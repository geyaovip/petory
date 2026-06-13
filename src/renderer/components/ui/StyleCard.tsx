import { Check } from '@phosphor-icons/react'
import type { ReactElement, ReactNode } from 'react'

interface StyleCardProps {
  title: string
  description: string
  selected?: boolean
  disabled?: boolean
  badges?: ReactNode
  onClick?: () => void
}

export function StyleCard({
  title,
  description,
  selected = false,
  disabled = false,
  badges,
  onClick
}: StyleCardProps): ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        'relative min-h-[76px] rounded-2xl border p-3.5 text-left transition-[background-color,border-color,box-shadow,transform]',
        selected
          ? 'border-petory-primary bg-petory-primary-soft shadow-[0_0_0_2px_rgba(255,138,122,0.12)]'
          : 'border-petory-border bg-petory-surface shadow-sm',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:border-petory-primary hover:shadow-md active:scale-[0.99]'
      ].join(' ')}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2 pr-6">
        <span className="text-[14px] font-semibold">{title}</span>
        {badges ? (
          <div className="flex items-center gap-1">{badges}</div>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-petory-text-tertiary">
        {description}
      </p>
      {selected ? (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-petory-primary text-white">
          <Check size={12} weight="bold" />
        </span>
      ) : null}
    </button>
  )
}
