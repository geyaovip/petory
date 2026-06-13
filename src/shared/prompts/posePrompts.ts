import type { PetPoseType } from '../types/pet'

const POSE_SCENE_RULES = `The required pose must override the pose in the reference image. Keep the full body visible. No text, accessories, props, clothing, extra objects, or extra animals.`

const POSE_BODY: Record<PetPoseType, string> = {
  idle:
    'Required pose: the same pet is sitting clearly upright in a front-facing three-quarter view. Its spine and torso are vertical, chest is visible, both front paws are straight and planted side by side on the ground, hind legs are tucked under the body, and the tail rests naturally beside the body. The head faces the viewer with a calm gentle expression. Do not recline, lie down, lean sideways, sprawl, cross the legs, or copy the reference pose.',
  happy:
    'Required pose: the same pet is sitting clearly upright in a front-facing three-quarter view, with its torso vertical and hind legs tucked under the body. Both front paws are lifted slightly in front of the chest in a balanced cute celebratory gesture. The head faces the viewer with bright eyes and a joyful cheerful expression. Do not lie down, lean sideways, stand on four legs, or copy the reference pose.',
  focus:
    'Required pose: the same pet is sitting clearly upright in a front-facing three-quarter view, with its torso vertical, hind legs tucked under the body, and both front paws planted neatly side by side on the ground. The head tilts slightly forward toward the viewer, with alert ears, attentive eyes, and a calm concentrated expression. Do not lie down, look away, lean sideways, or copy the reference pose.',
  sleep:
    'Required pose: the same pet is sleeping in a compact upright seated pose, with hind legs tucked beneath the body, both front paws together on the ground, torso mostly vertical, and head gently lowered toward the chest. Eyes are fully closed with a peaceful relaxed expression. Keep the face and full body visible. Do not lie flat, curl into a ball, recline sideways, hide the face, or copy the reference pose.',
  remind:
    'Required pose: the same pet is sitting clearly upright in a front-facing three-quarter view, with its torso vertical and hind legs tucked under the body. One front paw is planted firmly on the ground while the other front paw is raised beside the chest in a clear friendly wave. The head faces the viewer with alert eyes and an attentive caring expression. Do not raise both paws, lie down, lean sideways, or copy the reference pose.',
  angry:
    'Required pose: the same pet is sitting clearly upright in a front-facing three-quarter view, with its torso vertical, hind legs tucked under the body, and both front paws planted firmly on the ground slightly apart. The head faces the viewer, ears angle slightly outward, eyes narrow mildly, and the mouth has a small pout for a cute annoyed expression. Keep the mood expressive but not aggressive or scary. Do not bare teeth, attack, lie down, lean sideways, or copy the reference pose.'
}

export function getPoseInstruction(pose: PetPoseType): string {
  return `${POSE_BODY[pose]} ${POSE_SCENE_RULES}`
}
