import type { EntitlementLimits, PlanTier } from './types/auth'

/** One custom pet per account; deleting locally does not reset this limit. */
export const CUSTOM_PET_LIMIT_MESSAGE =
  '您已创建过自定义宠物，暂不支持再次创建或重新生成，账号其他功能可正常使用。'

export const PLAN_LIMITS: Record<PlanTier, EntitlementLimits> = {
  free: {
    maxPets: 10,
    maxDesktopPets: 5,
    dailyChatLimit: 20,
    dailyGenerationLimit: 3,
    multiPet: true
  },
  pro: {
    maxPets: 10,
    maxDesktopPets: 5,
    dailyChatLimit: 9999,
    dailyGenerationLimit: 50,
    multiPet: true
  }
}

/** Kept for compatibility with older local sessions while membership UI is disabled. */
export const MOCK_REDEEM_CODES: Record<string, PlanTier> = {
  'PETORY-PRO-DEMO': 'pro',
  'PETORY-PRO-TEST': 'pro'
}
