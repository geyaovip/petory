import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { POMODORO_COPY } from '@shared/copy/pomodoro'
import type { PomodoroPhase, PomodoroState } from '@shared/types/pomodoro'
import { Button } from '../components/ui/Button'
import { ProgressRing } from '../components/ui/ProgressRing'
import { PanelFrame } from '../components/ui/PanelFrame'

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
  if (phase === 'focus') {
    return { track: 'stroke-petory-border', progress: 'stroke-petory-accent' }
  }
  if (phase === 'break') {
    return { track: 'stroke-petory-border', progress: 'stroke-petory-success' }
  }
  return { track: 'stroke-petory-border', progress: 'stroke-petory-border' }
}

export function PomodoroPanel(): ReactElement {
  const [state, setState] = useState<PomodoroState | null>(null)

  useEffect(() => {
    void window.petory.pomodoro.getState().then(setState)
    return window.petory.pomodoro.onTick(setState)
  }, [])

  const phase = state?.phase ?? 'idle'
  const progress = useMemo(() => {
    if (!state || state.phase === 'idle') return 0
    const total = phaseTotalMs(state)
    if (total <= 0) return 0
    return 1 - state.remainingMs / total
  }, [state])

  const colors = ringColors(phase)
  const displayMs =
    state?.phase === 'idle'
      ? (state?.focusDurationMin ?? 25) * 60 * 1000
      : (state?.remainingMs ?? 0)

  return (
    <PanelFrame title={POMODORO_COPY.title} subtitle="让桌宠陪你完成这一轮专注" onClose={() => window.petory.pomodoro.close()}>
      <div className="flex min-h-full flex-col px-6 py-6">
      <div className="flex flex-1 flex-col items-center justify-center py-4">
        <ProgressRing
          progress={progress}
          trackClassName={colors.track}
          progressClassName={colors.progress}
        >
          <p className="text-[12px] font-medium text-petory-primary">{phaseLabel(phase)}</p>
          <p className="mt-1 font-mono text-[40px] font-semibold leading-none">{formatMs(displayMs)}</p>
          {state?.isPaused ? (
            <p className="mt-1 text-[12px] text-petory-text-tertiary">{POMODORO_COPY.paused}</p>
          ) : null}
        </ProgressRing>
      </div>

      <div className="flex gap-2">
        {state?.phase === 'idle' ? (
          <Button fullWidth onClick={() => void window.petory.pomodoro.start().then(setState)}>
            {POMODORO_COPY.start}
          </Button>
        ) : (
          <>
            {state?.isPaused ? (
              <Button fullWidth onClick={() => void window.petory.pomodoro.resume().then(setState)}>
                {POMODORO_COPY.resume}
              </Button>
            ) : (
              <Button
                fullWidth
                variant="secondary"
                onClick={() => void window.petory.pomodoro.pause().then(setState)}
              >
                {POMODORO_COPY.pause}
              </Button>
            )}
            <Button fullWidth variant="ghost" onClick={() => void window.petory.pomodoro.end().then(setState)}>
              {POMODORO_COPY.end}
            </Button>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-[12px] text-petory-text-tertiary">
        {POMODORO_COPY.durationHint(state?.focusDurationMin ?? 25, state?.breakDurationMin ?? 5)}
      </p>
      </div>
    </PanelFrame>
  )
}
