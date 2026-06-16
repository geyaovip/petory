import { config } from 'dotenv'
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, screen } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { loadDockIcon } from './appIcon'
import { ERROR_MESSAGES } from '../../src/shared/constants'
import { IPC, type MenuAction, type UploadPayload, type WindowPosition } from '../../src/shared/ipc'
import type { PetVisualState } from '../../src/shared/types/growth'
import type { PomodoroStartInput } from '../../src/shared/types/pomodoro'
import type { FinalizePetInput, PetPersonality, PetPoseType } from '../../src/shared/types/pet'
import { broadcastPetsListChanged, listPetsNeedingPoseCompletion, resolvePoseImagePath } from './poseService'
import { clearChatSession, handleSendChat } from './chat/handlers'
import { clearChatHistory, getChatHistory, loadChatSettings, saveChatSettings } from './chatStore'
import { runCompletePosesPipeline, runGenerationPipeline } from './image/pipeline'
import { completeMissingPosesForAllPets, isPoseCompletionRunning } from './poseCompletionService'
import { isPoseRegenerationRunning, regeneratePetPose } from './poseRegenerationService'
import { installSamplePet, refreshInstalledSamplePets } from './samplePet'
import { checkForUpdates, downloadUpdate, getUpdateState, initAutoUpdater, quitAndInstallUpdate } from './updateService'
import { initCrashReporter, recordCrash } from './crashReporter'
import { hasAcceptedLegal, saveLegalAcceptance } from './legalStore'
import {
  bootstrapRemoteSession,
  buildAuthState,
  refreshAuthState,
  canActivatePet,
  canCreatePet,
  rejectLegacyOfflineSession,
  getAuthState,
  isAuthenticated,
  requestMagicLink,
  consumeMagicLink,
  logout
} from './auth'
import { applyUserSettings, persistAndApply } from './applySettings'
import {
  clearChatData,
  deletePetImages as removePetImageFiles,
  exportLocalData,
  pickAndImportLocalData,
  listManagedPets,
  openDownloadPageUrl,
  openFeedbackUrl,
  openPrivacyUrl,
  openTermsUrl,
  openWebsiteUrl,
  wipeAllLocalData
} from './dataService'
import { activatePet, finalizePet, getActivePet, getPetById, loadStore, updatePet } from './petStore'
import {
  getDesktopPetStatus,
  hidePetFromDesktop,
  listDesktopPetSummaries,
  showPetOnDesktop,
  syncAllDesktopPets
} from './desktopPetService'
import { consumeOnboardingIntent, setOnboardingIntent } from './onboardingIntent'
import { saveUpload, validateUpload } from './upload'
import { getGrowthStats, handleDailyOpenRewards } from './growthService'
import { endPomodoro, getPomodoroState, pausePomodoro, resumePomodoro, startPomodoro } from './pomodoroService'
import { getPetVisualState, setPetVisualState } from './petStateService'
import { loadUserSettings, patchUserSettings } from './settingsStore'
import {
  confirmSedentaryRest,
  resetSedentaryTimer,
  startSedentaryService,
  stopSedentaryService
} from './sedentaryService'
import { startSleepService, stopSleepService, touchActivity } from './sleepService'
import {
  closeAllPanelWindows,
  closeAuthWindow,
  closeChatWindow,
  closeGuideWindow,
  closeGrowthWindow,
  closeOnboardingWindow,
  closePetWindow,
  closePomodoroWindow,
  closePetsWindow,
  closeSettingsWindow,
  createAuthWindow,
  createOnboardingWindow,
  setPetContextMenuHandler,
  getAuthWindow,
  getChatWindow,
  getGrowthWindow,
  getGuideWindow,
  getOnboardingWindow,
  getPetIdForWindow,
  getPetWindow,
  getPetsWindow,
  isPetWindow,
  getPomodoroWindow,
  getSettingsWindow,
  handleSetPosition,
  moveWindowTo,
  setPetWindowClickThrough,
  notifyPetImageUpdated,
  openChatWindow,
  openGrowthWindow,
  openGuideWindow,
  openOnboardingWindow,
  openPetsWindow,
  openPomodoroWindow,
  openSettingsWindow,
  showPetWindowAfterCreation
} from './windows'
import type { OnboardingIntent } from '../../src/shared/types/onboarding'
import type { ChatSettings } from '../../src/shared/types/chat'
import type { UserSettings } from '../../src/shared/types/settings'
import { broadcastSessionExpired } from './auth/sessionBroadcast'
import { setAuthExpiredHandler } from './auth/sessionGuard'

