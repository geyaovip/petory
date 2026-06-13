import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { AuthState } from '@shared/types/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LinkButton } from '../components/ui/LinkButton'
import { MaintenanceNotice } from '../components/MaintenanceNotice'
import { PageShell } from '../components/ui/PageShell'
import { AUTH_COPY } from '@shared/copy/auth'

type LoginMode = 'magic-link' | 'password'

export function AuthPanel(): ReactElement {
  const [mode, setMode] = useState<LoginMode>('magic-link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedLegal, setAgreedLegal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [bootstrap, setBootstrap] = useState<AuthState | null>(null)

  useEffect(() => {
    void window.petory.auth.refresh().then(setBootstrap).catch(() => {
      void window.petory.auth.getState().then(setBootstrap)
    })
    const off = window.petory.auth.onStateChanged(setBootstrap)
    return off
  }, [])

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (!agreedLegal) {
      setError(AUTH_COPY.legalRequired)
      return
    }

    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      await window.petory.legal.accept()
      if (mode === 'magic-link') {
        const result = await window.petory.auth.requestMagicLink(email)
        if (result.success) setInfo(result.message || AUTH_COPY.magicLinkSent)
        else setError(result.message)
        return
      }

      const result = await window.petory.auth.login({ email, password })
      if (!result.success) setError(result.message)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (): void => {
    setMode((current) => (current === 'magic-link' ? 'password' : 'magic-link'))
    setError(null)
    setInfo(null)
  }

  return (
    <PageShell className="justify-center bg-petory-surface">
      <div className="mx-auto w-full max-w-[360px]">
        <img src="/logo.png" alt="Petory" className="mb-7 h-12 w-auto" />
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">登录 Petory</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-petory-text-secondary">
          {mode === 'magic-link'
            ? AUTH_COPY.subtitleRemote
            : '使用已有账号的邮箱和密码登录。'}
        </p>

        {bootstrap?.maintenanceNotice ? (
          <MaintenanceNotice className="mt-4" message={bootstrap.maintenanceNotice} />
        ) : null}

        <form className="mt-7 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-[13px] font-medium text-petory-text-secondary">
            {AUTH_COPY.emailLabel}
            <Input
              type="email"
              className="mt-2 bg-petory-surface"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setError(null)
                setInfo(null)
              }}
              required
            />
          </label>

          {mode === 'password' ? (
            <label className="block text-[13px] font-medium text-petory-text-secondary">
              {AUTH_COPY.passwordLabel}
              <Input
                type="password"
                className="mt-2 bg-petory-surface"
                placeholder={AUTH_COPY.passwordPlaceholder}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
            </label>
          ) : null}

          {error ? (
            <p className="rounded-lg bg-petory-error-soft px-3 py-2 text-[12px] text-petory-error" role="alert">
              {error}
            </p>
          ) : null}

          {info ? (
            <p className="rounded-lg bg-petory-primary-soft px-3 py-2 text-[12px] leading-relaxed text-petory-primary" role="status">
              {info}
            </p>
          ) : null}

          <Button fullWidth disabled={loading} type="submit">
            {loading
              ? AUTH_COPY.loading
              : mode === 'magic-link'
                ? AUTH_COPY.sendMagicLink
                : AUTH_COPY.login}
          </Button>
        </form>

        <div className="mt-3 text-center">
          <LinkButton onClick={switchMode}>
            {mode === 'magic-link' ? AUTH_COPY.passwordLogin : AUTH_COPY.magicLinkLogin}
          </LinkButton>
        </div>

        <label className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-petory-text-secondary">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 accent-petory-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-petory-primary focus-visible:ring-offset-2"
            checked={agreedLegal}
            onChange={() => setAgreedLegal((value) => !value)}
          />
          <span>
            {AUTH_COPY.legalPrefix}
            <LinkButton className="mx-0.5" onClick={() => window.petory.app.openTerms()}>
              {AUTH_COPY.legalTerms}
            </LinkButton>
            {AUTH_COPY.legalAnd}
            <LinkButton className="mx-0.5" onClick={() => window.petory.app.openPrivacy()}>
              {AUTH_COPY.legalPrivacy}
            </LinkButton>
          </span>
        </label>

        {mode === 'magic-link' ? (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-petory-text-tertiary">
            首次使用该邮箱时会自动创建免费账号，无需单独注册。
          </p>
        ) : null}
      </div>
    </PageShell>
  )
}
