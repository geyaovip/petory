import type { ReferenceMode } from '../generation/reference'
import type { PetPoseType } from '../types/pet'
import type { PetStyleType } from '../types/pet'
import { getPoseInstruction } from './posePrompts'
import { POSE_REFERENCE_IMAGE_RULES } from './poseReferencePrompt'
import { ANCHOR_STYLE_PROMPT_BASE, PETORY_STYLE_PROMPT_BASE } from './petoryStyle'

/**
 * Generation preserves the uploaded pet's identity and only changes pose.
 * styleType is kept for product/plan metadata; it must not restyle the subject.
 */
export function getStylePrompt(
  _styleType: PetStyleType,
  pose: PetPoseType = 'idle',
  referenceMode: ReferenceMode = 'upload',
  hasPoseReference = false
): string {
  const poseRules = getPoseInstruction(pose, referenceMode)
  const base = referenceMode === 'anchor' ? ANCHOR_STYLE_PROMPT_BASE : PETORY_STYLE_PROMPT_BASE
  if (hasPoseReference) {
    return `${POSE_REFERENCE_IMAGE_RULES}\n\n${base}\n\n${poseRules}`
  }
  return `${base}\n\n${poseRules}`
}
