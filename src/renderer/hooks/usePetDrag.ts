import { useCallback, useEffect, useRef, type RefObject } from 'react'

const DRAG_THRESHOLD = 4

interface UsePetDragOptions {
  onClick?: () => void
  draggingRef?: RefObject<boolean>
}

export function usePetDrag({ onClick, draggingRef }: UsePetDragOptions) {
  const internalDragging = useRef(false)
  const moved = useRef(false)
  const windowPos = useRef({ x: 0, y: 0 })
  const origin = useRef({ x: 0, y: 0, winX: 0, winY: 0 })
  const activePointerId = useRef<number | null>(null)
  const captureElRef = useRef<HTMLElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null)
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  const setDragging = useCallback(
    (value: boolean): void => {
      internalDragging.current = value
      if (draggingRef) {
        draggingRef.current = value
      }
    },
    [draggingRef]
  )

  const refreshWindowPos = useCallback(async () => {
    const pos = await window.petory.window.getPosition()
    windowPos.current = pos
    return pos
  }, [])

  const releaseCaptureRef = useRef(() => {
    const el = captureElRef.current
    const pointerId = activePointerId.current
    if (el && pointerId !== null && el.hasPointerCapture(pointerId)) {
      try {
        el.releasePointerCapture(pointerId)
      } catch {
        // ignore
      }
    }
    captureElRef.current = null
  })

  const finishDragRef = useRef((event: PointerEvent) => {
    if (event.pointerId !== activePointerId.current) return
    if (!internalDragging.current) return

    const didMove = moved.current
    setDragging(false)
    activePointerId.current = null
    releaseCaptureRef.current()
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    const finalPosition = pendingPositionRef.current
    pendingPositionRef.current = null
    if (finalPosition) {
      windowPos.current = finalPosition
      void window.petory.window.setPosition(finalPosition)
    }
    window.removeEventListener('pointermove', handleWindowPointerMoveRef.current)
    window.removeEventListener('pointerup', handleWindowPointerUpRef.current)
    window.removeEventListener('pointercancel', handleWindowPointerUpRef.current)
    void refreshWindowPos()
    if (!didMove) {
      onClickRef.current?.()
    }
  })

  const handleWindowPointerMoveRef = useRef((event: PointerEvent) => {
    if (!internalDragging.current || event.pointerId !== activePointerId.current) return
    window.petory.window.setIgnoreMouseEvents(false)
    const dx = event.screenX - origin.current.x
    const dy = event.screenY - origin.current.y
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      moved.current = true
    }
    const next = {
      x: origin.current.winX + dx,
      y: origin.current.winY + dy
    }
    pendingPositionRef.current = next
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null
        const pending = pendingPositionRef.current
        pendingPositionRef.current = null
        if (!pending) return
        windowPos.current = pending
        void window.petory.window.setPosition(pending)
      })
    }
  })

  const handleWindowPointerUpRef = useRef((event: PointerEvent) => {
    finishDragRef.current(event)
  })

  useEffect(() => {
    void refreshWindowPos()
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMoveRef.current)
      window.removeEventListener('pointerup', handleWindowPointerUpRef.current)
      window.removeEventListener('pointercancel', handleWindowPointerUpRef.current)
      releaseCaptureRef.current()
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [refreshWindowPos])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()

      window.petory.window.setIgnoreMouseEvents(false)
      setDragging(true)
      moved.current = false
      activePointerId.current = event.pointerId
      captureElRef.current = event.currentTarget
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // window-level listeners still handle drag
      }

      origin.current = {
        x: event.screenX,
        y: event.screenY,
        winX: windowPos.current.x,
        winY: windowPos.current.y
      }

      void refreshWindowPos().then((pos) => {
        if (!internalDragging.current || activePointerId.current !== event.pointerId) return
        origin.current.winX = pos.x
        origin.current.winY = pos.y
        origin.current.x = event.screenX
        origin.current.y = event.screenY
      })

      window.addEventListener('pointermove', handleWindowPointerMoveRef.current)
      window.addEventListener('pointerup', handleWindowPointerUpRef.current)
      window.addEventListener('pointercancel', handleWindowPointerUpRef.current)
    },
    [refreshWindowPos, setDragging]
  )

  return { onPointerDown }
}
