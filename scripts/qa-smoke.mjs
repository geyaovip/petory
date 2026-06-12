#!/usr/bin/env node
/**
 * API smoke checks for local dev stack.
 * Usage: PETORY_API_BASE_URL=http://localhost:8787 npm run qa:smoke
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const base = (process.env.PETORY_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '')

function fail(message) {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}

function ok(message) {
  console.log(`✓ ${message}`)
}

async function getJson(pathname) {
  const res = await fetch(`${base}${pathname}`)
  const data = await res.json().catch(() => ({}))
  return { res, data }
}

console.log(`Petory API smoke — ${base}\n`)

try {
  const health = await getJson('/health')
  if (!health.res.ok || health.data.ok !== true) {
    fail(`/health failed (${health.res.status})`)
  } else {
    ok(`/health → version ${health.data.version ?? 'unknown'}`)
  }

  const status = await getJson('/api/app/status')
  if (!status.res.ok) {
    fail(`/api/app/status failed (${status.res.status})`)
  } else {
    ok(
      `/api/app/status → registration=${status.data.registrationOpen}, payment=${status.data.paymentEnabled}`
    )
  }

  const plans = await getJson('/api/payment/plans')
  if (!plans.res.ok || !Array.isArray(plans.data.plans)) {
    fail('/api/payment/plans failed')
  } else {
    ok(`/api/payment/plans → ${plans.data.plans.length} plan(s)`)
  }

  const protectedRes = await fetch(`${base}/api/me`, {
    headers: { Authorization: 'Bearer invalid-token' }
  })
  if (protectedRes.status === 401) {
    ok('/api/me rejects invalid JWT (401)')
  } else {
    fail(`/api/me expected 401, got ${protectedRes.status}`)
  }
} catch (error) {
  fail(error instanceof Error ? error.message : 'fetch failed — is the server running?')
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
ok(`client package version ${pkg.version}`)

if (process.exitCode) {
  console.error('\nSmoke checks failed. Start stack: npm run dev:stack')
} else {
  console.log('\nSmoke checks passed. Complete manual steps in docs/quality/QA-INTERNAL.md')
}
