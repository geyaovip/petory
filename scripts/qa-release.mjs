import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf-8'))
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}

function ok(message) {
  console.log(`✓ ${message}`)
}

const pkg = readJson('package.json')
const version = pkg.version

const requiredFiles = [
  'package.json',
  'electron-builder.yml',
  'website/index.html',
  'website/download.html',
  'website/download.js',
  'website/releases/latest.json',
  'scripts/sync-release-manifest.mjs',
  'scripts/copy-update-feed.mjs',
  'scripts/rembg_remove.py',
  'resources/sample/pet.svg',
  'brand/generated/logo.png',
  'brand/generated/favicon.png',
  'brand/generated/icon.png',
  'brand/generated/icon.icns'
]

for (const file of requiredFiles) {
  if (fs.existsSync(path.join(root, file))) {
    ok(`found ${file}`)
  } else {
    fail(`missing ${file}`)
  }
}

const manifest = readJson('website/releases/latest.json')
if (manifest.version === version) {
  ok(`latest.json version matches package.json (${version})`)
} else {
  fail(`latest.json version ${manifest.version} != package.json ${version}`)
}

if (manifest.updateFeed === 'https://petory.chat/releases') {
  ok('update feed URL configured')
} else {
  fail(`unexpected updateFeed: ${manifest.updateFeed}`)
}

const builder = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf-8')
if (builder.includes('https://petory.chat/releases')) {
  ok('electron-builder publish URL configured')
} else {
  fail('electron-builder publish URL missing')
}

const releaseDir = path.join(root, 'release')
if (fs.existsSync(releaseDir)) {
  const ymlFiles = fs.readdirSync(releaseDir).filter((f) => f.startsWith('latest') && f.endsWith('.yml'))
  if (ymlFiles.length > 0) {
    ok(`release feed files present: ${ymlFiles.join(', ')}`)
  } else {
    console.warn('⚠ release/ has no latest*.yml — run npm run pack && npm run release:prepare before deploy')
  }
} else {
  console.warn('⚠ release/ directory missing — run npm run pack before publishing')
}

if (process.exitCode) {
  console.error('\nQA release checks failed.')
} else {
  console.log('\nQA release checks passed.')
}
