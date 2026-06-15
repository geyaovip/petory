import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import type { ReferenceMode } from '../../../src/shared/generation/reference'
import type { PetPoseType, PetStyleType } from '../../../src/shared/types/pet'
import type { ServerBatchResponse, ServerJobResponse } from '../../../src/shared/types/api'
import { ApiError, apiFetch } from '../api/client'
import { getLocalDeviceId } from '../api/deviceId'
import { applyQuotaFromResponse } from '../api/remoteQuotaStore'
import { prepareReferenceFromPath } from './prepareReference'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 800

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.webp') return 'image/webp'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  return 'image/png'
}

async function imageToBlob(
  imagePath: string,
  referenceMode: ReferenceMode
): Promise<{ blob: Blob; filename: string }> {
  const prepared = await prepareReferenceFromPath(imagePath, referenceMode)
  const ext = prepared.mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const arrayBuffer = prepared.buffer.buffer.slice(
    prepared.buffer.byteOffset,
    prepared.buffer.byteOffset + prepared.buffer.byteLength
  ) as ArrayBuffer
  const blob = new Blob(
    [arrayBuffer],
    { type: prepared.mimeType }
  )
  console.info(
    `[petory] remote upload reference: ${imagePath} (source=${prepared.sourceBytes}B → prepared=${prepared.preparedBytes}B, mode=${referenceMode})`
  )
  return { blob, filename: `reference.${ext}` }
}

async function buildFormData(input: {
  imagePath: string
  referenceMode: ReferenceMode
  styleType: PetStyleType
  deviceId: string
  poses?: PetPoseType[]
  pose?: PetPoseType
}): Promise<FormData> {
  const form = new FormData()
  const { blob, filename } = await imageToBlob(input.imagePath, input.referenceMode)
  form.append('image', blob, filename)
  form.append('styleType', input.styleType)
  form.append('deviceId', input.deviceId)
  if (input.poses) form.append('poses', JSON.stringify(input.poses))
  if (input.pose) form.append('pose', input.pose)
  return form
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Business / config failures must not spawn duplicate generation batches on retry. */
const NON_RETRYABLE_CODES = new Set([
  'GENERATION_FAILED',
  'IMAGE_NOT_CONFIGURED',
  'QUOTA_EXCEEDED',
  'USER_DISABLED',
  'UPLOAD_INVALID',
  'POSE_LOCKED',
  'POSE_INVALID',
  'DEVICE_FLAGGED',
  'API_NOT_CONFIGURED',
  'AUTH_EXPIRED',
  'SERVICE_DISABLED',
  'RATE_LIMIT'
])

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.code && NON_RETRYABLE_CODES.has(error.code)) return false
  if (error.status === 0 || error.status === 408 || error.status === 429) return true
  return error.status === 502 || error.status === 503 || error.status === 504
}

async function withRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      if (attempt >= MAX_RETRIES || !isRetryableError(error)) {
        throw error
      }
      console.warn(`[petory] ${label} failed (attempt ${attempt + 1}), retrying…`, error)
      await sleep(RETRY_DELAY_MS * (attempt + 1))
    }
  }
  throw lastError
}

export async function consumeRemoteGenerationQuota(): Promise<void> {
  const data = await apiFetch<{ quota?: ServerBatchResponse['quota'] }>('/api/generation/consume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: getLocalDeviceId() })
  })
  if (data.quota) applyQuotaFromResponse({ quota: data.quota })
}

export async function logLocalGenerationBatch(input: {
  styleType: PetStyleType
  poses: PetPoseType[]
  clientPetId: string
  posePaths: Partial<Record<PetPoseType, string>>
}): Promise<void> {
  try {
    const form = new FormData()
    form.append('deviceId', getLocalDeviceId())
    form.append('styleType', input.styleType)
    form.append('poses', JSON.stringify(input.poses))
    form.append('clientPetId', input.clientPetId)
    for (const pose of input.poses) {
      const posePath = input.posePaths[pose]
      if (!posePath || !fs.existsSync(posePath)) continue
      const preview = await sharp(posePath)
        .resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78, alphaQuality: 85 })
        .toBuffer()
      const arrayBuffer = preview.buffer.slice(
        preview.byteOffset,
        preview.byteOffset + preview.byteLength
      ) as ArrayBuffer
      form.append(
        `preview_${pose}`,
        new Blob([arrayBuffer], { type: 'image/webp' }),
        `${pose}.webp`
      )
    }
    await apiFetch('/api/generation/log-local-batch', {
      method: 'POST',
      body: form
    })
  } catch (error) {
    console.warn('[petory] failed to log local generation batch for admin:', error)
  }
}

export async function requestGenerationBatch(input: {
  imagePath: string
  referenceMode: ReferenceMode
  styleType: PetStyleType
  poses?: PetPoseType[]
}): Promise<ServerBatchResponse> {
  const form = await buildFormData({
    imagePath: input.imagePath,
    referenceMode: input.referenceMode,
    styleType: input.styleType,
    deviceId: getLocalDeviceId(),
    poses: input.poses
  })
  const data = await withRetry('generation batch', () =>
    apiFetch<ServerBatchResponse>('/api/generation/batch', {
      method: 'POST',
      body: form
    })
  )
  if (data.quota) applyQuotaFromResponse({ quota: data.quota })
  return data
}

export async function requestPoseCompletion(input: {
  imagePath: string
  referenceMode: ReferenceMode
  styleType: PetStyleType
  poses: PetPoseType[]
}): Promise<ServerBatchResponse> {
  const form = await buildFormData({
    imagePath: input.imagePath,
    referenceMode: input.referenceMode,
    styleType: input.styleType,
    deviceId: getLocalDeviceId(),
    poses: input.poses
  })
  const data = await withRetry('pose completion', () =>
    apiFetch<ServerBatchResponse>('/api/generation/complete-poses', {
      method: 'POST',
      body: form
    })
  )
  if (data.quota) applyQuotaFromResponse({ quota: data.quota })
  return data
}

export async function requestPoseRegeneration(input: {
  imagePath: string
  referenceMode: ReferenceMode
  styleType: PetStyleType
  pose: PetPoseType
}): Promise<ServerJobResponse> {
  const form = await buildFormData({
    imagePath: input.imagePath,
    referenceMode: input.referenceMode,
    styleType: input.styleType,
    deviceId: getLocalDeviceId(),
    pose: input.pose
  })
  const data = await withRetry('pose regeneration', () =>
    apiFetch<ServerJobResponse>('/api/generation/regenerate-pose', {
      method: 'POST',
      body: form
    })
  )
  if (data.quota) applyQuotaFromResponse({ quota: data.quota })
  return data
}

export async function downloadImage(url: string, targetPath: string): Promise<void> {
  await withRetry('image download', async () => {
    const response = await fetch(url)
    if (!response.ok) {
      const err = new Error(`下载生成图失败：HTTP ${response.status}`)
      Object.assign(err, { status: response.status })
      throw err
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, buffer)
  })
}
