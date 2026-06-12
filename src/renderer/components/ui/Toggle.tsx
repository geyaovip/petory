import type { ReactElement } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
}

export function Toggle({ checked, onChange, label, description }: ToggleProps): ReactElement {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-6 text-[14px]">
      <span className="min-w-0">
        <span className="block font-medium text-petory-text">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-relaxed text-petory-text-tertiary">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={[
          'relative block h-6 w-11 shrink-0 appearance-none rounded-full border-0 p-0 shadow-inner outline-none transition-colors duration-150',
          'focus-visible:ring-2 focus-visible:ring-petory-primary focus-visible:ring-offset-2',
          checked ? 'bg-petory-primary' : 'bg-[#D9D7D2]'
        ].join(' ')}
        onClick={() => onChange(!checked)}
      >
        <span
          className={[
            'pointer-events-none absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(45,42,38,0.22)] transition-transform duration-150',
            checked ? 'translate-x-5' : 'translate-x-0'
          ].join(' ')}
        />
      </button>
    </label>
  )
}
