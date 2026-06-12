import { useEffect, useRef, type ReactElement } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps): ReactElement | null {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    cancelButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-[320px] rounded-2xl bg-petory-surface p-5 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-[16px] font-semibold text-petory-text">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-[13px] leading-relaxed text-petory-text-secondary">
          {message}
        </p>
        <div className="mt-5 flex gap-2">
          <Button ref={cancelButtonRef} variant="secondary" fullWidth onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} fullWidth onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
