import { useEffect, useState, type ReactElement } from 'react'
import { ONBOARDING_COPY } from '@shared/copy/onboarding'
import type { GenerationPhase } from '@shared/types/pet'
import { BrandLogo } from '../components/BrandLogo'
import { PageShell } from '../components/ui/PageShell'

const PHASE_HEADLINE: Record<GenerationPhase, string> = {
  upload: ONBOARDING_COPY.generating.upload,
  remote: ONBOARDING_COPY.generating.remote,
  local: ONBOARDING_COPY.generating.local
}

export function GeneratingPage(): ReactElement {
  const [phase, setPhase] = useState<GenerationPhase>('remote')
  const [poseLabel, setPoseLabel] = useState('准备中')
  const [progress, setProgress] = useState({ index: 0, total: 0 })

  useEffect(() => {
    document.title = 'Petory — 生成中'
  }, [])

  useEffect(() => {
    return window.petory.pet.onGenerationProgress((payload) => {
      if (payload.phase) setPhase(payload.phase)
      setPoseLabel(payload.poseLabel)
      setProgress({ index: payload.index, total: payload.total })
    })
  }, [])

  const percent =
    progress.total > 0 && phase === 'local'
      ? Math.round((progress.index / progress.total) * 100)
      : undefined

  const detailLine =
    phase === 'local' && progress.total > 0
      ? ONBOARDING_COPY.generating.poseProgress(poseLabel, progress.index, progress.total)
      : phase === 'remote'
        ? ONBOARDING_COPY.generating.poseWorking(poseLabel)
        : null

  return (
    <PageShell className="items-center justify-center text-center">
      <BrandLogo alt="" className="mb-8 h-14 w-auto animate-pulse" />
      <p className="text-[18px] font-medium">{PHASE_HEADLINE[phase]}</p>
      {detailLine ? (
        <p className="mt-2 text-[13px] text-petory-text-secondary">{detailLine}</p>
      ) : null}
      <p className="mt-1 text-[12px] text-petory-text-tertiary">
        {ONBOARDING_COPY.generating.identityNote}
      </p>
      <div className="mt-8 h-0.5 w-48 overflow-hidden rounded-full bg-petory-track">
        <div
          className="h-full rounded-full bg-petory-primary transition-all duration-500"
          style={{
            width: percent !== undefined ? `${Math.max(8, percent)}%` : '33%'
          }}
        />
      </div>
      {percent !== undefined ? (
        <p className="mt-3 text-[12px] tabular-nums text-petory-text-tertiary">{percent}%</p>
      ) : null}
    </PageShell>
  )
}
