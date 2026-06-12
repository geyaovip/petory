import { X } from '@phosphor-icons/react'
import type { ReactElement, ReactNode } from 'react'

export function PanelFrame({
  title,
  subtitle,
  onClose,
  children,
  footer,
  className = ''
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}): ReactElement {
  const isMac = window.petory.platform === 'darwin'
  return (
    <div className={`flex h-full min-h-0 flex-col bg-petory-bg text-petory-text ${className}`}>
      <header
        className={`electron-drag flex h-[76px] shrink-0 items-center justify-between border-b border-petory-border pr-6 ${
          isMac ? 'pl-[76px]' : 'pl-6'
        }`}
      >
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.01em]">{title}</h1>
          {subtitle ? <p className="mt-1 truncate text-[12px] text-petory-text-tertiary">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          aria-label="关闭"
          className="electron-no-drag flex h-8 w-8 items-center justify-center rounded-lg text-petory-text-secondary transition-colors hover:bg-petory-muted hover:text-petory-text"
          onClick={onClose}
        >
          <X size={17} weight="bold" />
        </button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      {footer ? <footer className="shrink-0 border-t border-petory-border bg-petory-bg px-6 py-4">{footer}</footer> : null}
    </div>
  )
}
