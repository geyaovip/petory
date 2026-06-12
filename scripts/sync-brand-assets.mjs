import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'petory_logo')
const brandDir = path.join(root, 'brand', 'generated')

/**
 * Brand asset map — only edit sources in petory_logo/, then run npm run sync:brand
 *
 * SOURCES (you maintain):
 *   petory_logo/wordmark.png   — horizontal logo, white background
 *   petory_logo/app-icon.png   — square app icon, white background
 *
 * CANONICAL OUTPUT (git-tracked):
 *   brand/generated/*   — all derived PNG / ICNS
 *
 * MIRRORS (gitignored, copied on sync — do not hand-edit):
 *   logo.png          → website/assets, src/renderer/public, server/admin/public
 *   favicon-*.png     → website/, src/renderer/public, server/admin/public
 *   apple-touch-icon  → website/admin (full bleed); renderer copy uses mac Dock inset
 *   build/icon.png    → electron-builder Windows (full bleed)
 *   build/icon.icns   → electron-builder macOS (Dock safe zone)
 *
 * NOT NEEDED (build artifacts — delete freely):
 *   out/renderer/*    — electron-vite copies from src/renderer/public on build
 *   build/icon.iconset — temporary icns input, removed after sync
 *   release/*         — packaged installers
 */

const sources = {
  wordmark: 'wordmark.png',
  appIcon: 'app-icon.png'
}

const TRIM_THRESHOLD = 12
const WHITE_MIN = 245
const WHITE_SPREAD = 18
/**
 * Processing priority (app-icon):
 *   1. No white / pale fringe on dark backgrounds (top/left edges included)
 *   2. Smooth edges — no alpha stair-steps (feather + supersample)
 *   3. Transparent squircle corners (contain resize, never crop)
 *   4. Keep deep blue squircle body; pale edge blues may be trimmed inward
 */
const FRINGE_LIGHT_MIN = 155
const FRINGE_MAX_SAT = 95
const EDGE_RING_DEPTH = 5
const EDGE_PALE_LIGHT = 162
/**
 * Per-scene transparent margin (1 = no extra padding, max fill).
 * Pale-edge cleanup is handled separately — not via canvas inset.
 */
const SCENE_INSET = {
  favicon: 1,
  webAppleTouch: 1,
  macDockRuntime: 0.84,
  macInstaller: 0.84,
  winInstaller: 1,
  brandArchive: 1
}

function isWhiteish(r, g, b, a) {
  if (a < 20) return true
  if (r < WHITE_MIN || g < WHITE_MIN || b < WHITE_MIN) return false
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max - min <= WHITE_SPREAD
}

/** Flood white / transparent from image edges — keeps interior whites (e.g. cat fur). */
function keyWhiteBackgroundRgba(data, width, height) {
  const channels = 4
  const size = width * height
  const bg = new Uint8Array(size)
  const queue = []

  const pushIfBg = (x, y) => {
    const p = y * width + x
    if (bg[p]) return
    const i = p * channels
    if (!isWhiteish(data[i], data[i + 1], data[i + 2], data[i + 3])) return
    bg[p] = 1
    queue.push(p)
  }

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0)
    pushIfBg(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y)
    pushIfBg(width - 1, y)
  }

  while (queue.length > 0) {
    const p = queue.pop()
    const x = p % width
    const y = (p - x) / width
    if (x > 0) pushIfBg(x - 1, y)
    if (x < width - 1) pushIfBg(x + 1, y)
    if (y > 0) pushIfBg(x, y - 1)
    if (y < height - 1) pushIfBg(x, y + 1)
  }

  for (let p = 0; p < size; p++) {
    const i = p * channels
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (bg[p]) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
      continue
    }

    if (a < 20 && r >= WHITE_MIN - 10 && g >= WHITE_MIN - 10 && b >= WHITE_MIN - 10) {
      data[i + 3] = 255
      continue
    }

    if (a < 20) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
}

/** Undo white-background premultiplication on semi-transparent edge pixels. */
function decontaminateWhiteSpill(data, width, height) {
  const channels = 4
  const size = width * height

  for (let p = 0; p < size; p++) {
    const i = p * channels
    const a = data[i + 3] / 255
    if (a <= 0.02 || a >= 0.995) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const inv = 1 - a

    data[i] = Math.max(0, Math.min(255, Math.round((r - inv * 255) / a)))
    data[i + 1] = Math.max(0, Math.min(255, Math.round((g - inv * 255) / a)))
    data[i + 2] = Math.max(0, Math.min(255, Math.round((b - inv * 255) / a)))
  }
}

