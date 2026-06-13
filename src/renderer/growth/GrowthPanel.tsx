import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { GrowthStats, InteractionLog } from '@shared/types/growth'
import { playLevelUp } from '../utils/petSound'
import { EmptyState } from '../components/ui/EmptyState'
import { PanelLoading } from '../components/ui/PanelLoading'
import { PanelFrame } from '../components/ui/PanelFrame'

const INTERACTION_LABELS: Record<InteractionLog['type'], string> = {
  chat: '聊天',
  pomodoro: '专注',
  sedentary: '久坐',
  daily_open: '每日打开'
}

export function GrowthPanel(): ReactElement {
  const [stats, setStats] = useState<GrowthStats | null>(null)
  const [loading, setLoading] = useState(true)
  const enableSoundRef = useRef(false)
  const prevLevelRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    const [nextStats, settings] = await Promise.all([
      window.petory.growth.getStats(),
      window.petory.settings.get()
    ])
    if (
      nextStats &&
      enableSoundRef.current &&
      prevLevelRef.current !== null &&
      nextStats.level > prevLevelRef.current
    ) {
      playLevelUp()
    }
    if (nextStats) prevLevelRef.current = nextStats.level
    setStats(nextStats)
    enableSoundRef.current = settings.enableSound
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    return window.petory.growth.onUpdated(() => {
      void load()
    })
  }, [load])

  if (loading) {
    return <PanelLoading label="正在加载成长数据…" />
  }

  if (!stats) {
    return (
      <EmptyState
        title="还没有成长数据"
        description="和桌宠聊天、专注工作，它会慢慢成长起来。"
        actionLabel="去创建桌宠"
        onAction={() => window.petory.pet.openOnboarding({ mode: 'new' })}
      />
    )
  }

  return (
    <PanelFrame title="成长" subtitle="每一次陪伴都会留下记录" onClose={() => window.petory.growth.close()}>
      <div className="space-y-4 px-5 py-5">
      <div className="rounded-2xl border border-petory-border bg-petory-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[20px] font-semibold">{stats.name}</p>
            <p className="text-[13px] text-petory-text-secondary">
              Lv.{stats.level} · {stats.styleLabel}
            </p>
          </div>
          <span className="rounded-full bg-petory-primary-soft px-3 py-1 text-[12px] font-medium text-petory-primary">
            Lv.{stats.level}
          </span>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-petory-track">
          <div
            className="h-full rounded-full bg-petory-primary"
            style={{ width: `${stats.expPercent}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-petory-text-tertiary">
          {stats.nextLevelExp
            ? `${stats.exp} / ${stats.nextLevelExp} EXP`
            : `${stats.exp} EXP（已满级）`}
        </p>
      </div>

      <div className="grid grid-cols-3 divide-x divide-petory-border rounded-2xl border border-petory-border bg-petory-surface py-5">
        <div className="px-4">
          <p className="text-[12px] text-petory-text-tertiary">今日专注</p>
          <p className="mt-1 text-[20px] font-semibold">{stats.todayFocusCount}</p>
        </div>
        <div className="px-4">
          <p className="text-[12px] text-petory-text-tertiary">连续陪伴</p>
          <p className="mt-1 text-[20px] font-semibold">{stats.streakDays}</p>
        </div>
        <div className="px-4">
          <p className="text-[12px] text-petory-text-tertiary">姿势图</p>
          <p className="mt-1 text-[20px] font-semibold">{stats.poseCount}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-petory-border bg-petory-surface p-5">
        <h2 className="text-[13px] font-semibold">小成就</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.badges.map((badge) => (
            <span
              key={badge.id}
              className={[
                'rounded-full px-2.5 py-1 text-[11px]',
                badge.earned
                  ? 'bg-petory-primary-soft text-petory-primary'
                  : 'bg-petory-track text-petory-text-tertiary'
              ].join(' ')}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </section>

      {stats.recentInteractions.length > 0 ? (
        <section className="rounded-2xl border border-petory-border bg-petory-surface p-5">
          <h2 className="text-[13px] font-semibold">最近互动</h2>
          <ul className="mt-3 divide-y divide-petory-border">
            {stats.recentInteractions.map((item) => (
              <li key={item.id} className="py-3 text-[12px] text-petory-text-secondary">
                <span className="text-petory-text-tertiary">
                  {new Date(item.createdAt).toLocaleString()} ·{' '}
                  {INTERACTION_LABELS[item.type]}
                </span>
                <p className="truncate text-petory-text">{item.content}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-4 text-[12px] text-petory-text-tertiary">
          最近互动：
          {stats.lastInteractionAt
            ? new Date(stats.lastInteractionAt).toLocaleString()
            : '暂无'}
        </p>
      )}

      </div>
    </PanelFrame>
  )
}
