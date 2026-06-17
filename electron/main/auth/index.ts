export {
  rejectLegacyOfflineSession,
  getAuthState,
  isAuthenticated,
  requestMagicLink,
  consumeMagicLink,
  logout,
  redeemCode,
  clearAuthData,
  bootstrapRemoteSession,
  refreshAuthState
} from './authService'

export { incrementChatUsage, incrementGenerationUsage } from './usageStore'
export {
  canActivatePet,
  canCreatePet,
  canGeneratePet,
  canSendChat,
  buildAuthState
} from './entitlementService'
