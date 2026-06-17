import fs from 'fs'
import path from 'path'
import { ERROR_MESSAGES } from '../../../src/shared/constants'
import type { ServerBatchJob } from '../../../src/shared/types/api'
import type {
  CompletePosesResult,
  GenerationFailure,
  GenerationResult,
  Pet,
  PetPoseAssets,
  PetPoseType
} from '../../../src/shared/types/pet'
import { ApiError } from '../api/client'
import { isUsingRemoteQuota } from '../api/remoteQuotaStore'
import { canGeneratePet } from '../auth/entitlementService'
import { ensureRemoteQuotaFresh } from '../api/remoteQuotaStore'
import { incrementGenerationUsage } from '../auth/usageStore'
import {
  broadcastGenerationPhase,
  broadcastGenerationProgress,
  broadcastPetsListChanged,
  buildProgressPayload,
  getMissingPosesForPet,
  getPoseOutputPath,
  getPosesToGenerate
} from '../poseService'
import type { ReferenceMode } from '../../../src/shared/generation/reference'
import { seedFromString, sortPosesIdleFirst } from '../../../src/shared/generation/reference'
import { getArkApiKey } from '../apiKeys'
import { ensurePetDirs, getPetById, updatePet } from '../petStore'
import { generatePetImage } from './seedream'
import { hasUploadReference, resolveUploadReferencePath } from './referencePath'
import { removeBackground } from './rembg'
import {
  consumeRemoteGenerationQuota,
  downloadImage,
  logLocalGenerationBatch,
  requestGenerationBatch,
  requestPoseCompletion,
  requestPoseRegeneration
} from './remoteGeneration'

function resolveAnchorReferencePath(pet: Pet, generatedDir: string): string | null {
  if (pet.imageMinimaxRawPath && fs.existsSync(pet.imageMinimaxRawPath)) {
    return pet.imageMinimaxRawPath
  }
  const idlePath = path.join(generatedDir, 'minimax_idle.png')
  return fs.existsSync(idlePath) ? idlePath : null
}

function resolveRemoteReferencePath(
  pet: Pet,
  poses: PetPoseType[],
  generatedDir: string
): string {
  const uploadReference = resolveUploadReferencePath(pet)
  if (!uploadReference) {
    throw new Error('upload_invalid')
  }
  if (poses.includes('idle')) {
    return uploadReference
  }
  return resolveAnchorReferencePath(pet, generatedDir) ?? uploadReference
}

function resolveRemoteReferenceMode(
  pet: Pet,
  poses: PetPoseType[],
  generatedDir: string
): ReferenceMode {
  if (poses.includes('idle')) return 'upload'
  return resolveAnchorReferencePath(pet, generatedDir) ? 'anchor' : 'upload'
}

function shouldUseRemoteGeneration(): boolean {
  return isUsingRemoteQuota() && !getArkApiKey()
}

async function processDownloadedPose(
  pet: Pet,
  petId: string,
  pose: PetPoseType,
  rawUrl: string,
  existingPaths: PetPoseAssets
): Promise<{ posePaths: PetPoseAssets; idleRawPath: string }> {
  const { generatedDir } = ensurePetDirs(petId)
  const posePaths: PetPoseAssets = { ...existingPaths }
  let idleRawPath = pet.imageMinimaxRawPath

  const minimaxRawPath = path.join(generatedDir, `minimax_${pose}.png`)
  const posePngPath = getPoseOutputPath(generatedDir, pose)

  await downloadImage(rawUrl, minimaxRawPath)
  try {
    await removeBackground(minimaxRawPath, posePngPath)
  } catch (error) {
    console.error(`[petory] rembg failed for pose ${pose}:`, error)
    if (pose === 'idle' && !posePaths.idle) {
      if (error instanceof Error && error.message === 'rembg_not_installed') {
        throw error
      }
      throw new Error('rembg_failed')
    }
    return { posePaths, idleRawPath }
  }

  posePaths[pose] = posePngPath
  if (pose === 'idle') {
    idleRawPath = minimaxRawPath
  }
  return { posePaths, idleRawPath }
}

