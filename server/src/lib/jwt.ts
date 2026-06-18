import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export type TokenRole = 'user' | 'admin'

export interface TokenPayload {
  sub: string
  role: TokenRole
  email: string
}

function resolveExpiresIn(override?: string): string | undefined {
  const raw = (override ?? config.jwtExpiresIn).trim()
  if (!raw || raw === 'never' || raw === '0') return undefined
  return raw
}

export function signToken(payload: TokenPayload, expiresIn?: string): string {
  const ttl = resolveExpiresIn(expiresIn)
  if (!ttl) return jwt.sign(payload, config.jwtSecret)
  return jwt.sign(payload, config.jwtSecret, { expiresIn: ttl as never })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload
}
