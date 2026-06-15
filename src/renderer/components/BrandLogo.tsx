import type { ReactElement } from 'react'
import { LOGO_SRC } from '../lib/brandAssets'

interface BrandLogoProps {
  alt?: string
  className?: string
}

export function BrandLogo({ alt = 'Petory', className }: BrandLogoProps): ReactElement {
  return <img src={LOGO_SRC} alt={alt} className={className} />
}
