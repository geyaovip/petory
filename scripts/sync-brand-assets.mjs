import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'petory_logo')

/**
 * Brand asset map — only edit sources in petory_logo/, then run npm run sync:brand
 *
 * SOURCES (you maintain):
 *   petory_logo/wordmark.png   — horizontal logo, white background
 *   petory_logo/app-icon.png   — square app icon, white background
 *
 * GENERATED (do not hand-edit):
 *   logo.png          → website/assets, src/renderer/public, server/admin/public
 *   favicon-*.png     → website/, src/renderer/public, server/admin/public
 *   apple-touch-icon  → same three (Dock runtime, transparent squircle)
 *   build/icon.png    → electron-builder Windows + fallback
 *   build/icon.icns   → electron-builder macOS
 */

const sources = {
  wordmark: 'wordmark.png',
  appIcon: 'app-icon.png'
}

const TRIM_THRESHOLD = 12
const WHITE_MIN = 245
const WHITE_SPREAD = 18

const APP_ICON_ZOOM = {
  16: 1.2,
  32: 1.14,
  48: 1.1,
  128: 1.08,
  180: 1.06,
  256: 1.06,
  512: 1.05,
  1024: 1.04
}

function zoomForSize(size) {
  return APP_ICON_ZOOM[size] ?? (size <= 64 ? 1.12 : size <= 256 ? 1.06 : 1.04)
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

    // Restore enclosed near-white holes left by bad prior exports (e.g. cat muzzle).
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

async function loadKeyedSource(fileName) {
  const from = path.join(srcDir, fileName)
  if (!fs.existsSync(from)) {
    throw new Error(`Missing source asset: ${from}`)
  }

  const { data, info } = await sharp(from).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  keyWhiteBackgroundRgba(data, info.width, info.height)

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

async function trimmedBuffer(keyed) {
  return sharp(keyed).trim({ threshold: TRIM_THRESHOLD }).png().toBuffer()
}

async function writeTrimmedWordmark(keyed, toPath) {
  const to = path.join(root, toPath)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  await sharp(keyed).trim({ threshold: TRIM_THRESHOLD }).png().toFile(to)
  console.log(`✓ ${toPath}`)
}

async function sampleAppIconBlue(keyed) {
  const { data, info } = await sharp(keyed).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels
      if (data[i + 3] > 128) {
        return { r: data[i], g: data[i + 1], b: data[i + 2], alpha: 255 }
      }
    }
  }
  return { r: 70, g: 150, b: 253, alpha: 255 }
}

function zoomedPipeline(trimmed, size) {
  const zoom = zoomForSize(size)
  const zoomed = Math.max(size, Math.round(size * zoom))
  const offset = Math.max(0, Math.round((zoomed - size) / 2))

  return sharp(trimmed)
    .resize(zoomed, zoomed, { fit: 'cover', position: 'centre' })
    .extract({ left: offset, top: offset, width: size, height: size })
}

async function writeAppIconAlpha(trimmed, dest, size) {
  await zoomedPipeline(trimmed, size).png().toFile(dest)
}

async function writeFaviconSolid(trimmed, dest, size, background) {
  await zoomedPipeline(trimmed, size).flatten({ background }).png().toFile(dest)
}

async function writeFaviconSet(trimmed, background, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  for (const size of [16, 32, 48]) {
    const dest = path.join(outDir, `favicon-${size}.png`)
    await writeFaviconSolid(trimmed, dest, size, background)
    console.log(`✓ ${path.relative(root, dest)}`)
  }
  const appleTouch = path.join(outDir, 'apple-touch-icon.png')
  await writeAppIconAlpha(trimmed, appleTouch, 180)
  console.log(`✓ ${path.relative(root, appleTouch)}`)
  await fs.promises.copyFile(path.join(outDir, 'favicon-32.png'), path.join(outDir, 'favicon.png'))
  console.log(`✓ ${path.relative(root, path.join(outDir, 'favicon.png'))}`)
}

for (const file of Object.values(sources)) {
  if (!fs.existsSync(path.join(srcDir, file))) {
    console.error(`✗ Expected ${path.join(srcDir, file)}`)
    process.exit(1)
  }
}

const wordmarkKeyed = await loadKeyedSource(sources.wordmark)
for (const target of [
  'website/assets/logo.png',
  'src/renderer/public/logo.png',
  'server/admin/public/logo.png'
]) {
  await writeTrimmedWordmark(wordmarkKeyed, target)
}

const appIconKeyed = await loadKeyedSource(sources.appIcon)
const appIconTrimmed = await trimmedBuffer(appIconKeyed)
const appIconBlue = await sampleAppIconBlue(appIconKeyed)

await writeFaviconSet(appIconTrimmed, appIconBlue, path.join(root, 'website'))
await writeFaviconSet(appIconTrimmed, appIconBlue, path.join(root, 'src/renderer/public'))
await writeFaviconSet(appIconTrimmed, appIconBlue, path.join(root, 'server/admin/public'))

const buildDir = path.join(root, 'build')
fs.mkdirSync(buildDir, { recursive: true })

const iconPng = path.join(buildDir, 'icon.png')
await writeAppIconAlpha(appIconTrimmed, iconPng, 1024)
console.log('✓ build/icon.png')

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

try {
  execSync(`iconutil -c icns "${iconset}" -o "${path.join(buildDir, 'icon.icns')}"`, {
    stdio: 'inherit'
  })
  console.log('✓ build/icon.icns')
} catch {
  console.warn('⚠ iconutil failed — build/icon.png is still available for electron-builder')
}

console.log('Brand assets synced from petory_logo/')
