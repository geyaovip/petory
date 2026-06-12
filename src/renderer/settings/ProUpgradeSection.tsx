import { Check } from '@phosphor-icons/react'
import { useEffect, useState, type ReactElement } from 'react'
import type { AuthState } from '@shared/types/auth'
import { formatPlanPrice } from '@shared/paymentPlans'
import type { PaymentPlan, PaymentPlanId } from '@shared/types/payment'
import { Button } from '../components/ui/Button'
import type { StatusVariant } from '../components/ui/StatusBanner'

export function ProUpgradeSection({
  authState,
  onStatus,
  onAuthUpdated,
  onReload
}: {
  authState: AuthState
  onStatus: (message: string, variant?: StatusVariant) => void
  onAuthUpdated: (state: AuthState) => void
  onReload: () => Promise<void>
}): ReactElement {
  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [loadingPlan, setLoadingPlan] = useState<PaymentPlanId | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanId>('pro_monthly')
  const [unavailable, setUnavailable] = useState(false)
  const isPro = authState.session?.user.plan === 'pro'

  useEffect(() => {
    void window.petory.payment.getPlans().then(setPlans).catch(() => setUnavailable(true))
  }, [])

  const purchase = async (): Promise<void> => {
    setLoadingPlan(selectedPlan)
    try {
      const result = await window.petory.payment.purchaseMock(selectedPlan)
      if (!result.success) return onStatus(result.message, 'error')
      onAuthUpdated(result.state)
      await onReload()
      onStatus('已开通 Petory Pro')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold">Petory Pro</h2>
          <p className="mt-0.5 text-[12px] text-petory-text-tertiary">更多姿势、多只桌宠与更高每日额度。</p>
        </div>
        {isPro ? <span className="rounded-full bg-petory-primary-soft px-2.5 py-1 text-[11px] font-medium text-petory-primary">已开通</span> : null}
      </div>
      <div className="border-y border-petory-border">
        <div className="grid grid-cols-3 gap-3 py-4 text-[12px] text-petory-text-secondary">
          {['6 种完整姿势', '最多 5 只桌宠', '更高生成与对话额度'].map((benefit) => (
            <span key={benefit} className="flex items-center gap-1.5">
              <Check size={14} className="text-petory-primary" weight="bold" />
              {benefit}
            </span>
          ))}
        </div>
        {plans.length > 0 ? (
          <div className="flex items-center justify-between gap-5 border-t border-petory-border py-4">
            <div className="flex gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`rounded-lg border px-4 py-2 text-left transition-colors ${
                    selectedPlan === plan.id
                      ? 'border-petory-primary bg-petory-primary-soft'
                      : 'border-petory-border bg-petory-surface hover:border-petory-border-strong'
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <span className="block text-[12px] font-medium">{plan.name}</span>
                  <span className="mt-0.5 block text-[11px] text-petory-text-tertiary">{formatPlanPrice(plan)}</span>
                </button>
              ))}
            </div>
            <Button size="sm" disabled={loadingPlan !== null} onClick={() => void purchase()}>
              {loadingPlan ? '处理中…' : isPro ? '续费 Pro' : '开通 Pro'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-petory-border py-4">
            <p className="text-[12px] text-petory-text-tertiary">{unavailable ? '暂时无法获取套餐，请稍后重试。' : '正在获取套餐…'}</p>
            <Button size="sm" variant="secondary" onClick={() => window.petory.app.openDownloadPage()}>了解 Pro</Button>
          </div>
        )}
      </div>
    </section>
  )
}
