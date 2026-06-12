import type { ReactElement } from 'react'
import { X } from '@phosphor-icons/react'

interface PanelHeaderProps {
  title: string
  subtitle?: string
  onClose?: () => void
  closeLabel?: string
  className?: string
}

export function PanelHeader({
  title,
  subtitle,
  onClose,
  closeLabel = '关闭',
  className = ''
}: PanelHeaderProps): ReactElement {
  return (
    <header className={`flex items-start justify-between gap-3 ${className}`}>
      <div>
        <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-[12px] text-petory-text-tertiary">{subtitle}</p>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          aria-label={closeLabel}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-petory-text-secondary hover:bg-petory-muted hover:text-petory-text"
          onClick={onClose}
        >
          <X size={17} weight="bold" />
        </button>
      ) : null}
    </header>
  )
}
