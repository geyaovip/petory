import { BrowserWindow, screen } from 'electron'
import path from 'path'
import { loadAppIcon } from './appIcon'
import { IPC } from '../../src/shared/ipc'
import { broadcastPetsListChanged } from './poseService'
import type { BubblePayload } from '../../src/shared/types/growth'
import { applyUserSettings } from './applySettings'
import { getActivePet, getPetById, getPetsOnDesktop, updatePet } from './petStore'
import { loadUserSettings } from './settingsStore'
import {
  getCenteredPosition,
  getDefaultPetWindowState,
  isLegacyPetPosition,
  loadWindowState,
  saveWindowState
} from './windowState'

export type PanelMode =
  | 'pet'
  | 'onboarding'
  | 'auth'
  | 'chat'
  | 'pomodoro'
  | 'growth'
  | 'settings'
  | 'pets'
  | 'guide'

const isDev = Boolean(process.env['ELECTRON_RENDERER_URL'])

const petWindows = new Map<string, BrowserWindow>()
let petContextMenuHandler: ((win: BrowserWindow) => void) | undefined

export function setPetContextMenuHandler(handler: (win: BrowserWindow) => void): void {
  petContextMenuHandler = handler
}
let onboardingWindow: BrowserWindow | null = null
let authWindow: BrowserWindow | null = null
let chatWindow: BrowserWindow | null = null
let pomodoroWindow: BrowserWindow | null = null
let growthWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let petsWindow: BrowserWindow | null = null
let guideWindow: BrowserWindow | null = null

function getRendererUrl(windowMode: PanelMode, petId?: string): string {
  const petQuery = petId ? `&petId=${encodeURIComponent(petId)}` : ''
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL']
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}window=${windowMode}${petQuery}`
  }
  return `file://${path.join(__dirname, '../renderer/index.html')}?window=${windowMode}${petQuery}`
}

function loadWindowContent(win: BrowserWindow, mode: PanelMode, petId?: string): void {
  const url = getRendererUrl(mode, petId)
  if (url.startsWith('file://')) {
    const filePath = path.join(__dirname, '../renderer/index.html')
    const query: Record<string, string> = { window: mode }
    if (petId) query.petId = petId
    void win.loadFile(filePath, { query })
  } else {
    void win.loadURL(url)
  }
}

export function getPetIdForWindow(win: BrowserWindow | null | undefined): string | null {
  if (!win || win.isDestroyed()) return null
  for (const [petId, petWin] of petWindows.entries()) {
    if (petWin.id === win.id) return petId
  }
  return null
}

export function isPetWindow(win: BrowserWindow | null | undefined): boolean {
  return getPetIdForWindow(win) !== null
}

function getPrimaryPetId(): string | null {
  return getActivePet()?.id ?? null
}

export function getPrimaryPetWindow(): BrowserWindow | null {
  const primaryId = getPrimaryPetId()
  if (!primaryId) return null
  const win = petWindows.get(primaryId)
  if (win && !win.isDestroyed()) return win
  return null
}

function panelPosition(
  offsetX: number,
  offsetY: number,
  size: { width: number; height: number }
): { x: number; y: number } {
  const { x, y } = getCenteredPosition(size.width, size.height)
  return { x: x + offsetX, y: y + offsetY }
}

