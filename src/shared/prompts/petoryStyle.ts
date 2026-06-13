export const PETORY_STYLE_PROMPT_BASE = `Use the reference image only for the pet's identity and appearance. Preserve the same individual pet's species, breed, face, eye color, fur colors, markings, ear shape, and body proportions. Do not preserve or copy the reference pose, body position, camera framing, background, or composition. Repose the pet exactly as instructed below. Show one centered full-body pet on a plain light background, with no text or extra objects.`

export const ANCHOR_STYLE_PROMPT_BASE = `Use the reference image only for the same pet's identity and appearance. Preserve its face, colors, markings, ears, eyes, and proportions, but do not copy its pose or composition. Repose the pet exactly as instructed below on a plain light background.`

/** @deprecated Use getStylePrompt('petory', pose) */
export const PETORY_STYLE_PROMPT = `${PETORY_STYLE_PROMPT_BASE}
Pose: relaxed front-facing 3/4 sitting view, face toward the viewer, full body visible.
Plain solid background only. No text, watermark, extra animals, extra people, furniture, scenery, or unrelated objects. Do not crop the body.`
