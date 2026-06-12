# Petory 服务端与管理端文档

管理端（API Server + 运营后台）用于支撑 **Electron 客户端** 的账号、额度、AI 生成代理与运营管理。桌宠展示、拖拽、番茄钟、成长等能力仍在客户端完成。

> **当前状态**：服务端 **1.4.0** + PostgreSQL；客户端 **2.4.1**。交付记录见 [客户端 C2.x](../releases/client/) 与 [服务端 B1.x](../releases/server/)。

## 文档索引

| 文档 | 说明 |
|------|------|
| [PRD.md](./PRD.md) | 管理端产品需求（已对照客户端现状校正） |
| [B1.0.md](../releases/server/B1.0.md) | B1.0 交付说明 |
| [B1.1.md](../releases/server/B1.1.md) | B1.1 交付说明 |
| [B1.2.md](../releases/server/B1.2.md) | B1.2 交付说明（Kimi 代理） |
| [B1.3.md](../releases/server/B1.3.md) | **B1.3 已交付范围**（运营配置） |
| [ROADMAP.md](../releases/server/ROADMAP.md) | 服务端与管理端规划、客户端协同节奏 |
| [CLIENT-ALIGNMENT.md](./CLIENT-ALIGNMENT.md) | 客户端已实现能力 ↔ 后台需承接的映射表 |
| [DATABASE.md](./DATABASE.md) | **PostgreSQL** 本地与生产配置 |
| [DEPLOY.md](./DEPLOY.md) | 内测/生产部署 checklist |

## 与用户端文档的关系

| 范围 | 路径 |
|------|------|
| 项目文档总入口 | [../README.md](../README.md) |
| 客户端功能说明 | [FEATURES.md](../product/FEATURES.md) |
| 客户端发布记录 | [C2.x](../releases/client/) |
| 服务端发布记录 | [B1.x](../releases/server/) |
| 发布与更新通道 | [../../website/releases/DEPLOY.md](../../website/releases/DEPLOY.md) |

## 原始草稿

产品初稿来自：`/Users/gaiyao/Downloads/Petory 后台 PRD.md`。仓库内 [PRD.md](./PRD.md) 在初稿基础上做了与 **客户端 V1.4** 的对齐与勘误。

## 开发原则（文档级约定）

1. **MiniMax / Kimi API Key 不得写入客户端正式版**（当前开发版仍可在 `.env` 或本地设置中配置，上线前必须迁到后台）。
2. **rembg 去背景** 在可预见的版本内仍由 **客户端本地** 执行（与初稿一致）。
3. **权益数值** 以客户端 `src/shared/entitlements.ts` 为产品基准，后台配置应可覆盖但默认值需一致。
4. **不破坏本地用户数据**：客户端接入真实登录后，需提供 Mock → 账号迁移方案。
5. **管理端与用户端版本号独立**：客户端 `1.x`，管理端建议 `B1.x`（Backend）。
