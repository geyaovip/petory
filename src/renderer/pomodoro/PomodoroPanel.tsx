import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { POMODORO_COPY } from '@shared/copy/pomodoro'
import type { PomodoroPhase, PomodoroState } from '@shared/types/pomodoro'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { ProgressRing } from '../components/ui/ProgressRing'
import { PanelFrame } from '../components/ui/PanelFrame'

const FOCUS_OPTIONS = [15, 25, 45, 60]
const BREAK_OPTIONS = [5, 10, 15]

function formatMs(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function phaseTotalMs(state: PomodoroState): number {
  const min = state.phase === 'break' ? state.breakDurationMin : state.focusDurationMin
  return min * 60 * 1000
}

function phaseLabel(phase: PomodoroPhase): string {
  return POMODORO_COPY.phase[phase]
}

function ringColors(phase: PomodoroPhase): { track: string; progress: string } {
  if (phase === 'focus') return { track: 'stroke-petory-border', progress: 'stroke-petory-primary' }
  if (phase === 'break') return { track: 'stroke-petory-border', progress: 'stroke-petory-success' }
  return { track: 'stroke-petory-border', progress: 'stroke-petory-primary' }
}

function DurationOptions({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: number
  options: number[]
  onChange: (value: number) => void
}): ReactElement {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-petory-text-secondary">{label}</span>
        <span className="text-[11px] text-petory-text-tertiary">{value} 分钟</span>
      </div>
      <div className="grid grid-flow-col gap-2">
        {options.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={minutes === value}
            className={`h-9 rounded-xl border text-[12px] font-medium transition-colors ${
              minutes === value
                ? 'border-petory-primary bg-petory-primary-soft text-petory-primary'
                : 'border-petory-border bg-petory-surface text-petory-text-secondary hover:border-petory-border-strong hover:bg-petory-muted'
            }`}
            onClick={() => onChange(minutes)}
          >
            {minutes}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PomodoroPanel(): ReactElement {
  const [state, setState] = useState<PomodoroState | null>(null)
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [confirmEnd, setConfirmEnd] = useState(false)

  useEffect(() => {
    void window.petory.pomodoro.getState().then((next) => {
      setState(next)
      setFocusMinutes(next.focusDurationMin)
      setBreakMinutes(next.breakDurationMin)
    })
    return window.petory.pomodoro.onTick(setState)
  }, [])

  const phase = state?.phase ?? 'idle'
  const isIdle = phase === 'idle'
  const progress = useMemo(() => {
    if (!state || state.phase === 'idle') return 0
    const total = phaseTotalMs(state)
    return total > 0 ? 1 - state.remainingMs / total : 0
  }, [state])

  const colors = ringColors(phase)
  const displayMs = isIdle ? focusMinutes * 60 * 1000 : (state?.remainingMs ?? 0)

  const startAndHide = async (): Promise<void> => {
    const next = await window.petory.pomodoro.start({
      focusDurationMin: focusMinutes,
      breakDurationMin: breakMinutes
    })
    setState(next)
    window.petory.pomodoro.close()
  }

  const resumeAndHide = async (): Promise<void> => {
    setState(await window.petory.pomodoro.resume())
    window.petory.pomodoro.close()
  }

  return (
    <PanelFrame
      title={POMODORO_COPY.title}
      subtitle={isIdle ? '设置这一轮的节奏' : '关闭窗口不会停止计时'}
      onClose={() => window.petory.pomodoro.close()}
    >
      <div className="flex min-h-full flex-col gap-4 px-5 py-5">
        <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-petory-border bg-petory-surface py-5">
          <ProgressRing
            progress={progress}
            size={184}
            trackClassName={colors.track}
            progressClassName={colors.progress}
          >
            <p className="text-[12px] font-medium text-petory-primary">{phaseLabel(phase)}</p>
            <p className="mt-1 font-mono text-[38px] font-semibold leading-none tabular-nums">{formatMs(displayMs)}</p>
            {state?.isPaused ? <p className="mt-2 text-[11px] text-petory-text-tertiary">{POMODORO_COPY.paused}</p> : null}
          </ProgressRing>
        </div>

        {isIdle ? (
          <div className="space-y-4 rounded-2xl border border-petory-border bg-petory-surface p-4">
            <DurationOptions label="专注时长" value={focusMinutes} options={FOCUS_OPTIONS} onChange={setFocusMinutes} />
            <DurationOptions label="休息时长" value={breakMinutes} options={BREAK_OPTIONS} onChange={setBreakMinutes} />
          </div>
        ) : null}

        {isIdle ? (
          <Button fullWidth onClick={() => void startAndHide()}>{POMODORO_COPY.start}</Button>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            {state?.isPaused ? (
              <Button fullWidth onClick={() => void resumeAndHide()}>{POMODORO_COPY.resume}并收起</Button>
            ) : (
              <Button fullWidth onClick={() => void window.petory.pomodoro.pause().then(setState)}>{POMODORO_COPY.pause}</Button>
            )}
            <Button variant="ghost" onClick={() => setConfirmEnd(true)}>{POMODORO_COPY.end}</Button>
          </div>
        )}

        <p className="text-center text-[11px] leading-relaxed text-petory-text-tertiary">
          {isIdle ? '开始后窗口会自动收起，桌宠陪你安静专注。' : '从桌宠菜单再次打开，可以暂停或结束。'}
        </p>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title="结束这一轮专注？"
        message="当前进度不会计入已完成的专注记录。"
        confirmLabel="结束专注"
        danger
        onConfirm={() => {
          setConfirmEnd(false)
          void window.petory.pomodoro.end().then(setState)
        }}
        onCancel={() => setConfirmEnd(false)}
      />
    </PanelFrame>
  )
}