config({ path: path.resolve(process.cwd(), '.env') })

function clearStaleDevSingletonLocks(): void {
  if (app.isPackaged) return

  const userData =
    process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library/Application Support/petory')
      : process.platform === 'win32'
        ? path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'petory')
        : path.join(os.homedir(), '.config/petory')

  for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try {
      fs.unlinkSync(path.join(userData, name))
    } catch {
      // ignore busy or missing
    }
  }
}

clearStaleDevSingletonLocks()

const AUTH_PROTOCOL = 'petory'
let pendingAuthDeepLink = process.argv.find((arg) => arg.startsWith(`${AUTH_PROTOCOL}://`)) ?? null
let authDeepLinkInFlight = false
const generationInFlight = new Set<string>()

if (app.isPackaged) {
  app.setAsDefaultProtocolClient(AUTH_PROTOCOL)
} else if (process.defaultApp && process.argv[1]) {
  app.setAsDefaultProtocolClient(AUTH_PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
}

app.on('open-url', (event, url) => {
  event.preventDefault()
  if (app.isReady()) void handleAuthDeepLink(url)
  else pendingAuthDeepLink = url
})

if (app.isPackaged) {
  const hasSingleInstanceLock = app.requestSingleInstanceLock()
  if (!hasSingleInstanceLock) {
    app.quit()
    process.exit(0)
  }

  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((arg) => arg.startsWith(`${AUTH_PROTOCOL}://`))
    if (deepLink) void handleAuthDeepLink(deepLink)
    const focusTarget = getPetWindow() ?? getAuthWindow() ?? getOnboardingWindow() ?? BrowserWindow.getAllWindows()[0]
    if (focusTarget && !focusTarget.isDestroyed()) {
      if (focusTarget.isMinimized()) focusTarget.restore()
      focusTarget.focus()
    }
  })
}

function broadcastAuthStateChanged(): void {
  const state = buildAuthState()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.auth.stateChanged, state)
    }
  }
}

function enterAppAfterAuth(): void {
  closeAuthWindow()
  bootstrapMainApp()
}

async function handleAuthDeepLink(rawUrl: string): Promise<void> {
  if (authDeepLinkInFlight) return
  let token = ''
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== `${AUTH_PROTOCOL}:` || url.hostname !== 'auth' || url.pathname !== '/callback') {
      return
    }
    token = url.searchParams.get('token') ?? ''
  } catch {
    return
  }
  if (!token) return

  authDeepLinkInFlight = true
  try {
    createAuthWindow()
    const result = await consumeMagicLink(token)
    if (!result.success) {
      dialog.showErrorBox('登录失败', result.message)
      return
    }
    broadcastAuthStateChanged()
    enterAppAfterAuth()
  } finally {
    authDeepLinkInFlight = false
  }
}

function buildContextMenu(): Menu {
  const focusActive = getPomodoroState().phase !== 'idle'
  return Menu.buildFromTemplate([
    { label: '和它说话', click: () => openChatWindow() },
    {
      label: focusActive ? '查看专注' : '开始专注',
      click: () => openPomodoroWindow()
    },
    { label: '查看成长', click: () => openGrowthWindow() },
    { type: 'separator' },
    { label: '宠物管理', click: () => openPetsWindow() },
    { label: '设置', click: () => openSettingsWindow() },
    { label: '隐藏桌宠', click: () => sendMenuAction('hide') },
    { type: 'separator' },
    { label: '退出 Petory', click: () => sendMenuAction('quit') }
  ])
}

function sendMenuAction(action: MenuAction): void {
  getPetWindow()?.webContents.send(IPC.menu.action, action)
}

