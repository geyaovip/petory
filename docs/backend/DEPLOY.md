# 服务端与管理端部署要点（内测 / 生产）

> 当前无自动化 CI 部署脚本；以下为环境 checklist。

## 必需服务

| 组件 | 开发 | 生产建议 |
|------|------|----------|
| API | `npm run dev` | Node 20+，PM2 / Railway / Fly.io |
| 数据库 | Docker Postgres | Neon / Supabase / RDS |
| 图片 | `server/uploads/` | S3 / R2 / OSS（后续） |
| 域名 | `localhost:8787` | HTTPS 反向代理 |

## 环境变量

```env
# 必填
DATABASE_URL=postgresql://user:pass@host:5432/petory?schema=public&sslmode=require
JWT_SECRET=<强随机字符串>
PUBLIC_BASE_URL=https://api.your-domain.com

# AI（仅服务端）
MINIMAX_API_KEY=...
KIMI_API_KEY=...

# 管理员邮箱白名单（首次启动）
ADMIN_EMAIL=geyaovip@163.com
OPERATOR_EMAIL=operator@petory.app
RESEND_API_KEY=<Resend API Key>
MAIL_FROM=Petory <noreply@petory.chat>

PORT=8787
```

## 初始化

```bash
cd server
npm install
npm run db:push    # 或 prisma migrate deploy
npm run build
npm start
```

首次启动会种子化：管理员、运营账号、系统配置、演示兑换码。

## 客户端配置

正式包需在构建环境注入：

```env
PETORY_API_BASE_URL=https://api.your-domain.com
```

正式包也可在 **设置 → 后台服务 → API 地址** 配置（优先于 `.env`）。

## 安全

- 勿将 `MINIMAX_API_KEY` / `KIMI_API_KEY` 写入客户端
- 生产务必更换默认管理员密码
- Admin UI 建议仅内网或 VPN 访问，或加独立认证层
- 定期备份 PostgreSQL

## 健康检查

```bash
curl -s https://api.your-domain.com/health
curl -s https://api.your-domain.com/api/app/status
```

## 相关文档

- [DATABASE.md](./DATABASE.md) — 数据库配置
- [B1.3.md](../releases/server/B1.3.md) — 运营配置 API
- [C2.0.md](../releases/client/C2.0.md) — 客户端对接
- [C2.6.md](../releases/client/C2.6.md) — 设备封禁与备份导入
- [BACKLOG.md](../product/BACKLOG.md) — 功能待办
- [QA-INTERNAL.md](../quality/QA-INTERNAL.md) — 内测验收（含 `npm run qa:smoke`）
