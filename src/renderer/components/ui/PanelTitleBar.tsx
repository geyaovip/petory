import { X } from '@phosphor-icons/react'
import type { ReactElement, ReactNode } from 'react'

interface PanelTitleBarProps {
  title: string
  subtitle?: string
  onClose?: () => void
  trailing?: ReactNode
  className?: string
}

export function PanelTitleBar({
  title,
  subtitle,
  onClose,
  trailing,
  className = ''
}: PanelTitleBarProps): ReactElement {
  const isMac = window.petory.platform === 'darwin'

  return (
    <header
      className={`electron-drag relative flex h-[72px] shrink-0 items-center border-b border-petory-border/80 bg-petory-bg/95 px-5 ${className}`}
    >
      <div
        className={`pointer-events-none min-w-0 flex-1 text-center ${isMac ? 'px-[72px]' : 'px-12'}`}
      >
        <h1 className="truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 truncate text-[11px] leading-tight text-petory-text-tertiary">{subtitle}</p>
        ) : null}
      </div>

      <div className="electron-no-drag absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {trailing}
        {onClose ? (
          <button
            type="button"
            aria-label="关闭"
            className="flex h-9 w-9 items-center justify-center rounded-full text-petory-text-secondary transition-colors hover:bg-petory-muted hover:text-petory-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petory-primary"
            onClick={onClose}
          >
            <X size={18} weight="bold" />
          </button>
        ) : null}
      </div>
    </header>
  )
}