async function processRemoteJobs(
  pet: Pet,
  petId: string,
  jobs: ServerBatchJob[],
  existingPaths: PetPoseAssets,
  progressOffset: number,
  progressTotal: number
): Promise<{ posePaths: PetPoseAssets; idleRawPath: string }> {
  let posePaths: PetPoseAssets = { ...existingPaths }
  let idleRawPath = pet.imageMinimaxRawPath
  let index = 0

  for (const job of jobs) {
    const pose = job.pose as PetPoseType
    index += 1
    broadcastGenerationProgress(
      buildProgressPayload(petId, pose, progressOffset + index, progressTotal)
    )

    if (job.status !== 'succeeded' || !job.rawOutputUrl) {
      if (pose === 'idle' && !posePaths.idle) {
        throw new Error('idle_generation_failed')
      }
      continue
    }

    const result = await processDownloadedPose(pet, petId, pose, job.rawOutputUrl, posePaths)
    posePaths = result.posePaths
    idleRawPath = result.idleRawPath
  }

  return { posePaths, idleRawPath }
}

async function generatePoseBatch(
  pet: Pet,
  petId: string,
  poses: PetPoseType[],
  existingPaths: PetPoseAssets,
  progressOffset: number,
  progressTotal: number
): Promise<{ posePaths: PetPoseAssets; idleRawPath: string }> {
  if (shouldUseRemoteGeneration()) {
    broadcastGenerationPhase(petId, 'upload', '上传照片', progressTotal)
    broadcastGenerationPhase(petId, 'remote', '云端生成', progressTotal)
    const { generatedDir } = ensurePetDirs(petId)
    const batch = await requestGenerationBatch({
      imagePath: resolveRemoteReferencePath(pet, poses, generatedDir),
      referenceMode: resolveRemoteReferenceMode(pet, poses, generatedDir),
      styleType: pet.styleType,
      poses
    })
    if (batch.success === false || !batch.jobs?.length) {
      throw mapBatchFailure(batch.message, batch.code)
    }
    if (batch.batchId) {
      updatePet(petId, { cloudBatchId: batch.batchId })
    }
    return processRemoteJobs(pet, petId, batch.jobs, existingPaths, progressOffset, progressTotal)
  }

  broadcastGenerationPhase(petId, 'local', '本机 Seedream 生成', progressTotal)

  const { generatedDir } = ensurePetDirs(petId)
  const posePaths: PetPoseAssets = { ...existingPaths }
  let idleRawPath = pet.imageMinimaxRawPath
  const orderedPoses = sortPosesIdleFirst(poses)
  const includesIdle = orderedPoses.includes('idle')
  const existingIdleRaw =
    pet.imageMinimaxRawPath && fs.existsSync(pet.imageMinimaxRawPath)
      ? pet.imageMinimaxRawPath
      : fs.existsSync(path.join(generatedDir, 'minimax_idle.png'))
        ? path.join(generatedDir, 'minimax_idle.png')
        : null

  const uploadReference = resolveUploadReferencePath(pet)
  if (!uploadReference) {
    throw new Error('upload_invalid')
  }

  let referencePath = uploadReference
  let referenceMode: ReferenceMode = 'upload'
  if (!includesIdle && existingIdleRaw) {
    referencePath = existingIdleRaw
    referenceMode = 'anchor'
  }

  for (let index = 0; index < orderedPoses.length; index += 1) {
    const pose = orderedPoses[index]
    broadcastGenerationProgress(
      buildProgressPayload(petId, pose, progressOffset + index + 1, progressTotal)
    )

    const minimaxRawPath = path.join(generatedDir, `minimax_${pose}.png`)
    const posePngPath = getPoseOutputPath(generatedDir, pose)

    console.info(
      `[petory] generating pose=${pose} reference=${referencePath} mode=${referenceMode}`
    )

    try {
      const generated = await generatePetImage(referencePath, pet.styleType, pose, {
        seed: seedFromString(pet.id),
        referenceMode
      })
      fs.writeFileSync(minimaxRawPath, generated)
      if (pose === 'idle') {
        idleRawPath = minimaxRawPath
        referencePath = minimaxRawPath
        referenceMode = 'anchor'
      }
    } catch (error) {
      console.error(`[petory] Seedream generation failed for pose ${pose}:`, error)
      if (pose === 'idle' && !posePaths.idle) {
        throw new Error('idle_generation_failed')
      }
      continue
    }

    try {
      await removeBackground(minimaxRawPath, posePngPath)
    } catch (error) {
      console.error(`[petory] rembg failed for pose ${pose}:`, error)
      if (pose === 'idle' && !posePaths.idle) {
        if (error instanceof Error && error.message === 'rembg_not_installed') {
          throw error
        }
        throw new Error('rembg_failed')
      }
      continue
    }

    posePaths[pose] = posePngPath
  }

  return { posePaths, idleRawPath }
}

