# Petory Brand Asset Audit

## Scope

- Source truth: `petory_logo/01_petory_primary_logo_transparent.png` and `petory_logo/03_petory_app_icon_transparent.png`.
- Surfaces: website, admin, renderer/browser tab, Apple Touch, macOS Dock and ICNS, Windows installer, packaged Electron app.
- Before evidence: `.codex/brand-audit/01-current-assets-on-dark.png`.
- After evidence: `.codex/brand-audit/02-optimized-assets-on-dark.png`.
- Packaged macOS evidence: `.codex/brand-audit/03-packaged-macos-icon.png`.

## Steps And Health

1. Source files: needs follow-up.
   - The two-file source model is correct and should remain the only editable brand source.
   - Both PNG exports contain transparent-channel holes with painted RGB data. The pipeline now repairs these deterministically.
   - The square source is only 263 x 267. This is below the recommended 1024 x 1024 master size and remains the main source of softness at large sizes.

2. Horizontal wordmark: healthy.
   - Used for website, admin, authentication, onboarding, and branded empty/loading states.
   - Repair is restricted to the mascot region, so white fur is restored without filling letter counters.
   - Cache references were bumped to `v=10` on website and admin surfaces.

3. Browser and window icons: healthy.
   - Electron renderer/window icons use transparent rounded artwork with 72% inset at 16 px and 82% at 32/48 px.
   - Website and admin favicons use the same opaque blue-background output and no longer diverge.
   - Website icon URLs now use `v=10` to avoid stale browser caches.

4. Apple Touch icon: healthy.
   - Output is fully opaque, so iOS/macOS masking cannot reveal black or white transparent corners.
   - Internal mascot transparency is rejected by automated verification.

5. macOS Dock and packaged app: healthy with source-resolution limit.
   - Dock and ICNS artwork use an 80% visual safe zone instead of the previous oversized 84% treatment.
   - The generated ICNS is present in the packaged `.app`; its SHA-256 matches `build/icon.icns`.
   - All ICNS scale layers from 16 px through 1024 px are present.

6. Windows installer icon: healthy with source-resolution limit.
   - `build/icon.png` is generated separately at an 88% safe zone instead of reusing the full-bleed archive image.
   - The icon has no internal transparency holes and does not touch the canvas edge.

7. Automation and release checks: healthy.
   - `npm run sync:brand` regenerates website, admin, renderer, Dock, ICNS, Windows, Apple Touch, SERP, and OG assets.
   - Release QA checks geometry, central transparency, safe zones, favicon edges, and Apple Touch opacity.
   - A warning is emitted while the square master remains below 512 px.

## Remaining Recommendation

- Replace only `petory_logo/03_petory_app_icon_transparent.png` with a visually identical 1024 x 1024 or vector-derived export. Do not upscale the current 263 x 267 PNG and treat it as a new master; that preserves the existing blur and edge stair-stepping.
- An SVG, PDF, AI, or Figma vector source is preferable. Export the final PNG with a solid icon interior and transparency only outside the rounded tile.

## Validation

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run qa`: passed.
- `electron-builder --mac --dir`: passed.
- Packaged ICNS hash comparison: passed.
- Dark/checkerboard visual comparison: passed.

final result: passed with source-resolution warning
