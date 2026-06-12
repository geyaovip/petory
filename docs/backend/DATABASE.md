# 管理端数据库（PostgreSQL）

> 自 B1.3 起，管理端统一使用 **PostgreSQL**。早期 SQLite（`dev.db`）已弃用。

## 本地开发

```bash
# 仅数据库（完整栈见 ../development/DOCKER-DEV.md）
npm run server:db:up   # 或根目录 npm run docker:up
cp .env.example .env   # DATABASE_URL 已指向本地库
npm run db:push        # 同步 Prisma 模型到库
npm run dev
```

默认凭据（仅本地）：

| 项 | 值 |
|----|-----|
| Host | `localhost:5433`（避免与本机其他 Postgres 占用的 5432 冲突） |
| Database | `petory` |
| User / Password | `petory` / `petory` |

根目录也可：`npm run server:db:up` → `npm run server:db`。

## 环境变量

```env
DATABASE_URL="postgresql://petory:petory@localhost:5433/petory?schema=public"
```

生产环境请使用托管服务（Neon、Supabase、Railway、RDS 等），并开启 SSL：

```env
DATABASE_URL="postgresql://user:pass@host:5432/petory?schema=public&sslmode=require"
```

## 表结构

由 `server/prisma/schema.prisma` 定义，核心表包括：

- `User`、`Device`、`GenerationBatch`、`GenerationJob`
- `GenerationQuota`、`ChatQuota`、`QuotaLog`、`ChatLog`
- `RedeemCode`、`RedeemLog`
- `PaymentOrder`（C2.5 模拟支付）
- `SystemConfig`、`AdminUser`、`AdminAuditLog`、`UserLoginLog`

## 运维命令

| 命令 | 说明 |
|------|------|
| `npm run db:up` | 启动本地 Postgres 容器 |
| `npm run db:down` | 停止容器 |
| `npm run db:push` | 将 schema 推送到数据库（开发） |
| `npm run db:generate` | 重新生成 Prisma Client |

公测后建议引入 `prisma migrate` 做版本化迁移；当前开发阶段仍用 `db push`。

## 从 SQLite 切换

若你曾在 `server/dev.db` 存过测试数据：

1. 备份旧 `dev.db`（如需查阅）
2. 按上文配置 PostgreSQL 并 `db:push`
3. 重启 API — 管理员账号、兑换码、系统配置会由 `seed.ts` 重新种子化

**用户与任务数据不会自动导入**，需重新注册或手动迁移。
