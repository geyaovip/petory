import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getPoseFileName, PET_POSE_ORDER } from '../../src/shared/poses'
import type { PetPoseAssets } from '../../src/shared/types/pet'
import { canCreatePet } from './auth/entitlementService'
import { createDraftPet, ensurePetDirs, loadStore, saveStore, updatePet } from './petStore'

export type InstallSampleResult =
  | { success: true; petId: string }
  | { success: false; message: string }

function getSampleRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sample')
  }
  return path.join(app.getAppPath(), 'resources/sample')
}

function copySampleAssets(petId: string): { petPngPath: string; posePaths: PetPoseAssets } {
  const sampleRoot = getSampleRoot()
  const sampleIdle = path.join(sampleRoot, 'poses', 'idle.png')
  const { sourceDir, generatedDir } = ensurePetDirs(petId)
  const sourceCopy = path.join(sourceDir, 'sample.png')
  const petPngPath = path.join(generatedDir, 'pet.png')

  fs.copyFileSync(sampleIdle, sourceCopy)
  fs.copyFileSync(sampleIdle, petPngPath)

  const posePaths: PetPoseAssets = {}
  for (const pose of PET_POSE_ORDER) {
    const posePath = path.join(generatedDir, getPoseFileName(pose))
    fs.copyFileSync(path.join(sampleRoot, 'poses', `${pose}.png`), posePath)
    posePaths[pose] = posePath
  }

  return { petPngPath, posePaths }
}

export function refreshInstalledSamplePets(): void {
  const sampleIdle = path.join(getSampleRoot(), 'poses', 'idle.png')
  if (!fs.existsSync(sampleIdle)) return

  const store = loadStore()
  let pathsChanged = false

  store.pets = store.pets.map((pet) => {
    if (!pet.isSample) return pet

    const { petPngPath, posePaths } = copySampleAssets(pet.id)
    const hasCurrentPaths =
      pet.imageMinimaxRawPath === petPngPath &&
      pet.imagePetPath === petPngPath &&
      PET_POSE_ORDER.every((pose) => pet.posePaths?.[pose] === posePaths[pose])

    if (hasCurrentPaths) return pet

    pathsChanged = true
    return {
      ...pet,
      imageMinimaxRawPath: petPngPath,
      imagePetPath: petPngPath,
      posePaths
    }
  })

  if (pathsChanged) saveStore(store)
}

export async function installSamplePet(): Promise<InstallSampleResult> {
  const quota = canCreatePet()
  if (!quota.ok) {
    return { success: false, message: quota.message }
  }

  const sampleRoot = getSampleRoot()
  const sampleIdle = path.join(sampleRoot, 'poses', 'idle.png')
  if (!fs.existsSync(sampleIdle)) {
    return { success: false, message: '示例宠物资源缺失，请重新安装应用。' }
  }

  try {
    const pet = createDraftPet({ imageOriginalPath: '', imageCompressedPath: '' })
    const { sourceDir } = ensurePetDirs(pet.id)
    const sourceCopy = path.join(sourceDir, 'sample.png')
    const { petPngPath, posePaths } = copySampleAssets(pet.id)

    updatePet(pet.id, {
      imageOriginalPath: sourceCopy,
      imageCompressedPath: sourceCopy,
      imageMinimaxRawPath: petPngPath,
      imagePetPath: petPngPath,
      posePaths,
      status: 'generated',
      isSample: true
    })

    return { success: true, petId: pet.id }
  } catch (error) {
    console.error('[petory] install sample pet failed:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '示例宠物安装失败'
    }
  }
}
