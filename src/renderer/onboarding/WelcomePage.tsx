import type { ReactElement } from 'react'
import { ONBOARDING_COPY } from '@shared/copy/onboarding'
import { Button } from '../components/ui/Button'
import { PageShell } from '../components/ui/PageShell'

interface WelcomePageProps {
  onCreate: () => void
  onTrySample: () => void
  sampleLoading?: boolean
}

export function WelcomePage({
  onCreate,
  onTrySample,
  sampleLoading = false
}: WelcomePageProps): ReactElement {
  return (
    <PageShell className="items-center justify-center bg-petory-surface text-center">
      <img src="/logo.png" alt="Petory" className="mb-8 h-14 w-auto" />
      <div className="mb-9 max-w-[340px]">
        <p className="text-[26px] font-semibold leading-snug tracking-[-0.02em]">{ONBOARDING_COPY.welcome.title}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-petory-text-secondary">
          {ONBOARDING_COPY.welcome.subtitle}
        </p>
      </div>
      <div className="flex w-full max-w-[320px] flex-col gap-3">
        <Button fullWidth onClick={onCreate}>
          {ONBOARDING_COPY.welcome.createCta}
        </Button>
        <Button fullWidth variant="ghost" disabled={sampleLoading} onClick={onTrySample}>
          {sampleLoading ? ONBOARDING_COPY.welcome.sampleLoading : ONBOARDING_COPY.welcome.sampleCta}
        </Button>
      </div>
    </PageShell>
  )
}
