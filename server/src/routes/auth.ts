import { Hono } from 'hono'
import {
  consumeMagicLink,
  requestMagicLink
} from '../services/authService.js'

export const authRoutes = new Hono()

authRoutes.post('/magic-link', async (c) => {
  const body = await c.req.json<{ email?: string }>()
  if (!body.email) {
    return c.json({ success: false, message: '请输入邮箱地址。' }, 400)
  }
  const result = await requestMagicLink({ email: body.email })
  return c.json(result, result.success ? 200 : 400)
})

authRoutes.post('/callback', async (c) => {
  const body = await c.req.json<{ token?: string }>()
  if (!body.token) {
    return c.json({ success: false, message: '登录链接无效。' }, 400)
  }
  const ip = c.req.header('x-forwarded-for') ?? undefined
  const result = await consumeMagicLink(body.token, { ip })
  return c.json(result, result.success ? 200 : 401)
})
