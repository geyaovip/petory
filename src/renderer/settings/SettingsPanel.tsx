import {
  Bell,
  GearSix,
  PawPrint,
  ShieldCheck,
  SignOut,
  UserCircle
} from '@phosphor-icons/react'
import { useCallback, useEffect, useState, type CSSProperties, type ReactElement } from 'react'
import { PERSONALITIES } from '@shared/constants'
import { getPlanLabel } from '@shared/planLabels'
import type { AuthState } from '@shared/types/auth'
import type { Pet, PetPersonality, PoseCompletionStatus } from '@shared/types/pet'
import type { SedentaryInterval, UserSettings } from '@shared/types/settings'
import type { UpdateState } from '@shared/types/update'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Input } from '../components/ui/Input'
import { PreferenceGroup, PreferenceRow } from '../components/ui/PreferenceGroup'
import { Pill } from '../components/ui/Pill'
import { StatusBanner, type StatusVariant } from '../components/ui/StatusBanner'
import { Toggle } from '../components/ui/Toggle'
import { ProUpgradeSection } from './ProUpgradeSection'
import { PanelTitleBar } from '../components/ui/PanelTitleBar'

type SettingsTab = 'account' | 'pet' | 'reminders' | 'privacy' | 'advanced'
type ConfirmKind = 'import' | 'wipe' | null

const NAV_ITEMS = [
  { id: 'account' as const, label: '账号', icon: UserCircle },
  { id: 'pet' as const, label: '桌宠', icon: PawPrint },
  { id: 'reminders' as const, label: '提醒', icon: Bell },
  { id: 'privacy' as const, label: '隐私与数据', icon: ShieldCheck },
  { id: 'advanced' as const, label: '高级', icon: GearSix }
]

const TAB_COPY: Record<SettingsTab, { title: string; subtitle: string }> = {
  account: { title: '账号', subtitle: '管理登录状态、额度与 Petory Pro。' },
  pet: { title: '桌宠', subtitle: '自定义桌宠在桌面上的行为与外观。' },
  reminders: { title: '提醒', subtitle: '控制久坐与专注结束时的通知。' },
  privacy: { title: '隐私与数据', subtitle: '管理本地数据、聊天记录和隐私选项。' },
  advanced: { title: '高级', subtitle: '服务地址、应用更新与维护操作。' }
}

