import type { PetPoseType } from '../types/pet'

const POSE_SCENE_RULES = `Full body, plain background, no text, accessories, props, clothing, or extra objects. Preserve the exact same individual pet from the reference: species, breed, face shape, eye color, fur color, markings, ear shape, body proportions, and distinctive features must remain unchanged. Change pose and expression only.`

const POSE_BODY: Record<PetPoseType, string> = {
  idle:
    'Pose only: same pet sitting in a relaxed front-facing 3/4 view, body slightly turned, face looking toward the viewer, calm gentle expression.',
  happy:
    'Pose only: same pet sitting in a front-facing 3/4 view, joyful cheerful expression, paws slightly open or raised in a cute happy gesture.',
  focus:
    'Pose only: same pet sitting in a front-facing 3/4 view, attentive eyes and a concentrated calm expression, paws resting naturally.',
  sleep:
    'Pose only: same pet in a cozy sitting-sleep pose, eyes closed peacefully, relaxed posture while still mostly upright and desktop-friendly.',
  remind:
    'Pose only: same pet sitting in a front-facing 3/4 view, one paw raised in a friendly wave, attentive caring expression.',
  angry:
    'Pose only: same pet sitting in a front-facing 3/4 view, mildly pouty annoyed expression and a cute-not-scary upset mood.'
}

export function getPoseInstruction(pose: PetPoseType): string {
  return `${POSE_BODY[pose]} ${POSE_SCENE_RULES}`
}