function createPanelWindow(
  ref: { current: BrowserWindow | null },
  mode: PanelMode,
  size: { width: number; height: number; minWidth: number; minHeight: number },
  title: string,
  offset: { x: number; y: number }
): BrowserWindow {
  if (ref.current && !ref.current.isDestroyed()) {
    ref.current.focus()
    return ref.current
  }

  const pos = panelPosition(offset.x, offset.y, size)
  const icon = loadAppIcon()
  const win = new BrowserWindow({
    ...size,
    x: pos.x,
    y: pos.y,
    title,
    ...(icon ? { icon } : {}),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#FAFAF8',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  loadWindowContent(win, mode)
  const showPanel = (): void => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }
  win.once('ready-to-show', showPanel)
  // Slow or offline service calls must not leave a usable panel permanently hidden.
  setTimeout(showPanel, 1200)
  win.on('closed', () => {
    ref.current = null
  })
  ref.current = win
  return win
}

export function getPetWindow(): BrowserWindow | null {
  return getPrimaryPetWindow() ?? petWindows.values().next().value ?? null
}

export function getAllPetWindows(): BrowserWindow[] {
  return [...petWindows.values()].filter((win) => !win.isDestroyed())
}

function resolvePetWindowPosition(petId: string, index: number): { x: number; y: number } {
  const pet = getPetById(petId)
  const fallback = loadWindowState()
  const offset = index * 36
  let x = pet?.desktopX ?? fallback.x + offset
  let y = pet?.desktopY ?? fallback.y + offset

  if (isLegacyPetPosition(x, y)) {
    const def = getDefaultPetWindowState()
    x = def.x + offset
    y = def.y + offset
    updatePet(petId, { desktopX: x, desktopY: y })
  }

  return { x, y }
}

function attachPetWindow(petId: string, win: BrowserWindow): void {
  petWindows.set(petId, win)

  win.on('moved', () => {
    if (win.isDestroyed()) return
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    updatePet(petId, { desktopX: x, desktopY: y })
    if (petId === getPrimaryPetId()) {
      saveWindowState({ x, y, width, height })
    }
  })

  win.on('closed', () => {
    petWindows.delete(petId)
  })

  win.webContents.on('context-menu', () => {
    petContextMenuHandler?.(win)
  })
}

export function createPetWindowFor(petId: string, desktopIndex = 0): BrowserWindow {
  const position = resolvePetWindowPosition(petId, desktopIndex)

  const existing = petWindows.get(petId)
  if (existing && !existing.isDestroyed()) {
    handleSetPosition(petId, position)
    existing.show()
    return existing
  }

  const state = loadWindowState()
  const settings = loadUserSettings()

  const icon = loadAppIcon()
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: position.x,
    y: position.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: settings.alwaysOnTop,
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    show: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  loadWindowContent(win, 'pet', petId)
  attachPetWindow(petId, win)

  win.once('ready-to-show', () => {
    applyUserSettings(settings)
    handleSetPosition(petId, position)
    win.show()
  })

  win.webContents.once('did-finish-load', () => {
    applyUserSettings(settings)
    win.setIgnoreMouseEvents(true, { forward: true })
  })

  return win
}

export function setPetWindowClickThrough(win: BrowserWindow, ignore: boolean): void {
  if (win.isDestroyed()) return
  win.setIgnoreMouseEvents(ignore, { forward: true })
}

export function closePetWindowFor(petId: string): void {
  const win = petWindows.get(petId)
  if (win && !win.isDestroyed()) {
    win.close()
  }
  petWindows.delete(petId)
}

export function syncDesktopPetWindows(): void {
  const visible = getPetsOnDesktop()
  const visibleIds = new Set(visible.map((pet) => pet.id))

  visible.forEach((pet, index) => {
    createPetWindowFor(pet.id, index)
  })

  for (const petId of [...petWindows.keys()]) {
    if (!visibleIds.has(petId)) {
      closePetWindowFor(petId)
    }
  }
}

export function getOnboardingWindow(): BrowserWindow | null {
  return onboardingWindow
}

export function getAuthWindow(): BrowserWindow | null {
  return authWindow
}

export function getChatWindow(): BrowserWindow | null {
  return chatWindow
}

export function getPomodoroWindow(): BrowserWindow | null {
  return pomodoroWindow
}

export function getGrowthWindow(): BrowserWindow | null {
  return growthWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function getPetsWindow(): BrowserWindow | null {
  return petsWindow
}

export function createPetWindow(): BrowserWindow {
  syncDesktopPetWindows()
  const existing = getPetWindow()
  if (existing) return existing
  const active = getActivePet()
  if (!active?.id) {
    throw new Error('No active pet to display')
  }
  return createPetWindowFor(active.id)
}

export function createOnboardingWindow(): BrowserWindow {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.focus()
    return onboardingWindow
  }

  onboardingWindow = new BrowserWindow({
    width: 420,
    height: 560,
    minWidth: 380,
    minHeight: 520,
    title: 'Petory',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#FAFAF8',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  loadWindowContent(onboardingWindow, 'onboarding')
  onboardingWindow.once('ready-to-show', () => onboardingWindow?.show())
  onboardingWindow.on('closed', () => {
    onboardingWindow = null
  })
  return onboardingWindow
}

export function closeOnboardingWindow(): void {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.close()
  }
  onboardingWindow = null
}

export function openOnboardingWindow(): BrowserWindow {
  return createOnboardingWindow()
}

export function createAuthWindow(): BrowserWindow {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus()
    return authWindow
  }

  authWindow = new BrowserWindow({
    width: 420,
    height: 600,
    minWidth: 380,
    minHeight: 520,
    title: 'Petory',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#FAFAF8',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  loadWindowContent(authWindow, 'auth')
  authWindow.once('ready-to-show', () => authWindow?.show())
  authWindow.on('closed', () => {
    authWindow = null
  })
  return authWindow
}

export function closeAuthWindow(): void {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close()
  }
  authWindow = null
}

export function createChatWindow(): BrowserWindow {
  const holder = { current: chatWindow }
  chatWindow = createPanelWindow(
    holder,
    'chat',
    { width: 360, height: 480, minWidth: 320, minHeight: 400 },
    'Petory — Chat',
    { x: 0, y: 0 }
  )
  return chatWindow
}

export function openChatWindow(): void {
  createChatWindow()
}

export function closeChatWindow(): void {
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.close()
  chatWindow = null
}

export function createPomodoroWindow(): BrowserWindow {
  const holder = { current: pomodoroWindow }
  pomodoroWindow = createPanelWindow(
    holder,
    'pomodoro',
    { width: 320, height: 400, minWidth: 300, minHeight: 360 },
    'Petory — Focus',
    { x: 0, y: 0 }
  )
  return pomodoroWindow
}

export function openPomodoroWindow(): void {
  createPomodoroWindow()
}

export function closePomodoroWindow(): void {
  if (pomodoroWindow && !pomodoroWindow.isDestroyed()) pomodoroWindow.close()
  pomodoroWindow = null
}

export function createGrowthWindow(): BrowserWindow {
  const holder = { current: growthWindow }
  growthWindow = createPanelWindow(
    holder,
    'growth',
    { width: 360, height: 440, minWidth: 320, minHeight: 400 },
    'Petory — Growth',
    { x: 20, y: 20 }
  )
  return growthWindow
}

export function openGrowthWindow(): void {
  createGrowthWindow()
}

export function closeGrowthWindow(): void {
  if (growthWindow && !growthWindow.isDestroyed()) growthWindow.close()
  growthWindow = null
}

export function openSettingsWindow(): void {
  const holder = { current: settingsWindow }
  settingsWindow = createPanelWindow(
    holder,
    'settings',
    { width: 720, height: 720, minWidth: 620, minHeight: 600 },
    'Petory — Settings',
    { x: 40, y: 40 }
  )
}

export function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close()
  settingsWindow = null
}

export function openPetsWindow(): void {
  const holder = { current: petsWindow }
  const hadWindow = Boolean(petsWindow && !petsWindow.isDestroyed())
  petsWindow = createPanelWindow(
    holder,
    'pets',
    { width: 760, height: 680, minWidth: 640, minHeight: 560 },
    'Petory — Pets',
    { x: 60, y: 60 }
  )
  if (hadWindow) {
    broadcastPetsListChanged()
  }
}

export function closePetsWindow(): void {
  if (petsWindow && !petsWindow.isDestroyed()) petsWindow.close()
  petsWindow = null
}

export function getGuideWindow(): BrowserWindow | null {
  return guideWindow
}

export function openGuideWindow(): void {
  const holder = { current: guideWindow }
  guideWindow = createPanelWindow(
    holder,
    'guide',
    { width: 360, height: 420, minWidth: 320, minHeight: 380 },
    'Petory — Guide',
    { x: 30, y: 30 }
  )
}

export function closeGuideWindow(): void {
  if (guideWindow && !guideWindow.isDestroyed()) guideWindow.close()
  guideWindow = null
}

export function closeAllPanelWindows(): void {
  closeChatWindow()
  closePomodoroWindow()
  closeGrowthWindow()
  closeSettingsWindow()
  closePetsWindow()
  closeGuideWindow()
}

export function hidePetWindow(petId?: string): void {
  if (petId) {
    closePetWindowFor(petId)
    return
  }
  getPetWindow()?.hide()
}

export function closePetWindow(): void {
  for (const petId of [...petWindows.keys()]) {
    closePetWindowFor(petId)
  }
}

export function notifyPetBubble(payload: BubblePayload): void {
  const win = getPrimaryPetWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.pet.bubbleText, payload)
  }
}

