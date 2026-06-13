import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import path from 'path'
import { config } from './config.js'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/user.js'
import { generationRoutes } from './routes/generation.js'
import { adminRoutes } from './routes/admin.js'
import { redeemRoutes } from './routes/redeem.js'
import { chatRoutes } from './routes/chat.js'
import { appRoutes } from './routes/app.js'
import { paymentRoutes } from './routes/payment.js'
import { loginAdmin } from './services/authService.js'
import { ensureUploadsDir } from './services/storageService.js'

export function createApp() {
  ensureUploadsDir()

  const app = new Hono()

  app.use('*', cors())

  app.get('/health', (c) => c.json({ ok: true, version: 'B1.4.0' }))

  app.get('/auth/callback', (c) => {
    const token = c.req.query('token') ?? ''
    const deepLink = `petory://auth/callback?token=${encodeURIComponent(token)}`
    const safeDeepLink = deepLink.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    return c.html(`<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录 Petory</title></head>
<body style="margin:0;background:#fafaf8;color:#262522;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <main style="max-width:440px;margin:15vh auto;padding:32px;text-align:center">
    <h1 style="font-size:24px">正在打开 Petory</h1>
    <p style="color:#777;line-height:1.7">如果应用没有自动打开，请点击下面的按钮。</p>
    <a href="${safeDeepLink}" style="display:inline-block;margin-top:12px;background:#2f6f5e;color:white;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">打开 Petory</a>
  </main>
  <script>window.location.replace(${JSON.stringify(deepLink)})</script>
</body>
</html>`)
  })

  app.route('/api/app', appRoutes)
  app.route('/api/auth', authRoutes)

  // Admin routes must register before /api userRoutes (which applies requireUser to all /api/*)
  app.post('/api/admin/login', async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>()
    if (!body.email || !body.password) {
      return c.json({ success: false, message: '请填写账号和密码。' }, 400)
    }
    const ip = c.req.header('x-forwarded-for') ?? undefined
    const result = await loginAdmin({ email: body.email, password: body.password }, { ip })
    if (!result.success) return c.json(result, 401)
    return c.json(result)
  })
  app.route('/api/admin', adminRoutes)

  app.route('/api/generation', generationRoutes)
  app.route('/api/redeem', redeemRoutes)
  app.route('/api/payment', paymentRoutes)
  app.route('/api/chat', chatRoutes)
  app.route('/api', userRoutes)

  app.use(
    '/uploads/*',
    serveStatic({
      root: config.uploadsDir,
      rewriteRequestPath: (p) => p.replace(/^\/uploads/, '')
    })
  )
  app.use(
    '/admin/*',
    serveStatic({
      root: path.join(process.cwd(), 'admin/public'),
      rewriteRequestPath: (p) => p.replace(/^\/admin/, '') || '/index.html'
    })
  )
  app.use(
    '/downloads/*',
    serveStatic({
      root: path.join(process.cwd(), 'public/downloads'),
      rewriteRequestPath: (p) => p.replace(/^\/downloads/, '')
    })
  )

  app.get('/admin', (c) => c.redirect('/admin/'))

  return app
}

export { config }
