import { useCallback, useEffect, useState, type ReactElement } from 'react'
import type { OnboardingIntent } from '@shared/types/onboarding'
import type { PetStyleType } from '@shared/types/pet'
import { ErrorPage } from './ErrorPage'
import { GeneratingPage } from './GeneratingPage'
import { NamingPage } from './NamingPage'
import { ResultPage } from './ResultPage'
import { StyleSelectPage } from './StyleSelectPage'
import { UploadPage } from './UploadPage'
import { WelcomePage } from './WelcomePage'
import type { OnboardingErrorCode, OnboardingStep } from './types'

type FlowStep = OnboardingStep | 'loading'

function resolveDefaultStyle(
  lastSelectedStyle: PetStyleType,
  activeStyle?: PetStyleType
): PetStyleType {
  return lastSelectedStyle ?? activeStyle ?? 'petory'
}

export function OnboardingFlow(): ReactElement {
  const [step, setStep] = useState<FlowStep>('loading')
  const [replaceMode, setReplaceMode] = useState(false)
  const [returnToPets, setReturnToPets] = useState(false)
  const [petId, setPetId] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<PetStyleType>('petory')
  const [lastUsedStyle, setLastUsedStyle] = useState<PetStyleType>('petory')
  const [isSamplePet, setIsSamplePet] = useState(false)
  const [errorCode, setErrorCode] =
    useState<OnboardingErrorCode>('generation_failed')
  const [errorMessage, setErrorMessage] = useState('')
  const [installingSample, setInstallingSample] = useState(false)

  const applyIntent = useCallback(
    async (intent: OnboardingIntent | null): Promise<void> => {
      const [hasActive, activePet, settings] = await Promise.all([
        window.petory.pet.hasActive(),
        window.petory.pet.getActive(),
        window.petory.settings.get()
      ])

      const rememberedStyle = settings.lastSelectedStyle
      setLastUsedStyle(rememberedStyle)
      setReturnToPets(intent?.returnTo === 'pets')

      if (intent?.mode === 'restyle') {
        const pets = await window.petory.pets.list()
        const pet = pets.find((item) => item.id === intent.petId)
        if (!pet || pet.isSample) {
          setSelectedStyle(rememberedStyle)
          setReplaceMode(hasActive)
          setStep(hasActive ? 'upload' : 'welcome')
          return
        }

        setReplaceMode(true)
        setPetId(pet.id)
        setIsSamplePet(false)
        setSelectedStyle(pet.styleType ?? rememberedStyle)
        setStep(pet.imagePetPath ? 'result' : 'style')
        return
      }

      if (intent?.mode === 'new') {
        setReplaceMode(false)
        setPetId(null)
        setIsSamplePet(false)
        setSelectedStyle(rememberedStyle)
        setStep('upload')
        return
      }

      if (intent?.mode === 'replace' || hasActive) {
        setReplaceMode(true)
        setPetId(null)
        setIsSamplePet(false)
        setSelectedStyle(
          resolveDefaultStyle(rememberedStyle, activePet?.styleType)
        )
        setStep('upload')
        return
      }

      setReplaceMode(false)
      setSelectedStyle(rememberedStyle)
      setStep('welcome')
    },
    []
  )

  const returnToPrevious = useCallback((): void => {
    if (returnToPets) window.petory.pets.open()
    window.close()
  }, [returnToPets])

  useEffect(() => {
    void window.petory.pet.consumeOnboardingIntent().then((intent) => {
      void applyIntent(intent)
    })
    return window.petory.pet.onOnboardingIntent((intent) => {
      void applyIntent(intent)
    })
  }, [applyIntent])

  const runGeneration = useCallback(async (id: string, style: PetStyleType) => {
    setIsSamplePet(false)
    setSelectedStyle(style)
    setStep('generating')
    const result = await window.petory.pet.generate(id, style)
    if (!result.success) {
      setPetId(id)
      setErrorCode(result.code)
      setErrorMessage(result.message)
      setStep('error')
      return
    }
    setLastUsedStyle(style)
    setPetId(id)
    setStep('result')
  }, [])

  const runSample = useCallback(async () => {
    setInstallingSample(true)
    setStep('generating')
    try {
      const result = await window.petory.pet.installSample()
      if (!result.success) {
        setErrorCode('generation_failed')
        setErrorMessage(result.message)
        setStep('error')
        return
      }
      setPetId(result.petId)
      setIsSamplePet(true)
      setSelectedStyle('petory')
      setStep('naming')
    } finally {
      setInstallingSample(false)
    }
  }, [])

  if (step === 'loading') {
    return (
      <div className="flex h-full items-center justify-center bg-petory-bg text-petory-text-secondary">
        加载中…
      </div>
    )
  }

  if (step === 'welcome') {
    return (
      <WelcomePage
        sampleLoading={installingSample}
        onCreate={() => setStep('upload')}
        onTrySample={() => void runSample()}
      />
    )
  }

  if (step === 'upload') {
    return (
      <UploadPage
        replaceMode={replaceMode}
        onUploaded={(id) => {
          void window.petory.settings.get().then((settings) => {
            setPetId(id)
            setSelectedStyle(settings.lastSelectedStyle)
            setLastUsedStyle(settings.lastSelectedStyle)
            setStep('style')
          })
        }}
        onError={(message) => {
          setErrorCode('upload_invalid')
          setErrorMessage(message)
          setStep('error')
        }}
      />
    )
  }

  if (step === 'style' && petId) {
    return (
      <StyleSelectPage
        initialStyle={selectedStyle}
        lastUsedStyle={lastUsedStyle}
        replaceMode={replaceMode}
        onBack={() => setStep('upload')}
        onContinue={(style) => void runGeneration(petId, style)}
      />
    )
  }

  if (step === 'generating') {
    return <GeneratingPage styleType={isSamplePet ? 'petory' : selectedStyle} />
  }

  if (step === 'result' && petId) {
    return (
      <ResultPage
        petId={petId}
        initialStyle={selectedStyle}
        lastUsedStyle={lastUsedStyle}
        onUse={() => setStep('naming')}
        onRegenerate={(style) => void runGeneration(petId, style)}
        onUploadAnother={() => {
          setPetId(null)
          setIsSamplePet(false)
          setStep('upload')
        }}
      />
    )
  }

  if (step === 'naming' && petId) {
    return (
      <NamingPage
        petId={petId}
        isSample={isSamplePet}
        styleType={selectedStyle}
        onSubmit={returnToPrevious}
      />
    )
  }

  if (step === 'error') {
    return (
      <ErrorPage
        code={errorCode}
        message={errorMessage}
        onTryAgain={
          petId
            ? () => {
                if (errorCode === 'style_locked') {
                  setStep('style')
                  return
                }
                void runGeneration(petId, selectedStyle)
              }
            : undefined
        }
        onUploadAnother={() => {
          setPetId(null)
          setIsSamplePet(false)
          setStep('upload')
        }}
      />
    )
  }

  return (
    <WelcomePage
      sampleLoading={installingSample}
      onCreate={() => setStep('upload')}
      onTrySample={() => void runSample()}
    />
  )
}