function pixelStats(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return { max, min, sat: max - min, light: (r + g + b) / 3 }
}

function isCoreBlue(r, g, b) {
  return b >= r + 12 && b >= g + 4 && b - Math.min(r, g) >= 28
}

/** Saturated interior blue — protected from edge trimming. */
function isDeepBlue(r, g, b, a = 255) {
  return a >= 180 && isCoreBlue(r, g, b) && (r + g + b) / 3 < EDGE_PALE_LIGHT
}

function isPaleSpill(r, g, b, a) {
  if (a === 0 || a === 255) return false
  const { sat, light } = pixelStats(r, g, b)
  if (light >= 248 && sat <= FRINGE_MAX_SAT) return true
  if (light >= FRINGE_LIGHT_MIN && sat <= FRINGE_MAX_SAT && a < 210) return true
  if (light >= 190 && sat <= 90 && a < 150) return true
  if (a < 44 && light >= 130) return true
  return false
}

/**
 * Remove white / pale halos. May adjust edge blues contaminated by white matte.
 * Does not remove opaque core blue squircle pixels. Never snaps partial alpha to 255
 * (that causes visible jaggies on Dock / tab icons).
 */
function cleanEdgeSpill(data, width, height) {
  const channels = 4
  const size = width * height

  for (let p = 0; p < size; p++) {
    const i = p * channels
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (a === 255) continue

    if (a === 0) continue

    if (isPaleSpill(r, g, b, a) || (a < 36 && !isCoreBlue(r, g, b))) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
      continue
    }

    if (a < 200 && b < Math.max(r, g) - 28 && !isCoreBlue(r, g, b)) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
      continue
    }

    if (a < 100 && !isCoreBlue(r, g, b)) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
}

/** Pale fringe connected to canvas edge (incl. light sky-blue from white matte). */
function isExteriorSpill(r, g, b, a) {
  if (a < 16) return true
  if (isDeepBlue(r, g, b, a)) return false
  const { sat, light } = pixelStats(r, g, b)
  if (isWhiteish(r, g, b, a)) return true
  if (light >= EDGE_PALE_LIGHT && sat < FRINGE_MAX_SAT) return true
  if (light >= 148 && sat < 80 && a < 252) return true
  if (!isCoreBlue(r, g, b) && light >= 130) return true
  return false
}

function floodExteriorSpill(data, width, height) {
  const channels = 4
  const size = width * height
  const spill = new Uint8Array(size)
  const queue = []

  const push = (x, y) => {
    const p = y * width + x
    if (spill[p]) return
    const i = p * channels
    if (!isExteriorSpill(data[i], data[i + 1], data[i + 2], data[i + 3])) return
    spill[p] = 1
    queue.push(p)
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }

  while (queue.length > 0) {
    const p = queue.pop()
    const x = p % width
    const y = (p - x) / width
    if (x > 0) push(x - 1, y)
    if (x < width - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < height - 1) push(x, y + 1)
  }

  for (let p = 0; p < size; p++) {
    if (!spill[p]) continue
    const i = p * channels
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 0
  }
}

/** Strip pale pixels in a few px ring outside deep blue (fixes top/left white halos). */
function stripExteriorPaleRing(data, width, height, maxDepth = EDGE_RING_DEPTH) {
  const channels = 4
  const size = width * height
  const dist = new Int16Array(size).fill(-1)
  const queue = []

  for (let p = 0; p < size; p++) {
    if (data[p * channels + 3] < 12) {
      dist[p] = 0
      queue.push(p)
    }
  }

  for (let qi = 0; qi < queue.length; qi++) {
    const p = queue[qi]
    const d = dist[p]
    if (d >= maxDepth) continue
    const x = p % width
    const y = (p - x) / width
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1]
    ]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const np = ny * width + nx
      if (dist[np] >= 0) continue
      dist[np] = d + 1
      queue.push(np)
    }
  }

  for (let p = 0; p < size; p++) {
    const d = dist[p]
    if (d <= 0 || d > maxDepth) continue
    const i = p * channels
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    const { light, sat } = pixelStats(r, g, b)

    if (isDeepBlue(r, g, b, a) && d >= maxDepth - 1) continue

    const pale =
      light >= EDGE_PALE_LIGHT ||
      (light >= 145 && sat < 88) ||
      !isCoreBlue(r, g, b) ||
      a < 245

    if (pale) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
}

