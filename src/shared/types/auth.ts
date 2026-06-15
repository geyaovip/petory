export type PlanTier = 'free' | 'pro'
export type AuthMode = 'account' | 'offline'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  plan: PlanTier
  proExpiresAt?: string | null
  createdAt: string
}

export interface AuthSession {
  user: AuthUser
  mode: AuthMode
  token: string
  loggedInAt: string
}

export interface EntitlementLimits {
  maxPets: number
  maxDesktopPets: number
  dailyChatLimit: number
  dailyGenerationLimit: number
  multiPet: boolean
}

export interface UsageSnapshot {
  date: string
  chatCount: number
  generationCount: number
}

export interface AuthState {
  session: AuthSession | null
  usage: UsageSnapshot
  limits: EntitlementLimits
  remainingChat: number
  remainingGeneration: number
  maintenanceNotice?: string | null
  useRemoteBackend?: boolean
  registrationOpen?: boolean
  generationServiceEnabled?: boolean
  chatServiceEnabled?: boolean
  paymentEnabled?: boolean
  mockPaymentEnabled?: boolean
}

export type MagicLinkRequestResult =
  | { success: true; message: string }
  | { success: false; message: string }

export interface PoseCompletionSummary {
  added: number
  pets: number
  failed: number
}

export type AuthActionResult =
  | { success: true; state: AuthState; poseCompletion?: PoseCompletionSummary }
  | { success: false; message: string }
