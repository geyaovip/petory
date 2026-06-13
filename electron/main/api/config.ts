import { loadUserSettings } from '../settingsStore'

export const DEFAULT_API_BASE_URL = 'https://api.petory.chat'

export function getApiBaseUrl(): string {
  const fromSettings = loadUserSettings().apiBaseUrl?.trim()
  const raw = fromSettings || process.env['PETORY_API_BASE_URL']?.trim()
  return (raw || DEFAULT_API_BASE_URL).replace(/\/$/, '')
}

export function isRemoteBackendEnabled(): boolean {
  return true
}
