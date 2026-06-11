import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { AuthState } from '@shared/types/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LinkButton } from '../components/ui/LinkButton'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { MaintenanceNotice } from '../components/MaintenanceNotice'
import { PageShell } from '../components/ui/PageShell'

type AuthTab = 'login' | 'register'

export function AuthPanel(): ReactElement {
  const [tab, setTab] = useState<AuthTab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [agreedLegal, setAgreedLegal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrap, setBootstrap] = useState<AuthState | null>(null)

  const remote = bootstrap?.useRemoteBackend === true
  const registrationOpen = bootstrap?.registrationOpen !== false

  useEffect(() => {
    void window.petory.auth.refresh().then(setBootstrap).catch(() => {
      void window.petory.auth.getState().then(setBootstrap)
    })
    const off = window.petory.auth.onStateChanged(setBootstrap)
    return off
  }, [])

  useEffect(() => {
    if (!registrationOpen && tab === 'register') {
      setTab('login')
    }
  }, [registrationOpen, tab])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!agreedLegal) {
      setError('请先阅读并同意用户协议与隐私政策。')
      return
    }
    if (tab === 'register' && !registrationOpen) {
      setError('当前暂未开放注册。')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await window.petory.legal.accept()
      const result =
        tab === 'login'
          ? await window.petory.auth.login({ email, password })
          : await window.petory.auth.register({
              email,
              password,
              displayName: displayName.trim() || undefined
            })
      if (!result.success) {
        setError(result.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell className="justify-center">
      <div className="mx-auto w-full max-w-[360px]">
        <img src="/logo.png" alt="Petory" className="mx-auto mb-4 h-10 w-auto" />
        <p className="text-center text-[24px] font-semibold">欢迎来到 Petory</p>
        <p className="mt-2 text-center text-[13px] text-petory-text-secondary">
          {remote ? '请登录后使用，额度与生成由云端同步。' : '请注册或登录后使用 Petory。'}
        </p>

        {bootstrap?.maintenanceNotice ? (
          <MaintenanceNotice className="mt-4" message={bootstrap.maintenanceNotice} />
        ) : null}

        <SegmentedControl
          className="mt-6"
          value={tab}
          options={[
            { value: 'login', label: '登录' },
            { value: 'register', label: '注册', disabled: !registrationOpen }
          ]}
          onChange={(next) => {
            setTab(next)
            setError(null)
          }}
        />

        {!registrationOpen && remote ? (
          <p className="mt-2 text-center text-[11px] text-petory-text-tertiary">
            当前暂未开放新用户注册。
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={(e) => void submit(e)}>
          {tab === 'register' ? (
            <label className="block text-[13px] font-medium text-petory-text-secondary">
              昵称（可选）
              <Input
                className="mt-2 bg-petory-surface"
                placeholder="怎么称呼你"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
          ) : null}

          <label className="block text-[13px] font-medium text-petory-text-secondary">
            邮箱
            <Input
              type="email"
              className="mt-2 bg-petory-surface"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="block text-[13px] font-medium text-petory-text-secondary">
            密码
            <Input
              type="password"
              className="mt-2 bg-petory-surface"
              placeholder="至少 6 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error ? (
            <p className="rounded-lg bg-petory-error-soft px-3 py-2 text-[12px] text-petory-error">
              {error}
            </p>
          ) : null}

          <Button fullWidth disabled={loading} type="submit">
            {loading ? '请稍候…' : tab === 'login' ? '登录' : '注册并进入'}
          </Button>
        </form>

        <label className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-petory-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={agreedLegal}
            onChange={() => setAgreedLegal((v) => !v)}
          />
          <span>
            我已阅读并同意
            <LinkButton className="mx-0.5" onClick={() => window.petory.app.openTerms()}>
              用户协议
            </LinkButton>
            与
            <LinkButton className="mx-0.5" onClick={() => window.petory.app.openPrivacy()}>
              隐私政策
            </LinkButton>
          </span>
        </label>
      </div>
    </PageShell>
  )
}
