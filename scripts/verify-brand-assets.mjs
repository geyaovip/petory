import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function pixelFlags(r, g, b, a) {
  const light = (r + g + b) / 3
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return { light, sat, a, isWhiteFur: light > 200 && sat < 40 && a > 200 }
}

async function analyzeDockIcon(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const errors = []

  let whiteFur = 0
  let centralTransparency = 0
  for (let y = Math.floor(height * 0.34); y < Math.floor(height * 0.56); y++) {
    for (let x = Math.floor(width * 0.38); x < Math.floor(width * 0.62); x++) {
      const i = (y * width + x) * channels
      if (pixelFlags(data[i], data[i + 1], data[i + 2], data[i + 3]).isWhiteFur) whiteFur++
      if (data[i + 3] < 250) centralTransparency++
    }
  }
  if (whiteFur < 80) {
    errors.push(`猫脸/胸口白色区域过少（${whiteFur} px，期望 ≥80）— 可能被误清透明`)
  }
  if (centralTransparency > 0) {
    errors.push(`Dock 图标主体内部仍有 ${centralTransparency} 个透明/半透明像素`)
  }

  let leftPale = 0
  let bottomPale = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const { light, sat, a } = pixelFlags(data[i], data[i + 1], data[i + 2], data[i + 3])
      if (a > 10) {
        if (light >= 175 && sat < 45) leftPale++
        break
      }
    }
  }
  for (let x = 0; x < width; x++) {
    for (let y = height - 1; y >= 0; y--) {
      const i = (y * width + x) * channels
      const { light, sat, a } = pixelFlags(data[i], data[i + 1], data[i + 2], data[i + 3])
      if (a > 10) {
        if (light >= 175 && sat < 45) bottomPale++
        break
      }
    }
  }
  if (leftPale > 0) errors.push(`Dock 图标左边仍有 ${leftPale} 处浅色白边像素`)
  if (bottomPale > 0) errors.push(`Dock 图标底边仍有 ${bottomPale} 处浅色白边像素`)

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      if (data[i + 3] < 10) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  const visibleRatio = Math.max(maxX - minX + 1, maxY - minY + 1) / Math.max(width, height)
  if (visibleRatio < 0.77 || visibleRatio > 0.82) {
    errors.push(`Dock 图标可见尺寸占比为 ${(visibleRatio * 100).toFixed(1)}%，期望 77%–82%`)
  }

  return errors
}

async function countTransparentPixels(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let count = 0
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] < 255) count++
  }
  return count
}

export async function verifyBrandAssets(baseRoot = root) {
  const dockIcon = path.join(baseRoot, 'build/dock-icon.png')
  const errors = []
  const warnings = []

  const appIconSource = path.join(baseRoot, 'petory_logo', '03_petory_app_icon_transparent.png')
  if (fs.existsSync(appIconSource)) {
    const sourceMeta = await sharp(appIconSource).metadata()
    if ((sourceMeta.width ?? 0) < 512 || (sourceMeta.height ?? 0) < 512) {
      warnings.push(
        `方形 Logo 源图仅 ${sourceMeta.width}×${sourceMeta.height}，生成 1024px 安装图标时会放大；建议补一份至少 1024×1024 的同构图源`
      )
    }
  }

  if (!fs.existsSync(dockIcon)) {
    errors.push('缺少 build/dock-icon.png — 请先运行 npm run sync:brand')
    return { ok: false, errors, warnings }
  }

  const meta = await sharp(dockIcon).metadata()
  if (meta.width !== 512 || meta.height !== 512) {
    errors.push(`dock-icon 应为 512×512，当前 ${meta.width}×${meta.height}`)
  }

  errors.push(...(await analyzeDockIcon(dockIcon)))

  const appleTouch = path.join(baseRoot, 'brand/generated/apple-touch-icon.png')
  if (!fs.existsSync(appleTouch)) {
    errors.push('缺少 brand/generated/apple-touch-icon.png')
  } else {
    const transparent = await countTransparentPixels(appleTouch)
    if (transparent > 0) errors.push(`Apple Touch 图标仍有 ${transparent} 个透明/半透明像素`)
  }

  for (const size of [16, 32, 48]) {
    const favicon = path.join(baseRoot, 'brand/generated', `favicon-${size}.png`)
    if (!fs.existsSync(favicon)) {
      errors.push(`缺少 favicon-${size}.png`)
      continue
    }
    const { data, info } = await sharp(favicon).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let touchesEdge = false
    for (let y = 0; y < info.height && !touchesEdge; y++) {
      for (let x = 0; x < info.width; x++) {
        if (x > 0 && y > 0 && x < info.width - 1 && y < info.height - 1) continue
        if (data[(y * info.width + x) * info.channels + 3] > 8) {
          touchesEdge = true
          break
        }
      }
    }
    if (touchesEdge) errors.push(`favicon-${size}.png 的图形触碰画布边缘`)
  }

  return { ok: errors.length === 0, errors, warnings }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const result = await verifyBrandAssets()
  if (!result.ok) {
    console.error('✗ Brand asset verification failed:')
    for (const err of result.errors) console.error(`  - ${err}`)
    process.exit(1)
  }
  for (const warning of result.warnings) console.warn(`⚠ ${warning}`)
  console.log('✓ Brand assets verified (cat face + Dock edges)')
}
