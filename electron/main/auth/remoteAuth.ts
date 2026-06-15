import type {
  AuthActionResult,
  AuthSession,
  MagicLinkRequestResult
} from '../../../src/shared/types/auth'
import type { ServerAuthUser } from '../../../src/shared/types/api'
import { apiFetch } from '../api/client'
import { refreshAppStatus } from '../api/appStatus'
import { getLocalDeviceId } from '../api/deviceId'
import {
  applyQuotaFromResponse,
  clearRemoteQuota,
  refreshRemoteQuota
} from '../api/remoteQuotaStore'
import { buildAuthState } from './entitlementService'
import { loadSession, saveSession, clearSession } from './authStore'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) return '请输入有效的邮箱地址。'
  return null
}

function toSession(user: ServerAuthUser, token: string): AuthSession {
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      proExpiresAt: user.proExpiresAt ?? null,
      createdAt: user.createdAt
    },
    mode: 'account',
    token,
    loggedInAt: new Date().toISOString()
  }
}

async function registerDevice(): Promise<void> {
  await apiFetch('/api/devices/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localDeviceId: getLocalDeviceId(),
      deviceName: process.platform,
      os: process.platform,
      appVersion: process.env.npm_package_version
    })
  })
}

async function registerDeviceSafe(): Promise<void> {
  try {
    await registerDevice()
  } catch (error) {
    console.warn('[petory] device register failed:', error)
  }
}

function success(): AuthActionResult {
  return { success: true, state: buildAuthState() }
}

function failure(message: string): AuthActionResult {
  return { success: false, message }
}

async function afterAuth(
  user: ServerAuthUser,
  token: string,
  quota?: { quota?: unknown; chatQuota?: unknown }
): Promise<AuthActionResult> {
  saveSession(toSession(user, token))
  applyQuotaFromResponse({
    userLimits: user.limits,
    quota: quota?.quota as never,
    chatQuota: quota?.chatQuota as never
  })
  await refreshAppStatus(true)
  await registerDeviceSafe()
  try {
    await refreshRemoteQuota()
  } catch {
    // quota already applied from login response when available
  }
  return success()
}

export async function remoteRequestMagicLink(email: string): Promise<MagicLinkRequestResult> {
  const emailError = validateEmail(email)
  if (emailError) return { success: false, message: emailError }

  try {
    const result = await apiFetch<MagicLinkRequestResult>('/api/auth/magic-link', {
      method: 'POST',
      auth: false,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    return result
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '登录邮件发送失败，请稍后再试。'
    }
  }
}

export async function remoteConsumeMagicLink(token: string): Promise<AuthActionResult> {
  if (!token.trim()) return failure('登录链接无效。')
  try {
    const result = await apiFetch<{
      success: boolean
      accessToken?: string
      user?: ServerAuthUser
      message?: string
    }>('/api/auth/callback', {
      method: 'POST',
      auth: false,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    if (!result.success || !result.accessToken || !result.user) {
      return failure(result.message || '登录链接无效或已过期。')
    }
    return afterAuth(result.user, result.accessToken)
  } catch (error) {
    return failure(error instanceof Error ? error.message : '登录失败，请重新发送链接。')
  }
}

export async function remoteLogout(): Promise<AuthActionResult> {
  clearSession()
  clearRemoteQuota()
  return success()
}

export async function remoteRedeemCode(code: string): Promise<AuthActionResult> {
  const session = loadSession()
  if (!session) return failure('请先登录。')
  try {
    const result = await apiFetch<{
      success: boolean
      message?: string
      user?: ServerAuthUser
      quota?: unknown
    }>('/api/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })

    if (!result.success || !result.user) {
      return failure(result.message || '兑换失败。')
    }

    saveSession({
      ...session,
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        plan: result.user.plan,
        proExpiresAt: result.user.proExpiresAt ?? null,
        createdAt: result.user.createdAt
      }
    })
    applyQuotaFromResponse({
      userLimits: result.user.limits,
      quota: result.quota as never
    })
    await refreshRemoteQuota()
    return success()
  } catch (error) {
    return failure(error instanceof Error ? error.message : '兑换失败。')
  }
}
