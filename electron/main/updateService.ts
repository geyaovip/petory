import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater
import { DEFAULT_UPDATE_FEED_URL } from '../../src/shared/constants'
import { IPC } from '../../src/shared/ipc'
import type { UpdateState } from '../../src/shared/types/update'

let state: UpdateState = { status: 'idle' }
let pendingCheck: Promise<UpdateState> | null = null
let checkSeq = 0

function broadcast(): void {
  const payload = { ...state }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.update.stateChanged, payload)
    }
  }
}

function isUpdateLocked(): boolean {
  return state.status === 'ready' || state.status === 'downloading'
}

function invalidateChecks(): void {
  checkSeq += 1
}

export function getUpdateState(): UpdateState {
  return { ...state }
}

function applyCheckResult(result: Awaited<ReturnType<typeof autoUpdater.checkForUpdates>>): void {
  if (!result || isUpdateLocked()) return

  if (result.isUpdateAvailable) {
    state = { status: 'available', version: result.updateInfo.version }
  } else {
    state = {
      status: 'not-available',
      version: result.updateInfo.version || app.getVersion(),
      message: '已是最新版本'
    }
  }
  broadcast()
}

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    state = { status: 'idle', message: '开发模式不检查更新' }
    return
  }

  const feedUrl = process.env['UPDATE_FEED_URL'] || DEFAULT_UPDATE_FEED_URL
  autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    if (isUpdateLocked()) return
    state = {
      status: 'error',
      message: error.message || '更新检查失败'
    }
    broadcast()
  })

  autoUpdater.on('download-progress', (progress) => {
    state = {
      status: 'downloading',
      version: state.version,
      progress: progress.percent
    }
    broadcast()
  })

  autoUpdater.on('update-downloaded', (info) => {
    invalidateChecks()
    pendingCheck = null
    state = { status: 'ready', version: info.version, message: '更新已下载，可立即安装' }
    broadcast()
  })

  setTimeout(() => {
    if (state.status === 'idle') {
      void checkForUpdates()
    }
  }, 8000)
}

async function runCheckForUpdates(): Promise<UpdateState> {
  if (!app.isPackaged) {
    state = { status: 'idle', message: '开发模式不检查更新' }
    return state
  }

  if (isUpdateLocked()) {
    return getUpdateState()
  }

  const seq = ++checkSeq
  state = { status: 'checking' }
  broadcast()

  try {
    const result = await autoUpdater.checkForUpdates()
    if (seq !== checkSeq || isUpdateLocked()) return getUpdateState()
    applyCheckResult(result)
  } catch (error) {
    if (seq !== checkSeq || isUpdateLocked()) return getUpdateState()
    state = {
      status: 'error',
      message: error instanceof Error ? error.message : '检查更新失败'
    }
    broadcast()
  }

  return getUpdateState()
}

export function checkForUpdates(): Promise<UpdateState> {
  if (isUpdateLocked()) {
    return Promise.resolve(getUpdateState())
  }

  if (!pendingCheck) {
    pendingCheck = runCheckForUpdates().finally(() => {
      pendingCheck = null
    })
  }
  return pendingCheck
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (!app.isPackaged) {
    return getUpdateState()
  }

  if (state.status !== 'available') {
    return getUpdateState()
  }

  invalidateChecks()
  pendingCheck = null

  state = { status: 'downloading', version: state.version, progress: 0 }
  broadcast()

  try {
    await autoUpdater.downloadUpdate()
  } catch (error) {
    state = {
      status: 'error',
      message: error instanceof Error ? error.message : '下载更新失败'
    }
    broadcast()
  }

  return getUpdateState()
}

export function quitAndInstallUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall()
}