function readImageDataUrl(filePath: string): string | null {
  if (!filePath || !fs.existsSync(filePath)) return null
  try {
    const buf = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.window.getPosition, (event): WindowPosition => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { x: 0, y: 0 }
    const [x, y] = win.getPosition()
    return { x, y }
  })

  ipcMain.handle(IPC.window.getCursorPosition, (): WindowPosition => {
    return screen.getCursorScreenPoint()
  })

  ipcMain.handle(IPC.window.setPosition, (event, position: WindowPosition) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return
    const petId = getPetIdForWindow(win)
    if (petId) {
      handleSetPosition(petId, position)
      return
    }
    moveWindowTo(win, position)
  })

  ipcMain.on(IPC.window.hide, (event) => {
    const petId = getPetIdForWindow(BrowserWindow.fromWebContents(event.sender))
    if (petId) {
      hidePetFromDesktop(petId)
      return
    }
    getPetWindow()?.hide()
  })

  ipcMain.on(IPC.window.show, () => {
    getPetWindow()?.show()
  })

  ipcMain.on(IPC.window.setIgnoreMouseEvents, (event, ignore: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || !isPetWindow(win)) return
    setPetWindowClickThrough(win, ignore)
  })

  ipcMain.on(IPC.app.quit, () => {
    app.quit()
  })

  ipcMain.on(IPC.app.openFeedback, () => {
    openFeedbackUrl()
  })

  ipcMain.handle(IPC.app.getVersion, () => app.getVersion())

  ipcMain.on(IPC.app.openWebsite, () => openWebsiteUrl())
  ipcMain.on(IPC.app.openDownloadPage, () => openDownloadPageUrl())
  ipcMain.on(IPC.app.openPrivacy, () => openPrivacyUrl())
  ipcMain.on(IPC.app.openTerms, () => openTermsUrl())

  ipcMain.on(IPC.window.showContextMenu, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || !isPetWindow(win)) return
    buildContextMenu().popup({ window: win })
  })

  ipcMain.handle(IPC.app.getPetId, (event) => {
    return getPetIdForWindow(BrowserWindow.fromWebContents(event.sender))
  })

  ipcMain.handle(IPC.app.getMode, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (isPetWindow(win)) return 'pet'
    if (win === getChatWindow()) return 'chat'
    if (win === getPomodoroWindow()) return 'pomodoro'
    if (win === getGrowthWindow()) return 'growth'
    if (win === getSettingsWindow()) return 'settings'
    if (win === getPetsWindow()) return 'pets'
    if (win === getAuthWindow()) return 'auth'
    if (win === getGuideWindow()) return 'guide'
    return 'onboarding'
  })

  ipcMain.handle(IPC.pet.hasActive, (): boolean => {
    return getActivePet() !== null
  })

  ipcMain.handle(IPC.pet.getActive, () => {
    return getActivePet()
  })

  ipcMain.handle(IPC.pet.getActiveImage, (): string | null => {
    const pet = getActivePet()
    if (!pet) return null
    const imagePath = resolvePoseImagePath(pet, 'idle')
    if (!imagePath) return null
    return readImageDataUrl(imagePath)
  })

  ipcMain.handle(IPC.pet.getPreviewImage, (_event, petId: string): string | null => {
    const pet = getPetById(petId)
    if (!pet) return null
    const imagePath = resolvePoseImagePath(pet, 'idle')
    if (!imagePath) return null
    return readImageDataUrl(imagePath)
  })

  ipcMain.handle(IPC.pet.getImage, (_event, petId: string, pose: PetVisualState = 'idle'): string | null => {
      const pet = getPetById(petId)
      if (!pet) return null
      const imagePath = resolvePoseImagePath(pet, pose)
      if (!imagePath) return null
      return readImageDataUrl(imagePath)
  })

  ipcMain.handle(IPC.pet.getSummary, (_event, petId: string) => {
    const pet = getPetById(petId)
    if (!pet) return null
    const active = getActivePet()
    const poseCount = pet.posePaths ? Object.keys(pet.posePaths).length : pet.imagePetPath ? 1 : 0
    return {
      name: pet.name,
      isPrimary: active?.id === petId,
      personality: pet.personality,
      poseCount
    }
  })

  ipcMain.handle(IPC.pet.upload, async (_event, payload: UploadPayload) => {
    const petQuota = canCreatePet()
    if (!petQuota.ok) {
      return {
        success: false as const,
        code: 'quota_exceeded' as const,
        message: petQuota.message
      }
    }
    if (!validateUpload(payload)) {
      return {
        success: false as const,
        code: 'upload_invalid' as const,
        message: ERROR_MESSAGES.upload_invalid
      }
    }
    try {
      const petId = await saveUpload(payload)
      return { success: true as const, petId }
    } catch {
      return {
        success: false as const,
        code: 'upload_invalid' as const,
        message: ERROR_MESSAGES.upload_invalid
      }
    }
  })

  ipcMain.handle(IPC.pet.generate, async (_event, petId: string) => {
    if (generationInFlight.has(petId)) {
      return {
        success: false as const,
        code: 'generation_failed' as const,
        message: '正在生成中，请稍候…'
      }
    }
    generationInFlight.add(petId)
    try {
      updatePet(petId, { styleType: 'petory' })
      const result = await runGenerationPipeline(petId)
      if (result.success) {
        const pet = getPetById(petId)
        if (pet) patchUserSettings({ lastSelectedStyle: pet.styleType })
        broadcastAuthStateChanged()
      }
      return result
    } finally {
      generationInFlight.delete(petId)
    }
  })

  ipcMain.handle(IPC.pet.finalize, async (_event, input: FinalizePetInput) => {
    const pet = finalizePet(input)
    broadcastPetsListChanged()
    closeOnboardingWindow()
    showPetWindowAfterCreation()
    if (!loadUserSettings().featureGuideCompleted) {
      setTimeout(() => openGuideWindow(), 500)
    }
    return pet
  })

  ipcMain.handle(IPC.pet.consumeOnboardingIntent, (): OnboardingIntent | null => {
    return consumeOnboardingIntent()
  })

  ipcMain.on(IPC.pet.openOnboarding, (_event, intent?: OnboardingIntent) => {
    const wasOpen = Boolean(getOnboardingWindow() && !getOnboardingWindow()!.isDestroyed())
    setOnboardingIntent(intent ?? null)
    const win = openOnboardingWindow()
    if (wasOpen) {
      win.webContents.send(IPC.pet.onboardingIntent, intent ?? null)
    }
  })

  ipcMain.handle(IPC.pet.installSample, () => installSamplePet())

  ipcMain.on(IPC.chat.open, () => {
    openChatWindow()
  })

  ipcMain.on(IPC.chat.close, () => {
    closeChatWindow()
  })

  ipcMain.handle(IPC.chat.send, async (_event, text: string) => {
    const result = await handleSendChat(text)
    if (result.success) broadcastAuthStateChanged()
    return result
  })

  ipcMain.handle(IPC.chat.getHistory, () => {
    const pet = getActivePet()
    if (!pet) return []
    return getChatHistory(pet.id)
  })

  ipcMain.handle(IPC.chat.clearHistory, () => {
    const pet = getActivePet()
    if (pet) {
      clearChatHistory(pet.id)
      clearChatSession(pet.id)
    }
  })

  ipcMain.handle(IPC.chat.getSettings, (): ChatSettings => {
    return loadChatSettings()
  })

  ipcMain.handle(IPC.chat.setSettings, (_event, settings: ChatSettings) => {
    saveChatSettings(settings)
  })

  ipcMain.handle(IPC.pet.getState, () => getPetVisualState())

  ipcMain.on(IPC.pet.confirmSedentary, () => {
    confirmSedentaryRest()
  })

  ipcMain.on(IPC.pet.recordActivity, () => {
    const visualState = getPetVisualState()
    touchActivity()
    resetSedentaryTimer()
    if (visualState === 'idle' || visualState === 'sleep') {
      setPetVisualState('happy', 2800)
    }
  })

  ipcMain.handle(IPC.pet.getPoseCompletionStatus, () => {
    return {
      running: isPoseCompletionRunning(),
      pending: listPetsNeedingPoseCompletion()
    }
  })

  ipcMain.handle(IPC.pet.completePoses, async (_event, petId?: string) => {
    if (isPoseCompletionRunning()) {
      return { success: false as const, message: '正在补全姿势，请稍候。' }
    }
    if (petId) {
      const result = await runCompletePosesPipeline(petId)
      if (result.success && 'addedPoses' in result && result.addedPoses.length > 0) {
        notifyPetImageUpdated(petId)
      }
      return result
    }
    const batch = await completeMissingPosesForAllPets()
    return {
      success: true as const,
      completed: batch.completed,
      failed: batch.failed
    }
  })

  ipcMain.handle(IPC.pet.regeneratePose, async (_event, petId: string, pose: PetPoseType) => {
    if (isPoseRegenerationRunning() || isPoseCompletionRunning()) {
      return { success: false as const, message: '正在生成姿势，请稍候。' }
    }
    return regeneratePetPose(petId, pose)
  })

  ipcMain.on(IPC.pomodoro.open, () => openPomodoroWindow())
  ipcMain.on(IPC.pomodoro.close, () => closePomodoroWindow())
  ipcMain.handle(IPC.pomodoro.getState, () => getPomodoroState())
  ipcMain.handle(IPC.pomodoro.start, (_event, input?: PomodoroStartInput) => startPomodoro(input))
  ipcMain.handle(IPC.pomodoro.pause, () => pausePomodoro())
  ipcMain.handle(IPC.pomodoro.resume, () => resumePomodoro())
  ipcMain.handle(IPC.pomodoro.end, () => endPomodoro())

  ipcMain.on(IPC.growth.open, () => openGrowthWindow())
  ipcMain.on(IPC.growth.close, () => closeGrowthWindow())
  ipcMain.handle(IPC.growth.getStats, () => getGrowthStats())

  ipcMain.on(IPC.settings.open, () => openSettingsWindow())
  ipcMain.on(IPC.settings.close, () => closeSettingsWindow())
  ipcMain.handle(IPC.settings.get, (): UserSettings => loadUserSettings())
  ipcMain.handle(IPC.settings.set, async (_event, settings: UserSettings) => {
    const prevUrl = loadUserSettings().apiBaseUrl
    const next = persistAndApply(settings)
    if (prevUrl !== next.apiBaseUrl) {
      await bootstrapRemoteSession()
      broadcastAuthStateChanged()
    }
    return next
  })

  ipcMain.on(IPC.pets.open, () => openPetsWindow())
  ipcMain.on(IPC.pets.close, () => closePetsWindow())
  ipcMain.handle(IPC.pets.list, () => listManagedPets())
  ipcMain.handle(IPC.pets.updateName, (_event, petId: string, name: string) => {
    const nextName = name.trim()
    if (!nextName) throw new Error('宠物名称不能为空')
    if (nextName.length > 20) throw new Error('宠物名称不能超过 20 个字符')
    const pet = updatePet(petId, { name: nextName })
    broadcastPetsListChanged()
    return pet
  })
  ipcMain.handle(IPC.pets.updatePersonality, (_event, personality: PetPersonality, petId?: string) => {
      const id = petId ?? getActivePet()?.id
      if (!id) throw new Error('No pet found')
      return updatePet(id, { personality })
  })

  ipcMain.handle(IPC.desktop.getStatus, () => getDesktopPetStatus())
  ipcMain.handle(IPC.desktop.list, () => listDesktopPetSummaries())
  ipcMain.handle(IPC.desktop.show, (_event, petId: string) => showPetOnDesktop(petId))
  ipcMain.handle(IPC.desktop.hide, (_event, petId: string) => {
    hidePetFromDesktop(petId)
    return { success: true as const }
  })

  ipcMain.handle(IPC.pets.activate, (_event, petId: string) => {
    const quota = canActivatePet(petId)
    if (!quota.ok) {
      return { success: false as const, message: quota.message }
    }
    try {
      const pet = activatePet(petId)
      patchUserSettings({ lastSelectedStyle: pet.styleType })
      notifyPetImageUpdated(petId)
      return { success: true as const, pet }
    } catch (error) {
      return {
        success: false as const,
        message: error instanceof Error ? error.message : '切换失败'
      }
    }
  })

  ipcMain.handle(IPC.data.export, () => exportLocalData())

  ipcMain.handle(IPC.data.import, async () => {
    const result = await pickAndImportLocalData()
    if (!result.success) return result
    applyUserSettings()
    const store = loadStore()
    if (store.activePetId) {
      syncAllDesktopPets()
    }
    broadcastAuthStateChanged()
    return result
  })
  ipcMain.handle(IPC.data.clearChat, () => {
    clearChatData(getActivePet()?.id)
  })
  ipcMain.handle(IPC.data.deletePetImages, (_event, petId: string) => {
    try {
      hidePetFromDesktop(petId)
      removePetImageFiles(petId)
      updatePet(petId, {
        imagePetPath: '',
        imageMinimaxRawPath: '',
        imageOriginalPath: '',
        imageCompressedPath: '',
        posePaths: {},
        status: 'draft',
        onDesktop: false
      })
      notifyPetImageUpdated(petId)
      return { success: true as const }
    } catch (error) {
      return {
        success: false as const,
        message: error instanceof Error ? error.message : '删除失败'
      }
    }
  })
  ipcMain.handle(IPC.data.wipeAll, () => {
    stopSedentaryService()
    stopSleepService()
    wipeAllLocalData()
    closeAllPanelWindows()
    closePetWindow()
    closeOnboardingWindow()
    createAuthWindow()
    broadcastAuthStateChanged()
    return { success: true as const }
  })

  ipcMain.handle(IPC.auth.getState, () => getAuthState())

  ipcMain.handle(IPC.auth.requestMagicLink, async (_event, email: string) => {
    return requestMagicLink(email)
  })

  ipcMain.handle(IPC.auth.refresh, async () => {
    const state = await refreshAuthState()
    broadcastAuthStateChanged()
    return state
  })

  ipcMain.handle(IPC.auth.logout, async () => {
    stopSedentaryService()
    stopSleepService()
    closeAllPanelWindows()
    closePetWindow()
    closeOnboardingWindow()
    const result = await logout()
    broadcastAuthStateChanged()
    createAuthWindow()
    return result
  })

  ipcMain.handle(IPC.update.getState, () => getUpdateState())
  ipcMain.handle(IPC.update.check, () => checkForUpdates())
  ipcMain.handle(IPC.update.download, () => downloadUpdate())
  ipcMain.on(IPC.update.install, () => quitAndInstallUpdate())

  ipcMain.handle(IPC.legal.hasAccepted, () => hasAcceptedLegal())
  ipcMain.handle(IPC.legal.accept, () => saveLegalAcceptance())

  ipcMain.on(IPC.guide.open, () => openGuideWindow())
  ipcMain.on(IPC.guide.close, () => closeGuideWindow())
  ipcMain.handle(IPC.guide.complete, () => {
    patchUserSettings({ featureGuideCompleted: true })
  })

  ipcMain.on(IPC.crash.reportRenderer, (_event, message: string, stack?: string) => {
    recordCrash('renderer', new Error(message), stack)
  })
}

