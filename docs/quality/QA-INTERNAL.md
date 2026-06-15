# 内测验收清单（C2.x + B1.4）

> 小范围公测前逐项勾选。默认 API：`http://localhost:8787`

## 自动化冒烟（先做）

```bash
npm run dev:stack          # 或确保 server 已启动
npm run qa:smoke           # health / app/status / payment plans
npm run qa                 # 发布资源检查（打包前）
```

- [ ] `qa:smoke` 全部 ✓
- [ ] `qa` 发布检查通过（正式发包前）

## 环境

- [ ] Docker 已安装，`npm run server:db:up` 成功
- [ ] `server/.env` 含 `JWT_SECRET`、`MINIMAX_API_KEY`、`KIMI_API_KEY`
- [ ] `npm run server:db` 无报错（含 `PaymentOrder` 表）
- [ ] `GET http://localhost:8787/health` 返回 `B1.4.0`
- [ ] `GET http://localhost:8787/api/app/status` 可访问

## 认证

- [ ] 新用户注册并登录成功
- [ ] 错误密码返回明确提示
- [ ] 后台关闭 `registrationOpen` 后，客户端注册 Tab 禁用且注册失败
- [ ] 退出登录回到登录页
- [ ] 手动使 JWT 失效后，下一次 API 请求回到登录页（401）

## 额度与公告

- [ ] 设置页显示今日剩余对话/生成次数
- [ ] 后台修改额度上限后，设置页刷新可见新上限
- [ ] 维护公告在登录页、设置页、聊天等窗口可见（`AppShell`）
- [ ] 生成或对话成功后，剩余次数减少

## 生成

- [ ] 创建桌宠整批生成成功（rembg 本地完成）
- [ ] 免费用户 3 姿势 / Pro 6 姿势与后台一致
- [ ] 额度用尽时提示明确，失败不扣额度
- [ ] 后台关闭 `generationServiceEnabled` 后提示维护中
- [ ] Pro 姿势补全、单姿势重生成不扣主额度
- [ ] 生成页展示 upload → remote → local 阶段进度

## 对话

- [ ] 对话成功返回气泡文案
- [ ] 免费用户超额被拦截
- [ ] 后台关闭 `chatServiceEnabled` 后提示维护中

## 兑换与 Pro

- [ ] `PETORY-PRO-DEMO` 核销成功，plan 变为 pro
- [ ] 兑换后姿势补全可触发（若有待补全宠物）

## 模拟支付（C2.5）

- [ ] 设置 → Pro 升级可见月付/年付方案
- [ ] 模拟支付成功后 plan 为 pro，显示 `proExpiresAt`
- [ ] 管理后台「支付订单」可见 paid 记录
- [ ] 关闭 `mockPaymentEnabled` 后模拟支付失败，兑换码仍可用

## 设备封禁（C2.6）

1. 客户端登录并完成一次生成（确保设备已注册）
2. 管理后台 → 设备 → **标记异常**
3. 客户端再次生成或对话

- [ ] 返回「该设备已被限制使用」类提示（`DEVICE_FLAGGED` / 403）
- [ ] 取消标记后恢复正常

## 数据导入（C2.6）

1. 机器 A：创建桌宠 → **导出本地数据**（schema v3）
2. 机器 B（或清空后）：登录同一账号 → **从备份导入**

- [ ] 导入后桌宠图片与姿势正常显示
- [ ] 账号需重新登录（session 不随备份迁移）
- [ ] `exports/pre-import-*` 自动备份存在

> v2 旧备份仅 JSON，无 `petFiles` 时图片可能缺失 — 请用 2.4.0+ 重新导出。

## 管理后台

- [ ] `/admin/` 使用 `geyaovip@163.com` 的 Magic Link 登录
- [ ] 仪表盘有今日数据
- [ ] 系统配置保存后客户端额度同步
- [ ] 运营账号 `operator@petory.app` 无法写入
- [ ] 支付订单列表可见

## 登录策略

- [ ] 登录页无「暂不登录，本地使用」
- [ ] 旧离线 session 启动后要求重新登录

## 生产前（文档级）

- [ ] 阅读 [backend/DEPLOY.md](../backend/DEPLOY.md)
- [ ] PostgreSQL 使用托管服务 + SSL
- [ ] `JWT_SECRET` 已更换强随机值

## 相关

- [BACKLOG.md](../product/BACKLOG.md) — 剩余待办
- [C2.6.md](../releases/client/C2.6.md) — 2.4.0 补强说明
