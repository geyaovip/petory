import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { PETS_COPY } from '@shared/copy/pets'
import { PERSONALITIES } from '@shared/constants'
import { PET_POSE_LABELS, PET_POSE_ORDER } from '@shared/poses'
import { getStyleDefinition } from '@shared/styles'
import type { DesktopPetStatus, Pet, PetPersonality, PetPoseType } from '@shared/types/pet'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { PanelHeader } from '../components/ui/PanelHeader'
import { PanelLoading } from '../components/ui/PanelLoading'
import { Pill } from '../components/ui/Pill'
import { StatusBanner } from '../components/ui/StatusBanner'

export function PetManagerPanel(): ReactElement {
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [desktopStatus, setDesktopStatus] = useState<DesktopPetStatus | null>(null)
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [missingPoseCount, setMissingPoseCount] = useState<Record<string, number>>({})
  const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ petId: string; name: string } | null>(null)

  const load = useCallback(async () => {
    const [list, nextDesktopStatus, poseStatus] = await Promise.all([
      window.petory.pets.list(),
      window.petory.desktop.getStatus(),
      window.petory.pet.getPoseCompletionStatus()
    ])
    setPets(list)
    setDesktopStatus(nextDesktopStatus)
    setSelectedPetId((current) => {
      if (current && list.some((pet) => pet.id === current)) return current
      return list.find((pet) => pet.isActive)?.id ?? list[0]?.id ?? null
    })
    setMissingPoseCount(
      Object.fromEntries(poseStatus.pending.map((item) => [item.petId, item.missing.length]))
    )

    const nextPreviews: Record<string, string> = {}
    await Promise.all(
      list.map(async (pet) => {
        const image = await window.petory.pet.getPreviewImage(pet.id)
        if (image) nextPreviews[pet.id] = image
      })
    )
    setPreviews(nextPreviews)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    return window.petory.pets.onListChanged(() => void load())
  }, [load])

  const selectedPet = useMemo(
    () => pets.find((pet) => pet.id === selectedPetId) ?? null,
    [pets, selectedPetId]
  )

  const showStatus = (message: string, error = false): void => {
    setStatus({ message, error })
    window.setTimeout(() => setStatus(null), 3000)
  }

  const updatePersonality = async (petId: string, personality: PetPersonality): Promise<void> => {
    await window.petory.pets.updatePersonality(personality, petId)
    await load()
    showStatus('性格已更新')
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

  const completePoses = async (petId: string): Promise<void> => {
    const result = await window.petory.pet.completePoses(petId)
    if (!result.success) return showStatus(result.message, true)
    const count = 'addedPoses' in result ? result.addedPoses.length : 0
    await load()
    showStatus(count > 0 ? `已补全 ${count} 种姿势` : '姿势已是最新')
  }

  const regeneratePose = async (petId: string, pose: PetPoseType): Promise<void> => {
    const key = `${petId}:${pose}`
    setRegeneratingKey(key)
    try {
      const result = await window.petory.pet.regeneratePose(petId, pose)
      if (!result.success) return showStatus(result.message, true)
      await load()
      showStatus(`已重生成「${PET_POSE_LABELS[pose]}」`)
    } finally {
      setRegeneratingKey(null)
    }
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
      <div className="shrink-0 border-b border-petory-border px-7 pb-4 pt-5">
        <PanelHeader
          className="pt-0"
          title="宠物管理"
          subtitle={
            desktopStatus
              ? `桌面显示 ${desktopStatus.visibleCount}/${desktopStatus.maxDesktopPets} · 主宠负责聊天与成长`
              : '选择一只宠物后再管理它的状态与姿势'
          }
          onClose={() => window.petory.pets.close()}
        />
        {status ? (
          <StatusBanner
            className="mt-3"
            message={status.message}
            variant={status.error ? 'error' : 'success'}
          />
        ) : null}
      </div>

      {pets.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <EmptyState
            title={PETS_COPY.empty.title}
            description={PETS_COPY.empty.description}
            actionLabel={PETS_COPY.empty.action}
            onAction={() => window.petory.pet.openOnboarding({ mode: 'new', returnTo: 'pets' })}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-r border-petory-border bg-petory-surface/55 p-4">
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
                        selected
                          ? 'bg-petory-primary-soft text-petory-text'
                          : 'hover:bg-petory-muted'
                      }`}
                      onClick={() => setSelectedPetId(pet.id)}
                    >
                      <span className="bg-petory-checker-sm flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-petory-border">
                        {previews[pet.id] ? (
                          <img src={previews[pet.id]} alt="" className="h-10 w-10 object-contain" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{pet.name || '未命名'}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-petory-text-tertiary">
                          {pet.isActive ? '主宠' : pet.onDesktop ? '桌面显示中' : '未显示'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <Button
              className="mt-3"
              fullWidth
              onClick={() => window.petory.pet.openOnboarding({ mode: 'new', returnTo: 'pets' })}
            >
              新建宠物
            </Button>
          </aside>

          {selectedPet ? (
            <main className="min-h-0 overflow-y-auto px-7 py-6">
              <section className="flex items-center gap-5">
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
                    <h2 className="truncate text-[24px] font-semibold">{selectedPet.name || '未命名'}</h2>
                    {selectedPet.isActive ? <Pill selected>主宠</Pill> : null}
                    {selectedPet.onDesktop ? <Pill>桌面中</Pill> : null}
                  </div>
                  <p className="mt-2 text-[13px] text-petory-text-secondary">
                    Lv.{selectedPet.level} · {getStyleDefinition(selectedPet.styleType).labelZh}
                    {selectedPet.isSample ? ' · 示例宠物' : ''}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => void toggleDesktop(selectedPet)}>
                      {selectedPet.onDesktop ? '从桌面隐藏' : '显示在桌面'}
                    </Button>
                    {!selectedPet.isActive ? (
                      <Button size="sm" variant="secondary" onClick={() => void activatePet(selectedPet.id)}>
                        设为主宠
                      </Button>
                    ) : null}
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

              <section className="mt-7 border-t border-petory-border pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[13px] font-semibold">姿势</h3>
                    <p className="mt-1 text-[12px] text-petory-text-tertiary">
                      点击已有姿势可单独重生成，不消耗生成额度。
                    </p>
                  </div>
                  {missingPoseCount[selectedPet.id] ? (
                    <Button size="sm" variant="secondary" onClick={() => void completePoses(selectedPet.id)}>
                      补全 {missingPoseCount[selectedPet.id]} 种
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PET_POSE_ORDER.filter((pose) => Boolean(selectedPet.posePaths?.[pose])).map((pose) => {
                    const key = `${selectedPet.id}:${pose}`
                    return (
                      <Pill
                        key={pose}
                        disabled={selectedPet.isSample || Boolean(regeneratingKey)}
                        selected={regeneratingKey === key}
                        onClick={() => void regeneratePose(selectedPet.id, pose)}
                      >
                        {regeneratingKey === key ? '生成中…' : PET_POSE_LABELS[pose]}
                      </Pill>
                    )
                  })}
                </div>
              </section>

              {!selectedPet.isSample && selectedPet.imageOriginalPath ? (
                <section className="mt-7 border-t border-petory-border pt-6">
                  <h3 className="text-[13px] font-semibold">重新生成</h3>
                  <p className="mt-1 text-[12px] text-petory-text-tertiary">
                    保留这只宠物，重新选择照片与生成结果。
                  </p>
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
                  onClick={() => setDeleteTarget({ petId: selectedPet.id, name: selectedPet.name })}
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
