import type { MenuAction, PetDisplaySettings, UploadPayload, WindowPosition } from '@shared/ipc'
import type {
  AuthActionResult,
  AuthState,
  MagicLinkRequestResult
} from '@shared/types/auth'
import type { ChatMessage, ChatSettings, SendChatResponse } from '@shared/types/chat'
import type { BubblePayload, GrowthStats, PetVisualState } from '@shared/types/growth'
import type { PomodoroStartInput, PomodoroState } from '@shared/types/pomodoro'
import type { UserSettings } from '@shared/types/settings'
import type { LegalAcceptance } from '@shared/types/legal'
import type {
  ActivatePetResult,
  DesktopPetResult,
  DesktopPetStatus,
  FinalizePetInput,
  CompletePosesResult,
  GenerationProgressPayload,
  InstallSampleResult,
  PoseCompletionStatus,
  Pet,
  PetDesktopSummary,
  PetIpcResult,
  PetPersonality,
  PetPoseType,
  RegeneratePoseResult
} from '@shared/types/pet'
import type { OnboardingIntent } from '@shared/types/onboarding'
import type { UpdateInstallResult, UpdateState } from '@shared/types/update'

export interface PetoryAPI {
  platform: NodeJS.Platform
  app: {
    getPetId: () => Promise<string | null>
    getMode: () => Promise<
      'auth' | 'onboarding' | 'pet' | 'chat' | 'pomodoro' | 'growth' | 'settings' | 'pets' | 'guide'
    >
    quit: () => void
    getVersion: () => Promise<string>
    openFeedback: () => void
    openWebsite: () => void
    openDownloadPage: () => void
    openPrivacy: () => void
    openTerms: () => void
  }
  window: {
    getPosition: () => Promise<WindowPosition>
    getCursorPosition: () => Promise<WindowPosition>
    setPosition: (position: WindowPosition) => Promise<void>
    hide: () => void
    show: () => void
    showContextMenu: () => void
    setIgnoreMouseEvents: (ignore: boolean) => void
    onCursorProbe: (callback: (position: WindowPosition | null) => void) => () => void
  }
  menu: {
    onAction: (callback: (action: MenuAction) => void) => () => void
  }
  pet: {
    hasActive: () => Promise<boolean>
    getActive: () => Promise<Pet | null>
    getActiveImage: () => Promise<string | null>
    upload: (
      payload: UploadPayload
    ) => Promise<{ success: true; petId: string } | { success: false; code: string; message: string }>
    generate: (petId: string) => Promise<PetIpcResult>
    getPreviewImage: (petId: string) => Promise<string | null>
    getImage: (petId: string, pose?: PetVisualState) => Promise<string | null>
    getSummary: (petId: string) => Promise<{
      name: string
      isPrimary: boolean
      personality: PetPersonality
      poseCount: number
    } | null>
    finalize: (input: FinalizePetInput) => Promise<Pet>
    openOnboarding: (intent?: OnboardingIntent) => void
    consumeOnboardingIntent: () => Promise<OnboardingIntent | null>
    onOnboardingIntent: (callback: (intent: OnboardingIntent | null) => void) => () => void
    installSample: () => Promise<InstallSampleResult>
    getState: () => Promise<PetVisualState>
    confirmSedentary: () => void
    recordActivity: () => void
    onImageUpdated: (callback: () => void) => () => void
    onBubbleText: (callback: (payload: BubblePayload) => void) => () => void
    onStateChanged: (callback: (state: PetVisualState) => void) => () => void
    onGenerationProgress: (callback: (payload: GenerationProgressPayload) => void) => () => void
    getPoseCompletionStatus: () => Promise<PoseCompletionStatus>
    completePoses: (petId?: string) => Promise<CompletePosesResult>
    regeneratePose: (petId: string, pose: PetPoseType) => Promise<RegeneratePoseResult>
  }
  chat: {
    open: () => void
    close: () => void
    send: (text: string) => Promise<SendChatResponse>
    getHistory: () => Promise<ChatMessage[]>
    clearHistory: () => Promise<void>
    getSettings: () => Promise<ChatSettings>
    setSettings: (settings: ChatSettings) => Promise<void>
  }
  pomodoro: {
    open: () => void
    close: () => void
    getState: () => Promise<PomodoroState>
    start: (input: PomodoroStartInput) => Promise<PomodoroState>
    pause: () => Promise<PomodoroState>
    resume: () => Promise<PomodoroState>
    end: () => Promise<PomodoroState>
    onTick: (callback: (state: PomodoroState) => void) => () => void
  }
  growth: {
    open: () => void
    close: () => void
    getStats: () => Promise<GrowthStats | null>
    onUpdated: (callback: () => void) => () => void
  }
  settings: {
    open: () => void
    close: () => void
    get: () => Promise<UserSettings>
    set: (settings: UserSettings) => Promise<UserSettings>
    onChanged: (callback: (display: PetDisplaySettings) => void) => () => void
  }
  desktop: {
    getStatus: () => Promise<DesktopPetStatus>
    list: () => Promise<PetDesktopSummary[]>
    show: (petId: string) => Promise<DesktopPetResult>
    hide: (petId: string) => Promise<{ success: true }>
  }
  pets: {
    open: () => void
    close: () => void
    list: () => Promise<Pet[]>
    onListChanged: (callback: () => void) => () => void
    updateName: (petId: string, name: string) => Promise<Pet>
    updatePersonality: (personality: PetPersonality, petId?: string) => Promise<Pet>
    activate: (petId: string) => Promise<ActivatePetResult>
  }
  data: {
    export: () => Promise<{ success: true; path: string } | { success: false; message: string }>
    import: () => Promise<
      | {
          success: true
          backupDir: string
          petFileCount: number
          sourcePath: string
        }
      | { success: false; message: string; cancelled?: boolean }
    >
    clearChat: () => Promise<void>
    deletePetImages: (petId: string) => Promise<{ success: true } | { success: false; message: string }>
    wipeAll: () => Promise<{ success: true }>
  }
  auth: {
    getState: () => Promise<AuthState>
    requestMagicLink: (email: string) => Promise<MagicLinkRequestResult>
    logout: () => Promise<AuthActionResult>
    refresh: () => Promise<AuthState>
    onStateChanged: (callback: (state: AuthState) => void) => () => void
    onSessionExpired: (callback: (payload: { message: string }) => void) => () => void
  }
  update: {
    getState: () => Promise<UpdateState>
    check: () => Promise<UpdateState>
    download: () => Promise<UpdateState>
    install: () => Promise<UpdateInstallResult>
    onStateChanged: (callback: (state: UpdateState) => void) => () => void
  }
  legal: {
    hasAccepted: () => Promise<boolean>
    accept: () => Promise<LegalAcceptance>
  }
  guide: {
    open: () => void
    close: () => void
    complete: () => Promise<void>
  }
  crash: {
    reportRenderer: (message: string, stack?: string) => void
  }
}

declare global {
  interface Window {
    petory: PetoryAPI
  }
}

export {}
