import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { PetPoseType, PetStyleType } from '../../../src/shared/types/pet.js'
import { config } from '../config.js'
import { checkRateLimit } from '../lib/rateLimit.js'
import type { AuthVariables } from '../middleware/auth.js'
import { requireUser } from '../middleware/auth.js'
import { defaultPosesForUser, parsePosesJson } from '../services/entitlementService.js'
import { getBatchForUser, runGenerationBatch, serializeBatch } from '../services/batchService.js'
import { createSinglePoseRegen, logClientLocalBatch, serializeJob } from '../services/generationService.js'
import { canConsumeGeneration, consumeGeneration, getQuotaView } from '../services/quotaService.js'
import { assertCanCreateCustomPet } from '../services/customPetService.js'
import { assertDeviceAllowed } from '../services/deviceGuardService.js'
import { prisma } from '../lib/prisma.js'

const POSES = new Set(['idle', 'happy', 'sleep', 'focus', 'remind', 'angry'])

function errorStatus(code?: string): ContentfulStatusCode {
  if (code === 'QUOTA_EXCEEDED') return 402
  if (code === 'CUSTOM_PET_LIMIT') return 409
  if (code === 'DEVICE_FLAGGED') return 403
  if (code === 'RATE_LIMIT') return 429
  if (code === 'SERVICE_DISABLED') return 503
  if (code === 'IMAGE_NOT_CONFIGURED') return 503
  return 500
}

export const generationRoutes = new Hono<{ Variables: AuthVariables }>()

generationRoutes.use('*', requireUser)

function checkGenRateLimit(userId: string, ip: string) {
  if (!checkRateLimit(`gen:user:${userId}`, 3, 60_000)) {
    return { ok: false as const, status: 429 as const, message: '请求过于频繁，请稍后再试。' }
  }
  if (!checkRateLimit(`gen:ip:${ip}`, 20, 60_000)) {
    return { ok: false as const, status: 429 as const, message: '请求过于频繁，请稍后再试。' }
  }
  return { ok: true as const }
}

generationRoutes.get('/quota', async (c) => {
  const user = c.get('user')!
  return c.json(await getQuotaView(user))
})

/** Client-side MiniMax: deduct one generation quota after local image generation succeeds. */
generationRoutes.post('/consume', async (c) => {
  const user = c.get('user')!
  const body = await c.req.json<{ deviceId?: string }>().catch(() => ({ deviceId: undefined }))
  const deviceCheck = await assertDeviceAllowed(user.id, body.deviceId)
  if (!deviceCheck.ok) {
    return c.json({ success: false, code: deviceCheck.code, message: deviceCheck.message }, 403)
  }

  const quotaCheck = await canConsumeGeneration(user)
  if (!quotaCheck.ok) {
    return c.json({ success: false, code: quotaCheck.code, message: quotaCheck.message }, 402)
  }

  const slotCheck = await assertCanCreateCustomPet(user)
  if (!slotCheck.ok) {
    return c.json({ success: false, code: slotCheck.code, message: slotCheck.message }, 409)
  }

  await consumeGeneration(user.id, 'client_local_minimax')
  return c.json({ success: true, quota: await getQuotaView(user) })
})

