import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import sharp from 'sharp'
import { verifyBrandAssets } from './verify-brand-assets.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'petory_logo')
const brandDir = path.join(root, 'brand', 'generated')

/**
 * Brand asset map — only edit sources in petory_logo/, then run npm run sync:brand
 *
 * SOURCES (RGBA transparent — no edge / fringe processing):
 *   petory_logo/01_petory_primary_logo_transparent.png  — horizontal wordmark
 *   petory_logo/03_petory_app_icon_transparent.png      — square app icon
 *
 * CANONICAL OUTPUT (git-tracked):
 *   brand/generated/*
 *
 * MIRRORS (gitignored, copied on sync):
 *   logo.png, favicon-*.png, apple-touch-icon.png
 *   build/icon.png, build/dock-icon.png, build/icon.icns
 */

const sources = {
  wordmark: '01_petory_primary_logo_transparent.png',
  appIcon: '03_petory_app_icon_transparent.png'
}

/** Transparent margin for macOS Dock / installer only (layout, not edge cleanup). */
const SCENE_INSET = {
  favicon: 1,
  webAppleTouch: 1,
  macDockRuntime: 0.84,
  macInstaller: 0.84,
  winInstaller: 1,
  brandArchive: 1
}

function assertSources() {
  for (const file of Object.values(sources)) {
    const from = path.join(srcDir, file)
    if (!fs.existsSync(from)) {
      console.error(`✗ Expected ${from}`)
      process.exit(1)
    }
  }
}

function floodExteriorMask(data, width, height, alphaCut = 24) {
  const channels = 4
  const size = width * height
  const exterior = new Uint8Array(size)
  const queue = []

  const push = (x, y) => {
    const p = y * width + x
    if (exterior[p]) return
    if (data[p * channels + 3] >= alphaCut) return
    exterior[p] = 1
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

  return exterior
}

function markExteriorNeighbors(exterior, width, height, depth = 2) {
  const size = width * height
  const near = new Uint8Array(size)
  let frontier = []

  for (let p = 0; p < size; p++) {
    if (!exterior[p]) continue
    near[p] = 1
    frontier.push(p)
  }

  for (let step = 0; step < depth; step++) {
    const next = []
    for (const p of frontier) {
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
        if (near[np]) continue
        near[np] = 1
        next.push(np)
      }
    }
    frontier = next
  }

  return near
}

/** Wordmark: fill interior RGB-with-zero-alpha holes only. */
function repairWordmarkAlpha(data, width, height) {
  const channels = 4
  const size = width * height
  const exterior = floodExteriorMask(data, width, height, 20)

  for (let p = 0; p < size; p++) {
    if (exterior[p]) continue
    const i = p * channels
    if (data[i + 3] >= 128) continue
    if (Math.max(data[i], data[i + 1], data[i + 2]) > 10) data[i + 3] = 255
  }
}

function pixelColorFlags(r, g, b) {
  const light = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return {
    light,
    sat,
    isOrange: r > g + 8 && r > b + 15 && sat > 28,
    isDeepBlue: b >= r + 12 && b >= g + 4 && light < 185 && sat > 35
  }
}

/** Cat white fur sits against orange — keep; squircle pale halo against blue — strip. */
function hasOpaqueFurNeighbor(data, width, height, channels, p) {
  const x = p % width
  const y = (p - x) / width
  const offsets = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1]
  ]

  for (const [nx, ny] of offsets) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    const ni = (ny * width + nx) * channels
    if (data[ni + 3] < 200) continue
    const { isOrange } = pixelColorFlags(data[ni], data[ni + 1], data[ni + 2])
    if (isOrange) return true
  }

  return false
}

/**
 * App icon: fill design-export holes (white cat face with alpha=0),
 * strip squircle pale fringe on Dock, without hollowing the cat.
 */
function processAppIconAlpha(data, width, height) {
  const channels = 4
  const size = width * height
  const exterior = floodExteriorMask(data, width, height, 24)
  const nearExterior = markExteriorNeighbors(exterior, width, height, 8)

  for (let p = 0; p < size; p++) {
    const i = p * channels
    const a = data[i + 3]

    if (exterior[p]) {
      if (a > 0) {
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        data[i + 3] = 0
      }
      continue
    }

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Design export: RGB painted but alpha fully zero (cat white face/chest).
    if (a < 5 && Math.max(r, g, b) > 10) {
      data[i + 3] = 255
      continue
    }

    if (nearExterior[p]) continue
    if (a >= 128) continue
    const { light, sat } = pixelColorFlags(r, g, b)
    // Resize fringe only: semi-transparent pale halos, not hidden interior holes.
    if (a > 0 && light >= 145 && sat < 95) continue
    if (Math.max(r, g, b) > 10) data[i + 3] = 255
  }

  for (let p = 0; p < size; p++) {
    if (exterior[p] || !nearExterior[p]) continue

    const i = p * channels
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a === 0) continue

    const { light, sat, isOrange, isDeepBlue } = pixelColorFlags(r, g, b)
    if (isOrange || isDeepBlue) continue

    const neutralPale = light >= 175 && sat < 58
    const softFringe = a < 235 && light >= 118 && sat < 100
    const squircleHalo =
      (neutralPale || softFringe || a < 48) && !hasOpaqueFurNeighbor(data, width, height, channels, p)
    if (!squircleHalo) continue

    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
    data[i + 3] = 0
  }
}

