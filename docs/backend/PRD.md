# Petory 管理端 PRD

> 版本：文档 v1.0（2026-06-09）  
> 对齐客户端：**V1.4**  
> 状态：**B1.2 已交付**（+ Kimi 对话代理、对话额度）

## 1. 定位与目标

### 1.1 定位

Petory 管理端 = **API Server** + **运营管理后台**，支撑桌面客户端的：

- 用户与设备身份
- 生成 / 对话额度与权益
- MiniMax（及后续 Kimi）**服务端代理**
- 生成任务记录、成本与风控
- Pro 订阅 / 兑换码运营

**不承担**：桌宠渲染、窗口穿透、番茄钟、成长 UI、本地 rembg。

### 1.2 核心目标

1. MiniMax / Kimi API Key **仅存在于服务端**
2. 用户生成、对话额度由服务端校验与扣减
3. 代理 MiniMax 图生图（多风格、多姿势）
4. 全量记录生成任务（排障、成本、风控）
5. 真实登录态（JWT）与设备登记
6. Pro 权益：订阅、兑换码、管理员手动开通
7. 运营后台：用户 / 任务 / 额度 / 配置
8. 基础风控与成本统计

### 1.3 与客户端协作架构

```
Electron 客户端
  ├─ 压缩上传图、选 style / poses
  ├─ 携带 access token 调 Petory API
  ├─ 下载 MiniMax 原图
  ├─ 本地 rembg → 透明 PNG
  └─ 本地保存桌宠与姿势（userData）

Petory API Server
  ├─ Auth / 设备 / 额度 / 权益
  ├─ 对象存储（输入图、MiniMax 输出原图）
  ├─ MiniMax 代理（按 style + pose 拼 prompt）
  └─ 任务状态、日志、统计

运营后台（Web）
  └─ 只调 Admin API，不直连 MiniMax
```

---

## 2. 模块清单

| # | 模块 | MVP (B1.0) | 后续 |
|---|------|------------|------|
| 1 | 用户系统 | 邮箱验证码登录、JWT | 密码登录、OAuth |
| 2 | 设备系统 | 登记设备、弱绑定 | 设备数限制 |
| 3 | 生成额度 | 日额度、扣减规则 | 赠送额度、管理员调整 |
| 4 | 对话额度 | — | B1.2 Kimi 代理后启用 |
| 5 | 图片生成任务 | 多风格 idle 单图任务 | 多姿势批量、单姿势任务 |
| 6 | MiniMax 代理 | 是 | 队列、优先级 |
| 7 | Kimi 代理 | — | B1.2 |
| 8 | 订阅与权益 | 手动 Pro、兑换码 | Stripe 等 |
| 9 | 管理后台 | 用户 / 任务 / 额度 | 仪表盘、配置中心 |
| 10 | 日志风控 | 基础限流 | 审核、告警 |

---

## 3. 用户系统

### 3.1 登录（B1.0）

- **假登录**：邮箱 + 密码注册/登录（与客户端 V1.4 Mock 交互一致，用户数据写入服务端数据库）
- JWT access token；refresh token B1.3+ 可选
- 真实邮箱验证码 / OAuth：后续版本再换，不阻塞 B1.0

### 3.2 用户字段

| 字段 | 说明 |
|------|------|
| id | UUID |
| email | 唯一 |
| nickname | 显示名 |
| avatar_url | 可选 |
| status | `active` / `disabled` / `deleted` |
| plan | `free` / `pro` |
| pro_expires_at | Pro 到期，可空 |
| created_at / updated_at / last_login_at | |

### 3.3 客户端登录态

- 返回 `accessToken` + `refreshToken`
- 生成 / 对话 / 管理类接口需 Bearer token
- 退出登录吊销 refresh（可选）

---

## 4. 设备系统

客户端生成 `localDeviceId`，调用 `POST /api/devices/register`。

| 字段 | 说明 |
|------|------|
| local_device_id | 客户端生成，稳定 |
| device_name / os / os_version / app_version | |
| last_active_at | 心跳或每次 API 更新 |

**MVP**：只记录，不限制数量。  
**预留**：免费 1 台 / Pro 3 台（与客户端多设备同步规划一致）。

---

## 5. 额度与权益

### 5.1 默认值（与客户端 `PLAN_LIMITS` 一致）

| 权益 | 免费 | Pro |
|------|------|-----|
| daily_generation_limit | **3** | **50** |
| daily_chat_limit | **20** | **9999** |
| max_pets | **1** | **10** |
| max_desktop_pets | **1** | **5** |
| styles | `petory` | 全部 6 种 |
| poses | 3 种 | 6 种 |

系统配置表应能覆盖上述默认值，但出厂配置必须与上表一致。

