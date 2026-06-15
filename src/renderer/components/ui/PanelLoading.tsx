import type { ReactElement } from 'react'
import { BrandLogo } from '../BrandLogo'

interface PanelLoadingProps {
  label?: string
}

export function PanelLoading({ label = '加载中…' }: PanelLoadingProps): ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-petory-bg px-6 text-center">
      <BrandLogo alt="" className="h-10 w-auto animate-pulse" />
      <p className="text-[14px] text-petory-text-secondary" role="status">{label}</p>
    </div>
  )
}
