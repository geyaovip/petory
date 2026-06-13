import type { PomodoroPhase, PomodoroStartInput, PomodoroState } from '../../src/shared/types/pomodoro'
import { addFocusSession } from './focusSessionStore'
import { rewardPomodoro } from './growthService'
import { notifyBubble, setPetVisualState } from './petStateService'
import { getActivePet } from './petStore'
import { loadUserSettings, patchUserSettings } from './settingsStore'
import { incrementTodayFocus } from './statsStore'
import { resetSedentaryTimer } from './sedentaryService'
import { touchActivity } from './sleepService'
import { getPetWindow, getPomodoroWindow } from './windows'
import { IPC } from '../../src/shared/ipc'

interface InternalState {
  phase: PomodoroPhase
  remainingMs: number
  isPaused: boolean
  focusStartedAt: string | null
}

let state: InternalState = {
  phase: 'idle',
  remainingMs: 0,
  isPaused: false,
  focusStartedAt: null
}

let ticker: ReturnType<typeof setInterval> | null = null

function getSettings() {
  return loadUserSettings()
}

function broadcast(): void {
  const settings = getSettings()
  const payload: PomodoroState = {
    phase: state.phase,
    remainingMs: state.remainingMs,
    isPaused: state.isPaused,
    focusDurationMin: settings.focusDuration,
    breakDurationMin: settings.breakDuration
  }
  getPomodoroWindow()?.webContents.send(IPC.pomodoro.tick, payload)
  getPetWindow()?.webContents.send(IPC.pomodoro.tick, payload)
}

function stopTicker(): void {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

function startTicker(): void {
  stopTicker()
  ticker = setInterval(() => tick(), 1000)
}

function tick(): void {
  if (state.phase === 'idle' || state.isPaused) {
    broadcast()
    return
  }

  state.remainingMs = Math.max(0, state.remainingMs - 1000)
  broadcast()

  if (state.remainingMs <= 0) {
    onPhaseComplete()
  }
}

function onPhaseComplete(): void {
  const settings = getSettings()
  const pet = getActivePet()

  if (state.phase === 'focus' && pet) {
    const end = new Date().toISOString()
    addFocusSession({
      petId: pet.id,
      startTime: state.focusStartedAt ?? end,
      endTime: end,
      duration: settings.focusDuration,
      status: 'completed',
      expReward: 10
    })
    rewardPomodoro(pet.id, settings.focusDuration)
    incrementTodayFocus(pet.id)
    setPetVisualState('happy', 8000)
    notifyBubble({
      text: `太棒了，刚刚这 ${settings.focusDuration} 分钟我们一起守住了！`,
      priority: 'normal'
    })

    if (settings.autoNextRound) {
      state.phase = 'break'
      state.remainingMs = settings.breakDuration * 60 * 1000
      state.isPaused = false
      state.focusStartedAt = null
      broadcast()
      return
    }

    state.phase = 'idle'
    state.remainingMs = 0
    state.isPaused = false
    state.focusStartedAt = null
    stopTicker()
    setPetVisualState('idle')
    broadcast()
    return
  }

  if (state.phase === 'break') {
    state.phase = 'idle'
    state.remainingMs = 0
    state.isPaused = false
    stopTicker()
    setPetVisualState('idle')
    notifyBubble({ text: '休息结束啦，准备好了就再开始吧。', priority: 'low' })
    broadcast()
  }
}

export function getPomodoroState(): PomodoroState {
  const settings = getSettings()
  return {
    phase: state.phase,
    remainingMs: state.remainingMs,
    isPaused: state.isPaused,
    focusDurationMin: settings.focusDuration,
    breakDurationMin: settings.breakDuration
  }
}

export function startPomodoro(input?: PomodoroStartInput): PomodoroState {
  const settings = input
    ? patchUserSettings({
        focusDuration: Math.max(5, Math.min(120, input.focusDurationMin)),
        breakDuration: Math.max(1, Math.min(30, input.breakDurationMin))
      })
    : getSettings()
  state = {
    phase: 'focus',
    remainingMs: settings.focusDuration * 60 * 1000,
    isPaused: false,
    focusStartedAt: new Date().toISOString()
  }
  touchActivity()
  setPetVisualState('focus')
  resetSedentaryTimer()
  startTicker()
  broadcast()
  return getPomodoroState()
}

export function pausePomodoro(): PomodoroState {
  if (state.phase !== 'idle') {
    state.isPaused = true
  }
  broadcast()
  return getPomodoroState()
}

export function resumePomodoro(): PomodoroState {
  if (state.phase !== 'idle') {
    state.isPaused = false
    startTicker()
  }
  broadcast()
  return getPomodoroState()
}

export function endPomodoro(): PomodoroState {
  stopTicker()
  state = { phase: 'idle', remainingMs: 0, isPaused: false, focusStartedAt: null }
  touchActivity()
  setPetVisualState('idle')
  broadcast()
  return getPomodoroState()
}
