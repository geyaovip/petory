import type { ReactElement, ReactNode } from 'react'

export function PreferenceGroup({
  title,
  description,
  children,
  className = ''
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}): ReactElement {
  return (
    <section className={className}>
      <div className="mb-2">
        <h2 className="text-[13px] font-semibold text-petory-text">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12px] text-petory-text-tertiary">{description}</p>
        ) : null}
      </div>
      <div className="divide-y divide-petory-border border-y border-petory-border">{children}</div>
    </section>
  )
}

export function PreferenceRow({
  title,
  description,
  children,
  align = 'center'
}: {
  title: string
  description?: string
  children: ReactNode
  align?: 'center' | 'start'
}): ReactElement {
  return (
    <div className={`flex min-h-[58px] justify-between gap-8 py-3 ${align === 'start' ? 'items-start' : 'items-center'}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-petory-text">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-petory-text-tertiary">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
