import { Hono } from 'hono'
import {
  consumeMagicLink,
  loginUser,
  registerUser,
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

authRoutes.post('/register', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; displayName?: string }>()
  if (!body.email || !body.password) {
    return c.json({ success: false, message: '请填写邮箱和密码。' }, 400)
  }
  const ip = c.req.header('x-forwarded-for') ?? undefined
  const result = await registerUser(
    {
      email: body.email,
      password: body.password,
      displayName: body.displayName
    },
    { ip }
  )
  if (!result.success) return c.json(result, 400)
  return c.json(result)
})

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>()
  if (!body.email || !body.password) {
    return c.json({ success: false, message: '请填写邮箱和密码。' }, 400)
  }
  const ip = c.req.header('x-forwarded-for') ?? undefined
  const result = await loginUser({ email: body.email, password: body.password }, { ip })
  if (!result.success) return c.json(result, 401)
  return c.json(result)
})
