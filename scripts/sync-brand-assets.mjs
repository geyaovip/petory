import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'petory_logo')

const sources = {
  primary: '01_petory_primary_logo_transparent.png',
  appIcon: '03_petory_app_icon_transparent.png',
  avatar: '05_petory_social_avatar_transparent.png'
}

function copy(fromName, toPath) {
  const from = path.join(srcDir, fromName)
  const to = path.join(root, toPath)
  if (!fs.existsSync(from)) {
    throw new Error(`Missing source asset: ${from}`)
  }
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log(`✓ ${toPath}`)
}

for (const file of Object.values(sources)) {
  const full = path.join(srcDir, file)
  if (!fs.existsSync(full)) {
    console.error(`✗ Expected ${full}`)
    process.exit(1)
  }
}

copy(sources.primary, 'website/assets/logo.png')
copy(sources.primary, 'src/renderer/public/logo.png')
copy(sources.primary, 'server/admin/public/logo.png')
copy(sources.appIcon, 'server/admin/public/app-icon.png')
copy(sources.appIcon, 'website/assets/app-icon.png')
copy(sources.appIcon, 'src/renderer/public/app-icon.png')
copy(sources.appIcon, 'website/favicon.png')
copy(sources.avatar, 'website/assets/avatar.png')

const buildDir = path.join(root, 'build')
fs.mkdirSync(buildDir, { recursive: true })
const iconPng = path.join(buildDir, 'icon.png')
execSync(
  `sips -z 1024 1024 "${path.join(srcDir, sources.appIcon)}" --out "${iconPng}"`,
  { stdio: 'inherit' }
)

const iconset = path.join(buildDir, 'icon.iconset')
if (fs.existsSync(iconset)) {
  fs.rmSync(iconset, { recursive: true, force: true })
}
fs.mkdirSync(iconset, { recursive: true })

for (const size of [16, 32, 128, 256, 512]) {
  const out1 = path.join(iconset, `icon_${size}x${size}.png`)
  const out2 = path.join(iconset, `icon_${size}x${size}@2x.png`)
  execSync(`sips -z ${size} ${size} "${iconPng}" --out "${out1}"`, { stdio: 'inherit' })
  execSync(`sips -z ${size * 2} ${size * 2} "${iconPng}" --out "${out2}"`, { stdio: 'inherit' })
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
