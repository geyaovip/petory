#!/usr/bin/env node
/**
 * Merge ARK / mail / chat keys from server/.env into deploy/server/.env
 * for production Docker Compose. Never prints secret values.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = path.join(root, 'server/.env')
const templatePath = path.join(root, 'deploy/server/env.example')
const targetPath = path.join(root, 'deploy/server/.env')

const MERGE_KEYS = [
  'ARK_API_KEY',
  'ARK_API_BASE',
  'ARK_IMAGE_MODEL',
  'RESEND_API_KEY',
  'MAIL_FROM',
  'KIMI_API_KEY',
  'KIMI_API_BASE',
  'KIMI_MODEL',
  'ADMIN_EMAIL',
  'OPERATOR_EMAIL'
]

const PRODUCTION_PUBLIC_BASE_URL = 'https://api.petory.chat'

function isLocalBaseUrl(value) {
  if (!value) return true
  try {
    const host = new URL(value).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
  } catch {
    return true
  }
}

function parseEnv(text) {
  const map = new Map()
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    map.set(key, value)
  }
  return map
}

function serializeEnv(lines, map) {
  const out = []
  const used = new Set()
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line)
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq < 0) {
      out.push(line)
      continue
    }
    const key = trimmed.slice(0, eq).trim()
    if (map.has(key)) {
      const value = map.get(key)
      out.push(`${key}=${value.includes(' ') ? `"${value}"` : value}`)
      used.add(key)
    } else {
      out.push(line)
    }
  }
  for (const key of MERGE_KEYS) {
    if (!used.has(key) && map.has(key) && map.get(key)) {
      const value = map.get(key)
      out.push(`${key}=${value.includes(' ') ? `"${value}"` : value}`)
    }
  }
  return out.join('\n').replace(/\n?$/, '\n')
}

if (!fs.existsSync(sourcePath)) {
  console.error('✗ Missing server/.env — copy server/.env.example and fill ARK_API_KEY first.')
  process.exit(1)
}

const source = parseEnv(fs.readFileSync(sourcePath, 'utf-8'))
const template = fs.readFileSync(templatePath, 'utf-8')
const templateLines = template.split('\n')

let target = new Map()
let baseLines = templateLines
if (fs.existsSync(targetPath)) {
  const existingText = fs.readFileSync(targetPath, 'utf-8')
  target = parseEnv(existingText)
  baseLines = existingText.split('\n')
}

let merged = 0
for (const key of MERGE_KEYS) {
  const value = source.get(key)
  if (!value) continue
  if (target.get(key) === value) continue
  target.set(key, value)
  merged += 1
}

const templateMap = parseEnv(template)
const prodPublicUrl = templateMap.get('PUBLIC_BASE_URL') || PRODUCTION_PUBLIC_BASE_URL
if (isLocalBaseUrl(target.get('PUBLIC_BASE_URL'))) {
  if (target.get('PUBLIC_BASE_URL') !== prodPublicUrl) {
    target.set('PUBLIC_BASE_URL', prodPublicUrl)
    merged += 1
  }
}

const preserved = ['POSTGRES_PASSWORD', 'JWT_SECRET'].filter(
  (key) => target.has(key) && target.get(key) && !source.has(key)
)

if (merged === 0 && fs.existsSync(targetPath)) {
  console.log('✓ deploy/server/.env already has the same ARK/mail/chat values as server/.env')
} else {
  const body = serializeEnv(baseLines, target)
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.writeFileSync(targetPath, body, 'utf-8')
  console.log(`✓ Updated deploy/server/.env (${merged} key(s) merged from server/.env)`)
}

const ark = target.get('ARK_API_KEY') || source.get('ARK_API_KEY')
if (!ark) {
  console.warn('⚠ ARK_API_KEY is still empty — image generation will fail until you set it in server/.env')
} else {
  console.log(`✓ ARK_API_KEY present (${ark.length} chars)`)
}

const publicUrl = target.get('PUBLIC_BASE_URL')
if (isLocalBaseUrl(publicUrl)) {
  console.warn('⚠ PUBLIC_BASE_URL is still localhost — magic-link emails will be broken')
} else {
  console.log(`✓ PUBLIC_BASE_URL → ${publicUrl}`)
}

console.log('\nNext: npm run deploy:server')
