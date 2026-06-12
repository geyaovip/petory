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
    'border border-petory-primary bg-petory-primary text-white hover:border-petory-primary-hover hover:bg-petory-primary-hover active:translate-y-px disabled:active:translate-y-0 disabled:opacity-40',
  secondary:
    'border border-petory-border bg-petory-surface text-petory-text hover:border-petory-border-strong hover:bg-petory-muted active:translate-y-px disabled:active:translate-y-0',
  ghost:
    'border border-transparent bg-transparent text-petory-text-secondary hover:bg-petory-muted hover:text-petory-text active:translate-y-px',
  danger:
    'border border-transparent bg-petory-error-soft text-petory-error hover:bg-petory-error-hover active:scale-[0.98]'
}

const sizeClass: Record<Size, string> = {
  md: 'h-10 px-5 text-[14px] rounded-lg',
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
        'inline-flex items-center justify-center font-medium transition-[background-color,border-color,color,transform] duration-150',
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