### 5.2 扣减规则

**生成额度**

| 场景 | job_type | 扣减 |
|------|----------|------|
| 新建桌宠 / 换风格整批生成 | `full_batch` | 成功扣 **1**（整批 N 个 pose 仍只扣 1 次，与客户端一致） |
| Pro 姿势补全 | `pose_completion` | **不扣** |
| 单姿势重生成 | `single_pose_regen` | **不扣**（或 Pro + 单独日上限，二期再定） |
| MiniMax 失败 / 超时无结果 | — | 不扣 |
| 内容安全拦截 | — | 不扣 |

**对话额度**（B1.2 起）

- Kimi 请求成功扣 1；失败不扣（与生成规则类似）

### 5.3 额度不足

统一错误码，例如 `QUOTA_EXCEEDED`，body 含 `remainingToday`、`dailyLimit`、`isProUser`。  
客户端已有中文提示，后台返回结构化字段即可。

---

## 6. 图片生成任务

### 6.1 任务类型演进

**B1.0（最小）**

- 单任务：1 张输入图 → 1 个 `styleType` → 1 个 `pose`（默认 `idle`）
- 客户端可多次调用来模拟多姿势（临时方案）

**B1.1（推荐与 V1.3 客户端对齐）**

- `POST /api/generation/batch`：一次请求创建 **1 个 batch + N 个 pose 子任务**
- 整批成功扣 1 次生成额度
- 支持 `styleType` 全枚举、`poses[]` 按 plan 校验

**B1.1+**

- `POST /api/generation/jobs` 单姿势任务（对应「单姿势重生成」）
- `POST /api/generation/complete-poses` 补全任务（不扣额度）

### 6.2 任务状态

`pending` → `processing` → `succeeded` | `failed` | `blocked` | `canceled`

### 6.3 任务字段（核心）

- user_id, device_id
- style_type, pose（或 batch_id + pose）
- input_image_url, output_image_url（MiniMax **原图**，非透明桌宠）
- prompt, negative_prompt（服务端拼装，客户端不传完整 prompt）
- status, error_code, error_message
- duration_ms, cost_usd（估算）
- created_at, updated_at

### 6.4 图片限制

- 格式：PNG / JPG / JPEG / WEBP
- 单张 ≤ 10MB；建议客户端已压到长边 1280px
- 存对象存储，MiniMax 使用可访问 URL

### 6.5 Prompt 管理

- Prompt 模板在 **服务端** 按 `styleType` + `pose` 维护（客户端已有 `posePrompts` 可对齐迁移）
- 客户端只传：`image`、`styleType`、`pose(s)`、`deviceId`、可选 `locale`（未来多语言）

---

## 7. MiniMax 代理

- API Key 仅存服务端环境变量 / 密钥管理
- 流程：鉴权 → 额度 → 存输入图 → 调 MiniMax → 存输出图 → 扣额度 → 返回 `rawOutputUrl`
- 内容安全：MVP 依赖 MiniMax；正式版接入图片审核（B2.x）

---

## 8. Kimi 对话代理（B1.2）

现客户端在 `electron/main/chat/` 直连 Kimi，Key 在用户 `.env` 或设置里。

后台需：

- `POST /api/chat/completions`（或流式）
- 校验对话额度
- 服务端保存 personality / 历史策略（MVP 可不存历史，仅代理）
- 不在 MVP 范围的内容：聊天历史云同步 → B2.x

---

## 9. 订阅、Pro 与兑换码

### 9.1 MVP

- 数据表预留 `subscriptions`
- 支持：管理员手动开通 / 取消 Pro、`pro_expires_at`
- **兑换码**：创建、核销、次数限制、过期时间（替代客户端 `MOCK_REDEEM_CODES`）

### 9.2 正式支付（B2.0）

- Stripe / Paddle / Lemon Squeezy 等
- Webhook 自动更新 plan

---

## 10. 管理后台（Web）

### 10.1 MVP 页面

1. **登录**（admin 账号）
2. **数据概览**：用户总数、今日活跃、今日生成成功/失败、估算成本、Pro 用户数
3. **用户列表 / 详情**：设备、任务、额度、订阅、操作日志
4. **生成任务列表 / 详情**：输入/输出图、错误信息
5. **额度管理**：手动加额度、查看 quota_logs
6. **兑换码管理**：生成、列表、核销记录
7. **系统配置**（MVP 可用环境变量，后台 UI 放 B1.3）

### 10.2 管理员操作

- 禁用 / 恢复用户
- 手动开通 / 取消 Pro
- 增加生成额度（及后续对话额度）
- 查看失败任务、复制错误信息

### 10.3 角色

MVP 仅 `admin`；后续 `super_admin` / `operation` / `support` / `finance`。

