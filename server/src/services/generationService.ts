import type { User } from '@prisma/client'
import { createHash } from 'node:crypto'
import { seedFromString } from '../../../src/shared/generation/reference.js'
import type { PetPoseType, PetStyleType } from '../../../src/shared/types/pet.js'
import { prisma } from '../lib/prisma.js'
import { assertDeviceAllowed } from './deviceGuardService.js'
import { assertGenerationEnabled } from './systemConfigService.js'
import { generateImage, assertImageApiConfigured } from './seedreamService.js'
import {
  saveClientPosePreview,
  saveInputImage,
  saveOutputImage,
  toPublicUrl
} from './storageService.js'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

export type BatchJobType =
  | 'full_batch'
  | 'pose_completion'
  | 'single_pose_regen'
  | 'client_local'

export function mimeToExt(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

/** B1.0 兼容：单姿势重生成，不扣额度 */
export async function createSinglePoseRegen(
  user: User,
  input: {
    imageBuffer: Buffer
    mimeType: string
    styleType: PetStyleType
    pose: PetPoseType
    deviceId?: string
  }
) {
  const serviceCheck = await assertGenerationEnabled()
  if (!serviceCheck.ok) return serviceCheck

  if (user.status !== 'active') {
    return { success: false as const, code: 'USER_DISABLED', message: '账号已被禁用。' }
  }

  const deviceCheck = await assertDeviceAllowed(user.id, input.deviceId)
  if (!deviceCheck.ok) return deviceCheck

  if (!ALLOWED_MIME.has(input.mimeType)) {
    return { success: false as const, code: 'UPLOAD_INVALID', message: '不支持的图片格式。' }
  }

  const imageApiCheck = assertImageApiConfigured()
  if (!imageApiCheck.ok) {
    return {
      success: false as const,
      code: imageApiCheck.code,
      message: imageApiCheck.message
    }
  }

  const job = await prisma.generationJob.create({
    data: {
      userId: user.id,
      deviceId: input.deviceId,
      jobType: 'single_pose_regen',
      styleType: input.styleType,
      pose: input.pose,
      status: 'processing'
    }
  })

  const ext = mimeToExt(input.mimeType)
  const inputPath = saveInputImage(user.id, job.id, input.imageBuffer, ext)
  await prisma.generationJob.update({ where: { id: job.id }, data: { inputImagePath: inputPath } })

  const started = Date.now()
  try {
    const { buffer, prompt } = await generateImage(input.imageBuffer, input.styleType, input.pose, {
      seed: seedFromString(createHash('sha256').update(input.imageBuffer).digest('hex')),
      referenceMode: input.pose === 'idle' ? 'upload' : 'anchor',
      mimeType: input.mimeType
    })
    const outputPath = saveOutputImage(user.id, job.id, buffer)
    const durationMs = Date.now() - started

    const updated = await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'succeeded', outputImagePath: outputPath, prompt, durationMs }
    })
    return { success: true as const, job: serializeJob(updated) }
  } catch (error) {
    const durationMs = Date.now() - started
    const message = error instanceof Error ? error.message : '生成失败'
    const errorCode = message.startsWith('IMAGE_') ? message.split(':')[0]! : 'GENERATION_FAILED'
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'failed', errorCode, errorMessage: message, durationMs }
    })
    return {
      success: false as const,
      code: errorCode,
      message: message.includes('IMAGE_NOT_CONFIGURED')
        ? '服务端未配置图像生成 API Key。'
        : '生成失败，请稍后重试。',
      jobId: job.id
    }
  }
}

/** Client-side image generation: record a succeeded batch for admin visibility. */
export async function logClientLocalBatch(
  user: User,
  input: {
    deviceId?: string
    styleType: PetStyleType
    poses: PetPoseType[]
    clientPetId?: string
    previews?: Partial<Record<PetPoseType, Buffer>>
  }
) {
  const batch = await prisma.generationBatch.create({
    data: {
      userId: user.id,
      deviceId: input.deviceId,
      jobType: 'client_local',
      styleType: input.styleType,
      status: 'succeeded',
      posesTotal: input.poses.length,
      posesSucceeded: input.poses.length
    }
  })

  if (input.poses.length > 0) {
    await prisma.generationJob.createMany({
      data: input.poses.map((pose) => ({
        userId: user.id,
        batchId: batch.id,
        deviceId: input.deviceId,
        jobType: 'client_local',
        styleType: input.styleType,
        pose,
        status: 'succeeded',
        outputImagePath: input.previews?.[pose]
          ? saveClientPosePreview(user.id, batch.id, pose, input.previews[pose]!)
          : null,
        prompt: input.clientPetId ? `clientPetId=${input.clientPetId}` : null
      }))
    })
  }

  return batch
}

export function serializeJob(job: {
  id: string
  userId: string
  batchId?: string | null
  jobType: string
  styleType: string
  pose: string
  status: string
  inputImagePath: string | null
  outputImagePath: string | null
  errorCode: string | null
  errorMessage: string | null
  durationMs: number | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    jobId: job.id,
    batchId: job.batchId ?? null,
    jobType: job.jobType,
    status: job.status,
    styleType: job.styleType,
    pose: job.pose,
    inputImageUrl: job.inputImagePath ? toPublicUrl(job.inputImagePath) : null,
    rawOutputUrl: job.outputImagePath ? toPublicUrl(job.outputImagePath) : null,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    durationMs: job.durationMs,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  }
}
