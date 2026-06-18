import type { User } from '@prisma/client'
import { createHash } from 'node:crypto'
import {
  seedFromString,
  sortPosesIdleFirst,
  type ReferenceMode
} from '../../../src/shared/generation/reference.js'
import { PET_POSE_LABELS } from '../../../src/shared/poses.js'
import type { PetPoseType, PetStyleType } from '../../../src/shared/types/pet.js'
import { prisma } from '../lib/prisma.js'
import { validatePoses } from './entitlementService.js'
import { generateImage, assertImageApiConfigured } from './seedreamService.js'
import { canConsumeGeneration, consumeGeneration } from './quotaService.js'
import { assertGenerationEnabled } from './systemConfigService.js'
import {
  mimeToExt,
  type BatchJobType
} from './generationService.js'
import { assertDeviceAllowed } from './deviceGuardService.js'
import { assertCanCreateCustomPet, assertCanRegenerateCustomPet, markCustomPetCreated } from './customPetService.js'
import { saveBatchInputImage, saveBatchPoseOutput, toPublicUrl } from './storageService.js'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

export type BatchInput = {
  imageBuffer: Buffer
  mimeType: string
  styleType: PetStyleType
  poses: PetPoseType[]
  deviceId?: string
  jobType: BatchJobType
}

function validateImage(mimeType: string) {
  if (!ALLOWED_MIME.has(mimeType)) {
    return { ok: false as const, code: 'UPLOAD_INVALID', message: '不支持的图片格式。' }
  }
  return { ok: true as const }
}

function fail(check: { code: string; message: string }) {
  return { success: false as const, code: check.code, message: check.message }
}

export function serializeBatch(batch: {
  id: string
  jobType: string
  styleType: string
  status: string
  posesTotal: number
  posesSucceeded: number
  createdAt: Date
  updatedAt: Date
  inputImagePath?: string | null
  jobs: Array<{
    id: string
    pose: string
    status: string
    outputImagePath: string | null
    errorMessage: string | null
    durationMs: number | null
  }>
}) {
  return {
    batchId: batch.id,
    jobType: batch.jobType,
    styleType: batch.styleType,
    status: batch.status,
    posesTotal: batch.posesTotal,
    posesSucceeded: batch.posesSucceeded,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    inputImageUrl: batch.inputImagePath ? toPublicUrl(batch.inputImagePath) : null,
    jobs: batch.jobs.map((job) => ({
      jobId: job.id,
      pose: job.pose,
      poseLabel: PET_POSE_LABELS[job.pose as PetPoseType] ?? job.pose,
      status: job.status,
      rawOutputUrl: job.outputImagePath ? toPublicUrl(job.outputImagePath) : null,
      errorMessage: job.errorMessage,
      durationMs: job.durationMs
    }))
  }
}

