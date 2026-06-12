import type { ReactElement } from 'react'

export interface SegmentedTabItem<T extends string> {
  id: T
  label: string
}

interface SegmentedTabsProps<T extends string> {
  items: readonly SegmentedTabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  className = ''
}: SegmentedTabsProps<T>): ReactElement {
  return (
    <div
      className={['flex gap-1 overflow-x-auto rounded-lg border border-petory-border bg-petory-surface p-1', className].join(
        ' '
      )}
      role="tablist"
    >
      {items.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={[
              'min-w-0 flex-1 whitespace-nowrap rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
              selected
                ? 'bg-petory-primary-soft text-petory-primary'
                : 'text-petory-text-secondary hover:bg-petory-muted hover:text-petory-text'
            ].join(' ')}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
