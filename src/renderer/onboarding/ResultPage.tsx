import { useEffect, useState, type ReactElement } from 'react'
import { ONBOARDING_COPY } from '@shared/copy/onboarding'
import { getStyleDefinition } from '@shared/styles'
import type { PetStyleType } from '@shared/types/pet'
import { Button } from '../components/ui/Button'
import { StylePicker } from '../components/StylePicker'
import { PageShell } from '../components/ui/PageShell'
import { TextButton } from '../components/ui/TextButton'

interface ResultPageProps {
  petId: string
  initialStyle: PetStyleType
  lastUsedStyle?: PetStyleType
  onUse: () => void
  onRegenerate: (style: PetStyleType) => void
  onUploadAnother: () => void
}

export function ResultPage({
  petId,
  initialStyle,
  lastUsedStyle,
  onUse,
  onRegenerate,
  onUploadAnother
}: ResultPageProps): ReactElement {
  const [preview, setPreview] = useState<string | null>(null)
  const [style, setStyle] = useState<PetStyleType>(initialStyle)
  const [showRestyle, setShowRestyle] = useState(false)

  useEffect(() => {
    void window.petory.pet.getPreviewImage(petId).then(setPreview)
  }, [petId])

  useEffect(() => {
    setStyle(initialStyle)
  }, [initialStyle])

  const styleLabel = getStyleDefinition(style).labelZh

  return (
    <PageShell className="items-center">
      <h1 className="w-full text-center text-[22px] font-semibold">{ONBOARDING_COPY.result.title}</h1>
      <p className="mt-2 text-center text-[13px] text-petory-text-secondary">
        {ONBOARDING_COPY.result.subtitle(styleLabel)}
      </p>

      <div className="bg-petory-checker mt-8 flex h-[240px] w-full items-center justify-center rounded-2xl border border-petory-border">
        {preview ? (
          <img src={preview} alt="Generated pet" className="max-h-[200px] max-w-[80%] object-contain" />
        ) : (
          <div className="h-32 w-32 animate-pulse rounded-full bg-petory-primary-soft" />
        )}
      </div>

      <div className="mt-8 flex w-full flex-col items-center gap-3">
        <Button fullWidth onClick={onUse}>
          {ONBOARDING_COPY.result.useCta}
        </Button>

        {!showRestyle ? (
          <TextButton onClick={() => setShowRestyle(true)}>{ONBOARDING_COPY.result.restyleToggle}</TextButton>
        ) : (
          <div className="w-full rounded-2xl border border-petory-border bg-petory-surface p-4">
            <p className="text-[12px] text-petory-text-secondary">{ONBOARDING_COPY.result.restyleHint}</p>
            <div className="mt-3">
              <StylePicker value={style} onChange={setStyle} lastUsedStyle={lastUsedStyle} />
            </div>
            <Button className="mt-4" fullWidth variant="secondary" onClick={() => onRegenerate(style)}>
              {ONBOARDING_COPY.result.regenerate}
            </Button>
          </div>
        )}

        <Button fullWidth variant="ghost" onClick={onUploadAnother}>
          {ONBOARDING_COPY.result.uploadAnother}
        </Button>
      </div>
    </PageShell>
  )
}
