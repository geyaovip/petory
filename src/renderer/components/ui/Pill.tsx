import type { ButtonHTMLAttributes, ReactElement } from 'react'

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

export function Pill({
  selected = false,
  className = '',
  children,
  disabled,
  ...props
}: PillProps): ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petory-primary focus-visible:ring-offset-2',
        selected
          ? 'border-petory-primary bg-petory-primary-soft text-petory-primary'
          : 'border-petory-border text-petory-text hover:border-petory-border-strong hover:bg-petory-muted',
        disabled ? 'cursor-not-allowed opacity-40' : '',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
