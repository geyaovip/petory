import type { PetPoseType } from '../types/pet'

export function getSamplePoseFileName(pose: PetPoseType): string {
  return `${pose}.png`
}