/** Client-side MiniMax: log a succeeded batch after local generation (admin visibility). */
generationRoutes.post('/log-local-batch', async (c) => {
  const user = c.get('user')!
  const isJson = c.req.header('content-type')?.includes('application/json')
  const body: Record<string, unknown> = isJson
    ? await c.req.json<Record<string, unknown>>().catch(() => ({}))
    : (await c.req.parseBody()) as Record<string, unknown>
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : undefined

  const deviceCheck = await assertDeviceAllowed(user.id, deviceId)
  if (!deviceCheck.ok) {
    return c.json({ success: false, code: deviceCheck.code, message: deviceCheck.message }, 403)
  }

  const styleType: PetStyleType = 'petory'

  let parsedPoses: unknown = []
  if (Array.isArray(body.poses)) {
    parsedPoses = body.poses
  } else if (typeof body.poses === 'string') {
    try {
      parsedPoses = JSON.parse(body.poses)
    } catch {
      parsedPoses = []
    }
  }
  const poses = Array.isArray(parsedPoses)
    ? parsedPoses.filter(
        (pose): pose is PetPoseType => typeof pose === 'string' && POSES.has(pose)
      )
    : defaultPosesForUser(user)
  const previews: Partial<Record<PetPoseType, Buffer>> = {}
  for (const pose of poses) {
    const preview = body[`preview_${pose}`]
    if (!(preview instanceof File) || preview.type !== 'image/webp' || preview.size > 1024 * 1024) {
      continue
    }
    previews[pose] = Buffer.from(await preview.arrayBuffer())
  }

  const logged = await logClientLocalBatch(user, {
    deviceId,
    styleType,
    poses,
    clientPetId: typeof body.clientPetId === 'string' ? body.clientPetId : undefined,
    previews
  })
  if (!logged.ok) {
    return c.json({ success: false, code: logged.code, message: logged.message }, 409)
  }

  return c.json({ success: true })
})

generationRoutes.post('/batch', async (c) => {
  const user = c.get('user')!
  const ip = c.req.header('x-forwarded-for') ?? 'local'
  const rate = checkGenRateLimit(user.id, ip)
  if (!rate.ok) return c.json({ success: false, code: 'RATE_LIMIT', message: rate.message }, rate.status)

  const body = await c.req.parseBody()
  const image = body['image']
  const styleType: PetStyleType = 'petory'
  const deviceId = body['deviceId'] ? String(body['deviceId']) : undefined
  const poses = parsePosesJson(body['poses'] ? String(body['poses']) : undefined, user)

  if (!(image instanceof File)) return c.json({ success: false, message: '请上传图片。' }, 400)
  if (image.size > config.maxUploadBytes) {
    return c.json({ success: false, message: '图片超过 10MB 限制。' }, 400)
  }

  const buffer = Buffer.from(await image.arrayBuffer())
  const result = await runGenerationBatch(user, {
    imageBuffer: buffer,
    mimeType: image.type || 'image/png',
    styleType,
    poses,
    deviceId,
    jobType: 'full_batch'
  })

  const quota = await getQuotaView(user)
  if (!result.success) {
    return c.json({ ...result, quota }, errorStatus(result.code))
  }
  return c.json({ ...result.batch, quota })
})

generationRoutes.post('/complete-poses', async (c) => {
  const user = c.get('user')!
  const ip = c.req.header('x-forwarded-for') ?? 'local'
  const rate = checkGenRateLimit(user.id, ip)
  if (!rate.ok) return c.json({ success: false, code: 'RATE_LIMIT', message: rate.message }, rate.status)

  const body = await c.req.parseBody()
  const image = body['image']
  const styleType: PetStyleType = 'petory'
  const deviceId = body['deviceId'] ? String(body['deviceId']) : undefined
  const posesRaw = body['poses'] ? String(body['poses']) : '[]'
  let poses: PetPoseType[]
  try {
    poses = JSON.parse(posesRaw) as PetPoseType[]
  } catch {
    return c.json({ success: false, message: 'poses 格式无效。' }, 400)
  }

  if (!(image instanceof File)) return c.json({ success: false, message: '请上传图片。' }, 400)
  if (image.size > config.maxUploadBytes) {
    return c.json({ success: false, message: '图片超过 10MB 限制。' }, 400)
  }

  const buffer = Buffer.from(await image.arrayBuffer())
  const result = await runGenerationBatch(user, {
    imageBuffer: buffer,
    mimeType: image.type || 'image/png',
    styleType,
    poses,
    deviceId,
    jobType: 'pose_completion'
  })

  const quota = await getQuotaView(user)
  if (!result.success) return c.json({ ...result, quota }, errorStatus(result.code))
  return c.json({ ...result.batch, quota })
})

