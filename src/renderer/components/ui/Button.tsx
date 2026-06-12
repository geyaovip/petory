import { forwardRef, type ButtonHTMLAttributes, type ReactElement } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-petory-primary text-white shadow-sm hover:bg-petory-primary-hover active:scale-[0.98] disabled:active:scale-100 disabled:opacity-40',
  secondary:
    'border border-petory-border bg-petory-surface text-petory-text shadow-sm hover:border-petory-border-strong hover:bg-petory-muted active:scale-[0.98] disabled:active:scale-100',
  ghost:
    'bg-transparent text-petory-text-secondary hover:bg-petory-primary-soft hover:text-petory-text active:scale-[0.98]',
  danger:
    'border border-transparent bg-petory-error-soft text-petory-error hover:bg-petory-error-hover active:scale-[0.98]'
}

const sizeClass: Record<Size, string> = {
  md: 'h-10 px-5 text-[15px] rounded-xl',
  sm: 'h-8 px-3 text-[13px] rounded-lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    className = '',
    children,
    ...props
  },
  ref
): ReactElement {
  return (
    <button
      ref={ref}
      type="button"
      className={[
        'inline-flex items-center justify-center font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petory-primary focus-visible:ring-offset-2 focus-visible:ring-offset-petory-bg',
        'disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        fullWidth ? 'w-full' : '',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
})
