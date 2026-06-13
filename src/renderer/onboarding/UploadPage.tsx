import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactElement
} from 'react'
import {
  ALLOWED_EXTENSIONS,
  CONTENT_SAFETY,
  MAX_UPLOAD_BYTES
} from '@shared/constants'
import { ONBOARDING_COPY } from '@shared/copy/onboarding'
import { PageShell } from '../components/ui/PageShell'
import { UploadSimple } from '@phosphor-icons/react'

interface UploadPageProps {
  replaceMode?: boolean
  onUploaded: (petId: string) => void
  onError: (message: string) => void
}

async function fileToPayload(file: File) {
  const buffer = await file.arrayBuffer()
  return {
    fileName: file.name,
    mimeType: file.type,
    data: new Uint8Array(buffer)
  }
}

export function UploadPage({
  replaceMode = false,
  onUploaded,
  onError
}: UploadPageProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file || uploading) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (
      !ext ||
      !ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])
    ) {
      onError('请上传 PNG、JPG、JPEG 或 WEBP 格式，且图片小于 10MB。')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onError('请上传 PNG、JPG、JPEG 或 WEBP 格式，且图片小于 10MB。')
      return
    }

    setUploading(true)
    try {
      const payload = await fileToPayload(file)
      const result = await window.petory.pet.upload(payload)
      if (!result.success) {
        onError(result.message)
        return
      }
      onUploaded(result.petId)
    } catch {
      onError('上传失败，请稍后重试。')
    } finally {
      setUploading(false)
    }
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const onDrop = (event: DragEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    setDragging(false)
    void handleFile(event.dataTransfer.files?.[0])
  }

  return (
    <PageShell className="px-6 pb-6 pt-8">
      <h1 className="text-[22px] font-semibold">
        {replaceMode
          ? ONBOARDING_COPY.upload.titleReplace
          : ONBOARDING_COPY.upload.titleNew}
      </h1>
      <p className="mt-2 text-[13px] text-petory-text-secondary">
        {replaceMode
          ? ONBOARDING_COPY.upload.hintReplace
          : ONBOARDING_COPY.upload.hintNew}
      </p>

      <button
        type="button"
        disabled={uploading}
        aria-busy={uploading}
        className={[
          'mt-6 flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-petory-text transition-[background-color,border-color,box-shadow]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petory-primary focus-visible:ring-offset-2',
          'disabled:cursor-wait disabled:opacity-70',
          dragging
            ? 'border-petory-primary bg-petory-primary-soft shadow-[0_0_0_3px_rgba(255,138,122,0.12)]'
            : 'border-petory-border-strong bg-petory-surface hover:border-petory-primary hover:bg-petory-primary-soft/30'
        ].join(' ')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-petory-primary-soft text-petory-primary">
          <UploadSimple size={23} weight="bold" />
        </span>
        <p className="text-[15px] font-medium">
          {uploading
            ? ONBOARDING_COPY.upload.uploading
            : ONBOARDING_COPY.upload.cta}
        </p>
        <p className="mt-2 text-center text-[12px] text-petory-text-tertiary">
          PNG / JPG / JPEG / WEBP · 最大 10MB
        </p>
      </button>

      <p className="mt-4 text-[12px] leading-relaxed text-petory-text-tertiary">
        {CONTENT_SAFETY.upload}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={onInputChange}
      />
    </PageShell>
  )
}
