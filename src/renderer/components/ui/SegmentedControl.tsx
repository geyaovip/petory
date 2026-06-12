import type { ReactElement } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = ''
}: SegmentedControlProps<T>): ReactElement {
  return (
    <div
      className={`flex rounded-xl bg-petory-surface p-1 shadow-sm ${className}`}
      role="tablist"
    >
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={option.disabled}
            className={[
              'flex-1 rounded-lg py-2 text-[14px] font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petory-primary focus-visible:ring-offset-1',
              selected
                ? 'bg-petory-primary text-white shadow-sm'
                : 'text-petory-text-secondary hover:bg-petory-primary-soft hover:text-petory-text',
              option.disabled ? 'cursor-not-allowed opacity-40' : ''
            ].join(' ')}
            onClick={() => {
              if (!option.disabled) onChange(option.value)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
