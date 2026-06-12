import { useEffect, useState, type ReactElement } from 'react'
import type { AuthState } from '@shared/types/auth'
import { formatPlanPrice } from '@shared/paymentPlans'
import type { PaymentPlan, PaymentPlanId } from '@shared/types/payment'
import type { StatusVariant } from '../components/ui/StatusBanner'
import { Button } from '../components/ui/Button'

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

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
  const [plansUnavailable, setPlansUnavailable] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<PaymentPlanId | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlanId>('pro_monthly')

  const isPro = authState.session?.user.plan === 'pro'
  const expiry = formatExpiry(authState.session?.user.proExpiresAt)
  const paymentOpen = authState.useRemoteBackend
    ? authState.paymentEnabled !== false && authState.mockPaymentEnabled !== false
    : true

  useEffect(() => {
    void window.petory.payment
      .getPlans()
      .then(setPlans)
      .catch(() => setPlansUnavailable(true))
  }, [])

  const purchase = async (planId: PaymentPlanId): Promise<void> => {
    setLoadingPlan(planId)
    try {
      const result = await window.petory.payment.purchaseMock(planId)
      if (!result.success) {
        onStatus(result.message, 'error')
        return
      }
      onAuthUpdated(result.state)
      await onReload()
      const extra = result.poseCompletion ? `，已补全 ${result.poseCompletion.added} 张 Pro 姿势` : ''
      onStatus(`已开通 Pro${extra}`)
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <section className="mt-6">
      <h2 className="text-[13px] font-medium text-petory-text-secondary">Pro 升级</h2>
      <div className="mt-2 space-y-3 rounded-2xl bg-petory-surface p-4 shadow-sm">
        <p className="text-[13px] text-petory-text-secondary">
          免费版：3 种姿势 + 1 只桌宠。Pro 解锁 6 种姿势、多风格、最多 5 只桌宠并行，以及更高每日额度。
        </p>

        {isPro ? (
          <p className="rounded-lg bg-petory-primary-soft px-3 py-2 text-[12px] text-petory-primary">
            当前为 Pro{expiry ? `，有效期至 ${expiry}` : '（兑换码永久）'}
          </p>
        ) : null}

        {paymentOpen ? (
          <>
            <p className="text-[11px] text-petory-text-tertiary">
              当前为试用开通方式，不产生真实扣款；微信 / 支付宝支付即将上线。
            </p>
            <div className="space-y-2">
              {plans.map((plan) => (
                <label
                  key={plan.id}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5',
                    selectedPlan === plan.id
                      ? 'border-petory-primary bg-petory-primary-soft/40'
                      : 'border-petory-border'
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="pro-plan"
                    className="mt-1"
                    checked={selectedPlan === plan.id}
                    onChange={() => setSelectedPlan(plan.id)}
                  />
                  <span className="flex-1 text-left">
                    <span className="block text-[14px] font-medium">
                      {plan.name}{' '}
                      <span className="text-petory-primary">{formatPlanPrice(plan)}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-petory-text-tertiary">
                      {plan.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {plansUnavailable ? (
              <p className="text-[12px] text-petory-text-tertiary">
                暂时无法获取套餐信息，请检查网络后重试。
              </p>
            ) : null}
            <Button
              fullWidth
              disabled={loadingPlan !== null || plans.length === 0}
              onClick={() => void purchase(selectedPlan)}
            >
              {loadingPlan ? '处理中…' : isPro ? '续费 Pro' : '开通 Pro'}
            </Button>
          </>
        ) : (
          <p className="text-[12px] text-petory-text-tertiary">
            支付暂未开放，可在上方账号区使用兑换码开通 Pro。
          </p>
        )}
        <Button variant="secondary" fullWidth onClick={() => window.petory.app.openDownloadPage()}>
          了解 Pro / 获取安装包
        </Button>
      </div>
    </section>
  )
}
