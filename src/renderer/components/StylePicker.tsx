import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { PetStyleType } from '@shared/types/pet'
import type { StyleCatalogItem } from '@shared/types/styles'
import { StyleCard } from './ui/StyleCard'

interface StylePickerProps {
  value: PetStyleType
  onChange: (style: PetStyleType) => void
  lastUsedStyle?: PetStyleType
}

export function StylePicker({ value, onChange, lastUsedStyle }: StylePickerProps): ReactElement {
  const [catalog, setCatalog] = useState<StyleCatalogItem[]>([])

  const load = useCallback(async () => {
    const next = await window.petory.pet.getStyleCatalog()
    setCatalog(next)
  }, [])

  useEffect(() => {
    void load()
    return window.petory.auth.onStateChanged(() => {
      void load()
    })
  }, [load])

  if (catalog.length === 0) {
    return (
      <p className="text-[13px] text-petory-text-tertiary" role="status">
        加载风格中…
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {catalog.map((style) => {
        const selected = value === style.id
        const locked = !style.available
        const isLastUsed = lastUsedStyle === style.id
        return (
          <StyleCard
            key={style.id}
            title={style.labelZh}
            description={locked ? '升级 Pro 解锁' : style.description}
            selected={selected}
            disabled={locked}
            badges={
              <>
                {isLastUsed ? (
                  <span className="rounded-full bg-petory-warning-soft px-2 py-0.5 text-[10px] font-medium text-petory-warning">
                    上次
                  </span>
                ) : null}
                {style.proOnly ? (
                  <span className="rounded-full bg-petory-accent-soft px-2 py-0.5 text-[10px] font-medium text-petory-accent-strong">
                    Pro
                  </span>
                ) : null}
              </>
            }
            onClick={() => {
              if (!locked) onChange(style.id)
            }}
          />
        )
      })}
    </div>
  )
}
