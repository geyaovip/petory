import type { ButtonHTMLAttributes, ReactElement } from 'react'

interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export function LinkButton({
  className = '',
  children,
  ...props
}: LinkButtonProps): ReactElement {
  return (
    <button
      type="button"
      className={[
        'inline rounded-sm text-petory-primary underline-offset-2 transition-colors hover:text-petory-primary-hover hover:underline',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petory-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
