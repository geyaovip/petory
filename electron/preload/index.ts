import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type MenuAction,
  type PetDisplaySettings,
  type UploadPayload,
  type WindowPosition
} from '../../src/shared/ipc'
import type { ChatMessage, ChatSettings, SendChatResponse } from '../../src/shared/types/chat'
import type { BubblePayload, GrowthStats, PetVisualState } from '../../src/shared/types/growth'
import type { GenerationProgressPayload, PetPoseType } from '../../src/shared/types/pet'
import type { PomodoroStartInput, PomodoroState } from '../../src/shared/types/pomodoro'
import type {
  AuthActionResult,
  AuthState,
  MagicLinkRequestResult
} from '../../src/shared/types/auth'
import type { UserSettings } from '../../src/shared/types/settings'
import type { LegalAcceptance } from '../../src/shared/types/legal'
import type {
  ActivatePetResult,
  DesktopPetResult,
  DesktopPetStatus,
  FinalizePetInput,
  InstallSampleResult,
  Pet,
  CompletePosesResult,
  PetDesktopSummary,
  PetIpcResult,
  PoseCompletionStatus,
  RegeneratePoseResult,
  PetPersonality
} from '../../src/shared/types/pet'
import type { OnboardingIntent } from '../../src/shared/types/onboarding'
import type { UpdateInstallResult, UpdateState } from '../../src/shared/types/update'

