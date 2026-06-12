import type { ReactElement, ReactNode } from 'react'

interface PageShellProps {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className = '' }: PageShellProps): ReactElement {
  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-y-auto bg-petory-bg px-8 py-7 text-petory-text ${className}`}
    >
      {children}
    </div>
  )
}
