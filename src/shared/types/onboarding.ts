export type OnboardingIntent =
  | { mode: 'new'; returnTo?: 'pets' }
  | { mode: 'replace'; returnTo?: 'pets' }
  | { mode: 'restyle'; petId: string; returnTo?: 'pets' }