function mapBatchFailure(message?: string, code?: string): Error {
  if (code === 'AUTH_EXPIRED') return new Error('auth_expired')
  if (code === 'SERVICE_DISABLED') return new Error('service_disabled')
  if (code === 'RATE_LIMIT') return new Error('rate_limit')
  if (code === 'NETWORK_ERROR') return new Error('network_error')
  if (message?.includes('额度')) return new Error(message)
  if (code === 'IMAGE_NOT_CONFIGURED') return new Error('image_not_configured')
  return new Error(message || 'generation_failed')
}

function mapApiErrorToFailure(error: ApiError): GenerationFailure {
  if (error.code === 'AUTH_EXPIRED' || error.status === 401) {
    return { success: false, code: 'auth_expired', message: ERROR_MESSAGES.auth_expired }
  }
  if (error.code === 'SERVICE_DISABLED' || error.status === 503) {
    return {
      success: false,
      code: 'service_disabled',
      message: error.message || ERROR_MESSAGES.service_disabled
    }
  }
  if (error.code === 'RATE_LIMIT' || error.status === 429) {
    return { success: false, code: 'rate_limit', message: error.message || ERROR_MESSAGES.rate_limit }
  }
  if (error.code === 'NETWORK_ERROR' || error.status === 0) {
    return { success: false, code: 'network_error', message: ERROR_MESSAGES.network_error }
  }
  if (error.message.includes('额度')) {
    return { success: false, code: 'quota_exceeded', message: error.message }
  }
  return { success: false, code: 'generation_failed', message: error.message }
}

function mapPipelineError(error: unknown): GenerationFailure | CompletePosesResult {
  if (error instanceof ApiError) {
    return mapApiErrorToFailure(error)
  }
  if (error instanceof Error && error.message === 'auth_expired') {
    return { success: false, code: 'auth_expired', message: ERROR_MESSAGES.auth_expired }
  }
  if (error instanceof Error && error.message === 'service_disabled') {
    return { success: false, code: 'service_disabled', message: ERROR_MESSAGES.service_disabled }
  }
  if (error instanceof Error && error.message === 'image_not_configured') {
    return {
      success: false,
      code: 'service_disabled',
      message: '图像生成服务尚未配置完成，请稍后再试。'
    }
  }
  if (error instanceof Error && error.message === 'network_error') {
    return { success: false, code: 'network_error', message: ERROR_MESSAGES.network_error }
  }
  if (error instanceof Error && error.message === 'rate_limit') {
    return { success: false, code: 'rate_limit', message: ERROR_MESSAGES.rate_limit }
  }
  if (error instanceof Error && error.message === 'idle_generation_failed') {
    return {
      success: false,
      code: 'generation_failed',
      message: ERROR_MESSAGES.generation_failed
    }
  }
  if (error instanceof Error && error.message === 'rembg_not_installed') {
    return {
      success: false,
      code: 'rembg_failed',
      message: ERROR_MESSAGES.rembg_failed
    }
  }
  if (error instanceof Error && error.message.includes('rembg')) {
    return {
      success: false,
      code: 'rembg_failed',
      message: ERROR_MESSAGES.rembg_failed
    }
  }
  if (error instanceof Error && error.message.includes('额度')) {
    return { success: false, code: 'quota_exceeded', message: error.message }
  }
  return {
    success: false,
    code: 'generation_failed',
    message: error instanceof Error ? error.message : ERROR_MESSAGES.generation_failed
  }
}

