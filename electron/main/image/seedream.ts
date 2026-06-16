import fs from 'fs'
import type { ReferenceMode } from '../../../src/shared/generation/reference'
import { shouldAttachPoseReference } from '../../../src/shared/generation/poseReference'
import { getStylePrompt } from '../../../src/shared/prompts/stylePrompts'
import type { PetVisualState } from '../../../src/shared/types/growth'
import type { PetStyleType } from '../../../src/shared/types/pet'
import { getArkApiKey } from '../apiKeys'
import { prepareReferenceFromPath } from './prepareReference'
import { getSamplePoseReferencePath } from './samplePoseReference'

interface SeedreamResponse {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { code?: string; message?: string }
}

export interface GeneratePetImageOptions {
  seed?: number
  referenceMode?: ReferenceMode
}

function getApiKey(): string {
  const key = getArkApiKey()
  if (!key) {
    throw new Error('ARK_API_KEY is not configured.')
  }
  return key
}

function getApiBase(): string {
  return process.env['ARK_API_BASE'] ?? 'https://ark.cn-beijing.volces.com/api/v3'
}

function getModel(): string {
  return process.env['ARK_IMAGE_MODEL'] ?? 'doubao-seedream-5-0-260128'
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

function buildImageInput(identityDataUrl: string, poseReferenceDataUrl?: string): string | string[] {
  return poseReferenceDataUrl ? [identityDataUrl, poseReferenceDataUrl] : identityDataUrl
}

export async function generatePetImage(
  referencePath: string,
  styleType: PetStyleType = 'petory',
  pose: PetVisualState = 'idle',
  options: GeneratePetImageOptions = {}
): Promise<Buffer> {
  const referenceMode = options.referenceMode ?? 'upload'
  const prepared = await prepareReferenceFromPath(referencePath, referenceMode)
  const identityDataUrl = toDataUrl(prepared.buffer, prepared.mimeType)
  const usePoseReference = shouldAttachPoseReference(referenceMode, pose)
  const poseReferencePath = usePoseReference ? getSamplePoseReferencePath(pose) : null
  const poseReferenceDataUrl = poseReferencePath
    ? toDataUrl(fs.readFileSync(poseReferencePath), 'image/png')
    : undefined
  const image = buildImageInput(identityDataUrl, poseReferenceDataUrl)
  const hasPoseReference = Boolean(poseReferenceDataUrl)

  console.info(
    `[petory] Seedream image reference: ${referencePath} (source=${prepared.sourceBytes}B -> prepared=${prepared.preparedBytes}B, ${prepared.mimeType}, mode=${referenceMode}, pose=${pose}, poseRef=${poseReferencePath ?? 'none'}, images=${hasPoseReference ? 2 : 1})`
  )

  const response = await fetch(`${getApiBase()}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`
    },
    body: JSON.stringify({
      model: getModel(),
      prompt: getStylePrompt(styleType, pose, referenceMode, hasPoseReference),
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
      `Seedream HTTP ${response.status}: ${json.error?.message ?? JSON.stringify(json)}`
    )
  }

  const base64 = json.data?.[0]?.b64_json
  if (base64) return Buffer.from(base64, 'base64')

  const imageUrl = json.data?.[0]?.url
  if (imageUrl) {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to download Seedream image: ${imageResponse.status}`)
    }
    return Buffer.from(await imageResponse.arrayBuffer())
  }

  throw new Error(`Seedream returned no image data: ${json.error?.message ?? 'unknown error'}`)
}
