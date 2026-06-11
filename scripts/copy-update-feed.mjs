import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const releaseDir = path.join(root, 'release')
const outDir = path.join(root, 'website/releases')

if (!fs.existsSync(releaseDir)) {
  console.warn('No release/ directory — run npm run pack first.')
  process.exit(0)
}

fs.mkdirSync(outDir, { recursive: true })
let copied = 0

const assetBaseUrl =
  process.env.PETORY_RELEASE_ASSET_BASE ??
  process.env.PETORY_DOWNLOAD_BASE_URL ??
  'https://api.petory.chat/downloads'

for (const file of fs.readdirSync(releaseDir)) {
  if (file.startsWith('latest') && file.endsWith('.yml')) {
    let content = fs.readFileSync(path.join(releaseDir, file), 'utf8')
    content = content.replace(
      /url:\s+(?!https?:\/\/)(\S+\.(?:dmg|exe|zip))/g,
      `url: ${assetBaseUrl}/$1`
    )
    content = content.replace(
      /^path:\s+(?!https?:\/\/)(\S+\.(?:dmg|exe|zip))\s*$/gm,
      `path: ${assetBaseUrl}/$1`
    )
    fs.writeFileSync(path.join(outDir, file), content, 'utf8')
    console.log(`Copied ${file} → website/releases/`)
    copied++
  }
}

if (copied === 0) {
  console.warn('No latest*.yml found in release/. Pack the app first.')
}
