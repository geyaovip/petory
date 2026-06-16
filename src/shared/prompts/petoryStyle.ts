export const PETORY_STYLE_PROMPT_BASE = `Use the uploaded image as the strict identity reference for the main subject, not as a style or composition template. The output must preserve the exact same individual and all identifying visual details from that photo while changing only the pose requested below. Do not borrow appearance, species, colors, markings, or character design from any other source. Produce a clean isolated semi-realistic faux-3D desktop-companion asset with believable depth, original material texture, and consistent product-quality lighting. It must not look like a flat card, sticker, generic mascot, or redesigned cartoon character.`

export const ANCHOR_STYLE_PROMPT_BASE = `Use the anchor image only to keep the exact same subject identity and rendering continuity across the pose set. Preserve its face, colors, texture, markings, proportions, clothing, accessories, material qualities, camera height, light direction, and apparent scale. Change only the requested pose. Do not borrow appearance from any other source. Keep the same semi-realistic faux-3D rendering and isolated desktop-companion presentation as the anchor.`

/** @deprecated Use getStylePrompt('petory', pose) */
export const PETORY_STYLE_PROMPT = `${PETORY_STYLE_PROMPT_BASE}
Pose: relaxed front-facing 3/4 sitting view, face toward the viewer, full body visible.
Plain solid background only. No text, watermark, extra animals, extra people, furniture, scenery, or unrelated objects. Do not crop the body.`
