import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getSamplePoseFileName } from '../../../src/shared/generation/samplePose.js'
import type { PetPoseType } from '../../../src/shared/types/pet.js'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

function candidateRoots(): string[] {
  return [
    path.resolve(moduleDir, '../../../resources/sample/poses'),
    '/app/resources/sample/poses'
  ]
}

export function getSamplePoseReferencePath(pose: PetPoseType): string | null {
  const fileName = getSamplePoseFileName(pose)
  for (const root of candidateRoots()) {
    const filePath = path.join(root, fileName)
    if (fs.existsSync(filePath)) return filePath
  }
  return null
}