function registerChatShortcut(): void {
  globalShortcut.unregister('CommandOrControl+Shift+C')
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (getActivePet()) {
      openChatWindow()
    }
  })
}

function bootstrapMainApp(): void {
  refreshInstalledSamplePets()
  const hasActive = getActivePet() !== null
  if (hasActive) {
    syncAllDesktopPets()
    handleDailyOpenRewards()
    startSedentaryService()
    startSleepService()
  } else {
    createOnboardingWindow()
  }
}

function openDevelopmentPreviewPanel(): void {
  if (app.isPackaged) return
  const panel = process.env.PETORY_DEV_PANEL
  if (panel === 'settings') {
    getPetWindow()?.hide()
    openSettingsWindow()
  }
  if (panel === 'pets') {
    getPetWindow()?.hide()
    openPetsWindow()
  }
  if (panel === 'chat') {
    getPetWindow()?.hide()
    openChatWindow()
  }
  if (panel === 'pomodoro') {
    getPetWindow()?.hide()
    openPomodoroWindow()
  }
  if (panel === 'growth') {
    getPetWindow()?.hide()
    openGrowthWindow()
  }
  if (panel === 'guide') {
    getPetWindow()?.hide()
    openGuideWindow()
  }
}

async function bootstrapOnLaunch(): Promise<void> {
  applyUserSettings()
  rejectLegacyOfflineSession()
  await bootstrapRemoteSession()
  if (!isAuthenticated()) {
    createAuthWindow()
    return
  }
  bootstrapMainApp()
}

