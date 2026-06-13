import { config } from '../config.js'

interface SendMagicLinkInput {
  to: string
  magicLinkUrl: string
  expiresInMinutes: number
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
      subject: '登录 Petory',
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
  return [
    '你好，',
    '',
    `点击下面的链接登录 Petory。该链接将在 ${input.expiresInMinutes} 分钟后失效：`,
    input.magicLinkUrl,
    '',
    '如果不是你本人操作，可以忽略这封邮件。',
    '',
    'Petory 团队'
  ].join('\n')
}

function buildHtml(input: SendMagicLinkInput): string {
  const safeUrl = escapeHtml(input.magicLinkUrl)
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#262522;line-height:1.6;max-width:520px;margin:auto">
      <h2 style="margin:0 0 12px">登录 Petory</h2>
      <p>点击下面的按钮完成登录。首次使用该邮箱时，我们会自动创建账号。</p>
      <p style="margin:24px 0">
        <a href="${safeUrl}" style="display:inline-block;background:#2f6f5e;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">进入 Petory</a>
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
