import { Hono, type Context } from 'hono'
import {
  consumeMagicLink,
  requestMagicLink
} from '../services/authService.js'
import { checkRateLimit } from '../lib/rateLimit.js'

export const authRoutes = new Hono()

function clientIp(c: Context): string {
  return (c.req.header('x-forwarded-for') ?? c.req.header('cf-connecting-ip') ?? 'local')
    .split(',')[0]!
    .trim()
}

authRoutes.post('/magic-link', async (c) => {
  const body = (await c.req.json<{ email?: string }>().catch(() => ({}))) as { email?: string }
  if (!body.email) {
    return c.json({ success: false, message: '请输入邮箱地址。' }, 400)
  }
  const email = body.email.trim().toLowerCase()
  const ip = clientIp(c)
  if (!checkRateLimit(`magic:ip:${ip}`, 8, 60 * 60 * 1000)) {
    return c.json({ success: false, message: '登录请求过于频繁，请稍后再试。' }, 429)
  }
  if (!checkRateLimit(`magic:email:${email}`, 5, 60 * 60 * 1000)) {
    return c.json({ success: false, message: '登录邮件请求过于频繁，请稍后再试。' }, 429)
  }
  const result = await requestMagicLink({ email: body.email })
  return c.json(result, result.success ? 200 : 400)
})

authRoutes.post('/callback', async (c) => {
  const body = (await c.req.json<{ token?: string }>().catch(() => ({}))) as { token?: string }
  if (!body.token) {
    return c.json({ success: false, message: '登录链接无效。' }, 400)
  }
  const ip = clientIp(c)
  const result = await consumeMagicLink(body.token, { ip })
  return c.json(result, result.success ? 200 : 401)
})
