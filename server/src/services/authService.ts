import { createHash, randomBytes } from 'crypto'
import { prisma } from '../lib/prisma.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
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

export async function registerUser(
  input: {
    email: string
    password: string
    displayName?: string
  },
  meta?: { ip?: string }
) {
  const sys = await getSystemConfig()
  if (!sys.registrationOpen) {
    return { success: false as const, message: '当前暂未开放注册。' }
  }
  const email = normalizeEmail(input.email)
  if (!EMAIL_RE.test(email)) {
    return { success: false as const, message: '请输入有效的邮箱地址。' }
  }
  if (input.password.length < 6) {
    return { success: false as const, message: '密码至少 6 位。' }
  }

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    return { success: false as const, message: '该邮箱已注册，请直接登录。' }
  }

  const displayName = input.displayName?.trim() || email.split('@')[0] || 'Petory 用户'
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(input.password),
      displayName
    }
  })
  await Promise.all([ensureQuota(user), ensureChatQuota(user)])
  await logUserLogin({ userId: user.id, email: user.email, ip: meta?.ip })

  return issueUserSession(user)
}

export async function loginUser(
  input: { email: string; password: string },
  meta?: { ip?: string }
) {
  const email = normalizeEmail(input.email)
  if (!EMAIL_RE.test(email)) {
    return { success: false as const, message: '请输入有效的邮箱地址。' }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { success: false as const, message: '账号不存在，请先注册。' }
  }
  if (user.status !== 'active') {
    return { success: false as const, message: '账号已被禁用。' }
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    await logUserLogin({ userId: user.id, email: user.email, ip: meta?.ip, success: false })
    return { success: false as const, message: '邮箱或密码不正确。' }
  }

  const touched = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  })
  const updated = await resolveUserSubscription(touched)
  await Promise.all([ensureQuota(updated), ensureChatQuota(updated)])
  await logUserLogin({ userId: updated.id, email: updated.email, ip: meta?.ip })

  return issueUserSession(updated)
}

export async function loginAdmin(
  input: { email: string; password: string },
  meta?: { ip?: string }
) {
  const email = normalizeEmail(input.email)
  const admin = await prisma.adminUser.findUnique({ where: { email } })
  if (!admin || admin.status !== 'active') {
    return { success: false as const, message: '管理员账号或密码不正确。' }
  }
  if (!(await verifyPassword(input.password, admin.passwordHash))) {
    return { success: false as const, message: '管理员账号或密码不正确。' }
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() }
  })

  await logAdminAction({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'admin_login',
    detail: meta?.ip ? `ip=${meta.ip}` : undefined
  })

  const token = signToken({ sub: admin.id, role: 'admin', email: admin.email })
  return {
    success: true as const,
    accessToken: token,
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
