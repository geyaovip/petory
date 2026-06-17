import { config as loadEnv } from 'dotenv'
import path from 'path'

loadEnv({ path: path.join(process.cwd(), '.env') })

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  jwtSecret: required('JWT_SECRET', 'petory-dev-secret'),
  /** Empty / "never" / "0" → token has no expiry; otherwise passed to jsonwebtoken expiresIn */
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '').trim(),
  databaseUrl: required(
    'DATABASE_URL',
    'postgresql://petory:petory@localhost:5433/petory?schema=public'
  ),
  arkApiKey: process.env.ARK_API_KEY ?? '',
  arkApiBase: (process.env.ARK_API_BASE ?? 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, ''),
  arkImageModel: process.env.ARK_IMAGE_MODEL ?? 'doubao-seedream-4-5-251128',
  adminEmail: (process.env.ADMIN_EMAIL ?? 'admin@petory.app').toLowerCase(),
  operatorEmail: (process.env.OPERATOR_EMAIL ?? 'operator@petory.app').toLowerCase(),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? 'http://localhost:8787').replace(/\/$/, ''),
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  mailFrom: process.env.MAIL_FROM ?? 'Petory <noreply@petory.chat>',
  uploadsDir: path.join(process.cwd(), 'uploads'),
  maxUploadBytes: 10 * 1024 * 1024,
  jobTimeoutMs: 60_000,
  kimiApiKey: process.env.KIMI_API_KEY ?? '',
  kimiApiBase: process.env.KIMI_API_BASE ?? 'https://api.moonshot.cn/v1',
  kimiModel: process.env.KIMI_MODEL ?? 'moonshot-v1-8k',
  chatMaxHistory: 20,
  chatMaxInputChars: 2000
}
