import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { PETS_COPY } from '@shared/copy/pets'
import { PERSONALITIES } from '@shared/constants'
import type { AuthState } from '@shared/types/auth'
import type { DesktopPetStatus, Pet, PetPersonality } from '@shared/types/pet'
import { Check, PencilSimple, X } from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { PanelHeader } from '../components/ui/PanelHeader'
import { PanelLoading } from '../components/ui/PanelLoading'
import { Pill } from '../components/ui/Pill'
import { StatusBanner } from '../components/ui/StatusBanner'
import { Input } from '../components/ui/Input'

export function PetManagerPanel(): ReactElement {
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [desktopStatus, setDesktopStatus] = useState<DesktopPetStatus | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<{
    message: string
    error: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    petId: string
    name: string
  } | null>(null)
  const [authState, setAuthState] = useState<AuthState | null>(null)

  const canCreateCustomPet = authState?.canCreateCustomPet !== false

  const needsFinalize = (pet: Pet): boolean =>
    !pet.isSample && pet.status === 'generated' && !pet.name.trim() && Boolean(pet.imagePetPath)

  const needsResumeGeneration = (pet: Pet): boolean =>
    !pet.isSample && pet.status === 'draft' && !pet.imagePetPath

  const load = useCallback(async () => {
    try {
      const [list, nextDesktopStatus] = await Promise.all([
        window.petory.pets.list(),
        window.petory.desktop.getStatus()
      ])
      setPets(list)
      setDesktopStatus(nextDesktopStatus)
      setSelectedPetId((current) => {
        if (current && list.some((pet) => pet.id === current)) return current
        return (
          list.find((pet) => needsFinalize(pet) || needsResumeGeneration(pet))?.id ??
          list.find((pet) => pet.isActive)?.id ??
          list[0]?.id ??
          null
        )
      })
      setLoading(false)

      const nextPreviews: Record<string, string> = {}
      await Promise.all(
        list.map(async (pet) => {
          try {
            const image = await window.petory.pet.getPreviewImage(pet.id)
            if (image) nextPreviews[pet.id] = image
          } catch {
            // Preview may fail while poses are still being written.
          }
        })
      )
      setPreviews(nextPreviews)
    } catch {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return window.petory.pets.onListChanged(() => void load())
  }, [load])

  useEffect(() => {
    void window.petory.auth.getState().then(setAuthState)
    return window.petory.auth.onStateChanged(setAuthState)
  }, [])

  const selectedPet = useMemo(() => pets.find((pet) => pet.id === selectedPetId) ?? null, [pets, selectedPetId])

  const showStatus = (message: string, error = false): void => {
    setStatus({ message, error })
    window.setTimeout(() => setStatus(null), 3000)
  }

  const updatePersonality = async (petId: string, personality: PetPersonality): Promise<void> => {
    await window.petory.pets.updatePersonality(personality, petId)
    await load()
    showStatus('性格已更新')
  }

  const beginNameEdit = (pet: Pet): void => {
    setNameDraft(pet.name)
    setEditingName(true)
  }

  const saveName = async (petId: string): Promise<void> => {
    const nextName = nameDraft.trim()
    if (!nextName) return showStatus('宠物名称不能为空', true)
    setSavingName(true)
    try {
      await window.petory.pets.updateName(petId, nextName)
      setEditingName(false)
      await load()
      showStatus('名称已更新')
    } catch (error) {
      showStatus(error instanceof Error ? error.message : '名称更新失败', true)
    } finally {
      setSavingName(false)
    }
  }

  const activatePet = async (petId: string): Promise<void> => {
    const result = await window.petory.pets.activate(petId)
    if (!result.success) return showStatus(result.message, true)
    await load()
    showStatus('已切换为主宠')
  }

  const toggleDesktop = async (pet: Pet): Promise<void> => {
    if (pet.onDesktop) {
      await window.petory.desktop.hide(pet.id)
      await load()
      return showStatus('已从桌面隐藏')
    }
    const result = await window.petory.desktop.show(pet.id)
    if (!result.success) return showStatus(result.message, true)
    await load()
    showStatus('已显示在桌面')
  }

  const deleteImages = async (petId: string): Promise<void> => {
    const result = await window.petory.data.deletePetImages(petId)
    if (!result.success) return showStatus(result.message, true)
    await load()
    showStatus('图片已删除')
  }

  if (loading) return <PanelLoading label={PETS_COPY.loading} />

  return (
    <div className="flex h-full min-h-0 flex-col bg-petory-bg text-petory-text">
        <PanelHeader
          title="宠物管理"
          subtitle={
            desktopStatus
              ? `桌面显示 ${desktopStatus.visibleCount}/${desktopStatus.maxDesktopPets} · 主宠负责聊天与成长`
              : '选择一只宠物后再管理它的状态'
          }
          onClose={() => window.petory.pets.close()}
        />
        {status ? (
        <StatusBanner className="mx-5 mt-4" message={status.message} variant={status.error ? 'error' : 'success'} />
        ) : null}

      {pets.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <EmptyState
            title={PETS_COPY.empty.title}
            description={PETS_COPY.empty.description}
            actionLabel={PETS_COPY.empty.action}
            onAction={
              canCreateCustomPet
                ? () =>
                    window.petory.pet.openOnboarding({
                      mode: 'new',
                      returnTo: 'pets'
                    })
                : undefined
            }
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-petory-border bg-petory-surface p-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-petory-text-tertiary">
              我的宠物 · {pets.length}
            </p>
            <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto">
              {pets.map((pet) => {
                const selected = pet.id === selectedPetId
                return (
                  <li key={pet.id}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        selected ? 'bg-petory-primary-soft text-petory-text' : 'hover:bg-petory-muted'
                      }`}
                      onClick={() => {
                        setEditingName(false)
                        setSelectedPetId(pet.id)
                      }}
                    >
                      <span className="bg-petory-checker-sm flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-petory-border">
                        {previews[pet.id] ? (
                          <img src={previews[pet.id]} alt="" className="h-10 w-10 object-contain" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{pet.name || '未命名'}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-petory-text-tertiary">
                          {needsFinalize(pet)
                            ? '待完成创建'
                            : needsResumeGeneration(pet)
                              ? '待继续生成'
                              : pet.isActive
                                ? '主宠'
                                : pet.onDesktop
                                  ? '桌面显示中'
                                  : '未显示'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {canCreateCustomPet ? (
              <Button
                className="mt-3"
                fullWidth
                onClick={() =>
                  window.petory.pet.openOnboarding({
                    mode: 'new',
                    returnTo: 'pets'
                  })
                }
              >
                新建宠物
              </Button>
            ) : null}
          </aside>

          {selectedPet ? (
            <main className="min-h-0 overflow-y-auto overscroll-contain px-7 py-6">
              {needsFinalize(selectedPet) ? (
                <StatusBanner className="mb-5" message={PETS_COPY.pendingFinalize.banner} variant="success" />
              ) : null}
              <section className="flex items-center gap-5 rounded-2xl border border-petory-border bg-petory-surface p-5">
                <div className="bg-petory-checker flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-petory-border">
                  {previews[selectedPet.id] ? (
                    <img
                      src={previews[selectedPet.id]}
                      alt={`${selectedPet.name} 预览`}
                      className="h-24 w-24 object-contain"
                    />
                  ) : (
                    <span className="text-[12px] text-petory-text-tertiary">暂无预览</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {editingName ? (
                      <form
                        className="flex min-w-[260px] max-w-[420px] flex-1 items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void saveName(selectedPet.id)
                        }}
                      >
                        <Input
                          autoFocus
                          className="h-9"
                          maxLength={20}
                          value={nameDraft}
                          onChange={(event) => setNameDraft(event.target.value)}
                        />
                        <Button
                          aria-label="保存名称"
                          className="w-9 px-0"
                          disabled={!nameDraft.trim() || savingName}
                          size="sm"
                          type="submit"
                        >
                          <Check size={16} weight="bold" />
                        </Button>
                        <Button
                          aria-label="取消编辑"
                          className="w-9 px-0"
                          disabled={savingName}
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingName(false)}
                        >
                          <X size={16} weight="bold" />
                        </Button>
                      </form>
                    ) : (
                      <div className="flex min-w-0 items-center gap-1.5">
                        <h2 className="truncate text-[24px] font-semibold">
                          {selectedPet.name || '未命名'}
                        </h2>
                        <button
                          type="button"
                          aria-label="编辑宠物名称"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-petory-text-tertiary transition-colors hover:bg-petory-muted hover:text-petory-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petory-primary"
                          onClick={() => beginNameEdit(selectedPet)}
                        >
                          <PencilSimple size={16} weight="bold" />
                        </button>
                      </div>
                    )}
                    {selectedPet.isActive ? <Pill selected>主宠</Pill> : null}
                    {selectedPet.onDesktop ? <Pill>桌面中</Pill> : null}
                  </div>
                  <p className="mt-2 text-[13px] text-petory-text-secondary">
                    Lv.{selectedPet.level}
                    {selectedPet.isSample ? ' · 示例宠物' : ''}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {needsFinalize(selectedPet) ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          window.petory.pet.openOnboarding({
                            mode: 'finalize',
                            petId: selectedPet.id,
                            returnTo: 'pets'
                          })
                        }
                      >
                        {PETS_COPY.pendingFinalize.action}
                      </Button>
                    ) : needsResumeGeneration(selectedPet) ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          window.petory.pet.openOnboarding({
                            mode: 'resume',
                            petId: selectedPet.id,
                            returnTo: 'pets'
                          })
                        }
                      >
                        {PETS_COPY.pendingResume.action}
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => void toggleDesktop(selectedPet)}>
                          {selectedPet.onDesktop ? '从桌面隐藏' : '显示在桌面'}
                        </Button>
                        {!selectedPet.isActive ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void activatePet(selectedPet.id)}
                          >
                            设为主宠
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </section>

              <section className="mt-7 border-t border-petory-border pt-6">
                <h3 className="text-[13px] font-semibold">性格</h3>
                <p className="mt-1 text-[12px] text-petory-text-tertiary">影响聊天语气，不会改变宠物外观。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PERSONALITIES.map((item) => (
                    <Pill
                      key={item}
                      selected={selectedPet.personality === item}
                      onClick={() => void updatePersonality(selectedPet.id, item)}
                    >
                      {item}
                    </Pill>
                  ))}
                </div>
              </section>

              {!selectedPet.isSample && selectedPet.imageOriginalPath ? (
                <section className="mt-7 border-t border-petory-border pt-6">
                  <h3 className="text-[13px] font-semibold">重新生成</h3>
                  <p className="mt-1 text-[12px] text-petory-text-tertiary">基于原照片重新生成完整六种姿势，不改变主体风格。</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      window.petory.pet.openOnboarding({
                        mode: 'restyle',
                        petId: selectedPet.id,
                        returnTo: 'pets'
                      })
                    }
                  >
                    重新生成这只宠物
                  </Button>
                </section>
              ) : null}

              <section className="mt-7 border-t border-petory-border pt-6">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDeleteTarget({
                      petId: selectedPet.id,
                      name: selectedPet.name
                    })
                  }
                >
                  删除本地图片文件
                </Button>
              </section>
            </main>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={PETS_COPY.confirmDeleteImages.title}
        message={deleteTarget ? PETS_COPY.confirmDeleteImages.message(deleteTarget.name) : ''}
        confirmLabel={PETS_COPY.confirmDeleteImages.confirm}
        danger
        onConfirm={() => {
          if (deleteTarget) void deleteImages(deleteTarget.petId)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
