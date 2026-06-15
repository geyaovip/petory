import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { AuthState } from '@shared/types/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { LinkButton } from '../components/ui/LinkButton'
import { MaintenanceNotice } from '../components/MaintenanceNotice'
import { PageShell } from '../components/ui/PageShell'
import { AUTH_COPY } from '@shared/copy/auth'

export function AuthPanel(): ReactElement {
  const [email, setEmail] = useState('')
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
      const result = await window.petory.auth.requestMagicLink(email)
      if (result.success) setInfo(result.message || AUTH_COPY.magicLinkSent)
      else setError(result.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageShell className="justify-center bg-petory-surface">
      <div className="mx-auto w-full max-w-[360px]">
        <img src="/logo.png" alt="Petory" className="mb-7 h-12 w-auto" />
        <h1 className="text-[24px] font-semibold tracking-[-0.02em]">登录 Petory</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-petory-text-secondary">
          {AUTH_COPY.subtitleRemote}
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
            {loading ? AUTH_COPY.loading : AUTH_COPY.sendMagicLink}
          </Button>
        </form>

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

        <p className="mt-4 text-center text-[11px] leading-relaxed text-petory-text-tertiary">
          首次使用该邮箱时会自动创建账号，无需密码或单独注册。
        </p>
      </div>
    </PageShell>
  )
}
