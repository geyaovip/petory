import type { AppMode } from '@shared/ipc'
import type { ReactElement } from 'react'

const TITLES: Partial<Record<AppMode, string>> = {
  auth: '登录',
  onboarding: '创建桌宠',
  chat: '和它说话',
  pomodoro: '专注',
  growth: '成长',
  settings: '设置',
  pets: '宠物管理',
  guide: '功能指南'
}

interface WindowTitleBarProps {
  mode: AppMode | 'loading'
}

export function WindowTitleBar({ mode }: WindowTitleBarProps): ReactElement {
  const title = mode === 'loading' ? 'Petory' : (TITLES[mode] ?? 'Petory')

  return (
    <div
      className="electron-drag relative flex h-[52px] shrink-0 items-center justify-center border-b border-petory-border/70 bg-petory-bg px-16"
      title="拖动标题栏移动窗口"
    >
      <span className="pointer-events-none select-none truncate text-[12px] font-semibold text-petory-text-secondary">{title}</span>
    </div>
  )
}
