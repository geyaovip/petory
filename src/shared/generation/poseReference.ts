import type { ReferenceMode } from './reference'
import type { PetPoseType } from '../types/pet'

/**
 * Attach the default pose choreography image only after idle has locked identity
 * via anchor mode. Never attach it on the first upload→idle step, or the model
 * blends the sample mascot's appearance into the user's subject.
 */
export function shouldAttachPoseReference(
  referenceMode: ReferenceMode,
  pose: PetPoseType
): boolean {
  return referenceMode === 'anchor' && pose !== 'idle'
}