contextBridge.exposeInMainWorld('petory', {
  platform: process.platform as NodeJS.Platform,
  app: {
    getPetId: (): Promise<string | null> => ipcRenderer.invoke(IPC.app.getPetId),
    getMode: (): Promise<
      'auth' | 'onboarding' | 'pet' | 'chat' | 'pomodoro' | 'growth' | 'settings' | 'pets' | 'guide'
    > => ipcRenderer.invoke(IPC.app.getMode),
    quit: (): void => ipcRenderer.send(IPC.app.quit),
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.app.getVersion),
    openFeedback: (): void => ipcRenderer.send(IPC.app.openFeedback),
    openWebsite: (): void => ipcRenderer.send(IPC.app.openWebsite),
    openDownloadPage: (): void => ipcRenderer.send(IPC.app.openDownloadPage),
    openPrivacy: (): void => ipcRenderer.send(IPC.app.openPrivacy),
    openTerms: (): void => ipcRenderer.send(IPC.app.openTerms)
  },
  window: {
    getPosition: (): Promise<WindowPosition> => ipcRenderer.invoke(IPC.window.getPosition),
    getCursorPosition: (): Promise<WindowPosition> => ipcRenderer.invoke(IPC.window.getCursorPosition),
    setPosition: (position: WindowPosition): Promise<void> => ipcRenderer.invoke(IPC.window.setPosition, position),
    hide: (): void => ipcRenderer.send(IPC.window.hide),
    show: (): void => ipcRenderer.send(IPC.window.show),
    showContextMenu: (): void => ipcRenderer.send(IPC.window.showContextMenu),
    setIgnoreMouseEvents: (ignore: boolean): void => ipcRenderer.send(IPC.window.setIgnoreMouseEvents, ignore),
    onCursorProbe: (callback: (position: WindowPosition | null) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, position: WindowPosition | null): void => {
        callback(position)
      }
      ipcRenderer.on(IPC.window.cursorProbe, handler)
      return () => ipcRenderer.removeListener(IPC.window.cursorProbe, handler)
    }
  },
  menu: {
    onAction: (callback: (action: MenuAction) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, action: MenuAction): void => {
        callback(action)
      }
      ipcRenderer.on(IPC.menu.action, handler)
      return () => ipcRenderer.removeListener(IPC.menu.action, handler)
    }
  },
  pet: {
    hasActive: (): Promise<boolean> => ipcRenderer.invoke(IPC.pet.hasActive),
    getActive: (): Promise<Pet | null> => ipcRenderer.invoke(IPC.pet.getActive),
    getActiveImage: (): Promise<string | null> => ipcRenderer.invoke(IPC.pet.getActiveImage),
    upload: (payload: UploadPayload) => ipcRenderer.invoke(IPC.pet.upload, payload),
    generate: (petId: string): Promise<PetIpcResult> =>
      ipcRenderer.invoke(IPC.pet.generate, petId),
    getPreviewImage: (petId: string): Promise<string | null> => ipcRenderer.invoke(IPC.pet.getPreviewImage, petId),
    getImage: (petId: string, pose?: PetVisualState): Promise<string | null> =>
      ipcRenderer.invoke(IPC.pet.getImage, petId, pose),
    getSummary: (
      petId: string
    ): Promise<{
      name: string
      isPrimary: boolean
      personality: PetPersonality
      poseCount: number
    } | null> => ipcRenderer.invoke(IPC.pet.getSummary, petId),
    finalize: (input: FinalizePetInput): Promise<Pet> => ipcRenderer.invoke(IPC.pet.finalize, input),
    openOnboarding: (intent?: OnboardingIntent): void => ipcRenderer.send(IPC.pet.openOnboarding, intent),
    consumeOnboardingIntent: (): Promise<OnboardingIntent | null> =>
      ipcRenderer.invoke(IPC.pet.consumeOnboardingIntent),
    onOnboardingIntent: (callback: (intent: OnboardingIntent | null) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, intent: OnboardingIntent | null): void => callback(intent)
      ipcRenderer.on(IPC.pet.onboardingIntent, handler)
      return () => ipcRenderer.removeListener(IPC.pet.onboardingIntent, handler)
    },
    installSample: (): Promise<InstallSampleResult> => ipcRenderer.invoke(IPC.pet.installSample),
    getState: (): Promise<PetVisualState> => ipcRenderer.invoke(IPC.pet.getState),
    confirmSedentary: (): void => ipcRenderer.send(IPC.pet.confirmSedentary),
    recordActivity: (): void => ipcRenderer.send(IPC.pet.recordActivity),
    onImageUpdated: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.pet.imageUpdated, handler)
      return () => ipcRenderer.removeListener(IPC.pet.imageUpdated, handler)
    },
    onBubbleText: (callback: (payload: BubblePayload) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: BubblePayload): void => callback(payload)
      ipcRenderer.on(IPC.pet.bubbleText, handler)
      return () => ipcRenderer.removeListener(IPC.pet.bubbleText, handler)
    },
    onStateChanged: (callback: (state: PetVisualState) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: PetVisualState): void => callback(state)
      ipcRenderer.on(IPC.pet.stateChanged, handler)
      return () => ipcRenderer.removeListener(IPC.pet.stateChanged, handler)
    },
    getPoseCompletionStatus: (): Promise<PoseCompletionStatus> => ipcRenderer.invoke(IPC.pet.getPoseCompletionStatus),
    completePoses: (petId?: string): Promise<CompletePosesResult> => ipcRenderer.invoke(IPC.pet.completePoses, petId),
    regeneratePose: (petId: string, pose: PetPoseType): Promise<RegeneratePoseResult> =>
      ipcRenderer.invoke(IPC.pet.regeneratePose, petId, pose),
    onGenerationProgress: (callback: (payload: GenerationProgressPayload) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: GenerationProgressPayload): void => callback(payload)
      ipcRenderer.on(IPC.pet.generationProgress, handler)
      return () => ipcRenderer.removeListener(IPC.pet.generationProgress, handler)
    }
  },
  chat: {
    open: (): void => ipcRenderer.send(IPC.chat.open),
    close: (): void => ipcRenderer.send(IPC.chat.close),
    send: (text: string): Promise<SendChatResponse> => ipcRenderer.invoke(IPC.chat.send, text),
    getHistory: (): Promise<ChatMessage[]> => ipcRenderer.invoke(IPC.chat.getHistory),
    clearHistory: (): Promise<void> => ipcRenderer.invoke(IPC.chat.clearHistory),
    getSettings: (): Promise<ChatSettings> => ipcRenderer.invoke(IPC.chat.getSettings),
    setSettings: (settings: ChatSettings): Promise<void> => ipcRenderer.invoke(IPC.chat.setSettings, settings)
  },
  pomodoro: {
    open: (): void => ipcRenderer.send(IPC.pomodoro.open),
    close: (): void => ipcRenderer.send(IPC.pomodoro.close),
    getState: (): Promise<PomodoroState> => ipcRenderer.invoke(IPC.pomodoro.getState),
    start: (input: PomodoroStartInput): Promise<PomodoroState> => ipcRenderer.invoke(IPC.pomodoro.start, input),
    pause: (): Promise<PomodoroState> => ipcRenderer.invoke(IPC.pomodoro.pause),
    resume: (): Promise<PomodoroState> => ipcRenderer.invoke(IPC.pomodoro.resume),
    end: (): Promise<PomodoroState> => ipcRenderer.invoke(IPC.pomodoro.end),
    onTick: (callback: (state: PomodoroState) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: PomodoroState): void => callback(state)
      ipcRenderer.on(IPC.pomodoro.tick, handler)
      return () => ipcRenderer.removeListener(IPC.pomodoro.tick, handler)
    }
  },
  growth: {
    open: (): void => ipcRenderer.send(IPC.growth.open),
    close: (): void => ipcRenderer.send(IPC.growth.close),
    getStats: (): Promise<GrowthStats | null> => ipcRenderer.invoke(IPC.growth.getStats),
    onUpdated: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.growth.updated, handler)
      return () => ipcRenderer.removeListener(IPC.growth.updated, handler)
    }
  },
  settings: {
    open: (): void => ipcRenderer.send(IPC.settings.open),
    close: (): void => ipcRenderer.send(IPC.settings.close),
    get: (): Promise<UserSettings> => ipcRenderer.invoke(IPC.settings.get),
    set: (settings: UserSettings): Promise<UserSettings> => ipcRenderer.invoke(IPC.settings.set, settings),
    onChanged: (callback: (display: PetDisplaySettings) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, display: PetDisplaySettings): void => callback(display)
      ipcRenderer.on(IPC.settings.changed, handler)
      return () => ipcRenderer.removeListener(IPC.settings.changed, handler)
    }
  },
  desktop: {
    getStatus: (): Promise<DesktopPetStatus> => ipcRenderer.invoke(IPC.desktop.getStatus),
    list: (): Promise<PetDesktopSummary[]> => ipcRenderer.invoke(IPC.desktop.list),
    show: (petId: string): Promise<DesktopPetResult> => ipcRenderer.invoke(IPC.desktop.show, petId),
    hide: (petId: string): Promise<{ success: true }> => ipcRenderer.invoke(IPC.desktop.hide, petId)
  },
  pets: {
    open: (): void => ipcRenderer.send(IPC.pets.open),
    close: (): void => ipcRenderer.send(IPC.pets.close),
    list: (): Promise<Pet[]> => ipcRenderer.invoke(IPC.pets.list),
    onListChanged: (callback: () => void): (() => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC.pets.listChanged, handler)
      return () => ipcRenderer.removeListener(IPC.pets.listChanged, handler)
    },
    updateName: (petId: string, name: string): Promise<Pet> => ipcRenderer.invoke(IPC.pets.updateName, petId, name),
    updatePersonality: (personality: PetPersonality, petId?: string): Promise<Pet> =>
      ipcRenderer.invoke(IPC.pets.updatePersonality, personality, petId),
    activate: (petId: string): Promise<ActivatePetResult> => ipcRenderer.invoke(IPC.pets.activate, petId)
  },
  data: {
    export: (): Promise<{ success: true; path: string } | { success: false; message: string }> =>
      ipcRenderer.invoke(IPC.data.export),
    import: (): Promise<
      | {
          success: true
          backupDir: string
          petFileCount: number
          sourcePath: string
        }
      | { success: false; message: string; cancelled?: boolean }
    > => ipcRenderer.invoke(IPC.data.import),
    clearChat: (): Promise<void> => ipcRenderer.invoke(IPC.data.clearChat),
    deletePetImages: (petId: string): Promise<{ success: true } | { success: false; message: string }> =>
      ipcRenderer.invoke(IPC.data.deletePetImages, petId),
    wipeAll: (): Promise<{ success: true }> => ipcRenderer.invoke(IPC.data.wipeAll)
  },
  auth: {
    getState: (): Promise<AuthState> => ipcRenderer.invoke(IPC.auth.getState),
    requestMagicLink: (email: string): Promise<MagicLinkRequestResult> =>
      ipcRenderer.invoke(IPC.auth.requestMagicLink, email),
    logout: (): Promise<AuthActionResult> => ipcRenderer.invoke(IPC.auth.logout),
    refresh: (): Promise<AuthState> => ipcRenderer.invoke(IPC.auth.refresh),
    onStateChanged: (callback: (state: AuthState) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: AuthState): void => callback(state)
      ipcRenderer.on(IPC.auth.stateChanged, handler)
      return () => ipcRenderer.removeListener(IPC.auth.stateChanged, handler)
    },
    onSessionExpired: (callback: (payload: { message: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { message: string }): void => callback(payload)
      ipcRenderer.on(IPC.auth.sessionExpired, handler)
      return () => ipcRenderer.removeListener(IPC.auth.sessionExpired, handler)
    }
  },
  update: {
    getState: (): Promise<UpdateState> => ipcRenderer.invoke(IPC.update.getState),
    check: (): Promise<UpdateState> => ipcRenderer.invoke(IPC.update.check),
    download: (): Promise<UpdateState> => ipcRenderer.invoke(IPC.update.download),
    install: (): Promise<UpdateInstallResult> => ipcRenderer.invoke(IPC.update.install),
    onStateChanged: (callback: (state: UpdateState) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: UpdateState): void => callback(state)
      ipcRenderer.on(IPC.update.stateChanged, handler)
      return () => ipcRenderer.removeListener(IPC.update.stateChanged, handler)
    }
  },
  legal: {
    hasAccepted: (): Promise<boolean> => ipcRenderer.invoke(IPC.legal.hasAccepted),
    accept: (): Promise<LegalAcceptance> => ipcRenderer.invoke(IPC.legal.accept)
  },
  guide: {
    open: (): void => ipcRenderer.send(IPC.guide.open),
    close: (): void => ipcRenderer.send(IPC.guide.close),
    complete: (): Promise<void> => ipcRenderer.invoke(IPC.guide.complete)
  },
  crash: {
    reportRenderer: (message: string, stack?: string): void =>
      ipcRenderer.send(IPC.crash.reportRenderer, message, stack)
  }
})
