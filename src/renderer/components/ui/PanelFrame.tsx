import type { ReactElement, ReactNode } from 'react'
import { PanelTitleBar } from './PanelTitleBar'

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
  return (
    <div className={`flex h-full min-h-0 flex-col bg-petory-bg text-petory-text ${className}`}>
      <PanelTitleBar title={title} subtitle={subtitle} onClose={onClose} />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</main>
      {footer ? <footer className="shrink-0 border-t border-petory-border bg-petory-surface px-5 py-4">{footer}</footer> : null}
    </div>
  )
}
