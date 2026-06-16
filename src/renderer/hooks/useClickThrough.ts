import { useCallback, useEffect, useRef, type RefObject } from 'react'

const PET_HIT_SELECTOR = '[data-pet-hit]'
const DRAG_HANDLE_SELECTOR = '[data-pet-drag]'

function clearCursor(): void {
  document.body.style.cursor = ''
  document.documentElement.style.cursor = ''
}

function pointInRect(
  clientX: number,
  clientY: number,
  rect: DOMRect
): boolean {
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  )
}

function isOverPetImageBox(clientX: number, clientY: number): boolean {
  const images = document.querySelectorAll<HTMLImageElement>(`${PET_HIT_SELECTOR} img`)
  for (const img of Array.from(images)) {
    if (pointInRect(clientX, clientY, img.getBoundingClientRect())) {
      return true
    }
  }
  return false
}

function isOverPetOpaque(
  clientX: number,
  clientY: number,
  alphaHitTest?: (img: HTMLImageElement, clientX: number, clientY: number) => boolean
): boolean {
  const images = document.querySelectorAll<HTMLImageElement>(`${PET_HIT_SELECTOR} img`)
  for (const img of Array.from(images)) {
    const rect = img.getBoundingClientRect()
    if (!pointInRect(clientX, clientY, rect)) continue
    if (alphaHitTest && !alphaHitTest(img, clientX, clientY)) continue
    return true
  }
  return false
}

function isOverDragHandle(clientX: number, clientY: number): boolean {
  const handles = document.querySelectorAll<HTMLElement>(DRAG_HANDLE_SELECTOR)
  for (const handle of Array.from(handles)) {
    if (pointInRect(clientX, clientY, handle.getBoundingClientRect())) {
      return true
    }
  }
  return false
}

export function useClickThrough(
  draggingRef: RefObject<boolean>,
  alphaHitTest?: (img: HTMLImageElement, clientX: number, clientY: number) => boolean
): void {
  const ignoringRef = useRef(true)
  const pointerButtonsRef = useRef(0)

  const setIgnore = useCallback((ignore: boolean) => {
    if (ignoringRef.current === ignore) return
    ignoringRef.current = ignore
    window.petory.window.setIgnoreMouseEvents(ignore)
  }, [])

  const isInteractiveAt = useCallback(
    (clientX: number, clientY: number): boolean => {
      if (isOverDragHandle(clientX, clientY)) return true
      if (isOverPetOpaque(clientX, clientY, alphaHitTest)) return true

      const elements = document.elementsFromPoint(clientX, clientY)
      for (const element of elements) {
        if (element.closest(DRAG_HANDLE_SELECTOR)) return true
        const hit = element.closest(PET_HIT_SELECTOR)
        if (!hit) continue
        if (hit instanceof HTMLImageElement && alphaHitTest) {
          if (alphaHitTest(hit, clientX, clientY)) return true
          continue
        }
        return true
      }
      return false
    },
    [alphaHitTest]
  )

  const applyCursor = useCallback(
    (clientX: number, clientY: number) => {
      if (draggingRef.current) {
        document.body.style.cursor = 'grabbing'
        document.documentElement.style.cursor = 'grabbing'
        return
      }
      if (!isInteractiveAt(clientX, clientY)) {
        clearCursor()
        return
      }
      const cursor = isOverDragHandle(clientX, clientY) ? 'grab' : 'pointer'
      document.body.style.cursor = cursor
      document.documentElement.style.cursor = cursor
    },
    [draggingRef, isInteractiveAt]
  )

  const isInteractiveTarget = useCallback(
    (target: Element | null, clientX: number, clientY: number): boolean => {
      if (isOverDragHandle(clientX, clientY)) return true
      if (isOverPetOpaque(clientX, clientY, alphaHitTest)) return true
      if (!target) return false
      if (target.closest(DRAG_HANDLE_SELECTOR)) return true
      const hit = target.closest(PET_HIT_SELECTOR)
      if (!hit) return false
      if (hit instanceof HTMLImageElement && alphaHitTest) {
        return alphaHitTest(hit, clientX, clientY)
      }
      return true
    },
    [alphaHitTest]
  )

  const updateIgnoreAt = useCallback(
    (clientX: number, clientY: number) => {
      if (draggingRef.current || pointerButtonsRef.current > 0) {
        setIgnore(false)
        applyCursor(clientX, clientY)
        return
      }
      const interactive = isInteractiveAt(clientX, clientY)
      setIgnore(!interactive)
      applyCursor(clientX, clientY)
    },
    [applyCursor, draggingRef, isInteractiveAt, setIgnore]
  )

  useEffect(() => {
    setIgnore(true)

    const onMove = (event: MouseEvent | PointerEvent): void => {
      pointerButtonsRef.current = event.buttons
      updateIgnoreAt(event.clientX, event.clientY)
    }

    const onPointerDown = (event: PointerEvent): void => {
      pointerButtonsRef.current = event.buttons
      if (
        isInteractiveTarget(event.target as Element | null, event.clientX, event.clientY) ||
        isOverPetImageBox(event.clientX, event.clientY) ||
        isOverDragHandle(event.clientX, event.clientY)
      ) {
        setIgnore(false)
        applyCursor(event.clientX, event.clientY)
      }
    }

    const onPointerUp = (event: PointerEvent): void => {
      pointerButtonsRef.current = event.buttons
      if (draggingRef.current) return
      updateIgnoreAt(event.clientX, event.clientY)
    }

    const onPointerLeave = (): void => {
      if (draggingRef.current || pointerButtonsRef.current > 0) return
      clearCursor()
      setIgnore(true)
    }

    const onCursorProbe = (position: { x: number; y: number } | null): void => {
      if (draggingRef.current || pointerButtonsRef.current > 0) return
      if (!position) {
        clearCursor()
        setIgnore(true)
        return
      }
      updateIgnoreAt(position.x, position.y)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    document.documentElement.addEventListener('mouseleave', onPointerLeave)
    document.documentElement.addEventListener('pointerleave', onPointerLeave)
    const unsubscribeProbe = window.petory.window.onCursorProbe(onCursorProbe)

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      document.documentElement.removeEventListener('mouseleave', onPointerLeave)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      unsubscribeProbe()
      clearCursor()
      setIgnore(false)
    }
  }, [alphaHitTest, applyCursor, draggingRef, isInteractiveTarget, setIgnore, updateIgnoreAt])
}
