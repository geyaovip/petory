import { screen } from 'electron'
import { IPC, type WindowPosition } from '../../src/shared/ipc'
import { getAllPetWindows } from './windows'

const PROBE_MS = 32

let probeTimer: ReturnType<typeof setInterval> | null = null

function pointInBounds(point: WindowPosition, bounds: Electron.Rectangle): boolean {
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  )
}

function probeOnce(): void {
  const cursor = screen.getCursorScreenPoint()

  for (const win of getAllPetWindows()) {
    if (win.isDestroyed() || !win.isVisible()) continue

    const bounds = win.getBounds()
    const payload: WindowPosition | null = pointInBounds(cursor, bounds)
      ? { x: cursor.x - bounds.x, y: cursor.y - bounds.y }
      : null

    win.webContents.send(IPC.window.cursorProbe, payload)
  }
}

export function startPetCursorProbe(): void {
  if (probeTimer) return
  probeTimer = setInterval(probeOnce, PROBE_MS)
  probeOnce()
}

export function stopPetCursorProbe(): void {
  if (!probeTimer) return
  clearInterval(probeTimer)
  probeTimer = null
}
