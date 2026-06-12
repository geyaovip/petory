import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { SETTINGS_COPY } from '@shared/copy/settings'
import type { AuthState } from '@shared/types/auth'
import type { UpdateState } from '@shared/types/update'
import { getStyleDefinition } from '@shared/styles'
import type { Pet, PetPersonality, PoseCompletionStatus } from '@shared/types/pet'
import type { SedentaryInterval, UserSettings } from '@shared/types/settings'
import { PERSONALITIES } from '@shared/constants'
import { getPlanLabel } from '@shared/planLabels'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Input } from '../components/ui/Input'
import { PanelHeader } from '../components/ui/PanelHeader'
import { Pill } from '../components/ui/Pill'
import { SegmentedTabs } from '../components/ui/SegmentedTabs'
import { Toggle } from '../components/ui/Toggle'
import { MaintenanceNotice } from '../components/MaintenanceNotice'
import { StatusBanner, type StatusVariant } from '../components/ui/StatusBanner'
import { ProUpgradeSection } from './ProUpgradeSection'

type SettingsTab = 'account' | 'pet' | 'privacy' | 'advanced'
type ConfirmKind = 'import' | 'wipe' | null

const SETTINGS_TABS = [
  { id: 'account' as const, label: SETTINGS_COPY.tabs.account },
  { id: 'pet' as const, label: SETTINGS_COPY.tabs.pet },
  { id: 'privacy' as const, label: SETTINGS_COPY.tabs.privacy },
  { id: 'advanced' as const, label: SETTINGS_COPY.tabs.advanced }
]

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="mt-5">
      <h2 className="text-[13px] font-medium text-petory-text-secondary">{title}</h2>
      <div className="mt-2 space-y-3 rounded-2xl bg-petory-surface p-4 shadow-sm">{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
  description
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  description?: string
}): ReactElement {
  return <Toggle label={label} description={description} checked={checked} onChange={onChange} />
}

