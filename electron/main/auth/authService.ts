import type {
  AuthActionResult,
  AuthState,
  LoginInput,
  MagicLinkRequestResult,
  RegisterInput
} from '../../../src/shared/types/auth'
import { isRemoteBackendEnabled } from '../api/config'
import { refreshAppStatus } from '../api/appStatus'
import { ensureRemoteQuotaFresh } from '../api/remoteQuotaStore'
import { buildAuthState } from './entitlementService'
import { clearSession, loadSession } from './authStore'
import * as remote from './remoteAuth'

export function getAuthState() {
  return buildAuthState()
}

export function rejectLegacyOfflineSession(): void {
  const session = loadSession()
  if (
    session?.mode === 'offline' ||
    session?.token === 'offline' ||
    session?.token.startsWith('mock_')
  ) {
    clearSession()
  }
}

export function isAuthenticated(): boolean {
  const session = loadSession()
  return session !== null && session.mode === 'account'
}

export async function login(input: LoginInput): Promise<AuthActionResult> {
  return remote.remoteLogin(input)
}

export async function requestMagicLink(email: string): Promise<MagicLinkRequestResult> {
  return remote.remoteRequestMagicLink(email)
}

export async function consumeMagicLink(token: string): Promise<AuthActionResult> {
  return remote.remoteConsumeMagicLink(token)
}

export async function register(input: RegisterInput): Promise<AuthActionResult> {
  return remote.remoteRegister(input)
}

export async function logout(): Promise<AuthActionResult> {
  return remote.remoteLogout()
}

export async function redeemCode(code: string): Promise<AuthActionResult> {
  return remote.remoteRedeemCode(code)
}

export function clearAuthData(): void {
  clearSession()
}

export async function bootstrapRemoteSession(): Promise<void> {
  if (!isRemoteBackendEnabled()) return
  await refreshAppStatus(true)
  const session = loadSession()
  if (session?.mode === 'account' && session.token !== 'offline') {
    try {
      await ensureRemoteQuotaFresh(true)
    } catch (error) {
      console.warn('[petory] failed to refresh remote quota:', error)
    }
  }
}

export async function refreshAuthState(): Promise<AuthState> {
  await bootstrapRemoteSession()
  try {
    await ensureRemoteQuotaFresh(true)
  } catch (error) {
    console.warn('[petory] failed to refresh auth quota state:', error)
  }
  return buildAuthState()
}
