# Docker 本地开发

> 数据库、API、官网可全部进 Docker；**Electron 桌宠必须在 macOS/Windows 本机跑**（需要桌面窗口）。

## 一键启动（推荐）

```bash
cd /path/to/Petory
npm run dev:docker
```

默认：**Docker** 只跑 Postgres + 官网；**本机**跑 API（8787）+ Electron 客户端。  
无需从 Docker Hub 拉 `node:20-alpine`（避免国内网络超时）。

## Postgres 连不上（P1001）

先确认容器在跑且端口已映射：

```bash
docker compose up -d postgres
docker compose ps
docker compose logs postgres
```

`petory-postgres` 应为 `healthy`，宿主机连 `localhost:5433`。  
`npm run dev:docker` 会最多等约 60 秒再跑 Prisma。

## 分步启动

```bash
npm run docker:up      # postgres + 官网
npm run setup:dev      # 同步表（首次或改过 schema）
npm run server:dev     # 终端1：API / 管理端
npm run dev            # 终端2：桌宠客户端
```

## 官网能开、管理端打不开？

**正常。** 当前 Docker 只有 **Postgres + 官网**，管理端由 **本机 API** 提供（`:8787`），不会随 `docker:up` 自动启动。

新开一个终端：

```bash
npm run setup:dev      # 首次
npm run server:dev     # 保持运行，不要关
```

浏览器打开：http://localhost:8787/admin/  
输入 `server/.env` 中配置的 `ADMIN_EMAIL`，通过邮箱中的一次性链接登录。

若页面空白没有登录框，执行：

```bash
# 浏览器控制台清除旧 token（或点页面上的「退出」）
localStorage.removeItem('petory_admin_token')

```

然后硬刷新页面（Cmd+Shift+R）并重新发送登录链接。

验证 API 是否起来：

```bash
curl http://localhost:8787/health
```

应返回 JSON（含版本号），而不是「无法连接」。

## 只起 Docker（不起 API / 客户端）

```bash
npm run docker:up
npm run docker:logs
npm run docker:down
```

## 可选：API 也放进 Docker

需能访问 Docker Hub。若 `docker:up` 报 `node:20-alpine` 超时，请用上面的默认方式。

```bash
npm run docker:up:api
```

## 地址

| 服务 | URL |
|------|-----|
| 管理后台 | http://localhost:8787/admin/ |
| API 健康检查 | http://localhost:8787/health |
| **官网** | http://localhost:5180/ |
| Postgres | `localhost:5433`（用户/库/密：petory） |

## 与 cryptopilot 共存

Petory Postgres 映射 **5433**，不占用本机 5432（cryptopilot 等可继续用 5432）。

## 客户端

```bash
npm run dev
```

设置里 API 地址：`http://localhost:8787`

## 相关

- [C2.0.md](../releases/client/C2.0.md) — 非 Docker 分步启动
- [DATABASE.md](../backend/DATABASE.md)