/** Prevent white RGB leaking through low alpha on dark Dock backgrounds. */
function sanitizeEdgeRgb(data, width, height) {
  const channels = 4
  const size = width * height

  for (let p = 0; p < size; p++) {
    const i = p * channels
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    const { light } = pixelStats(r, g, b)

    if (a < 28) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
      continue
    }

    if (a < 200 && light >= EDGE_PALE_LIGHT) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
      continue
    }

    if (a < 255 && light >= 190 && !isDeepBlue(r, g, b, a)) {
      data[i] = 0
      data[i + 1] = 0
      data[i + 2] = 0
      data[i + 3] = 0
    }
  }
}

/** Soften alpha at transparent↔opaque boundaries to remove stair-step jaggies. */
function featherAlphaEdges(data, width, height, passes = 2) {
  const channels = 4
  const size = width * height

  for (let pass = 0; pass < passes; pass++) {
    const alpha = new Uint8Array(size)
    for (let p = 0; p < size; p++) alpha[p] = data[p * channels + 3]

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p = y * width + x
        const a = alpha[p]
        const n = [alpha[p - 1], alpha[p + 1], alpha[p - width], alpha[p + width]]
        const nearTransparent = a < 28 || n.some((v) => v < 28)
        const nearOpaque = a > 220 || n.some((v) => v > 220)
        if (!(nearTransparent && nearOpaque)) continue

        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += alpha[(y + dy) * width + (x + dx)]
            count++
          }
        }
        data[p * channels + 3] = Math.round(sum / count)
      }
    }
  }
}

function postKeyAppIconRgba(data, width, height, { feather = true } = {}) {
  decontaminateWhiteSpill(data, width, height)
  cleanEdgeSpill(data, width, height)
  floodExteriorSpill(data, width, height)
  stripExteriorPaleRing(data, width, height)
  sanitizeEdgeRgb(data, width, height)
  if (feather) featherAlphaEdges(data, width, height, 2)
  sanitizeEdgeRgb(data, width, height)
}

function postKeyRgba(data, width, height) {
  decontaminateWhiteSpill(data, width, height)
  cleanEdgeSpill(data, width, height)
}

async function loadKeyedSource(fileName) {
  const from = path.join(srcDir, fileName)
  if (!fs.existsSync(from)) {
    throw new Error(`Missing source asset: ${from}`)
  }

  const { data, info } = await sharp(from).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  keyWhiteBackgroundRgba(data, info.width, info.height)
  postKeyRgba(data, info.width, info.height)

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

async function trimmedBuffer(keyed) {
  return sharp(keyed).trim({ threshold: TRIM_THRESHOLD }).png().toBuffer()
}

/** Centre non-square art on a transparent square so corners stay symmetric when scaled. */
async function squaredAppIconBuffer(keyed) {
  const trimmed = await trimmedBuffer(keyed)
  const meta = await sharp(trimmed).metadata()
  const side = Math.max(meta.width ?? 0, meta.height ?? 0)
  return sharp(trimmed)
    .resize(side, side, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer()
}

async function writeTrimmedWordmark(keyed, toPath) {
  fs.mkdirSync(path.dirname(toPath), { recursive: true })
  await sharp(keyed).trim({ threshold: TRIM_THRESHOLD }).png().toFile(toPath)
  console.log(`✓ ${path.relative(root, toPath)}`)
}

/** Scale with contain; optional inset adds transparent margin (see ICON_TRIM_INSET / MAC_DOCK_INSET). */
function resizeAppIcon(trimmed, size, inset = 1) {
  const inner = Math.max(1, Math.round(size * inset))
  const pad = size - inner
  const padTop = Math.floor(pad / 2)
  const padLeft = Math.floor(pad / 2)

  return sharp(trimmed)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3
    })
    .extend({
      top: padTop,
      bottom: pad - padTop,
      left: padLeft,
      right: pad - padLeft,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
}

function supersampleFactor(size) {
  if (size <= 32) return 4
  if (size <= 64) return 3
  if (size <= 256) return 2
  return 1
}

async function writeAppIconAlpha(trimmed, dest, size, { inset = 1 } = {}) {
  const factor = supersampleFactor(size)
  const renderSize = size * factor

  const { data, info } = await resizeAppIcon(trimmed, renderSize, inset)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  postKeyAppIconRgba(data, info.width, info.height, { feather: true })

  let pipeline = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })

  if (factor > 1) {
    pipeline = pipeline.resize(size, size, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill'
    })
  }

  await pipeline.png().toFile(dest)
}

