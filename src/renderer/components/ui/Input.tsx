import type { InputHTMLAttributes, ReactElement } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  fullWidth?: boolean
}

export function Input({ className = '', fullWidth = true, ...props }: InputProps): ReactElement {
  return (
    <input
      className={[
        'h-10 rounded-lg border border-petory-border bg-petory-bg px-3 text-[14px] text-petory-text outline-none transition-colors',
        'placeholder:text-petory-text-tertiary',
        'focus:border-petory-primary focus:ring-2 focus:ring-petory-primary-soft',
        'disabled:cursor-not-allowed disabled:bg-petory-muted disabled:text-petory-text-tertiary',
        fullWidth ? 'w-full' : '',
        className
      ].join(' ')}
      {...props}
    />
  )
}