export function SettingsPanel(): ReactElement {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [version, setVersion] = useState('')
  const [activePet, setActivePet] = useState<Pet | null>(null)
  const [activePersonality, setActivePersonality] = useState<PetPersonality | null>(null)
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<StatusVariant>('info')
  const [poseStatus, setPoseStatus] = useState<PoseCompletionStatus | null>(null)
  const [completingPoses, setCompletingPoses] = useState(false)
  const [tab, setTab] = useState<SettingsTab>('account')
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)

  const load = useCallback(async () => {
    const authPromise = window.petory.auth.refresh().catch(() => window.petory.auth.getState())
    const [nextSettings, ver, pet, nextAuth, nextUpdate, nextPoseStatus] = await Promise.all([
      window.petory.settings.get(),
      window.petory.app.getVersion(),
      window.petory.pet.getActive(),
      authPromise,
      window.petory.update.getState(),
      window.petory.pet.getPoseCompletionStatus()
    ])
    setSettings(nextSettings)
    setVersion(ver)
    setActivePet(pet)
    setActivePersonality(pet?.personality ?? null)
    setAuthState(nextAuth)
    setUpdateState(nextUpdate)
    setPoseStatus(nextPoseStatus)
  }, [])

  useEffect(() => {
    void load()
    const offAuth = window.petory.auth.onStateChanged(setAuthState)
    const offUpdate = window.petory.update.onStateChanged(setUpdateState)
    return () => {
      offAuth()
      offUpdate()
    }
  }, [load])

  const save = async (patch: Partial<UserSettings>): Promise<void> => {
    if (!settings) return
    const next = await window.petory.settings.set({ ...settings, ...patch })
    setSettings(next)
  }

  const showStatus = (message: string, variant: StatusVariant = 'success'): void => {
    setStatus(message)
    setStatusVariant(variant)
    setTimeout(() => setStatus(null), 3000)
  }

  const runImport = (): void => {
    void window.petory.data.import().then(async (result) => {
      if (!result.success) {
        if (!result.cancelled) showStatus(result.message, 'error')
        return
      }
      showStatus(SETTINGS_COPY.data.importSuccess(result.petFileCount))
      await load()
    })
  }

  const runWipe = (): void => {
    void window.petory.data.wipeAll()
  }

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center bg-petory-bg text-petory-text-secondary">
        {SETTINGS_COPY.loading}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-petory-bg text-petory-text">
      <div className="shrink-0 border-b border-petory-border bg-petory-bg/95 px-7 pb-4 pt-5">
        <PanelHeader
          className="pt-0"
          title="设置"
          subtitle="账号、桌宠行为、隐私与应用维护"
          onClose={() => window.petory.settings.close()}
        />

        <SegmentedTabs className="mt-4" items={SETTINGS_TABS} value={tab} onChange={setTab} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8">

      {status ? (
        <StatusBanner className="mt-3" message={status} variant={statusVariant} />
      ) : null}

      {authState?.maintenanceNotice ? (
        <MaintenanceNotice className="mt-4" message={authState.maintenanceNotice} />
      ) : null}

      {tab === 'account' ? (
        <>
          {authState?.session ? (
            <Section title={SETTINGS_COPY.tabs.account}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{authState.session.user.displayName}</p>
                  <p className="text-[12px] text-petory-text-tertiary">{authState.session.user.email}</p>
                </div>
                <span className="rounded-full bg-petory-primary-soft px-2 py-0.5 text-[11px] font-medium text-petory-primary">
                  {getPlanLabel(authState.session.user.plan)}
                </span>
              </div>
              <p className="text-[12px] text-petory-text-secondary">
                {SETTINGS_COPY.account.quotaRemaining(
                  authState.remainingChat,
                  authState.remainingGeneration
                )}
              </p>
              {authState.session.user.proExpiresAt ? (
                <p className="text-[11px] text-petory-text-tertiary">
                  {SETTINGS_COPY.account.proExpires}{' '}
                  {new Date(authState.session.user.proExpiresAt).toLocaleDateString('zh-CN')}
                </p>
              ) : null}
              {authState.useRemoteBackend ? (
                <p className="text-[11px] text-petory-text-tertiary">
                  {SETTINGS_COPY.account.cloudSync}
                  {authState.generationServiceEnabled === false
                    ? SETTINGS_COPY.account.genMaintenance
                    : ''}
                  {authState.chatServiceEnabled === false ? SETTINGS_COPY.account.chatMaintenance : ''}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Input
                  className="h-9 flex-1 text-[13px]"
                  placeholder={SETTINGS_COPY.account.redeemPlaceholder}
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    void window.petory.auth.redeemCode(redeemCode).then(async (result) => {
                      if (result.success) {
                        setRedeemCode('')
                        setAuthState(result.state)
                        if (result.poseCompletion) {
                          showStatus(
                            SETTINGS_COPY.account.redeemSuccessWithPoses(result.poseCompletion.added)
                          )
                        } else {
                          showStatus(SETTINGS_COPY.account.redeemSuccess)
                        }
                        await load()
                      } else {
                        showStatus(result.message, 'error')
                      }
                    })
                  }
                >
                  {SETTINGS_COPY.account.redeem}
                </Button>
              </div>
              <Button variant="ghost" fullWidth onClick={() => void window.petory.auth.logout()}>
                {SETTINGS_COPY.account.logout}
              </Button>
            </Section>
          ) : null}

          {authState?.session ? (
            <ProUpgradeSection
              authState={authState}
              onStatus={showStatus}
              onAuthUpdated={setAuthState}
              onReload={load}
            />
          ) : null}
        </>
      ) : null}

      {tab === 'pet' ? (
        <>
          <Section title={SETTINGS_COPY.tabs.pet}>
            <ToggleRow
              label={SETTINGS_COPY.desktop.launchAtStartup}
              checked={settings.launchAtStartup}
              onChange={(v) => void save({ launchAtStartup: v })}
            />
            <ToggleRow
              label={SETTINGS_COPY.desktop.alwaysOnTop}
              checked={settings.alwaysOnTop}
              onChange={(v) => void save({ alwaysOnTop: v })}
            />
            <div>
              <p className="text-[14px]">{SETTINGS_COPY.desktop.petSize}</p>
              <div className="mt-2 flex gap-2">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <Pill
                    key={size}
                    selected={settings.petSize === size}
                    onClick={() => void save({ petSize: size })}
                  >
                    {size === 'small'
                      ? SETTINGS_COPY.desktop.sizeSmall
                      : size === 'medium'
                        ? SETTINGS_COPY.desktop.sizeMedium
                        : SETTINGS_COPY.desktop.sizeLarge}
                  </Pill>
                ))}
              </div>
            </div>
            <label className="block text-[14px]">
              {SETTINGS_COPY.desktop.opacity(Math.round(settings.petOpacity * 100))}
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={settings.petOpacity}
                className="mt-2 w-full"
                onChange={(e) => void save({ petOpacity: Number(e.target.value) })}
              />
            </label>
            <ToggleRow
              label={SETTINGS_COPY.desktop.enableSound}
              checked={settings.enableSound}
              onChange={(v) => void save({ enableSound: v })}
            />
          </Section>

          <Section title="提醒">
            <ToggleRow
              label={SETTINGS_COPY.reminders.sedentary}
              checked={settings.enableSedentaryReminder}
              onChange={(v) => void save({ enableSedentaryReminder: v })}
            />
            <div>
              <p className="text-[13px] text-petory-text-secondary">
                {SETTINGS_COPY.reminders.sedentaryInterval}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([30, 45, 60, 90] as SedentaryInterval[]).map((min) => (
                  <Pill
                    key={min}
                    selected={settings.sedentaryInterval === min}
                    onClick={() => void save({ sedentaryInterval: min })}
                  >
                    {SETTINGS_COPY.reminders.sedentaryMinutes(min)}
                  </Pill>
                ))}
              </div>
            </div>
            <ToggleRow
              label={SETTINGS_COPY.reminders.pomodoro}
              checked={settings.enablePomodoroReminder}
              onChange={(v) => void save({ enablePomodoroReminder: v })}
            />
          </Section>

          {activePersonality ? (
            <Section title={SETTINGS_COPY.personality.title}>
              <div className="flex flex-wrap gap-2">
                {PERSONALITIES.map((item) => (
                  <Pill
                    key={item}
                    className="px-3 py-1.5 text-[12px]"
                    selected={activePersonality === item}
                    onClick={() =>
                      void window.petory.pets.updatePersonality(item).then(() => {
                        setActivePersonality(item)
                        showStatus(SETTINGS_COPY.personality.updated)
                      })
                    }
                  >
                    {item}
                  </Pill>
                ))}
              </div>
            </Section>
          ) : null}

          {poseStatus && poseStatus.pending.length > 0 ? (
            <Section title={SETTINGS_COPY.poseCompletion.title}>
              <p className="text-[13px] text-petory-text-secondary">{SETTINGS_COPY.poseCompletion.hint}</p>
              <ul className="mt-2 space-y-1 text-[12px] text-petory-text-tertiary">
                {poseStatus.pending.map((item) => (
                  <li key={item.petId}>
                    {SETTINGS_COPY.poseCompletion.missing(item.name, item.missing.length)}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-3"
                variant="secondary"
                fullWidth
                disabled={completingPoses || poseStatus.running}
                onClick={() => {
                  setCompletingPoses(true)
                  void window.petory.pet
                    .completePoses()
                    .then(async (result) => {
                      if (result.success && 'completed' in result) {
                        const total = result.completed.reduce((s, c) => s + c.addedCount, 0)
                        showStatus(SETTINGS_COPY.poseCompletion.success(total))
                      } else if (!result.success) {
                        showStatus(result.message, 'error')
                      }
                      await load()
                    })
                    .finally(() => setCompletingPoses(false))
                }}
              >
                {completingPoses || poseStatus.running
                  ? SETTINGS_COPY.poseCompletion.running
                  : SETTINGS_COPY.poseCompletion.cta}
              </Button>
            </Section>
          ) : null}

          {activePet ? (
            <Section title={SETTINGS_COPY.activePet.title}>
              <p className="text-[14px] font-medium">{activePet.name}</p>
              <p className="text-[12px] text-petory-text-tertiary">
                {getStyleDefinition(activePet.styleType).labelZh} · {activePet.personality}
              </p>
              <p className="text-[12px] text-petory-text-tertiary">
                {SETTINGS_COPY.activePet.lastStyle(
                  getStyleDefinition(settings.lastSelectedStyle).labelZh,
                  Object.keys(activePet.posePaths ?? {}).length || 1
                )}
              </p>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => window.petory.pets.open()}
              >
                管理或更换宠物
              </Button>
            </Section>
          ) : null}
        </>
      ) : null}

      {tab === 'privacy' ? (
        <>
          <Section title={SETTINGS_COPY.legal.title}>
            <Button variant="ghost" fullWidth onClick={() => window.petory.app.openTerms()}>
              {SETTINGS_COPY.legal.terms}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => window.petory.app.openPrivacy()}>
              {SETTINGS_COPY.legal.privacy}
            </Button>
            <ToggleRow
              label={SETTINGS_COPY.legal.crashReporting}
              checked={settings.enableCrashReporting}
              onChange={(v) => void save({ enableCrashReporting: v })}
            />
            <Button variant="ghost" fullWidth onClick={() => window.petory.guide.open()}>
              {SETTINGS_COPY.legal.reopenGuide}
            </Button>
          </Section>

          <Section title={SETTINGS_COPY.data.title}>
            <p className="text-[12px] text-petory-text-tertiary">{SETTINGS_COPY.data.hint}</p>
            <Button
              variant="secondary"
              fullWidth
              onClick={() =>
                void window.petory.data.export().then((result) => {
                  if (result.success) showStatus(SETTINGS_COPY.data.exportSuccess)
                  else showStatus(result.message, 'error')
                })
              }
            >
              {SETTINGS_COPY.data.export}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setConfirmKind('import')}>
              {SETTINGS_COPY.data.import}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() =>
                void window.petory.data.clearChat().then(() =>
                  showStatus(SETTINGS_COPY.data.clearChatSuccess)
                )
              }
            >
              {SETTINGS_COPY.data.clearChat}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => window.petory.pets.open()}>
              {SETTINGS_COPY.data.petManager}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setConfirmKind('wipe')}>
              {SETTINGS_COPY.data.wipeAll}
            </Button>
          </Section>
        </>
      ) : null}

      {tab === 'advanced' ? (
        <>
          <Section title={SETTINGS_COPY.api.title}>
            <label className="block text-[13px]">
              <span className="font-medium text-petory-text-secondary">{SETTINGS_COPY.api.title}</span>
              <Input
                type="url"
                className="mt-2 h-9 text-[13px]"
                placeholder={SETTINGS_COPY.api.placeholder}
                value={settings.apiBaseUrl}
                onChange={(e) => void save({ apiBaseUrl: e.target.value.trim() })}
              />
            </label>
            <p className="text-[11px] leading-relaxed text-petory-text-tertiary">{SETTINGS_COPY.api.hint}</p>
          </Section>

          <Section title={SETTINGS_COPY.update.title}>
            {updateState ? (
              <>
                <p className="text-[13px] text-petory-text-secondary">
                  {updateState.status === 'available'
                    ? SETTINGS_COPY.update.available(updateState.version ?? '')
                    : updateState.status === 'ready'
                      ? SETTINGS_COPY.update.ready(updateState.version ?? '')
                      : updateState.status === 'downloading'
                        ? SETTINGS_COPY.update.downloading(Math.round(updateState.progress ?? 0))
                        : updateState.message || SETTINGS_COPY.update.defaultMessage}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void window.petory.update.check().then((next) => {
                        setUpdateState(next)
                        showStatus(next.message || SETTINGS_COPY.update.checked)
                      })
                    }
                  >
                    {SETTINGS_COPY.update.check}
                  </Button>
                  {updateState.status === 'available' ? (
                    <Button
                      variant="primary"
                      onClick={() => void window.petory.update.download().then(setUpdateState)}
                    >
                      {SETTINGS_COPY.update.download}
                    </Button>
                  ) : null}
                  {updateState.status === 'ready' ? (
                    <Button variant="primary" onClick={() => window.petory.update.install()}>
                      {SETTINGS_COPY.update.install}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </Section>

          <Section title={SETTINGS_COPY.about.title}>
            <p className="text-[13px] text-petory-text-secondary">
              {SETTINGS_COPY.about.version(version || '1.0.0')}
            </p>
            <Button variant="ghost" fullWidth onClick={() => window.petory.app.openWebsite()}>
              {SETTINGS_COPY.about.website}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => window.petory.app.openDownloadPage()}>
              {SETTINGS_COPY.about.downloadPage}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => window.petory.app.openFeedback()}>
              {SETTINGS_COPY.about.feedback}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => window.petory.app.quit()}>
              {SETTINGS_COPY.about.quit}
            </Button>
          </Section>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmKind === 'import'}
        title={SETTINGS_COPY.data.confirmImport.title}
        message={SETTINGS_COPY.data.confirmImport.message}
        confirmLabel={SETTINGS_COPY.data.confirmImport.confirm}
        onConfirm={() => {
          setConfirmKind(null)
          runImport()
        }}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmDialog
        open={confirmKind === 'wipe'}
        title={SETTINGS_COPY.data.confirmWipe.title}
        message={SETTINGS_COPY.data.confirmWipe.message}
        confirmLabel={SETTINGS_COPY.data.confirmWipe.confirm}
        danger
        onConfirm={() => {
          setConfirmKind(null)
          runWipe()
        }}
        onCancel={() => setConfirmKind(null)}
      />
      </div>
    </div>
  )
}
