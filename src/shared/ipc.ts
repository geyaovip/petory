import type { FinalizePetInput, Pet, UploadResult } from './types/pet'

export const IPC = {
  window: {
    getPosition: 'petory:window:getPosition',
    getCursorPosition: 'petory:window:getCursorPosition',
    setPosition: 'petory:window:setPosition',
    hide: 'petory:window:hide',
    show: 'petory:window:show',
    showContextMenu: 'petory:window:showContextMenu',
    setIgnoreMouseEvents: 'petory:window:setIgnoreMouseEvents',
    cursorProbe: 'petory:window:cursorProbe'
  },
  app: {
    quit: 'petory:app:quit',
    getMode: 'petory:app:getMode',
    getPetId: 'petory:app:getPetId',
    openFeedback: 'petory:app:openFeedback',
    getVersion: 'petory:app:getVersion',
    openWebsite: 'petory:app:openWebsite',
    openDownloadPage: 'petory:app:openDownloadPage',
    openPrivacy: 'petory:app:openPrivacy',
    openTerms: 'petory:app:openTerms'
  },
  menu: {
    action: 'petory:menu:action'
  },
  pet: {
    hasActive: 'petory:pet:hasActive',
    getActive: 'petory:pet:getActive',
    getActiveImage: 'petory:pet:getActiveImage',
    upload: 'petory:pet:upload',
    generate: 'petory:pet:generate',
    getPreviewImage: 'petory:pet:getPreviewImage',
    finalize: 'petory:pet:finalize',
    openOnboarding: 'petory:pet:openOnboarding',
    imageUpdated: 'petory:pet:imageUpdated',
    bubbleText: 'petory:pet:bubbleText',
    stateChanged: 'petory:pet:stateChanged',
    getState: 'petory:pet:getState',
    confirmSedentary: 'petory:pet:confirmSedentary',
    recordActivity: 'petory:pet:recordActivity',
    installSample: 'petory:pet:installSample',
    getImage: 'petory:pet:getImage',
    getSummary: 'petory:pet:getSummary',
    consumeOnboardingIntent: 'petory:pet:consumeOnboardingIntent',
    onboardingIntent: 'petory:pet:onboardingIntent',
    generationProgress: 'petory:pet:generationProgress',
    getPoseCompletionStatus: 'petory:pet:getPoseCompletionStatus',
    completePoses: 'petory:pet:completePoses',
    regeneratePose: 'petory:pet:regeneratePose'
  },
  desktop: {
    getStatus: 'petory:desktop:getStatus',
    list: 'petory:desktop:list',
    show: 'petory:desktop:show',
    hide: 'petory:desktop:hide'
  },
  chat: {
    open: 'petory:chat:open',
    close: 'petory:chat:close',
    send: 'petory:chat:send',
    getHistory: 'petory:chat:getHistory',
    clearHistory: 'petory:chat:clearHistory',
    getSettings: 'petory:chat:getSettings',
    setSettings: 'petory:chat:setSettings'
  },
  pomodoro: {
    open: 'petory:pomodoro:open',
    close: 'petory:pomodoro:close',
    getState: 'petory:pomodoro:getState',
    start: 'petory:pomodoro:start',
    pause: 'petory:pomodoro:pause',
    resume: 'petory:pomodoro:resume',
    end: 'petory:pomodoro:end',
    tick: 'petory:pomodoro:tick'
  },
  growth: {
    open: 'petory:growth:open',
    close: 'petory:growth:close',
    getStats: 'petory:growth:getStats',
    updated: 'petory:growth:updated'
  },
  settings: {
    get: 'petory:settings:get',
    set: 'petory:settings:set',
    changed: 'petory:settings:changed',
    open: 'petory:settings:open',
    close: 'petory:settings:close'
  },
  pets: {
    open: 'petory:pets:open',
    close: 'petory:pets:close',
    list: 'petory:pets:list',
    listChanged: 'petory:pets:listChanged',
    updateName: 'petory:pets:updateName',
    updatePersonality: 'petory:pets:updatePersonality',
    activate: 'petory:pets:activate'
  },
  data: {
    export: 'petory:data:export',
    import: 'petory:data:import',
    clearChat: 'petory:data:clearChat',
    deletePetImages: 'petory:data:deletePetImages',
    wipeAll: 'petory:data:wipeAll'
  },
  auth: {
    getState: 'petory:auth:getState',
    requestMagicLink: 'petory:auth:requestMagicLink',
    logout: 'petory:auth:logout',
    refresh: 'petory:auth:refresh',
    stateChanged: 'petory:auth:stateChanged',
    sessionExpired: 'petory:auth:sessionExpired'
  },
  update: {
    getState: 'petory:update:getState',
    check: 'petory:update:check',
    download: 'petory:update:download',
    install: 'petory:update:install',
    stateChanged: 'petory:update:stateChanged'
  },
  legal: {
    hasAccepted: 'petory:legal:hasAccepted',
    accept: 'petory:legal:accept'
  },
  guide: {
    open: 'petory:guide:open',
    close: 'petory:guide:close',
    complete: 'petory:guide:complete'
  },
  crash: {
    reportRenderer: 'petory:crash:reportRenderer'
  }
} as const

export type MenuAction = 'chat' | 'focus' | 'settings' | 'hide' | 'quit'

export type AppMode = 'auth' | 'onboarding' | 'pet' | 'chat' | 'pomodoro' | 'growth' | 'settings' | 'pets' | 'guide'

export interface PetDisplaySettings {
  petSize: 'small' | 'medium' | 'large'
  petOpacity: number
  petHeight: number
}

export interface WindowPosition {
  x: number
  y: number
}

export type CursorProbePayload = WindowPosition | null

export interface UploadPayload {
  fileName: string
  mimeType: string
  data: Uint8Array
}

export type { Pet, UploadResult, FinalizePetInput }