export async function runGenerationPipeline(petId: string): Promise<GenerationResult | GenerationFailure> {
  try {
    await ensureRemoteQuotaFresh(true)
  } catch (error) {
    console.warn('[petory] failed to refresh remote quota before generation:', error)
  }
  const quota = canGeneratePet()
  if (!quota.ok) {
    return {
      success: false,
      code: 'quota_exceeded',
      message: quota.message
    }
  }

  const pet = getPetById(petId)
  if (!pet || !hasUploadReference(pet)) {
    return {
      success: false,
      code: 'upload_invalid',
      message: ERROR_MESSAGES.upload_invalid
    }
  }

  const poses = getPosesToGenerate()

  try {
    // Deduct remote quota before expensive generation (avoids "quota exceeded" after images are saved).
    if (!shouldUseRemoteGeneration() && isUsingRemoteQuota()) {
      await consumeRemoteGenerationQuota()
    }

    const { posePaths, idleRawPath } = await generatePoseBatch(pet, petId, poses, {}, 0, poses.length)

    if (!posePaths.idle) {
      return {
        success: false,
        code: 'generation_failed',
        message: ERROR_MESSAGES.generation_failed
      }
    }

    const updated: Pet = updatePet(petId, {
      imageMinimaxRawPath: idleRawPath,
      imagePetPath: posePaths.idle,
      posePaths,
      status: 'generated'
    })

    if (shouldUseRemoteGeneration()) {
      // quota already consumed by server batch
    } else if (!isUsingRemoteQuota()) {
      incrementGenerationUsage()
    } else {
      void logLocalGenerationBatch({
        styleType: updated.styleType,
        poses: Object.keys(posePaths) as PetPoseType[],
        clientPetId: updated.id,
        posePaths
      })
    }
    broadcastPetsListChanged()
    return { success: true, petId: updated.id }
  } catch (error) {
    return mapPipelineError(error) as GenerationFailure
  }
}

export async function applyRemoteBatchToPet(
  petId: string,
  jobs: ServerBatchJob[]
): Promise<GenerationResult | GenerationFailure> {
  const pet = getPetById(petId)
  if (!pet) {
    return {
      success: false,
      code: 'generation_failed',
      message: ERROR_MESSAGES.generation_failed
    }
  }

  const succeededJobs = jobs.filter((job) => job.status === 'succeeded' && job.rawOutputUrl)
  if (succeededJobs.length === 0) {
    return {
      success: false,
      code: 'generation_failed',
      message: '没有可导入的生成结果。'
    }
  }

  try {
    const { posePaths, idleRawPath } = await processRemoteJobs(
      pet,
      petId,
      succeededJobs,
      pet.posePaths ?? {},
      0,
      succeededJobs.length
    )
    if (!posePaths.idle) {
      return {
        success: false,
        code: 'generation_failed',
        message: ERROR_MESSAGES.generation_failed
      }
    }

    updatePet(petId, {
      imageMinimaxRawPath: idleRawPath,
      imagePetPath: posePaths.idle,
      posePaths,
      status: 'generated'
    })
    broadcastPetsListChanged()
    return { success: true, petId }
  } catch (error) {
    return mapPipelineError(error) as GenerationFailure
  }
}

export async function runCompletePosesPipeline(petId: string): Promise<CompletePosesResult> {
  const pet = getPetById(petId)
  if (!pet || !hasUploadReference(pet)) {
    return { success: false, message: '该宠物没有可用的原图，无法补全姿势。' }
  }
  if (pet.isSample) {
    return { success: true, petId, addedPoses: [] }
  }

  const missing = getMissingPosesForPet(pet)
  if (missing.length === 0) {
    return { success: true, petId, addedPoses: [] }
  }

  const existing = pet.posePaths ?? {}

  try {
    let posePaths: PetPoseAssets
    if (shouldUseRemoteGeneration()) {
      broadcastGenerationPhase(petId, 'upload', '上传照片', missing.length)
      broadcastGenerationPhase(petId, 'remote', '云端生成', missing.length)
      const { generatedDir } = ensurePetDirs(petId)
      const batch = await requestPoseCompletion({
        imagePath: resolveRemoteReferencePath(pet, missing, generatedDir),
        referenceMode: resolveRemoteReferenceMode(pet, missing, generatedDir),
        styleType: pet.styleType,
        poses: missing
      })
      if (batch.success === false || !batch.jobs?.length) {
        const mapped = mapPipelineError(mapBatchFailure(batch.message, batch.code))
        return { success: false, message: 'message' in mapped ? mapped.message : '姿势补全失败，请稍后重试。' }
      }
      const result = await processRemoteJobs(pet, petId, batch.jobs, existing, 0, missing.length)
      posePaths = result.posePaths
    } else {
      const result = await generatePoseBatch(pet, petId, missing, existing, 0, missing.length)
      posePaths = result.posePaths
    }

    const addedPoses = missing.filter((pose) => Boolean(posePaths[pose]))
    if (addedPoses.length === 0) {
      return { success: false, message: '姿势补全失败，请稍后重试。' }
    }

    updatePet(petId, {
      posePaths,
      imagePetPath: posePaths.idle ?? pet.imagePetPath
    })

    return { success: true, petId, addedPoses }
  } catch (error) {
    console.error('[petory] complete poses failed:', error)
    const mapped = mapPipelineError(error)
    return { success: false, message: 'message' in mapped ? mapped.message : '姿势补全失败' }
  }
}

