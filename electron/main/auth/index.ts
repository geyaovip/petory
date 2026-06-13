export {
  rejectLegacyOfflineSession,
  getAuthState,
  isAuthenticated,
  login,
  requestMagicLink,
  consumeMagicLink,
  logout,
  redeemCode,
  register,
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
  canUseStyle,
  buildAuthState
} from './entitlementService'
