import { config } from '../config.js'

interface SendMagicLinkInput {
  to: string
  magicLinkUrl: string
  expiresInMinutes: number
  audience?: 'user' | 'admin'
}

export async function sendMagicLink(input: SendMagicLinkInput): Promise<void> {
  if (!config.resendApiKey) {
    throw new Error('邮件服务暂未配置，请稍后再试。')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.mailFrom,
      to: input.to,
      subject: input.audience === 'admin' ? '登录 Petory 管理后台' : '登录 Petory',
      text: buildText(input),
      html: buildHtml(input)
    })
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string }
    throw new Error(payload.message || '登录邮件发送失败，请稍后再试。')
  }
}

function buildText(input: SendMagicLinkInput): string {
  const target = input.audience === 'admin' ? 'Petory 管理后台' : 'Petory'
  return [
    '你好，',
    '',
    `点击下面的链接登录${target}。该链接将在 ${input.expiresInMinutes} 分钟后失效：`,
    input.magicLinkUrl,
    '',
    '如果不是你本人操作，可以忽略这封邮件。',
    '',
    'Petory 团队'
  ].join('\n')
}

function buildHtml(input: SendMagicLinkInput): string {
  const safeUrl = escapeHtml(input.magicLinkUrl)
  const isAdmin = input.audience === 'admin'
  const title = isAdmin ? '登录 Petory 管理后台' : '登录 Petory'
  const description = isAdmin
    ? '点击下面的按钮完成管理员身份验证。只有已授权的管理员邮箱可以登录。'
    : '点击下面的按钮完成登录。首次使用该邮箱时，我们会自动创建账号。'
  const button = isAdmin ? '进入管理后台' : '进入 Petory'
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#262522;line-height:1.6;max-width:520px;margin:auto">
      <h2 style="margin:0 0 12px">${title}</h2>
      <p>${description}</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}" style="display:inline-block;background:#2f6f5e;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">${button}</a>
      </p>
      <p style="font-size:13px;color:#777">链接将在 ${input.expiresInMinutes} 分钟后失效，且只能使用一次。</p>
      <p style="font-size:13px;color:#777">如果按钮无法打开，请复制此链接到浏览器：<br>${safeUrl}</p>
      <p style="font-size:13px;color:#777">如果不是你本人操作，可以忽略这封邮件。</p>
    </div>
  `
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