async function loadAppIconSource(fileName) {
  const from = path.join(srcDir, fileName)
  const { data, info } = await sharp(from).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  processAppIconAlpha(data, info.width, info.height)
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toBuffer()
}

async function writeWordmark(fileName, toPath) {
  const from = path.join(srcDir, fileName)
  const { data, info } = await sharp(from).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  repairWordmarkAlpha(data, info.width, info.height)

  fs.mkdirSync(path.dirname(toPath), { recursive: true })
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toFile(toPath)
  console.log(`✓ ${path.relative(root, toPath)}`)
}

/** Centre non-square art on a transparent square for symmetric scaling. */
async function squaredAppIcon(source) {
  const trimmed = await sharp(source).trim().png().toBuffer()
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

async function writeAppIcon(source, dest, size, { inset = 1 } = {}) {
  const inner = Math.max(1, Math.round(size * inset))
  const pad = size - inner
  const padTop = Math.floor(pad / 2)
  const padLeft = Math.floor(pad / 2)

  const { data, info } = await sharp(source)
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
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  processAppIconAlpha(data, info.width, info.height)

  fs.mkdirSync(path.dirname(dest), { recursive: true })
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .png()
    .toFile(dest)
}

async function writeFaviconSet(source, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  for (const size of [16, 32, 48]) {
    const dest = path.join(outDir, `favicon-${size}.png`)
    await writeAppIcon(source, dest, size, { inset: SCENE_INSET.favicon })
    console.log(`✓ ${path.relative(root, dest)}`)
  }
  const appleTouch = path.join(outDir, 'apple-touch-icon.png')
  await writeAppIcon(source, appleTouch, 180, { inset: SCENE_INSET.webAppleTouch })
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

assertSources()
fs.mkdirSync(brandDir, { recursive: true })

await writeWordmark(sources.wordmark, path.join(brandDir, 'logo.png'))

const appIconSquared = await squaredAppIcon(await loadAppIconSource(sources.appIcon))

await writeFaviconSet(appIconSquared, brandDir)

const iconPng = path.join(brandDir, 'icon.png')
await writeAppIcon(appIconSquared, iconPng, 1024, { inset: SCENE_INSET.brandArchive })
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
  await writeAppIcon(appIconSquared, out1, size, { inset: SCENE_INSET.macInstaller })
  await writeAppIcon(appIconSquared, out2, size * 2, { inset: SCENE_INSET.macInstaller })
}

const iconIcns = path.join(brandDir, 'icon.icns')
try {
  execSync(`iconutil -c icns "${iconset}" -o "${iconIcns}"`, { stdio: 'inherit' })
  console.log(`✓ ${path.relative(root, iconIcns)}`)
} catch {
  console.warn('⚠ iconutil failed — build/icon.png is still available for electron-builder')
}

fs.rmSync(iconset, { recursive: true, force: true })

const webFaviconMirrors = (name) => [`server/admin/public/${name}`]
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
await mirrorFile('favicon.png', [...rendererPublicMirrors('favicon.png'), ...webFaviconMirrors('favicon.png')])
await mirrorFile('apple-touch-icon.png', webFaviconMirrors('apple-touch-icon.png'))

await writeAppIcon(
  appIconSquared,
  path.join(root, 'src/renderer/public/apple-touch-icon.png'),
  180,
  { inset: SCENE_INSET.macDockRuntime }
)
console.log(`✓ ${path.relative(root, 'src/renderer/public/apple-touch-icon.png')}`)

const dockIconPng = path.join(brandDir, 'dock-icon.png')
await writeAppIcon(appIconSquared, dockIconPng, 512, { inset: SCENE_INSET.macDockRuntime })
console.log(`✓ ${path.relative(root, dockIconPng)}`)

await mirrorFile('icon.png', ['build/icon.png'])
await mirrorFile('dock-icon.png', ['build/dock-icon.png'])
if (fs.existsSync(iconIcns)) {
  await mirrorFile('icon.icns', ['build/icon.icns'])
}

console.log('Brand assets synced: petory_logo/ → brand/generated/ → deployment mirrors')

const verification = await verifyBrandAssets(root)
if (!verification.ok) {
  console.error('✗ Brand asset verification failed:')
  for (const err of verification.errors) console.error(`  - ${err}`)
  process.exit(1)
}
console.log('✓ Brand assets verified (cat face + Dock edges)')

try {
  execSync('node scripts/generate-og-share.mjs', { cwd: root, stdio: 'inherit' })
} catch {
  console.warn('⚠ og-share.png generation skipped')
}