function applyAppIcon(): void {
  try {
    const icon = loadDockIcon()
    if (!icon || process.platform !== 'darwin' || !app.dock) return
    app.dock.setIcon(icon)
  } catch (error) {
    console.warn('[petory] failed to set Dock icon:', error)
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    app.dock.show()
    applyAppIcon()
  }

  initCrashReporter()
  setAuthExpiredHandler(() => {
    broadcastSessionExpired('登录已过期，请重新登录。')
    stopSedentaryService()
    stopSleepService()
    closeAllPanelWindows()
    closePetWindow()
    closeOnboardingWindow()
    broadcastAuthStateChanged()
    createAuthWindow()
  })
  registerIpc()
  setPetContextMenuHandler((win) => {
    buildContextMenu().popup({ window: win })
  })
  registerChatShortcut()
  initAutoUpdater()
  try {
    await bootstrapOnLaunch()
    if (pendingAuthDeepLink) {
      const deepLink = pendingAuthDeepLink
      pendingAuthDeepLink = null
      await handleAuthDeepLink(deepLink)
    }
  } catch (error) {
    console.error('[petory] bootstrap failed — opening auth window:', error)
    recordCrash('main', error, 'bootstrapOnLaunch')
    createAuthWindow()
  }
  setTimeout(openDevelopmentPreviewPanel, 500)

  app.on('activate', () => {
    if (!isAuthenticated()) {
      createAuthWindow()
      return
    }
    const store = loadStore()
    if (store.activePetId) {
      syncAllDesktopPets()
    } else {
      createOnboardingWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopSedentaryService()
})