generationRoutes.post('/regenerate-pose', async (c) => {
  const user = c.get('user')!
  const ip = c.req.header('x-forwarded-for') ?? 'local'
  const rate = checkGenRateLimit(user.id, ip)
  if (!rate.ok) return c.json({ success: false, code: 'RATE_LIMIT', message: rate.message }, rate.status)

  const body = await c.req.parseBody()
  const image = body['image']
  const styleType: PetStyleType = 'petory'
  const pose = String(body['pose'] ?? 'idle')
  const deviceId = body['deviceId'] ? String(body['deviceId']) : undefined

  if (!(image instanceof File)) return c.json({ success: false, message: '请上传图片。' }, 400)
  if (!POSES.has(pose)) return c.json({ success: false, message: '无效的姿势类型。' }, 400)
  if (image.size > config.maxUploadBytes) {
    return c.json({ success: false, message: '图片超过 10MB 限制。' }, 400)
  }

  const buffer = Buffer.from(await image.arrayBuffer())
  const result = await createSinglePoseRegen(user, {
    imageBuffer: buffer,
    mimeType: image.type || 'image/png',
    styleType,
    pose: pose as PetPoseType,
    deviceId
  })

  const quota = await getQuotaView(user)
  if (!result.success) return c.json({ ...result, quota }, errorStatus(result.code))
  return c.json({ ...result.job, quota })
})

/** @deprecated B1.0 兼容：单姿势整批（扣 1 次额度） */
generationRoutes.post('/jobs', async (c) => {
  const user = c.get('user')!
  const ip = c.req.header('x-forwarded-for') ?? 'local'
  const rate = checkGenRateLimit(user.id, ip)
  if (!rate.ok) return c.json({ success: false, code: 'RATE_LIMIT', message: rate.message }, rate.status)

  const body = await c.req.parseBody()
  const image = body['image']
  const styleType: PetStyleType = 'petory'
  const pose = String(body['pose'] ?? 'idle')
  const deviceId = body['deviceId'] ? String(body['deviceId']) : undefined

  if (!(image instanceof File)) return c.json({ success: false, message: '请上传图片。' }, 400)
  if (!POSES.has(pose)) return c.json({ success: false, message: '无效的姿势类型。' }, 400)
  if (image.size > config.maxUploadBytes) {
    return c.json({ success: false, message: '图片超过 10MB 限制。' }, 400)
  }
  const buffer = Buffer.from(await image.arrayBuffer())

  const result = await runGenerationBatch(user, {
    imageBuffer: buffer,
    mimeType: image.type || 'image/png',
    styleType,
    poses: [pose as PetPoseType],
    deviceId,
    jobType: 'full_batch'
  })

  const quota = await getQuotaView(user)
  if (!result.success) {
    return c.json({ ...result, quota }, errorStatus(result.code))
  }
  const firstJob = result.batch.jobs[0]
  return c.json({ ...firstJob, batchId: result.batch.batchId, quota })
})

generationRoutes.get('/recoverable', async (c) => {
  const user = c.get('user')!
  const batches = await prisma.generationBatch.findMany({
    where: {
      userId: user.id,
      jobType: 'full_batch',
      status: 'succeeded',
      posesSucceeded: { gte: 1 }
    },
    include: { jobs: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  const quota = await getQuotaView(user)
  return c.json({
    batches: batches.map((batch) => serializeBatch(batch)),
    quota
  })
})

generationRoutes.get('/batch/:id', async (c) => {
  const user = c.get('user')!
  const batch = await getBatchForUser(user.id, c.req.param('id'))
  if (!batch) return c.json({ success: false, message: '批次不存在。' }, 404)
  const quota = await getQuotaView(user)
  return c.json({ ...batch, quota })
})

generationRoutes.get('/jobs/:id', async (c) => {
  const user = c.get('user')!
  const job = await prisma.generationJob.findFirst({
    where: { id: c.req.param('id'), userId: user.id }
  })
  if (!job) return c.json({ success: false, message: '任务不存在。' }, 404)
  const quota = await getQuotaView(user)
  return c.json({ ...serializeJob(job), quota })
})

generationRoutes.get('/poses', async (c) => {
  const user = c.get('user')!
  return c.json({ poses: defaultPosesForUser(user), plan: user.plan })
})
