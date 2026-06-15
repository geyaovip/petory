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
  'PUBLIC_BASE_URL',
  'ADMIN_EMAIL',
  'OPERATOR_EMAIL'
]

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
if (fs.existsSync(targetPath)) {
  target = parseEnv(fs.readFileSync(targetPath, 'utf-8'))
}

let merged = 0
for (const key of MERGE_KEYS) {
  const value = source.get(key)
  if (!value) continue
  if (target.get(key) === value) continue
  target.set(key, value)
  merged += 1
}

if (merged === 0 && fs.existsSync(targetPath)) {
  console.log('✓ deploy/server/.env already has the same ARK/mail/chat values as server/.env')
} else {
  const body = serializeEnv(templateLines, target)
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

console.log('\nNext on VPS:')
console.log('  scp deploy/server/.env ubuntu@YOUR_HOST:/home/ubuntu/apps/petory/current/deploy/server/.env')
console.log('  ssh ubuntu@YOUR_HOST "cd /home/ubuntu/apps/petory/current && git pull --ff-only && docker compose -f deploy/server/compose.yaml up -d --build"')