async function writeFaviconSet(trimmed, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  for (const size of [16, 32, 48]) {
    const dest = path.join(outDir, `favicon-${size}.png`)
    await writeAppIconAlpha(trimmed, dest, size, { inset: SCENE_INSET.favicon })
    console.log(`✓ ${path.relative(root, dest)}`)
  }
  const appleTouch = path.join(outDir, 'apple-touch-icon.png')
  await writeAppIconAlpha(trimmed, appleTouch, 180, { inset: SCENE_INSET.webAppleTouch })
  console.log(`✓ ${path.relative(root, appleTouch)}`)
  await fs.promises.copyFile(path.join(outDir, 'favicon-32.png'), path.join(outDir, 'favicon.png'))
  console.log(`✓ ${path.relative(root, path.join(outDir, 'favicon.png'))}`)
}

async function mirrorFile(relativeName, destinations) {
  const src = path.join(brandDir, relativeName)
  for (const dest of destinations) {
    const to = path.join(root, dest)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    await fs.promises.copyFile(src, to)
  }
}

for (const file of Object.values(sources)) {
  if (!fs.existsSync(path.join(srcDir, file))) {
    console.error(`✗ Expected ${path.join(srcDir, file)}`)
    process.exit(1)
  }
}

fs.mkdirSync(brandDir, { recursive: true })

const wordmarkKeyed = await loadKeyedSource(sources.wordmark)
await writeTrimmedWordmark(wordmarkKeyed, path.join(brandDir, 'logo.png'))

const appIconKeyed = await loadKeyedSource(sources.appIcon)
const appIconSquared = await squaredAppIconBuffer(appIconKeyed)
const { data: appSqData, info: appSqInfo } = await sharp(appIconSquared)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
postKeyAppIconRgba(appSqData, appSqInfo.width, appSqInfo.height)
const appIconTrimmed = await sharp(appSqData, {
  raw: { width: appSqInfo.width, height: appSqInfo.height, channels: 4 }
})
  .png()
  .toBuffer()

await writeFaviconSet(appIconTrimmed, brandDir)

const iconPng = path.join(brandDir, 'icon.png')
await writeAppIconAlpha(appIconTrimmed, iconPng, 1024, { inset: SCENE_INSET.brandArchive })
console.log(`✓ ${path.relative(root, iconPng)}`)

const buildDir = path.join(root, 'build')
fs.mkdirSync(buildDir, { recursive: true })
const iconset = path.join(buildDir, 'icon.iconset')
if (fs.existsSync(iconset)) {
  fs.rmSync(iconset, { recursive: true, force: true })
}
fs.mkdirSync(iconset, { recursive: true })

for (const size of [16, 32, 128, 256, 512]) {
  const out1 = path.join(iconset, `icon_${size}x${size}.png`)
  const out2 = path.join(iconset, `icon_${size}x${size}@2x.png`)
  await writeAppIconAlpha(appIconTrimmed, out1, size, { inset: SCENE_INSET.macInstaller })
  await writeAppIconAlpha(appIconTrimmed, out2, size * 2, { inset: SCENE_INSET.macInstaller })
}

const iconIcns = path.join(brandDir, 'icon.icns')
try {
  execSync(`iconutil -c icns "${iconset}" -o "${iconIcns}"`, {
    stdio: 'inherit'
  })
  console.log(`✓ ${path.relative(root, iconIcns)}`)
} catch {
  console.warn('⚠ iconutil failed — build/icon.png is still available for electron-builder')
}

fs.rmSync(iconset, { recursive: true, force: true })

const webFaviconMirrors = (name) => [`website/${name}`, `server/admin/public/${name}`]

const rendererPublicMirrors = (name) => [`src/renderer/public/${name}`]

await mirrorFile('logo.png', [
  'website/assets/logo.png',
  'src/renderer/public/logo.png',
  'server/admin/public/logo.png'
])

for (const size of [16, 32, 48]) {
  const name = `favicon-${size}.png`
  await mirrorFile(name, [...webFaviconMirrors(name), ...rendererPublicMirrors(name)])
}
await mirrorFile('favicon.png', [...webFaviconMirrors('favicon.png'), ...rendererPublicMirrors('favicon.png')])
await mirrorFile('apple-touch-icon.png', webFaviconMirrors('apple-touch-icon.png'))
await writeAppIconAlpha(
  appIconTrimmed,
  path.join(root, 'src/renderer/public/apple-touch-icon.png'),
  180,
  { inset: SCENE_INSET.macDockRuntime }
)
await mirrorFile('icon.png', ['build/icon.png'])
if (fs.existsSync(iconIcns)) {
  await mirrorFile('icon.icns', ['build/icon.icns'])
}

console.log('Brand assets synced: petory_logo/ → brand/generated/ → deployment mirrors')
