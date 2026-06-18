import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth.js'
import { requireAdmin, requireAdminWrite } from '../middleware/auth.js'
import { logAdminAction } from '../services/auditService.js'
import { grantQuota } from '../services/quotaService.js'
import { serializeJob } from '../services/generationService.js'
import { serializeBatch } from '../services/batchService.js'
import { prisma } from '../lib/prisma.js'
import { getChatStatsForUser } from '../services/chatService.js'
import { getEnhancedDashboard } from '../services/dashboardService.js'
import {
  getSystemConfig,
  updateSystemConfig,
  type SystemConfigValues
} from '../services/systemConfigService.js'
import { parsePagination, prismaListArgs, toPaginationMeta } from '../lib/pagination.js'

export const adminRoutes = new Hono<{ Variables: AuthVariables }>()

adminRoutes.use('*', requireAdmin)

adminRoutes.get('/me', async (c) => {
  const admin = c.get('admin')!
  return c.json({ id: admin.id, email: admin.email, role: admin.role })
})

adminRoutes.get('/dashboard', async (c) => {
  return c.json(await getEnhancedDashboard())
})

adminRoutes.get('/system/config', async (c) => {
  return c.json({ config: await getSystemConfig() })
})

adminRoutes.patch('/system/config', requireAdminWrite, async (c) => {
  const admin = c.get('admin')!
  const body = await c.req.json<Partial<SystemConfigValues>>().catch(() => ({}))
  let next
  try {
    next = await updateSystemConfig(body, admin.id)
  } catch (error) {
    return c.json(
      { success: false, message: error instanceof Error ? error.message : '配置无效。' },
      400
    )
  }
  await logAdminAction({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'update_system_config',
    detail: JSON.stringify(body)
  })
  return c.json({ success: true, config: next })
})

adminRoutes.get('/audit-logs', async (c) => {
  const query = parsePagination(c)
  const [total, logs] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      ...prismaListArgs(query)
    })
  ])
  return c.json({
    logs: logs.map((log) => ({
      id: log.id,
      adminEmail: log.adminEmail,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      detail: log.detail,
      createdAt: log.createdAt.toISOString()
    })),
    pagination: toPaginationMeta(total, query)
  })
})

adminRoutes.get('/login-logs', async (c) => {
  const query = parsePagination(c)
  const [total, logs] = await Promise.all([
    prisma.userLoginLog.count(),
    prisma.userLoginLog.findMany({
      orderBy: { createdAt: 'desc' },
      ...prismaListArgs(query)
    })
  ])
  return c.json({
    logs: logs.map((log) => ({
      id: log.id,
      email: log.email,
      ip: log.ip,
      success: log.success,
      createdAt: log.createdAt.toISOString()
    })),
    pagination: toPaginationMeta(total, query)
  })
})

adminRoutes.get('/devices', async (c) => {
  const flagged = c.req.query('flagged')
  const where = flagged === 'true' ? { flagged: true } : undefined
  const query = parsePagination(c)
  const [total, devices] = await Promise.all([
    prisma.device.count({ where }),
    prisma.device.findMany({
      where,
      orderBy: { lastActiveAt: 'desc' },
      ...prismaListArgs(query),
      include: { user: { select: { email: true, displayName: true } } }
    })
  ])
  return c.json({
    devices: devices.map((d) => ({
      id: d.id,
      userId: d.userId,
      userEmail: d.user.email,
      userName: d.user.displayName,
      localDeviceId: d.localDeviceId,
      deviceName: d.deviceName,
      os: d.os,
      osVersion: d.osVersion,
      appVersion: d.appVersion,
      flagged: d.flagged,
      lastActiveAt: d.lastActiveAt.toISOString(),
      createdAt: d.createdAt.toISOString()
    })),
    pagination: toPaginationMeta(total, query)
  })
})

adminRoutes.post('/devices/:id/flag', requireAdminWrite, async (c) => {
  const admin = c.get('admin')!
  const body = await c.req.json<{ flagged?: boolean }>()
  const device = await prisma.device.findUnique({ where: { id: c.req.param('id') } })
  if (!device) return c.json({ success: false, message: '设备不存在。' }, 404)

  const flagged = body.flagged ?? !device.flagged
  await prisma.device.update({
    where: { id: device.id },
    data: { flagged }
  })

  await logAdminAction({
    adminId: admin.id,
    adminEmail: admin.email,
    action: flagged ? 'flag_device' : 'unflag_device',
    targetType: 'device',
    targetId: device.id
  })

  return c.json({ success: true, flagged })
})

adminRoutes.get('/users', async (c) => {
  const q = c.req.query('q')?.trim()
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { displayName: { contains: q, mode: 'insensitive' as const } }
        ]
      }
    : undefined
  const query = parsePagination(c)
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...prismaListArgs(query),
      include: { quota: true, chatQuota: true }
    })
  ])

  return c.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      plan: u.plan,
      proExpiresAt: u.proExpiresAt?.toISOString() ?? null,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      genUsedToday: u.quota?.usedToday ?? 0,
      genTotalUsed: u.quota?.totalUsed ?? 0,
      chatUsedToday: u.chatQuota?.usedToday ?? 0,
      chatTotalUsed: u.chatQuota?.totalUsed ?? 0
    })),
    pagination: toPaginationMeta(total, query)
  })
})

