export type PomodoroPhase = 'idle' | 'focus' | 'break'

export interface PomodoroState {
  phase: PomodoroPhase
  remainingMs: number
  isPaused: boolean
  focusDurationMin: number
  breakDurationMin: number
}

export interface PomodoroStartInput {
  focusDurationMin: number
  breakDurationMin: number
}