export function notifyPetImageUpdated(petId?: string): void {
  if (petId) {
    const win = petWindows.get(petId)
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.pet.imageUpdated)
    }
    return
  }

  for (const win of petWindows.values()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.pet.imageUpdated)
    }
  }
}

export function showPetWindowAfterCreation(): void {
  const active = getActivePet()
  if (!active?.id) return
  const win = createPetWindowFor(active.id)
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      win.show()
      notifyPetImageUpdated(active.id)
    })
  } else {
    win.show()
    notifyPetImageUpdated(active.id)
  }
}

export function moveWindowTo(win: BrowserWindow, position: { x: number; y: number }): void {
  if (win.isDestroyed()) return
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return
  // Trackpads commonly report fractional screen coordinates; Electron requires integers here.
  const point = { x: Math.round(position.x), y: Math.round(position.y) }
  const display = screen.getDisplayNearestPoint(point)
  const { x, y, width, height } = display.workArea
  const [w, h] = win.getSize()
  const clampedX = Math.min(Math.max(point.x, x), x + width - w)
  const clampedY = Math.min(Math.max(point.y, y), y + height - h)
  win.setPosition(clampedX, clampedY)
}

export function handleSetPosition(petId: string | null, position: { x: number; y: number }): void {
  const win = petId ? petWindows.get(petId) : getPetWindow()
  if (!win || win.isDestroyed()) return
  moveWindowTo(win, position)
  const [clampedX, clampedY] = win.getPosition()
  const [w, h] = win.getSize()
  if (petId) {
    updatePet(petId, { desktopX: clampedX, desktopY: clampedY })
  }
  if (!petId || petId === getPrimaryPetId()) {
    saveWindowState({ x: clampedX, y: clampedY, width: w, height: h })
  }
}