---

## 11. API 概要

### 11.1 用户端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 假登录注册（B1.0 ✅） |
| POST | `/api/auth/login` | 假登录（B1.0 ✅） |
| POST | `/api/auth/refresh` | 刷新 token（后续） |
| POST | `/api/auth/logout` | 退出（后续） |
| GET | `/api/me` | 当前用户 + 权益摘要 |
| POST | `/api/devices/register` | 注册/更新设备 |
| GET | `/api/generation/quota` | 生成额度 |
| GET | `/api/chat/quota` | 对话额度（B1.2） |
| POST | `/api/generation/jobs` | 创建单图任务（B1.0） |
| POST | `/api/generation/batch` | 创建多姿势批次（B1.1） |
| GET | `/api/generation/jobs/:id` | 查询任务 |
| POST | `/api/generation/jobs/:id/cancel` | 取消（可选） |
| POST | `/api/redeem` | 兑换码核销 |

### 11.2 管理端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/users` | 用户列表 |
| GET | `/api/admin/users/:id` | 用户详情 |
| POST | `/api/admin/users/:id/disable` | 禁用 |
| POST | `/api/admin/users/:id/quota/grant` | 加额度 |
| POST | `/api/admin/users/:id/pro/activate` | 开通 Pro |
| GET | `/api/admin/generation/jobs` | 任务列表 |
| GET | `/api/admin/generation/jobs/:id` | 任务详情 |
| CRUD | `/api/admin/redeem-codes` | 兑换码 |
| GET | `/api/admin/dashboard` | 概览指标 |

详细 request/response 见初稿第 16–19 节，实现时以 OpenAPI 为准。

---

## 12. 数据表（核心）

与初稿一致，补充建议：

| 表 | 说明 |
|----|------|
| users | + `plan`, `pro_expires_at` |
| devices | |
| generation_jobs | + `pose`, `job_type`, `batch_id` |
| generation_batches | B1.1 可选，关联多 pose |
| generation_quotas | 生成日额度 |
| chat_quotas | B1.2 对话日额度 |
| quota_logs | |
| redeem_codes / redeem_logs | 兑换码 |
| subscriptions | 支付预留 |
| admin_users | |
| system_configs | |
| admin_audit_logs | 管理员操作 |

---

## 13. 风控（MVP）

- 单用户：≤ 3 次生成请求 / 分钟
- 单 IP：≤ 20 次 / 分钟
- 单任务超时：60s（可配置）
- 连续失败 5 次：短暂冷却
- 禁用用户立即拒绝所有生成

---

## 14. 技术栈建议

| 层 | 推荐 |
|----|------|
| API | Node.js + TypeScript，NestJS 或 Hono |
| ORM | Prisma + PostgreSQL |
| 缓存/限流 | Redis |
| 对象存储 | R2 / S3 / OSS |
| 队列 | BullMQ（多 pose 异步时） |
| 管理后台 | Next.js + React + Tailwind + shadcn/ui |
| 部署 | Railway / Fly.io + Neon/Supabase + R2 |

---

## 15. MVP 验收标准（B1.0）

### 用户

- [ ] 邮箱验证码登录，客户端可拿 token
- [ ] `GET /api/me` 返回 plan 与权益
- [ ] 设备可注册
- [ ] 禁用用户无法创建任务

### 生成

- [ ] 客户端可创建任务并拿到 `rawOutputUrl`
- [ ] Key 不出现在客户端包内
- [ ] 成功扣 1 次生成额度，失败不扣
- [ ] 任务可查询状态

### 运营

- [ ] 管理员可登录后台
- [ ] 可搜用户、看任务、看失败原因
- [ ] 可手动加额度、开通 Pro
- [ ] 可创建兑换码并在客户端核销

### 安全

- [ ] 管理 API 与用户 API 权限隔离
- [ ] 上传大小与频率限制生效

---

## 16. 明确不做（与初稿一致 + 补充）

| 项目 | 阶段 |
|------|------|
| 云端 rembg | B2.x 再评估 |
| 云端存透明 PNG / 桌宠素材 | B2.x |
| 宠物 / 聊天 / 成长云同步 | B2.x |
| 复杂支付 | B2.0 |
| 多管理员角色 | B1.3+ |
| 社区 / 市场 / 插件 | V2.0+ |
| 客户端多语言 | 客户端独立迭代 |

---

## 17. 相关文档

- [CLIENT-ALIGNMENT.md](./CLIENT-ALIGNMENT.md) — 客户端现状对照
- [ROADMAP.md](../releases/server/ROADMAP.md) — 管理端版本节奏
- [FEATURES.md](../product/FEATURES.md) — 客户端功能说明
