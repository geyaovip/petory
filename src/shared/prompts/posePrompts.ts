import type { ReferenceMode } from '../generation/reference'
import type { PetPoseType } from '../types/pet'

const IDENTITY_RULES = `Use the main subject in the uploaded image as the only subject. Preserve the exact same individual: species or object type, silhouette, primary colors, material or fur texture, markings, face and eye features, head details, body proportions, clothing, accessories, and every distinctive identifying detail. Do not redesign, simplify, beautify, replace, or turn it into a different character.`

const POSE_SET_RULES = `This image is one pose in a fixed six-pose Petory desktop-companion set. Keep the same semi-realistic faux-3D rendering, camera distance, camera height, three-quarter framing, upper-front-left lighting, material treatment, and apparent scale across the whole set. Only change the pose-specific body language and expression described below. Do not switch to a different art style, camera angle, crop, or character design.`

const RENDER_RULES = `Render it as a believable semi-realistic faux-3D desktop companion cutout. Preserve the source subject's real anatomy, fur, feathers, skin, fabric, metal, or other material texture. Add restrained three-dimensional volume, natural surface depth, soft contact shading, gentle ambient occlusion, subtle rim light, and clean product-photography lighting from the upper front-left. Use a medium focal length with minimal perspective distortion. The result should feel dimensional and alive while still looking like the uploaded subject. Do not make it flat, card-like, sticker-like, icon-like, cel-shaded, heavily illustrated, chibi, super-deformed, toy-like, plush-like, plastic, glossy figurine-like, or excessively cartoonish. Do not place it inside a card, badge, frame, tile, rounded rectangle, platform, room, or scenery.`

const OUTPUT_RULES = `Show exactly one complete subject, centered with comfortable transparent padding, fully visible from the highest point to the feet or base, with a clean readable silhouette. Transparent background with no backdrop and no environment. If transparency is unavailable, use a single pure white or very light neutral background suitable for automatic background removal. No text, watermark, logo, extra people, extra animals, duplicate body parts, unrelated props, crop, occlusion, dramatic perspective, back view, or pure side view.`

const SEATED_BASE = `Use the same seated upright three-quarter desktop-companion base as the Petory default idle pose: body turned slightly three-quarter while the face looks toward the viewer, hindquarters or equivalent base resting on the ground, both front paws planted naturally side by side unless one paw is intentionally raised, tail visible beside the body when the subject has a tail, and the full body readable in frame.`

const POSE_BODY: Record<PetPoseType, string> = {
  idle: `${SEATED_BASE} Expression is calm, gently attentive, and friendly. Eyes are open. Do not stand, walk, lie down, loaf, curl up, lean strongly, or copy the uploaded photo pose.`,
  happy: `${SEATED_BASE} Keep the same seated upright body, camera framing, and scale as idle. Change only the expression and one paw gesture: brighten into a joyful smile, slightly open the mouth if appropriate, and raise one front paw in a small natural wave while the other paw and hind legs stay planted. The celebration must come from expression and one lifted paw, not from standing, jumping, leaning far forward, or changing the camera angle.`,
  focus: `Focus pose uses a prone loaf position, not a seated pose. The same subject lies flat on its belly close to the ground, with the chest and forelegs lowered and both front paws extended forward together. The head stays up and looks toward the viewer with calm, attentive open eyes. The posture suggests quiet concentration without becoming sleepy. Preserve the face, markings, and full body silhouette. Do not sit upright, curl into a sleeping ball, stand, add props, close the eyes, or turn away.`,
  sleep: `Sleep pose uses a compact curled resting position, not a seated pose and not the focus loaf pose. The same subject curls into a natural sleeping crescent with eyes fully closed, relaxed ears, lowered head resting on or between the front paws, and the tail wrapped along the body when present. Keep the face and distinctive markings identifiable. Do not sit upright, stay in a belly-down loaf, add a bed or blanket, add Zzz text, or crop tightly enough to lose identity.`,
  remind: `${SEATED_BASE} Keep the same seated upright body, camera framing, and scale as idle. Change only the expression and one paw gesture: raise one front paw in a clear but natural attention or beckoning gesture, like a caring reminder, while the other paw supports the seated pose. Use an alert, attentive, gently concerned expression with open eyes and a neutral or softly serious mouth. This is not the happy pose: do not smile broadly, do not open the mouth in celebration, and do not add props.`,
  angry: `${SEATED_BASE} Keep the same seated upright body, camera framing, and scale as idle. Change only the expression and subtle posture tension: use a mildly annoyed or impatient look with slightly lowered brows or ears where appropriate, firmer planted front paws, and a small forward weight shift. Both front paws remain on the ground. Keep it cute, believable, and non-threatening. Do not bare teeth, attack, stand up, add anger symbols, flames, or props.`
}

const ANCHOR_POSE_HINTS: Record<PetPoseType, string | null> = {
  idle: null,
  happy:
    'Anchor continuity: preserve the anchor subject identity, rendering style, seated upright three-quarter framing, and apparent scale. Only add the happy expression and one waving front paw.',
  focus:
    'Anchor continuity: preserve the anchor subject identity, rendering style, lighting, and scale, but transform the body from the anchor into the belly-down loaf pose described above. Do not keep the seated upright pose from the anchor.',
  sleep:
    'Anchor continuity: preserve the anchor subject identity, rendering style, lighting, and scale, but transform the body from the anchor into the curled sleeping pose described above. Do not keep the seated upright pose from the anchor.',
  remind:
    'Anchor continuity: preserve the anchor subject identity, rendering style, seated upright three-quarter framing, and apparent scale. Only add the alert reminder expression and one raised front paw.',
  angry:
    'Anchor continuity: preserve the anchor subject identity, rendering style, seated upright three-quarter framing, and apparent scale. Only add the mildly annoyed expression and subtle tension.'
}

export function getPoseInstruction(
  pose: PetPoseType,
  referenceMode: ReferenceMode = 'upload'
): string {
  const sections = [IDENTITY_RULES, POSE_SET_RULES, POSE_BODY[pose], RENDER_RULES, OUTPUT_RULES]
  const anchorHint = referenceMode === 'anchor' ? ANCHOR_POSE_HINTS[pose] : null
  if (anchorHint) sections.splice(3, 0, anchorHint)
  return sections.join('\n\n')
}
