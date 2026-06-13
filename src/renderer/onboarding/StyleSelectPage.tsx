import { useEffect, useState, type ReactElement } from 'react'
import { ONBOARDING_COPY } from '@shared/copy/onboarding'
import { getStyleDefinition } from '@shared/styles'
import type { PetStyleType } from '@shared/types/pet'
import { Button } from '../components/ui/Button'
import { StylePicker } from '../components/StylePicker'
import { PageShell } from '../components/ui/PageShell'
import { TextButton } from '../components/ui/TextButton'
import { Sparkle } from '@phosphor-icons/react'

interface StyleSelectPageProps {
  initialStyle: PetStyleType
  lastUsedStyle?: PetStyleType
  replaceMode?: boolean
  onBack: () => void
  onContinue: (style: PetStyleType) => void
}

export function StyleSelectPage({
  initialStyle,
  lastUsedStyle,
  replaceMode = false,
  onBack,
  onContinue
}: StyleSelectPageProps): ReactElement {
  const [style, setStyle] = useState<PetStyleType>(initialStyle)

  useEffect(() => {
    setStyle(initialStyle)
  }, [initialStyle])

  const lastUsedLabel = lastUsedStyle
    ? getStyleDefinition(lastUsedStyle).labelZh
    : null

  return (
    <PageShell className="px-6 pb-6 pt-8">
      <h1 className="text-[22px] font-semibold">
        {ONBOARDING_COPY.styleSelect.title}
      </h1>
      <p className="mt-2 text-[13px] text-petory-text-secondary">
        {replaceMode
          ? ONBOARDING_COPY.styleSelect.hintReplace
          : ONBOARDING_COPY.styleSelect.hint}
      </p>
      {lastUsedLabel ? (
        <p className="mt-1 text-[12px] text-petory-text-tertiary">
          上次使用：{lastUsedLabel}
        </p>
      ) : null}

      <div className="mt-5">
        <StylePicker
          value={style}
          onChange={setStyle}
          lastUsedStyle={lastUsedStyle}
        />
      </div>

      <div className="mt-auto border-t border-petory-border pt-5">
        <p className="mb-3 text-center text-[11px] text-petory-text-tertiary">
          生成后仍可预览并重新选择风格
        </p>
        <Button
          className="h-12 gap-2 rounded-xl shadow-[0_6px_18px_rgba(255,107,94,0.22)] hover:shadow-[0_8px_22px_rgba(255,107,94,0.28)]"
          fullWidth
          onClick={() => onContinue(style)}
        >
          <Sparkle size={18} weight="fill" />
          开始生成
        </Button>
        <TextButton className="mt-2 w-full py-2" onClick={onBack}>
          重新选择照片
        </TextButton>
      </div>
    </PageShell>
  )
}
