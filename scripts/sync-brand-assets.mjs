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
 *   apple-touch-icon  → same three (Dock runtime, transparent squircle)
 *   build/icon.png    → electron-builder Windows + fallback
 *   build/icon.icns   → electron-builder macOS
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
 *   1. Transparent squircle corners (contain resize, never crop)
 *   2. Remove white background / halos aggressively
 *   3. Keep the blue squircle fill — edge blues may be cleaned or strengthened,
 *      but opaque blue body is never deleted
 */
const FRINGE_LIGHT_MIN = 165
const FRINGE_MAX_SAT = 72

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

/** Opaque blue squircle body — never delete. */
function isCoreBlue(r, g, b) {
  return b >= r + 12 && b >= g + 4 && b - Math.min(r, g) >= 28
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
 * Does not remove opaque core blue squircle pixels.
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

    if (isCoreBlue(r, g, b) && a >= 140) {
      data[i + 3] = 255
      continue
    }

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

/** Pale opaque fringe connected to canvas edge (not interior cat whites). */
function isExteriorSpill(r, g, b, a) {
  if (a < 16) return true
  if (isCoreBlue(r, g, b) && a >= 100) return false
  const { sat, light } = pixelStats(r, g, b)
  if (isWhiteish(r, g, b, a)) return true
  if (light >= 225 && sat < 50 && !isCoreBlue(r, g, b)) return true
  if (light >= 200 && sat < 38 && a < 250) return true
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

function postKeyAppIconRgba(data, width, height) {
  decontaminateWhiteSpill(data, width, height)
  cleanEdgeSpill(data, width, height)
  floodExteriorSpill(data, width, height)
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

/** Scale with contain so transparent squircle corners are never cropped away. */
function resizeAppIcon(trimmed, size) {
  return sharp(trimmed).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3
  })
}

async function writeAppIconAlpha(trimmed, dest, size) {
  const { data, info } = await resizeAppIcon(trimmed, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  postKeyAppIconRgba(data, info.width, info.height)
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(dest)
}

async function writeFaviconSet(trimmed, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  for (const size of [16, 32, 48]) {
    const dest = path.join(outDir, `favicon-${size}.png`)
    await writeAppIconAlpha(trimmed, dest, size)
    console.log(`✓ ${path.relative(root, dest)}`)
  }
  const appleTouch = path.join(outDir, 'apple-touch-icon.png')
  await writeAppIconAlpha(trimmed, appleTouch, 180)
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
await writeAppIconAlpha(appIconTrimmed, iconPng, 1024)
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
  await writeAppIconAlpha(appIconTrimmed, out1, size)
  await writeAppIconAlpha(appIconTrimmed, out2, size * 2)
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

const webFaviconMirrors = (name) => [
  `website/${name}`,
  `src/renderer/public/${name}`,
  `server/admin/public/${name}`
]

await mirrorFile('logo.png', [
  'website/assets/logo.png',
  'src/renderer/public/logo.png',
  'server/admin/public/logo.png'
])

for (const size of [16, 32, 48]) {
  await mirrorFile(`favicon-${size}.png`, webFaviconMirrors(`favicon-${size}.png`))
}
await mirrorFile('favicon.png', webFaviconMirrors('favicon.png'))
await mirrorFile('apple-touch-icon.png', webFaviconMirrors('apple-touch-icon.png'))
await mirrorFile('icon.png', ['build/icon.png'])
if (fs.existsSync(iconIcns)) {
  await mirrorFile('icon.icns', ['build/icon.icns'])
}

console.log('Brand assets synced: petory_logo/ → brand/generated/ → deployment mirrors')
