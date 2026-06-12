import type { ReferenceMode } from '../../../src/shared/generation/reference.js'
import { getStylePrompt } from '../../../src/shared/prompts/stylePrompts.js'
import type { PetPoseType, PetStyleType } from '../../../src/shared/types/pet.js'
import { config } from '../config.js'

interface MiniMaxImageResponse {
  base_resp?: { status_code: number; status_msg: string }
  data?: { image_base64?: string[]; image_urls?: string[] }
}

export interface GenerateImageOptions {
  seed?: number
  referenceMode?: ReferenceMode
  mimeType?: string
}

function toDataUrl(buffer: Buffer, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

export async function generateImage(
  imageBuffer: Buffer,
  styleType: PetStyleType,
  pose: PetPoseType,
  options: GenerateImageOptions = {}
): Promise<{ buffer: Buffer; prompt: string }> {
  if (!config.minimaxApiKey) {
    throw new Error('MINIMAX_NOT_CONFIGURED')
  }

  const referenceMode = options.referenceMode ?? 'upload'
  const prompt = getStylePrompt(styleType, pose, referenceMode)
  const mimeType = options.mimeType ?? 'image/png'
  const dataUrl = toDataUrl(imageBuffer, mimeType)

  const body: Record<string, unknown> = {
    model: 'image-01',
    prompt,
    aspect_ratio: '3:4',
    response_format: 'base64',
    n: 1,
    // Upload references are identity-critical; prompt rewriting can change the subject.
    prompt_optimizer: referenceMode === 'anchor',
    subject_reference: [{ type: 'character', image_file: dataUrl }]
  }

  if (options.seed !== undefined) {
    body.seed = options.seed
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.minimaxApiKey}`
  }
  if (config.minimaxGroupId) headers['Group-Id'] = config.minimaxGroupId

  const url = new URL(`${config.minimaxApiBase}/v1/image_generation`)
  if (config.minimaxGroupId) url.searchParams.set('GroupId', config.minimaxGroupId)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`MINIMAX_HTTP_${response.status}: ${text}`)
  }

  const json = (await response.json()) as MiniMaxImageResponse
  const statusCode = json.base_resp?.status_code ?? -1
  if (statusCode !== 0) {
    throw new Error(`MINIMAX_ERROR_${statusCode}: ${json.base_resp?.status_msg ?? 'unknown'}`)
  }

  const base64 = json.data?.image_base64?.[0]
  if (base64) {
    return { buffer: Buffer.from(base64, 'base64'), prompt }
  }

  const imageUrl = json.data?.image_urls?.[0]
  if (imageUrl) {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`MINIMAX_DOWNLOAD_${imageResponse.status}`)
    }
    return { buffer: Buffer.from(await imageResponse.arrayBuffer()), prompt }
  }

  throw new Error('MINIMAX_NO_IMAGE')
}
