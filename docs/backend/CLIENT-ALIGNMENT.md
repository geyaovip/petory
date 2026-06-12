# 客户端 ↔ 管理端对齐表

基于客户端 **V1.4**（`package.json`）与代码现状整理。用于后台 PRD 校正与接口设计。

## 1. 架构分工（已定）

| 能力 | 客户端（现状） | 管理端（规划） |
|------|----------------|----------------|
| 桌宠窗口、拖拽、穿透、Alpha 命中 | ✅ 已实现 | ❌ 不做 |
| rembg 去背景 | ✅ 本地 Python | ❌ MVP 不做云端 rembg |
| 透明 PNG / 姿势图存储 | ✅ 本地 `userData/pets/` | ❌ MVP 不存最终桌宠图 |
| MiniMax 图生图 | ⚠️ 客户端直连（Key 在本地） | ✅ 应代理 |
| Kimi 对话 | ⚠️ 客户端直连（Key 在本地） | ✅ 应代理（B1.2+） |
| 账号 / 额度 | ⚠️ 本地 Mock | ✅ 服务端权威 |
| 兑换码 Pro | ⚠️ 硬编码 `MOCK_REDEEM_CODES` | ✅ 后台发放与核销 |
| 自动更新 / 官网 | ✅ 静态站 + electron-updater | 可选：版本公告 API |

## 2. 权益与额度（以客户端为准）

来源：`src/shared/entitlements.ts` → `PLAN_LIMITS`

| 权益项 | 免费版 | Pro | 初稿 PRD 差异 |
|--------|--------|-----|----------------|
| 每日 **生成** 次数 | **3** | **50** | 初稿写 1 / 30，**以本表为准** |
| 每日 **对话** 次数 | **20** | **9999**（实质不限） | 初稿未单独列对话额度 |
| 最大宠物数 | **1** | **10** | 初稿 Pro「多宠物」未写上限 |
| 桌面同时显示 | **1** | **5** | 初稿未覆盖 |
| 可用风格 | 仅 `petory` | 6 种全解锁 | 初稿 MVP 仅一种风格，**客户端已 6 风格** |
| 姿势数量 | 3 种 | 6 种 | 初稿未描述多姿势任务模型 |

### 生成额度扣减（客户端现状）

| 操作 | 是否扣 `dailyGenerationLimit` | 说明 |
|------|------------------------------|------|
| 首次上传后整批生成（含多姿势） | ✅ 扣 **1 次** | `runGenerationPipeline` → `incrementGenerationUsage` |
| Pro 姿势补全 | ❌ 不扣 | `runCompletePosesPipeline` |
| 单姿势重生成 | ❌ 不扣 | `runRegenerateSinglePose` |
| 换风格重新生成 | ✅ 扣 **1 次** | 走完整 `generate` 流程 |

> **后台设计建议**：初稿「Regenerate 均扣 1 次」与现客户端不一致。建议后台区分 **jobType**：`full_batch`（扣额度）、`pose_completion`（不扣或 Pro 专属）、`single_pose_regen`（不扣或限 Pro + 日上限）。

## 3. 风格与姿势（客户端已实现）

### 风格 `styleType`

| 值 | 名称 | Pro 专属 |
|----|------|----------|
| `petory` | Petory 默认 | 否 |
| `pixel` | 像素 | 是 |
| `sticker` | 贴纸 | 是 |
| `plush` | 毛绒 | 是 |
| `clay` | 黏土 | 是 |
| `cyber` | 赛博 | 是 |

### 姿势 `pose`（多图）

| 值 | 免费 | Pro |
|----|------|-----|
| `idle` / `happy` / `remind` | ✅ | ✅ |
| `focus` / `sleep` / `angry` | | ✅ |

后台生成 API 需支持：

- `styleType`：上述 6 枚举
- `poses[]`：按用户 plan 返回待生成列表（与客户端 `getPosesToGenerate` 逻辑一致）
- 可选：**单姿势任务**（对应客户端「单姿势重生成」）

## 4. 账号体系（客户端现状 vs 后台目标）

| 项目 | 客户端 V1.4 | 后台 PRD 目标 |
|------|---------------|---------------|
| 登录方式 | 邮箱 + 密码（本地 `mock-users.json`） | 邮箱验证码（MVP 推荐） |
| 离线模式 | `continueOffline`，guest 额度 | 可选：设备级匿名（低优先级） |
| Token | 本地假 token | access + refresh JWT |
| 用户字段 | `id, email, displayName, plan, createdAt` | 需增加 `status, proExpiresAt, lastLoginAt` 等 |
| 宠物关联 | `Pet.userId?` 已预留 | 创建/同步时写入服务端 userId |

**迁移注意**：客户端已有密码注册数据仅存在本机，接入真实后台后应视为 **重新注册** 或提供 **一次性绑定** 流程（文档阶段先不写实现）。

## 5. 数据与同步

| 数据 | 存储位置（现） | 后台 MVP | 后台后续 |
|------|----------------|----------|----------|
| 宠物元数据 | `pets-store.json` | 不存 | B2.x 云同步元数据 |
| 聊天历史 | `chat-history.json` | 不存 | B2.x |
| 互动 / 成长 | `interaction-log.json`, `pet-stats.json` | 不存 | B2.x |
| 导出备份 | `schemaVersion: 2` 本地 JSON | 可提供导入 API | B2.x |
| 生成任务 | 无服务端记录 | **generation_jobs 表** | 成本统计 |

## 6. 管理后台页面 ↔ 客户端可观测数据

MVP 运营后台主要查 **服务端** 数据；客户端本地 Mock 阶段无后台可查。

上线后管理员应能看到：

- 用户：邮箱、plan、状态、今日生成/对话次数（来自服务端 usage）
- 任务：输入图 URL、MiniMax 原图 URL、style、poses、状态、耗时、错误码
- 兑换码：创建、核销记录、关联用户（替代 `PETORY-PRO-DEMO` 硬编码）
- 系统配置：免费/Pro 每日额度默认值（应对齐 `PLAN_LIMITS`）

## 7. 初稿 PRD 勘误摘要

| 初稿描述 | 校正后 |
|----------|--------|
| MVP 仅 `petory_style` 一种风格 | 客户端已 6 风格；后台需从首版支持 `styleType` 枚举 |
| 免费每日 1 次生成 / Pro 30 次 | 改为 **3 / 50**（生成）；并增加 **对话 20 / 9999** |
| Regenerate 一律扣额度 | 区分整批生成 vs 姿势补全 vs 单姿势重生成 |
| 未描述 Kimi 对话 | 增加 **对话代理与对话额度** 模块（B1.2） |
| 未描述多姿势批量任务 | 一次「创建桌宠」对应 **1 次额度 + N 个 pose 子任务** |
| 兑换码 | 客户端 Mock 2 个码；后台需 **兑换码管理**（B1.1） |
