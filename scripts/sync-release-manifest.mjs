import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
const version = pkg.version
const githubRepo = process.env.PETORY_GITHUB_REPO ?? 'geyaovip/petory'
const releaseBaseUrl =
  process.env.PETORY_RELEASE_BASE_URL ??
  `https://github.com/${githubRepo}/releases/download/v${version}`
const downloadBaseUrl = process.env.PETORY_DOWNLOAD_BASE_URL ?? 'https://api.petory.chat/downloads'
const assetBaseUrl = process.env.PETORY_RELEASE_ASSET_BASE

const releaseDir = path.join(root, 'release')

function findArtifact(ext) {
  if (!fs.existsSync(releaseDir)) return null
  return fs.readdirSync(releaseDir).find((f) => f.endsWith(ext) && !f.endsWith('.blockmap'))
}

function sizeLabel(bytes, fallback) {
  if (!bytes) return fallback
  return `~${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`
}

function macUrl(fileName, hasArtifact) {
  if (assetBaseUrl) return `${assetBaseUrl}/${fileName}`
  if (hasArtifact) return `${downloadBaseUrl}/${fileName}`
  return `${releaseBaseUrl}/${fileName}`
}

function winUrl(fileName, hasArtifact) {
  if (assetBaseUrl) return `${assetBaseUrl}/${fileName}`
  if (hasArtifact && process.env.PETORY_HOST_WIN_ON_API === '1') {
    return `${downloadBaseUrl}/${fileName}`
  }
  return `${releaseBaseUrl}/${fileName}`
}

const macDmg = findArtifact('.dmg')
const macFileName = macDmg ?? `Petory-${version}-arm64.dmg`
const macSizeBytes = macDmg ? fs.statSync(path.join(releaseDir, macDmg)).size : null

const winExe = findArtifact('.exe')
const winFileName = winExe ?? `Petory-Setup-${version}.exe`
const winSizeBytes = winExe ? fs.statSync(path.join(releaseDir, winExe)).size : null

const changelogPath = path.join(root, 'website/releases/latest.json')
const previousChangelog = (() => {
  try {
    const previous = JSON.parse(fs.readFileSync(changelogPath, 'utf-8'))
    if (Array.isArray(previous.changelog) && previous.changelog.length > 0) {
      return previous.changelog
    }
  } catch {
    // ignore
  }
  return [
    '透明像素精细命中：只有点到宠物本体才响应，其余区域穿透',
    '同伴宠点击可短暂切换开心姿势；主宠状态音效（设置中开启）',
    '宠物管理支持单姿势重生成，不消耗每日生成额度',
    '成长页：小成就徽章、最近互动、姿势数量',
    '导出包增强（云同步预留）'
  ]
})()

const manifest = {
  version,
  releasedAt: new Date().toISOString().slice(0, 10),
  mac: {
    fileName: macFileName,
    url: macUrl(macFileName, Boolean(macDmg)),
    sizeLabel: sizeLabel(macSizeBytes, '~120 MB')
  },
  win: {
    fileName: winFileName,
    url: winUrl(winFileName, Boolean(winExe)),
    sizeLabel: sizeLabel(winSizeBytes, '~100 MB')
  },
  updateFeed: 'https://petory.chat/releases',
  changelog: previousChangelog
}

const outDir = path.join(root, 'website/releases')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
console.log(`Synced website/releases/latest.json for v${version}`)
