# Petory Server (B1.3)

管理端 API + 运营后台。假登录 + 多姿势 batch + 兑换码 + Kimi 对话代理 + **系统配置与运营工具**。

## 快速开始

### 1. 启动 PostgreSQL（本地开发）

需要已安装 [Docker](https://www.docker.com/)。

```bash
cd server
npm run db:up
```

或从仓库根目录：

```bash
npm run server:db:up
```

默认连接：`postgresql://petory:petory@localhost:5432/petory`

### 2. 配置并启动 API

```bash
cd server
cp .env.example .env
# 编辑 .env：JWT_SECRET、ARK_API_KEY、KIMI_API_KEY

npm install
npm run db:push
npm run dev
```

- API：`http://localhost:8787`
- 健康检查：`GET /health`
- 管理后台：`http://localhost:8787/admin/`
- 管理员：`geyaovip@163.com`，通过一次性邮箱链接登录
- 只读运营：由 `OPERATOR_EMAIL` 配置，同样通过一次性邮箱链接登录

停止数据库：`npm run db:down`（在 `server/` 目录）

## 用户 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/magic-link` | 发送一次性登录邮件 `{ email }` |
| POST | `/api/auth/callback` | 使用一次性令牌换取登录态 `{ token }` |
| GET | `/api/me` | 当前用户 + 额度（Bearer token） |
| POST | `/api/devices/register` | 登记设备 |
| GET | `/api/generation/quota` | 生成额度 |
| POST | `/api/generation/batch` | 多姿势生成（multipart: image, styleType, poses?） |
| POST | `/api/generation/complete-poses` | 姿势补全（不扣额度） |
| POST | `/api/generation/regenerate-pose` | 单姿势重生成（不扣额度） |
| GET | `/api/generation/batch/:id` | 查询批次 |
| POST | `/api/redeem` | 兑换码 `{ code }` |
| GET | `/api/chat/quota` | 对话额度 |
| POST | `/api/chat/send` | Kimi 对话代理 |
| GET | `/api/app/status` | 公开：维护公告、服务开关、额度上限 |
| POST | `/api/generation/jobs` | B1.0 兼容单姿势（扣额度） |

## 管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/magic-link` | 向已授权管理员邮箱发送一次性登录链接 |
| POST | `/api/admin/auth/callback` | 使用管理员一次性令牌换取登录态 |
| GET | `/api/admin/dashboard` | 增强概览（7 日趋势、失败分布） |
| GET/PATCH | `/api/admin/system/config` | 系统配置 |
| GET | `/api/admin/devices` | 设备列表 |
| GET | `/api/admin/audit-logs` | 管理员审计 |
| GET | `/api/admin/login-logs` | 用户登录日志 |
| GET | `/api/admin/users` | 用户列表 |
| POST | `/api/admin/users/:id/quota/grant` | 加额度 |
| POST | `/api/admin/users/:id/pro/activate` | 开通 Pro |

完整列表见 [docs/backend/PRD.md](../docs/backend/PRD.md)。

## 技术栈

- Hono + TypeScript
- **Prisma + PostgreSQL**（本地 Docker；生产可用 Neon / Supabase / RDS 等）
- 本地 `uploads/` 存图；火山方舟 Key 仅服务端

## 生产部署

`DATABASE_URL` 指向托管 PostgreSQL，例如：

```env
DATABASE_URL="postgresql://user:pass@host:5432/petory?schema=public&sslmode=require"
```

部署后执行 `npm run db:push`（或后续改用 `prisma migrate`）初始化表结构。

## 从 SQLite 迁移

早期开发版使用 `file:./dev.db`，**不会自动迁移数据**。切换到 PostgreSQL 后请：

1. 更新 `server/.env` 中的 `DATABASE_URL`
2. `npm run db:up && npm run db:push`
3. 重启服务（种子管理员与兑换码会重新写入）

## 与客户端对接

客户端配置 `PETORY_API_BASE_URL=http://localhost:8787` 后走本服务。

- 对接说明：[docs/releases/client/C2.0.md](../docs/releases/client/C2.0.md)
- 一键启动：`npm run dev:stack`（仓库根目录）
- 内测验收：[docs/quality/QA-INTERNAL.md](../docs/quality/QA-INTERNAL.md)
- 部署：[docs/backend/DEPLOY.md](../docs/backend/DEPLOY.md)