function Segment<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}): ReactElement {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-petory-border bg-petory-surface p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`min-w-16 rounded-md px-4 py-1.5 text-[12px] font-medium transition-colors ${
            value === option.value
              ? 'bg-petory-primary-soft text-petory-primary'
              : 'text-petory-text-secondary hover:bg-petory-muted'
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsPanel(): ReactElement {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [version, setVersion] = useState('')
  const [activePet, setActivePet] = useState<Pet | null>(null)
  const [activePersonality, setActivePersonality] = useState<PetPersonality | null>(null)
  const [authState, setAuthState] = useState<AuthState | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [poseStatus, setPoseStatus] = useState<PoseCompletionStatus | null>(null)
  const [status, setStatus] = useState<{ message: string; variant: StatusVariant } | null>(null)
  const [tab, setTab] = useState<SettingsTab>('pet')
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null)

  const load = useCallback(async () => {
    const [nextSettings, nextVersion, pet, nextAuth, nextUpdate, nextPoseStatus] = await Promise.all([
      window.petory.settings.get(),
      window.petory.app.getVersion(),
      window.petory.pet.getActive(),
      window.petory.auth.refresh().catch(() => window.petory.auth.getState()),
      window.petory.update.getState(),
      window.petory.pet.getPoseCompletionStatus()
    ])
    setSettings(nextSettings)
    setApiBaseUrlDraft(nextSettings.apiBaseUrl)
    setVersion(nextVersion)
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
    setSettings(await window.petory.settings.set({ ...settings, ...patch }))
  }

  const showStatus = (message: string, variant: StatusVariant = 'success'): void => {
    setStatus({ message, variant })
    window.setTimeout(() => setStatus(null), 3000)
  }

  if (!settings) {
    return <div className="flex h-full items-center justify-center bg-petory-bg text-[13px] text-petory-text-tertiary">加载设置中…</div>
  }

  const tabCopy = TAB_COPY[tab]

  return (
    <div className="flex h-full min-h-0 flex-col bg-petory-bg text-petory-text">
      <PanelTitleBar title="设置" subtitle={`Petory v${version}`} onClose={() => window.petory.settings.close()} />
      <div className="flex min-h-0 flex-1">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-petory-border bg-petory-surface px-4 py-5">
        <nav className="space-y-1" aria-label="设置分类">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const selected = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                  selected
                    ? 'bg-petory-primary-soft text-petory-primary'
                    : 'text-petory-text-secondary hover:bg-petory-muted hover:text-petory-text'
                }`}
                onClick={() => setTab(item.id)}
              >
                <Icon size={19} weight={selected ? 'fill' : 'regular'} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-petory-border pt-4">
          {authState?.session ? (
            <div className="px-3 pb-3">
              <p className="truncate text-[12px] font-medium">{authState.session.user.displayName}</p>
              <p className="mt-0.5 truncate text-[11px] text-petory-text-tertiary">{authState.session.user.email}</p>
            </div>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[12px] font-medium text-petory-error transition-colors hover:bg-petory-error-soft"
            onClick={() => void window.petory.auth.logout()}
          >
            <SignOut size={17} />
            退出登录
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-10 py-8">
          <div className="mb-7">
            <h1 className="text-[25px] font-semibold tracking-[-0.025em]">{tabCopy.title}</h1>
            <p className="mt-1.5 text-[13px] text-petory-text-tertiary">{tabCopy.subtitle}</p>
          </div>
          {status ? <StatusBanner className="mb-5" message={status.message} variant={status.variant} /> : null}

          {tab === 'account' ? (
            <div className="max-w-[760px] space-y-8">
              <PreferenceGroup title="登录账号">
                <PreferenceRow
                  title={authState?.session?.user.displayName ?? '未登录'}
                  description={authState?.session?.user.email ?? '登录后可同步额度与会员状态'}
                >
                  <span className="rounded-full bg-petory-primary-soft px-2.5 py-1 text-[11px] font-medium text-petory-primary">
                    {getPlanLabel(authState?.session?.user.plan ?? 'free')}
                  </span>
                </PreferenceRow>
                <PreferenceRow
                  title="今日额度"
                  description={`对话 ${authState?.remainingChat ?? 0} 次 · 生成 ${authState?.remainingGeneration ?? 0} 次`}
                >
                  <span className="text-[12px] text-petory-text-tertiary">云端同步</span>
                </PreferenceRow>
                <PreferenceRow title="兑换码" description="输入兑换码开通权益或增加额度。">
                  <div className="flex w-[300px] gap-2">
                    <Input value={redeemCode} placeholder="输入兑换码" onChange={(event) => setRedeemCode(event.target.value)} />
                    <Button
                      size="sm"
                      disabled={!redeemCode.trim()}
                      onClick={() =>
                        void window.petory.auth.redeemCode(redeemCode).then(async (result) => {
                          if (!result.success) return showStatus(result.message, 'error')
                          setRedeemCode('')
                          setAuthState(result.state)
                          showStatus('兑换成功')
                          await load()
                        })
                      }
                    >
                      兑换
                    </Button>
                  </div>
                </PreferenceRow>
              </PreferenceGroup>
              {authState?.session ? (
                <ProUpgradeSection authState={authState} onStatus={showStatus} onAuthUpdated={setAuthState} onReload={load} />
              ) : null}
            </div>
          ) : null}

          {tab === 'pet' ? (
            <div className="max-w-[760px] space-y-8">
              {activePet ? (
                <PreferenceGroup title="当前桌宠">
                  <PreferenceRow title={activePet.name} description={`${activePet.personality} · Lv.${activePet.level}`}>
                    <Button size="sm" variant="secondary" onClick={() => window.petory.pets.open()}>管理宠物</Button>
                  </PreferenceRow>
                </PreferenceGroup>
              ) : null}
              <PreferenceGroup title="行为">
                <Toggle checked={settings.launchAtStartup} onChange={(value) => void save({ launchAtStartup: value })} label="开机自动启动" description="系统启动后自动运行 Petory。" />
                <Toggle checked={settings.alwaysOnTop} onChange={(value) => void save({ alwaysOnTop: value })} label="桌宠始终置顶" description="让桌宠保持在其他窗口上方。" />
                <PreferenceRow title="桌宠大小" description="调整桌宠在桌面上的显示尺寸。">
                  <Segment
                    value={settings.petSize}
                    options={[{ value: 'small', label: '小' }, { value: 'medium', label: '中' }, { value: 'large', label: '大' }]}
                    onChange={(petSize) => void save({ petSize })}
                  />
                </PreferenceRow>
                <PreferenceRow title="透明度" description="调整桌宠的透明显示效果。">
                  <div className="flex w-[280px] items-center gap-4">
                    <input
                      type="range"
                      className="petory-range w-full"
                      min={0.3}
                      max={1}
                      step={0.05}
                      value={settings.petOpacity}
                      style={{ '--range-progress': `${((settings.petOpacity - 0.3) / 0.7) * 100}%` } as CSSProperties}
                      onChange={(event) => void save({ petOpacity: Number(event.target.value) })}
                    />
                    <span className="w-10 text-right text-[12px] font-medium text-petory-text-secondary">{Math.round(settings.petOpacity * 100)}%</span>
                  </div>
                </PreferenceRow>
                <Toggle checked={settings.enableSound} onChange={(value) => void save({ enableSound: value })} label="桌宠音效" description="播放点击、提醒与升级音效。" />
              </PreferenceGroup>
              {activePersonality ? (
                <PreferenceGroup title="性格" description="影响聊天语气，不会改变宠物外观。">
                  <PreferenceRow title="聊天性格" align="start">
                    <div className="flex max-w-[420px] flex-wrap justify-end gap-2">
                      {PERSONALITIES.map((personality) => (
                        <Pill
                          key={personality}
                          selected={activePersonality === personality}
                          onClick={() =>
                            void window.petory.pets.updatePersonality(personality).then(() => {
                              setActivePersonality(personality)
                              showStatus('性格已更新')
                            })
                          }
                        >
                          {personality}
                        </Pill>
                      ))}
                    </div>
                  </PreferenceRow>
                </PreferenceGroup>
              ) : null}
            </div>
          ) : null}

          {tab === 'reminders' ? (
            <div className="max-w-[760px] space-y-8">
              <PreferenceGroup title="久坐提醒">
                <Toggle checked={settings.enableSedentaryReminder} onChange={(value) => void save({ enableSedentaryReminder: value })} label="启用久坐提醒" description="定时提醒你起身活动。" />
                <PreferenceRow title="提醒间隔" description="选择多久没有活动后提醒。">
                  <Segment
                    value={String(settings.sedentaryInterval) as `${SedentaryInterval}`}
                    options={([30, 45, 60, 90] as SedentaryInterval[]).map((value) => ({ value: String(value) as `${SedentaryInterval}`, label: `${value} 分钟` }))}
                    onChange={(value) => void save({ sedentaryInterval: Number(value) as SedentaryInterval })}
                  />
                </PreferenceRow>
              </PreferenceGroup>
              <PreferenceGroup title="专注提醒">
                <Toggle checked={settings.enablePomodoroReminder} onChange={(value) => void save({ enablePomodoroReminder: value })} label="番茄钟结束提醒" description="专注或休息结束时通知你。" />
                <PreferenceRow title="专注时长">
                  <Segment value={String(settings.focusDuration)} options={[15, 25, 45, 60].map((value) => ({ value: String(value), label: `${value} 分钟` }))} onChange={(value) => void save({ focusDuration: Number(value) })} />
                </PreferenceRow>
                <PreferenceRow title="休息时长">
                  <Segment value={String(settings.breakDuration)} options={[5, 10, 15].map((value) => ({ value: String(value), label: `${value} 分钟` }))} onChange={(value) => void save({ breakDuration: Number(value) })} />
                </PreferenceRow>
                <Toggle checked={settings.autoNextRound} onChange={(value) => void save({ autoNextRound: value })} label="自动开始下一轮" description="专注和休息结束后自动继续。" />
              </PreferenceGroup>
            </div>
          ) : null}

          {tab === 'privacy' ? (
            <div className="max-w-[760px] space-y-8">
              <PreferenceGroup title="隐私">
                <Toggle checked={settings.enableCrashReporting} onChange={(value) => void save({ enableCrashReporting: value })} label="保存本地崩溃日志" description="日志只保存在本机，不会自动上传。" />
                <PreferenceRow title="用户协议"><Button size="sm" variant="secondary" onClick={() => window.petory.app.openTerms()}>查看</Button></PreferenceRow>
                <PreferenceRow title="隐私政策"><Button size="sm" variant="secondary" onClick={() => window.petory.app.openPrivacy()}>查看</Button></PreferenceRow>
              </PreferenceGroup>
              <PreferenceGroup title="本地数据" description="导入前会自动备份当前数据。">
                <PreferenceRow title="导出完整备份"><Button size="sm" variant="secondary" onClick={() => void window.petory.data.export().then((result) => showStatus(result.success ? '备份已保存' : result.message, result.success ? 'success' : 'error'))}>导出</Button></PreferenceRow>
                <PreferenceRow title="从备份恢复"><Button size="sm" variant="secondary" onClick={() => setConfirmKind('import')}>导入</Button></PreferenceRow>
                <PreferenceRow title="清除聊天记录"><Button size="sm" variant="secondary" onClick={() => void window.petory.data.clearChat().then(() => showStatus('聊天记录已清除'))}>清除</Button></PreferenceRow>
                <PreferenceRow title="删除全部本地数据"><Button size="sm" variant="danger" onClick={() => setConfirmKind('wipe')}>删除数据</Button></PreferenceRow>
              </PreferenceGroup>
            </div>
          ) : null}

          {tab === 'advanced' ? (
            <div className="max-w-[760px] space-y-8">
              <PreferenceGroup title="服务">
                <PreferenceRow title="API 服务地址" description="留空时使用 Petory 默认服务。">
                  <div className="flex w-[420px] gap-2">
                    <Input
                      value={apiBaseUrlDraft}
                      placeholder="使用默认服务"
                      onChange={(event) => setApiBaseUrlDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                      }}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={apiBaseUrlDraft.trim() === settings.apiBaseUrl}
                      onClick={() => {
                        const apiBaseUrl = apiBaseUrlDraft.trim()
                        setApiBaseUrlDraft(apiBaseUrl)
                        void save({ apiBaseUrl }).then(() => showStatus('服务地址已保存'))
                      }}
                    >
                      保存
                    </Button>
                  </div>
                </PreferenceRow>
              </PreferenceGroup>
              <PreferenceGroup title="应用维护">
                <PreferenceRow title="当前版本" description={`Petory v${version}`}>
                  <Button size="sm" variant="secondary" onClick={() => void window.petory.update.check().then(setUpdateState)}>检查更新</Button>
                </PreferenceRow>
                {updateState?.status === 'available' ? <PreferenceRow title={`发现新版本 ${updateState.version}`}><Button size="sm" onClick={() => void window.petory.update.download().then(setUpdateState)}>下载更新</Button></PreferenceRow> : null}
                {updateState?.status === 'ready' ? <PreferenceRow title="更新已准备好"><Button size="sm" onClick={() => window.petory.update.install()}>安装并重启</Button></PreferenceRow> : null}
                <PreferenceRow title="新手引导"><Button size="sm" variant="secondary" onClick={() => window.petory.guide.open()}>重新查看</Button></PreferenceRow>
                <PreferenceRow title="Petory 官网"><Button size="sm" variant="secondary" onClick={() => window.petory.app.openWebsite()}>打开官网</Button></PreferenceRow>
                {poseStatus?.pending.length ? <PreferenceRow title="补全 Pro 姿势" description={`${poseStatus.pending.length} 只宠物需要补全`}><Button size="sm" variant="secondary" onClick={() => void window.petory.pet.completePoses().then(() => void load())}>开始补全</Button></PreferenceRow> : null}
                <PreferenceRow title="退出 Petory"><Button size="sm" variant="secondary" onClick={() => window.petory.app.quit()}>退出应用</Button></PreferenceRow>
              </PreferenceGroup>
            </div>
          ) : null}
        </div>
      </section>
      </div>

      <ConfirmDialog
        open={confirmKind === 'import'}
        title="导入备份"
        message="导入将覆盖当前桌宠与设置，账号登录状态会保留。确定继续吗？"
        confirmLabel="继续导入"
        onConfirm={() => {
          setConfirmKind(null)
          void window.petory.data.import().then(async (result) => {
            if (!result.success) {
              if (!result.cancelled) showStatus(result.message, 'error')
              return
            }
            showStatus(`导入成功，共恢复 ${result.petFileCount} 个资源文件`)
            await load()
          })
        }}
        onCancel={() => setConfirmKind(null)}
      />
      <ConfirmDialog
        open={confirmKind === 'wipe'}
        title="删除全部本地数据"
        message="此操作不可恢复，确定删除所有桌宠、聊天与设置吗？"
        confirmLabel="确定删除"
        danger
        onConfirm={() => void window.petory.data.wipeAll()}
        onCancel={() => setConfirmKind(null)}
      />
    </div>
  )
}
