import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { getSamplePoseFileName } from '../../../src/shared/generation/samplePose'
import type { PetPoseType } from '../../../src/shared/types/pet'

function getSamplePoseRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sample', 'poses')
  }
  return path.join(app.getAppPath(), 'resources/sample/poses')
}

export function getSamplePoseReferencePath(pose: PetPoseType): string | null {
  const filePath = path.join(getSamplePoseRoot(), getSamplePoseFileName(pose))
  return fs.existsSync(filePath) ? filePath : null
}
