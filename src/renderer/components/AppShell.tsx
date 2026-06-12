import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import type { AppMode } from '@shared/ipc'
import { MaintenanceNotice } from './MaintenanceNotice'
import { WindowTitleBar } from './WindowTitleBar'

interface AppShellProps {
  mode: AppMode | 'loading'
  children: ReactNode
}

export function AppShell({ mode, children }: AppShellProps): ReactElement {
  const [maintenanceNotice, setMaintenanceNotice] = useState<string | null>(null)
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'auth' || mode === 'loading') return

    void window.petory.auth.getState().then((state) => {
      setMaintenanceNotice(state.maintenanceNotice ?? null)
    })

    const offState = window.petory.auth.onStateChanged((state) => {
      setMaintenanceNotice(state.maintenanceNotice ?? null)
      if (!state.session) {
        setSessionExpiredMessage(null)
      }
    })

    const offExpired = window.petory.auth.onSessionExpired(({ message }) => {
      setSessionExpiredMessage(message)
    })

    return () => {
      offState()
      offExpired()
    }
  }, [mode])

  const showMaintenance = Boolean(maintenanceNotice) && mode !== 'auth'
  const showExpired = Boolean(sessionExpiredMessage) && mode !== 'auth'

  const showTitleBar = mode === 'auth' || mode === 'onboarding' || mode === 'loading'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showTitleBar ? <WindowTitleBar mode={mode} /> : null}
      {showExpired ? (
        <div
          className="shrink-0 border-b border-petory-error/25 bg-petory-error-soft px-4 py-2 text-center text-[12px] text-petory-text"
          role="alert"
        >
          {sessionExpiredMessage}
        </div>
      ) : null}
      {showMaintenance ? (
        <MaintenanceNotice message={maintenanceNotice!} className="mx-4 mt-2 shrink-0" />
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