adminRoutes.get('/users/:id', async (c) => {
  const user = await prisma.user.findUnique({
    where: { id: c.req.param('id') },
    include: {
      devices: true,
      quota: true,
      chatQuota: true,
      jobs: { orderBy: { createdAt: 'desc' }, take: 20 },
      chatLogs: { orderBy: { createdAt: 'desc' }, take: 20 }
    }
  })
  if (!user) return c.json({ success: false, message: '用户不存在。' }, 404)

  const chatStats = await getChatStatsForUser(user.id)

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      status: user.status,
      proExpiresAt: user.proExpiresAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      quota: user.quota,
      chatQuota: user.chatQuota,
      chatStats
    },
    devices: user.devices,
    jobs: user.jobs.map(serializeJob),
    recentChats: user.chatLogs.map((log) => ({
      id: log.id,
      status: log.status,
      petName: log.petName,
      personality: log.personality,
      inputChars: log.inputChars,
      outputChars: log.outputChars,
      durationMs: log.durationMs,
      errorCode: log.errorCode,
      createdAt: log.createdAt.toISOString()
    }))
  })
})

adminRoutes.post('/users/:id/disable', requireAdminWrite, async (c) => {
  const admin = c.get('admin')!
  const userId = c.req.param('id')!
  await prisma.user.update({
    where: { id: userId },
    data: { status: 'disabled' }
  })
  await logAdminAction({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'disable_user',
    targetType: 'user',
    targetId: userId
  })
  return c.json({ success: true })
})

adminRoutes.post('/users/:id/enable', requireAdminWrite, async (c) => {
  const admin = c.get('admin')!
  const userId = c.req.param('id')!
  await prisma.user.update({
    where: { id: userId },
    data: { status: 'active' }
  })
  await logAdminAction({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'enable_user',
    targetType: 'user',
    targetId: userId
  })
  return c.json({ success: true })
})

adminRoutes.post('/users/:id/quota/grant', requireAdminWrite, async (c) => {
  const admin = c.get('admin')!
  const body = (await c.req.json<{ amount?: number; reason?: string }>().catch(() => ({}))) as {
    amount?: number
    reason?: string
  }
  const amount = Number(body.amount ?? 0)
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1000) {
    return c.json({ success: false, message: 'amount 必须是 1 到 1000 之间的整数。' }, 400)
  }
  const userId = c.req.param('id')!
  await grantQuota(userId, amount, admin.id, body.reason ?? 'manual grant')
  await logAdminAction({
    adminId: admin.id,
    adminEmail: admin.email,
    action: 'grant_quota',
    targetType: 'user',
    targetId: userId,
    detail: `amount=${amount}`
  })
  return c.json({ success: true })
})

adminRoutes.get('/generation/jobs', async (c) => {
  const status = c.req.query('status')
  const where = status ? { status } : undefined
  const query = parsePagination(c)
  const [total, jobs] = await Promise.all([
    prisma.generationJob.count({ where }),
    prisma.generationJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...prismaListArgs(query),
      include: { user: { select: { email: true, displayName: true } } }
    })
  ])
  return c.json({
    jobs: jobs.map((job) => ({
      ...serializeJob(job),
      userEmail: job.user.email,
      userName: job.user.displayName
    })),
    pagination: toPaginationMeta(total, query)
  })
})

adminRoutes.get('/generation/jobs/:id', async (c) => {
  const job = await prisma.generationJob.findUnique({
    where: { id: c.req.param('id') },
    include: { user: true }
  })
  if (!job) return c.json({ success: false, message: '任务不存在。' }, 404)
  return c.json({
    job: serializeJob(job),
    user: { id: job.user.id, email: job.user.email, displayName: job.user.displayName }
  })
})

adminRoutes.get('/generation/batches', async (c) => {
  const query = parsePagination(c)
  const [total, batches] = await Promise.all([
    prisma.generationBatch.count(),
    prisma.generationBatch.findMany({
      orderBy: { createdAt: 'desc' },
      ...prismaListArgs(query),
      include: {
        jobs: true,
        user: { select: { email: true, displayName: true } }
      }
    })
  ])
  return c.json({
    batches: batches.map((b) => ({
      ...serializeBatch(b),
      userEmail: b.user.email,
      userName: b.user.displayName
    })),
    pagination: toPaginationMeta(total, query)
  })
})

adminRoutes.get('/chat/logs', async (c) => {
  const query = parsePagination(c)
  const [total, logs] = await Promise.all([
    prisma.chatLog.count(),
    prisma.chatLog.findMany({
      orderBy: { createdAt: 'desc' },
      ...prismaListArgs(query),
      include: { user: { select: { email: true, displayName: true } } }
    })
  ])
  return c.json({
    logs: logs.map((log) => ({
      id: log.id,
      userEmail: log.user.email,
      userName: log.user.displayName,
      status: log.status,
      petName: log.petName,
      personality: log.personality,
      inputChars: log.inputChars,
      outputChars: log.outputChars,
      durationMs: log.durationMs,
      errorCode: log.errorCode,
      createdAt: log.createdAt.toISOString()
    })),
    pagination: toPaginationMeta(total, query)
  })
})
