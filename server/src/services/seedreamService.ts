import fs from 'fs'
import type { ReferenceMode } from '../../../src/shared/generation/reference.js'
import { getStylePrompt } from '../../../src/shared/prompts/stylePrompts.js'
import type { PetPoseType, PetStyleType } from '../../../src/shared/types/pet.js'
import { config } from '../config.js'
import { getSamplePoseReferencePath } from '../lib/samplePoseReference.js'

interface SeedreamResponse {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { code?: string; message?: string }
}

export interface GenerateImageOptions {
  seed?: number
  referenceMode?: ReferenceMode
  mimeType?: string
}

function toDataUrl(buffer: Buffer, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function buildImageInput(identityDataUrl: string, poseReferenceDataUrl?: string): string | string[] {
  return poseReferenceDataUrl ? [identityDataUrl, poseReferenceDataUrl] : identityDataUrl
}

export function assertImageApiConfigured():
  | { ok: true }
  | { ok: false; code: 'IMAGE_NOT_CONFIGURED'; message: string } {
  if (config.arkApiKey) return { ok: true }
  return {
    ok: false,
    code: 'IMAGE_NOT_CONFIGURED',
    message: '服务端未配置图像生成 API Key（ARK_API_KEY）。'
  }
}

export async function generateImage(
  imageBuffer: Buffer,
  styleType: PetStyleType,
  pose: PetPoseType,
  options: GenerateImageOptions = {}
): Promise<{ buffer: Buffer; prompt: string }> {
  if (!config.arkApiKey) throw new Error('IMAGE_NOT_CONFIGURED')

  const referenceMode = options.referenceMode ?? 'upload'
  const poseReferencePath = getSamplePoseReferencePath(pose)
  const poseReferenceDataUrl = poseReferencePath
    ? toDataUrl(fs.readFileSync(poseReferencePath), 'image/png')
    : undefined
  const hasPoseReference = Boolean(poseReferenceDataUrl)
  const prompt = getStylePrompt(styleType, pose, referenceMode, hasPoseReference)
  const identityDataUrl = toDataUrl(imageBuffer, options.mimeType ?? 'image/png')
  const image = buildImageInput(identityDataUrl, poseReferenceDataUrl)

  console.info(
    `[petory] Seedream pose=${pose} mode=${referenceMode} poseRef=${poseReferencePath ?? 'none'} images=${hasPoseReference ? 2 : 1}`
  )

  const response = await fetch(`${config.arkApiBase}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.arkApiKey}`
    },
    body: JSON.stringify({
      model: config.arkImageModel,
      prompt,
      image,
      sequential_image_generation: 'disabled',
      size: '2K',
      output_format: 'png',
      response_format: 'b64_json',
      watermark: false,
      ...(options.seed !== undefined ? { seed: options.seed } : {})
    })
  })

  const json = (await response.json()) as SeedreamResponse
  if (!response.ok) {
    throw new Error(
      `IMAGE_HTTP_${response.status}: ${json.error?.message ?? JSON.stringify(json)}`
    )
  }

  const base64 = json.data?.[0]?.b64_json
  if (base64) return { buffer: Buffer.from(base64, 'base64'), prompt }

  const imageUrl = json.data?.[0]?.url
  if (imageUrl) {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) throw new Error(`IMAGE_DOWNLOAD_${imageResponse.status}`)
    return { buffer: Buffer.from(await imageResponse.arrayBuffer()), prompt }
  }

  throw new Error(`IMAGE_NO_DATA: ${json.error?.message ?? 'unknown error'}`)
}
