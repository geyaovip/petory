import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { PetVisualState } from '@shared/types/growth'
import { PET_SIZE_HEIGHT } from '@shared/types/settings'
import { useAlphaHitTest } from '../hooks/useAlphaHitTest'
import { useClickThrough } from '../hooks/useClickThrough'
import { usePetDrag } from '../hooks/usePetDrag'
import { useSpeechBubble } from '../hooks/useSpeechBubble'
import { playHappy, playPetClick, playRemind } from '../utils/petSound'
import { PetPlaceholder } from './PetPlaceholder'
import { SpeechBubble } from './SpeechBubble'

const GREETINGS = [
  '你来啦，今天也要加油哦。',
  '我在这儿陪你呢。',
  '点点气泡，我们可以聊聊天～'
]

const COMPANION_GREETINGS = ['嗯？', '我也在这儿～', '主宠在那边，我陪你待着。']

function poseAnimation(state: PetVisualState): string {
  const animations: Record<PetVisualState, string> = {
    idle: 'animate-pet-float',
    happy: 'animate-pet-happy',
    sleep: 'animate-pet-sleep',
    focus: 'animate-pet-focus',
    remind: 'animate-pet-remind',
    angry: 'animate-pet-angry'
  }
  return animations[state]
}

interface PetOverlayProps {
  petId: string
}

