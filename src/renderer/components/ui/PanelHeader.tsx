import type { ReactElement } from 'react'
import { PanelTitleBar } from './PanelTitleBar'

interface PanelHeaderProps {
  title: string
  subtitle?: string
  onClose?: () => void
  className?: string
}

export function PanelHeader({
  title,
  subtitle,
  onClose,
  className = ''
}: PanelHeaderProps): ReactElement {
  return <PanelTitleBar title={title} subtitle={subtitle} onClose={onClose} className={className} />
}