export async function runRegenerateSinglePose(
  petId: string,
  pose: PetPoseType
): Promise<
  | { success: true; petId: string; pose: PetPoseType }
  | { success: false; message: string }
> {
  const pet = getPetById(petId)
  if (!pet || !hasUploadReference(pet)) {
    return { success: false, message: '该宠物没有可用的原图，无法重生成姿势。' }
  }
  if (pet.isSample) {
    return { success: false, message: '示例宠物不支持单姿势重生成。' }
  }

  const existing = pet.posePaths ?? {}

  try {
    let posePaths: PetPoseAssets
    let idleRawPath = pet.imageMinimaxRawPath

    if (shouldUseRemoteGeneration()) {
      const { generatedDir } = ensurePetDirs(petId)
      const job = await requestPoseRegeneration({
        imagePath: resolveRemoteReferencePath(pet, [pose], generatedDir),
        referenceMode: resolveRemoteReferenceMode(pet, [pose], generatedDir),
        styleType: pet.styleType,
        pose
      })
      if (job.success === false || job.status !== 'succeeded' || !job.rawOutputUrl) {
        return { success: false, message: job.message || job.errorMessage || '姿势重生成失败，请稍后重试。' }
      }
      const result = await processDownloadedPose(pet, petId, pose, job.rawOutputUrl, existing)
      posePaths = result.posePaths
      idleRawPath = result.idleRawPath
    } else {
      const { generatedDir } = ensurePetDirs(petId)
      const idleAnchor =
        pet.imageMinimaxRawPath && fs.existsSync(pet.imageMinimaxRawPath)
          ? pet.imageMinimaxRawPath
          : fs.existsSync(path.join(generatedDir, 'minimax_idle.png'))
            ? path.join(generatedDir, 'minimax_idle.png')
            : null
      const useAnchor = pose !== 'idle' && idleAnchor

      if (useAnchor) {
        const minimaxRawPath = path.join(generatedDir, `minimax_${pose}.png`)
        const posePngPath = getPoseOutputPath(generatedDir, pose)
        const generated = await generatePetImage(idleAnchor, pet.styleType, pose, {
          seed: seedFromString(pet.id),
          referenceMode: 'anchor'
        })
        fs.writeFileSync(minimaxRawPath, generated)
        try {
          await removeBackground(minimaxRawPath, posePngPath)
          posePaths = { ...existing, [pose]: posePngPath }
        } catch (error) {
          console.error(`[petory] rembg failed for pose ${pose}:`, error)
          return {
            success: false,
            message: error instanceof Error ? error.message : '姿势重生成失败'
          }
        }
      } else {
        const result = await generatePoseBatch(pet, petId, [pose], existing, 0, 1)
        posePaths = result.posePaths
        idleRawPath = result.idleRawPath
      }
    }

    if (!posePaths[pose]) {
      return { success: false, message: '姿势重生成失败，请稍后重试。' }
    }

    updatePet(petId, {
      posePaths,
      imagePetPath: posePaths.idle ?? pet.imagePetPath,
      ...(pose === 'idle' ? { imageMinimaxRawPath: idleRawPath } : {})
    })

    return { success: true, petId, pose }
  } catch (error) {
    console.error('[petory] regenerate pose failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '姿势重生成失败'
    }
  }
}