export function PetOverlay({ petId }: PetOverlayProps): ReactElement {
  const [petImage, setPetImage] = useState<string | null>(null)
  const [petName, setPetName] = useState<string | null>(null)
  const [hasMultiPose, setHasMultiPose] = useState(false)
  const [isPrimary, setIsPrimary] = useState(true)
  const enableSoundRef = useRef(false)
  const [companionPose, setCompanionPose] = useState<PetVisualState>('idle')
  const isPrimaryRef = useRef(true)
  const draggingRef = useRef(false)
  const companionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [petState, setPetState] = useState<PetVisualState>('idle')
  const [petHeight, setPetHeight] = useState(160)
  const [petOpacity, setPetOpacity] = useState(1)
  const { text, phase, priority, show, pauseAutoHide, resumeAutoHide } = useSpeechBubble()

  const alphaHitTest = useAlphaHitTest(petImage)
  useClickThrough(draggingRef, alphaHitTest)

  const displayState: PetVisualState = isPrimary ? petState : companionPose

  const loadPoseImage = useCallback(
    async (pose: PetVisualState) => {
      const image = await window.petory.pet.getImage(petId, pose)
      setPetImage(image)
    },
    [petId]
  )

  const loadPet = useCallback(async () => {
    const [summary, state] = await Promise.all([
      window.petory.pet.getSummary(petId),
      window.petory.pet.getState()
    ])
    const primary = summary?.isPrimary ?? false
    const multiPose = (summary?.poseCount ?? 0) > 1
    isPrimaryRef.current = primary
    setIsPrimary(primary)
    setHasMultiPose(multiPose)
    setPetName(summary?.name ?? null)
    const visualState = primary ? state : 'idle'
    setPetState(visualState)
    setCompanionPose('idle')
    await loadPoseImage(visualState)
  }, [loadPoseImage, petId])

  useEffect(() => {
    void loadPet()
    void window.petory.settings.get().then((settings) => {
      setPetOpacity(settings.petOpacity)
      setPetHeight(PET_SIZE_HEIGHT[settings.petSize])
      enableSoundRef.current = settings.enableSound
    })
    const offImage = window.petory.pet.onImageUpdated(() => void loadPet())
    const offState = window.petory.pet.onStateChanged((state) => {
      if (!isPrimaryRef.current) return
      setPetState(state)
      void loadPoseImage(state)
      if (enableSoundRef.current) {
        if (state === 'happy') playHappy()
        if (state === 'remind') playRemind()
      }
    })
    const offBubble = window.petory.pet.onBubbleText((payload) => {
      if (isPrimaryRef.current) show(payload.text, payload.priority)
    })
    const offDisplay = window.petory.settings.onChanged((display) => {
      setPetHeight(display.petHeight)
      setPetOpacity(display.petOpacity)
    })
    return () => {
      offImage()
      offState()
      offBubble()
      offDisplay()
      if (companionTimerRef.current) clearTimeout(companionTimerRef.current)
    }
  }, [loadPet, loadPoseImage, show])

  useEffect(() => {
    if (!petName || !isPrimary) return
    const timer = setTimeout(() => {
      show(`我来啦，${petName}以后就在这里陪你。`, 'low')
    }, 800)
    return () => clearTimeout(timer)
  }, [isPrimary, petName, show])

  const flashCompanionHappy = (): void => {
    if (!hasMultiPose) return
    if (companionTimerRef.current) clearTimeout(companionTimerRef.current)
    setCompanionPose('happy')
    void loadPoseImage('happy')
    if (enableSoundRef.current) playHappy()
    companionTimerRef.current = setTimeout(() => {
      setCompanionPose('idle')
      void loadPoseImage('idle')
    }, 2800)
  }

  const handlePetClick = (): void => {
      if (isPrimary && petState === 'remind') {
        window.petory.pet.confirmSedentary()
        return
      }
      if (isPrimary) {
        window.petory.pet.recordActivity()
      } else {
        flashCompanionHappy()
      }
      if (enableSoundRef.current) playPetClick()
      const pool = isPrimary ? GREETINGS : COMPANION_GREETINGS
      show(pool[Math.floor(Math.random() * pool.length)], 'low')
  }

  const drag = usePetDrag({
    draggingRef,
    onClick: handlePetClick
  })
  const dragHandle = usePetDrag({ draggingRef })

  const openChat = (): void => {
    if (!isPrimary) return
    window.petory.chat.open()
  }

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-end pb-3"
      style={{ opacity: petOpacity }}
    >
      <div
        data-pet-drag
        data-pet-hit
        className="electron-no-drag absolute inset-x-0 top-0 z-30 h-14 cursor-grab touch-none active:cursor-grabbing"
        title="拖动此处移动桌宠"
        aria-hidden
        onPointerDown={dragHandle.onPointerDown}
      />
      <div className="relative flex flex-col items-center">
        <SpeechBubble
          text={text}
          phase={phase}
          priority={priority}
          onMouseEnter={pauseAutoHide}
          onMouseLeave={resumeAutoHide}
          onClick={isPrimary ? openChat : undefined}
        />
        <div
          data-pet-hit
          className={`electron-no-drag relative cursor-pointer touch-none will-change-transform active:cursor-grabbing ${poseAnimation(displayState)}`}
          onPointerDown={drag.onPointerDown}
          onContextMenu={(e) => {
            e.preventDefault()
            window.petory.window.showContextMenu()
          }}
        >
          {petImage ? (
            <img
              key={`${displayState}-${petImage}`}
              data-pet-hit
              src={petImage}
              alt={petName ?? '桌宠'}
              className="animate-pet-pose-enter w-auto cursor-pointer object-contain drop-shadow-md"
              style={{ height: petHeight }}
              draggable={false}
            />
          ) : (
            <PetPlaceholder />
          )}
          {displayState === 'sleep' ? (
            <div className="pointer-events-none absolute right-[8%] top-[2%] text-petory-text-secondary" aria-hidden>
              <span className="absolute animate-pet-zzz-one text-[13px] font-semibold">Z</span>
              <span className="absolute animate-pet-zzz-two text-[10px] font-semibold">z</span>
              <span className="absolute animate-pet-zzz-three text-[8px] font-semibold">z</span>
            </div>
          ) : null}
          {displayState === 'remind' ? (
            <span
              className="pointer-events-none absolute right-[4%] top-[8%] flex h-7 w-7 animate-pet-alert-pop items-center justify-center rounded-full border border-petory-warning/30 bg-petory-warning-soft text-[15px] font-bold text-petory-warning shadow-bubble"
              aria-hidden
            >
              !
            </span>
          ) : null}
        </div>
        {!isPrimary && petName ? (
          <span
            data-pet-hit
            className="mt-1 cursor-pointer rounded-full bg-black/10 px-2 py-0.5 text-[10px] text-petory-text-secondary"
          >
            {petName}
          </span>
        ) : null}
      </div>
    </div>
  )
}