export async function runGenerationBatch(user: User, input: BatchInput) {
  const serviceCheck = await assertGenerationEnabled()
  if (!serviceCheck.ok) return fail(serviceCheck)

  if (user.status !== 'active') {
    return { success: false as const, code: 'USER_DISABLED', message: '账号已被禁用。' }
  }

  const deviceCheck = await assertDeviceAllowed(user.id, input.deviceId)
  if (!deviceCheck.ok) return fail(deviceCheck)

  const imageCheck = validateImage(input.mimeType)
  if (!imageCheck.ok) return fail(imageCheck)

  const poseCheck = validatePoses(user, input.poses)
  if (!poseCheck.ok) return fail(poseCheck)

  if (input.jobType === 'full_batch') {
    const slotCheck = await assertCanCreateCustomPet(user)
    if (!slotCheck.ok) return fail(slotCheck)
  } else if (input.jobType === 'pose_completion') {
    const regenCheck = await assertCanRegenerateCustomPet(user)
    if (!regenCheck.ok) return fail(regenCheck)
  }

  const imageApiCheck = assertImageApiConfigured()
  if (!imageApiCheck.ok) {
    return {
      success: false as const,
      code: imageApiCheck.code,
      message: imageApiCheck.message
    }
  }

  const deductQuota = input.jobType === 'full_batch'
  if (deductQuota) {
    const quotaCheck = await canConsumeGeneration(user)
    if (!quotaCheck.ok) return fail(quotaCheck)
  }

  const batch = await prisma.generationBatch.create({
    data: {
      userId: user.id,
      deviceId: input.deviceId,
      jobType: input.jobType,
      styleType: input.styleType,
      status: 'processing',
      posesTotal: poseCheck.poses.length
    }
  })

  const ext = mimeToExt(input.mimeType)
  const inputPath = saveBatchInputImage(user.id, batch.id, input.imageBuffer, ext)
  await prisma.generationBatch.update({
    where: { id: batch.id },
    data: { inputImagePath: inputPath }
  })

  const jobRecords = await Promise.all(
    poseCheck.poses.map((pose) =>
      prisma.generationJob.create({
        data: {
          userId: user.id,
          batchId: batch.id,
          deviceId: input.deviceId,
          jobType: input.jobType,
          styleType: input.styleType,
          pose,
          status: 'processing',
          inputImagePath: inputPath
        }
      })
    )
  )

  let posesSucceeded = 0
  let idleSucceeded = false
  const poseOrder = new Map(
    sortPosesIdleFirst(poseCheck.poses).map((pose, index) => [pose, index])
  )
  const orderedJobs = [...jobRecords].sort(
    (a, b) =>
      (poseOrder.get(a.pose as PetPoseType) ?? 99) - (poseOrder.get(b.pose as PetPoseType) ?? 99)
  )

  let referenceBuffer = input.imageBuffer
  let referenceMode: ReferenceMode = 'upload'
  const generationSeed = seedFromString(
    createHash('sha256').update(input.imageBuffer).digest('hex')
  )

  for (const job of orderedJobs) {
    const started = Date.now()
    const usingUploadReference = referenceBuffer === input.imageBuffer
    console.info(
      `[petory] batch pose=${job.pose} reference=${usingUploadReference ? 'user_upload' : 'idle_anchor'} mode=${referenceMode}`
    )
    try {
      const { buffer, prompt } = await generateImage(
        referenceBuffer,
        input.styleType,
        job.pose as PetPoseType,
        {
          seed: generationSeed,
          referenceMode,
          mimeType: usingUploadReference ? input.mimeType : 'image/png'
        }
      )
      const outputPath = saveBatchPoseOutput(user.id, batch.id, job.pose as PetPoseType, buffer)
      const durationMs = Date.now() - started

      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'succeeded',
          outputImagePath: outputPath,
          prompt,
          durationMs
        }
      })
      posesSucceeded += 1
      if (job.pose === 'idle') {
        idleSucceeded = true
        referenceBuffer = buffer
        referenceMode = 'anchor'
      }
    } catch (error) {
      const durationMs = Date.now() - started
      const message = error instanceof Error ? error.message : '生成失败'
      const errorCode = message.startsWith('IMAGE_') ? message.split(':')[0]! : 'GENERATION_FAILED'
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorCode,
          errorMessage: message,
          durationMs
        }
      })
    }
  }

  let batchStatus = 'succeeded'
  if (posesSucceeded === 0) batchStatus = 'failed'
  else if (posesSucceeded < poseCheck.poses.length) batchStatus = 'partial'

  if (deductQuota) {
    if (input.jobType === 'full_batch' && idleSucceeded) {
      await consumeGeneration(user.id, `batch ${batch.id}`)
      await markCustomPetCreated(user.id)
    }
  }

  if (input.jobType === 'full_batch' && !idleSucceeded) {
    batchStatus = 'failed'
  }

  await prisma.generationBatch.update({
    where: { id: batch.id },
    data: { status: batchStatus, posesSucceeded }
  })

  const full = await prisma.generationBatch.findUniqueOrThrow({
    where: { id: batch.id },
    include: { jobs: { orderBy: { createdAt: 'asc' } } }
  })

  if (deductQuota && batchStatus === 'failed') {
    return {
      success: false as const,
      code: 'GENERATION_FAILED',
      message: '生成失败，待机姿势未成功。',
      batch: serializeBatch(full)
    }
  }

  if (!deductQuota && posesSucceeded === 0) {
    return {
      success: false as const,
      code: 'GENERATION_FAILED',
      message: '姿势补全失败，请稍后重试。',
      batch: serializeBatch(full)
    }
  }

  return { success: true as const, batch: serializeBatch(full) }
}

export async function getBatchForUser(userId: string, batchId: string) {
  const batch = await prisma.generationBatch.findFirst({
    where: { id: batchId, userId },
    include: { jobs: { orderBy: { createdAt: 'asc' } } }
  })
  if (!batch) return null
  return serializeBatch(batch)
}
