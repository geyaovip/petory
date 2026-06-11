import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
const version = pkg.version
const githubRepo = process.env.PETORY_GITHUB_REPO ?? 'geyaovip/petory'
const releaseBaseUrl = process.env.PETORY_RELEASE_BASE_URL ?? `https://github.com/${githubRepo}/releases/download/v${version}`

const releaseDir = path.join(root, 'release')
const macDmg =
  fs.existsSync(releaseDir)
    ? fs.readdirSync(releaseDir).find((f) => f.endsWith('.dmg') && !f.endsWith('.blockmap'))
    : null
const macFileName = macDmg ?? `Petory-${version}-mac.dmg`
const macSizeBytes = macDmg ? fs.statSync(path.join(releaseDir, macDmg)).size : null
const macSizeLabel = macSizeBytes
  ? `~${Math.max(1, Math.round(macSizeBytes / 1024 / 1024))} MB`
  : '~120 MB'

const manifest = {
  version,
  releasedAt: new Date().toISOString().slice(0, 10),
  mac: {
    fileName: macFileName,
    url: `${releaseBaseUrl}/${macFileName}`,
    sizeLabel: macSizeLabel
  },
  win: {
    fileName: `Petory Setup ${version}.exe`,
    url: `${releaseBaseUrl}/Petory-Setup-${version}.exe`,
    sizeLabel: '~100 MB'
  },
  updateFeed: 'https://petory.chat/releases',
  changelog: [
    '多姿势图与睡觉状态',
    'Pro 姿势补全',
    '多宠并行与点击穿透',
    '六种画风桌宠'
  ]
}

const outDir = path.join(root, 'website/releases')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
console.log(`Synced website/releases/latest.json for v${version}`)
