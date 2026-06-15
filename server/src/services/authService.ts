import { createHash, randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { hashPassword } from '../lib/password.js'
import { signToken } from '../lib/jwt.js'
import { PLAN_LIMITS } from '../../../src/shared/entitlements.js'
import type { PlanTier } from '../../../src/shared/types/auth.js'
import { logAdminAction, logUserLogin } from './auditService.js'
import { resolveUserSubscription } from './subscriptionService.js'
import { ensureChatQuota } from './chatQuotaService.js'
import { ensureQuota } from './quotaService.js'
import { getPublicAppStatus, getSystemConfig } from './systemConfigService.js'
import { sendMagicLink } from './mailService.js'
import { config } from '../config.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000
const MAGIC_LINK_COOLDOWN_MS = 60 * 1000

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function hashMagicLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function issueUserSession(user: Parameters<typeof toPublicUser>[0]) {
  const token = signToken({ sub: user.id, role: 'user', email: user.email })
  return { success: true as const, accessToken: token, user: await toPublicUser(user) }
}

export async function requestMagicLink(input: { email: string }) {
  const email = normalizeEmail(input.email)
  if (!EMAIL_RE.test(email)) {
    return { success: false as const, message: '请输入有效的邮箱地址。' }
  }

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const sys = await getSystemConfig()
    if (!sys.registrationOpen) {
      return { success: false as const, message: '当前暂未开放新用户注册。' }
    }
    const displayName = email.split('@')[0] || 'Petory 用户'
    user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash: await hashPassword(randomBytes(32).toString('hex'))
      }
    })
    await Promise.all([ensureQuota(user), ensureChatQuota(user)])
  }
  if (user.status !== 'active') {
    return { success: false as const, message: '账号已被禁用。' }
  }

  const latestToken = await prisma.magicLinkToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  })
  if (latestToken && Date.now() - latestToken.createdAt.getTime() < MAGIC_LINK_COOLDOWN_MS) {
    return { success: false as const, message: '登录邮件已发送，请稍后再试。' }
  }

  await prisma.magicLinkToken.deleteMany({
    where: { userId: user.id, consumedAt: null }
  })
  const rawToken = randomBytes(32).toString('base64url')
  await prisma.magicLinkToken.create({
    data: {
      userId: user.id,
      tokenHash: hashMagicLinkToken(rawToken),
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS)
    }
  })

  const magicLinkUrl = `${config.publicBaseUrl}/auth/callback?token=${encodeURIComponent(rawToken)}`
  try {
    await sendMagicLink({
      to: email,
      magicLinkUrl,
      expiresInMinutes: Math.floor(MAGIC_LINK_TTL_MS / 60_000)
    })
  } catch (error) {
    await prisma.magicLinkToken.deleteMany({ where: { tokenHash: hashMagicLinkToken(rawToken) } })
    return {
      success: false as const,
      message: error instanceof Error ? error.message : '登录邮件发送失败，请稍后再试。'
    }
  }

  return { success: true as const, message: '登录链接已发送，请查收邮件。' }
}

export async function consumeMagicLink(rawToken: string, meta?: { ip?: string }) {
  const tokenHash = hashMagicLinkToken(rawToken.trim())
  const record = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  })
  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    return { success: false as const, message: '登录链接无效或已过期，请重新发送。' }
  }
  if (record.user.status !== 'active') {
    return { success: false as const, message: '账号已被禁用。' }
  }

  const consumed = await prisma.magicLinkToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() }
  })
  if (consumed.count !== 1) {
    return { success: false as const, message: '登录链接已使用，请重新发送。' }
  }

  const touched = await prisma.user.update({
    where: { id: record.userId },
    data: { lastLoginAt: new Date() }
  })
  const user = await resolveUserSubscription(touched)
  await Promise.all([ensureQuota(user), ensureChatQuota(user)])
  await logUserLogin({ userId: user.id, email: user.email, ip: meta?.ip })
  return issueUserSession(user)
}

export async function requestAdminMagicLink(input: { email: string }) {
  const email = normalizeEmail(input.email)
  if (!EMAIL_RE.test(email)) {
    return { success: false as const, message: '请输入有效的邮箱地址。' }
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } })
  // Keep this response generic so the endpoint cannot be used to enumerate admins.
  if (!admin || admin.status !== 'active') {
    return { success: true as const, message: '如果该邮箱已获授权，登录链接将发送到邮箱。' }
  }

  const latestToken = await prisma.adminMagicLinkToken.findFirst({
    where: { adminId: admin.id },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  })
  if (latestToken && Date.now() - latestToken.createdAt.getTime() < MAGIC_LINK_COOLDOWN_MS) {
    return { success: false as const, message: '登录邮件已发送，请稍后再试。' }
  }

  await prisma.adminMagicLinkToken.deleteMany({
    where: { adminId: admin.id, consumedAt: null }
  })
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashMagicLinkToken(rawToken)
  await prisma.adminMagicLinkToken.create({
    data: {
      adminId: admin.id,
      tokenHash,
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS)
    }
  })

  try {
    await sendMagicLink({
      to: email,
      magicLinkUrl: `${config.publicBaseUrl}/admin/auth/callback?token=${encodeURIComponent(rawToken)}`,
      expiresInMinutes: Math.floor(MAGIC_LINK_TTL_MS / 60_000),
      audience: 'admin'
    })
  } catch (error) {
    await prisma.adminMagicLinkToken.deleteMany({ where: { tokenHash } })
    return {
      success: false as const,
      message: error instanceof Error ? error.message : '登录邮件发送失败，请稍后再试。'
    }
  }

  return { success: true as const, message: '管理员登录链接已发送，请查收邮件。' }
}

export async function consumeAdminMagicLink(rawToken: string, meta?: { ip?: string }) {
  const tokenHash = hashMagicLinkToken(rawToken.trim())
  const record = await prisma.adminMagicLinkToken.findUnique({
    where: { tokenHash },
    include: { admin: true }
  })
  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    return { success: false as const, message: '登录链接无效或已过期，请重新发送。' }
  }
  if (record.admin.status !== 'active') {
    return { success: false as const, message: '管理员账号不可用。' }
  }

  const consumed = await prisma.adminMagicLinkToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() }
  })
  if (consumed.count !== 1) {
    return { success: false as const, message: '登录链接已使用，请重新发送。' }
  }

  const admin = await prisma.adminUser.update({
    where: { id: record.adminId },
    data: { lastLoginAt: new Date() }
  })
  await logAdminAction({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'admin_magic_link_login',
    detail: meta?.ip ? `ip=${meta.ip}` : undefined
  })
  return {
    success: true as const,
    accessToken: signToken({ sub: admin.id, role: 'admin', email: admin.email }),
    admin: { id: admin.id, email: admin.email, role: admin.role }
  }
}

export async function toPublicUser(user: {
  id: string
  email: string
  displayName: string
  plan: string
  status: string
  proExpiresAt: Date | null
  createdAt: Date
}) {
  const plan = user.plan as PlanTier
  const cfg = await getSystemConfig()
  const dynamic = getPublicAppStatus(cfg).limits[plan]
  const limits = {
    ...PLAN_LIMITS[plan],
    dailyGenerationLimit: dynamic.dailyGenerationLimit,
    dailyChatLimit: dynamic.dailyChatLimit
  }
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plan,
    status: user.status,
    proExpiresAt: user.proExpiresAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    limits
  }
}
