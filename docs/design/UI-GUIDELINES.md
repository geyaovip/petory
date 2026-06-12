# Petory UI 设计规范

> 适用范围：**桌面客户端**、**官网**（`website/`）、**管理后台**（`server/admin/public/`）。
> 不包含：AI 生成的桌宠形象风格（见 Petory Style / `image-processing.mdc`）。

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **陪伴感优先** | 界面像「温柔的小窝」，不是效率 SaaS 或开发者工具 |
| **轻量不打扰** | 控制面板简洁；桌面桌宠层极轻，不抢焦点 |
| **三步完成** | 核心流程（上传 → 等待 → 使用）视觉路径清晰、无多余步骤 |
| **软而不幼** | 圆润、温暖，但避免过度卡通化（目标用户含学生、打工人） |
| **系统友好** | 尊重 macOS / Windows 原生窗口习惯，不强行仿移动端 App |

**视觉关键词：** 温暖 · 柔软 · 干净 · 轻盈 · 可亲近

---

## 2. 设计语言

### 2.1 整体气质

- **主模式：** 浅色（Light）— MVP 默认，桌宠 PNG 在浅色背景下对比最佳
- **风格：** Soft Minimal — 大留白、柔和色块、轻阴影、大圆角
- **质感：** 控制面板可用轻微毛玻璃（`backdrop-blur`），桌面气泡用实色 + 软阴影
- **深色模式：** V1.0 前不强制；Schema 预留，设置页可后补

### 2.2 两层 UI

```
┌─────────────────────────────────────────┐
│  桌面层（Pet Overlay）                    │
│  · 透明窗口 · 仅宠物 + 气泡 + 右键菜单      │
│  · 无 App  chrome · 动画为主              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  控制层（App Panels / Onboarding）        │
│  · 常规 Electron 窗口                     │
│  · 完整组件体系 · 本规范主要约束此层        │
└─────────────────────────────────────────┘
```

---

## 3. 色彩系统

### 3.1 品牌色

| Token | Hex | 用途 |
|-------|-----|------|
| `primary` | `#FF8A7A` | 主按钮、关键 CTA、选中态、经验条 |
| `primary-hover` | `#FF6B5E` | 主按钮悬停 |
| `primary-soft` | `#FFE8E4` | 主色浅底、标签背景 |
| `accent` | `#7EC8E3` | 次要强调、链接、番茄钟进行中 |
| `accent-soft` | `#E8F6FC` | 信息提示背景 |

主色选用 **暖珊瑚粉** — 传递陪伴与温度，区别于冷色调效率工具。

### 3.2 中性色

| Token | Hex | 用途 |
|-------|-----|------|
| `bg` | `#FAFAF8` | 页面背景（微暖白） |
| `surface` | `#FFFFFF` | 卡片、面板 |
| `surface-elevated` | `#FFFFFF` + shadow | 浮层、弹窗 |
| `border` | `#E8E6E1` | 分割线、输入框边框 |
| `border-strong` | `#D4D1CA` | 悬停边框 |
| `text` | `#2D2A26` | 主文字 |
| `text-secondary` | `#6B6560` | 副文案、说明 |
| `text-tertiary` | `#9C958E` | 占位符、辅助信息 |
| `disabled` | `#C8C4BD` | 禁用文字/图标 |

### 3.3 语义色

| Token | Hex | 用途 |
|-------|-----|------|
| `success` | `#6BC9A8` | 生成成功、番茄钟完成 |
| `success-soft` | `#E8F7F0` | 成功提示背景 |
| `warning` | `#F5B942` | 久坐提醒 |
| `warning-soft` | `#FEF6E4` | 提醒背景 |
| `error` | `#E85D5D` | 上传/生成失败 |
| `error-soft` | `#FDECEC` | 错误提示背景 |

### 3.4 Tailwind 配置参考

```js
// tailwind.config — theme.extend.colors
petory: {
  primary: { DEFAULT: '#FF8A7A', hover: '#FF6B5E', soft: '#FFE8E4' },
  accent: { DEFAULT: '#7EC8E3', soft: '#E8F6FC' },
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  border: { DEFAULT: '#E8E6E1', strong: '#D4D1CA' },
  text: { DEFAULT: '#2D2A26', secondary: '#6B6560', tertiary: '#9C958E' },
  success: { DEFAULT: '#6BC9A8', soft: '#E8F7F0' },
  warning: { DEFAULT: '#F5B942', soft: '#FEF6E4' },
  error: { DEFAULT: '#E85D5D', soft: '#FDECEC' },
}
```

---

## 4. 字体

### 4.1 字体族

| 用途 | macOS | Windows | Fallback |
|------|-------|---------|----------|
| 界面正文 | PingFang SC | Microsoft YaHei UI | system-ui, sans-serif |
| 英文/数字 | SF Pro | Segoe UI | -apple-system, BlinkMacSystemFont, sans-serif |
| 标题展示（可选） | 与正文相同，加粗 | 同左 | 不引入额外 Web Font（MVP） |

MVP **不加载外部字体**，使用系统字体栈保证性能与原生感。

### 4.2 字号层级

| Token | Size | Weight | Line-height | 用途 |
|-------|------|--------|-------------|------|
| `display` | 28px | 600 | 1.3 | 欢迎页主标题 |
| `h1` | 22px | 600 | 1.35 | 页面标题 |
| `h2` | 18px | 600 | 1.4 | 区块标题 |
| `body` | 15px | 400 | 1.5 | 正文 |
| `body-sm` | 13px | 400 | 1.45 | 说明、辅助 |
| `caption` | 12px | 400 | 1.4 | 标签、时间戳 |
| `button` | 15px | 500 | 1 | 按钮文字 |

### 4.3 文案调性

- 用「你」不用「您」；语气亲切、简短
- 错误提示说人话，不暴露技术名词（MiniMax、rembg、prompt、参考图）
- **不得复述生成 prompt**：禁止「保留形象」「只改变姿势」「主体清晰」「只生成姿势」等内部指令措辞；用户文案用产品语言（如「正在创造你的桌宠…」「挑好风格后，我们会根据你的照片创造桌宠」）
- 用户可见文案集中在 `src/shared/copy/`，与 `src/shared/prompts/` 严格分离
- 英文按钮文案用 Title Case：`Use This Pet`，不用全大写

---

## 5. 间距与布局

### 5.1 间距刻度（4px 基准）

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

| 场景 | 间距 |
|------|------|
| 组件内 padding（按钮） | 12px 20px |
| 卡片内 padding | 20px 24px |
| 表单项之间 | 16px |
| 区块之间 | 24–32px |
| 页面左右边距 | 24px（窄窗）/ 32px（≥480px） |

### 5.2 圆角

| Token | Value | 用途 |
|-------|-------|------|
| `radius-sm` | 8px | 输入框、小标签 |
| `radius-md` | 12px | 按钮、气泡 |
| `radius-lg` | 16px | 卡片 |
| `radius-xl` | 20px | 大面板、上传区 |
| `radius-full` | 9999px | 药丸按钮、进度条 |

### 5.3 阴影

```css
/* shadow-sm — 卡片 */
0 1px 3px rgba(45, 42, 38, 0.06), 0 1px 2px rgba(45, 42, 38, 0.04);

/* shadow-md — 浮层、结果页宠物预览 */
0 4px 12px rgba(45, 42, 38, 0.08), 0 2px 4px rgba(45, 42, 38, 0.04);

/* shadow-bubble — 桌宠气泡 */
0 2px 8px rgba(45, 42, 38, 0.12);
```

### 5.4 窗口尺寸参考

| 窗口 | 宽 × 高 |
|------|---------|
| 欢迎 / 上传 / 结果 | 420 × 560（可缩放，min 380×520） |
| 聊天面板 | 360 × 480 |
| 番茄钟面板 | 320 × 400 |
| 设置页 | 480 × 640 |
| 成长页 | 360 × 440 |

---

## 6. 组件规范

### 6.1 按钮

**Primary（主操作）**
- 背景 `primary`，文字白色，圆角 `radius-md`
- 悬停 `primary-hover`；禁用 40% 透明度
- 例：`创建我的桌宠`、`Use This Pet`

**Secondary（次操作）**
- 背景 `surface`，边框 `border`，文字 `text`
- 悬停边框 `border-strong`，背景 `#F5F4F2`

**Ghost（弱操作）**
- 无边框，文字 `text-secondary`；悬停背景 `primary-soft`

**Danger（删除数据）**
- 文字 `error`；背景 `error-soft` 仅用于确认弹窗

按钮最小高度 **40px**；同一视觉区域最多 1 个 Primary。

### 6.2 输入框

- 高度 40px，圆角 `radius-sm`，边框 `border`
- Focus：边框 `primary`，外发光 `0 0 0 3px primary-soft`
- 占位符 `text-tertiary`
- 宠物名称：max 20 字；带字数提示

### 6.3 卡片

- 背景 `surface`，圆角 `radius-lg`，阴影 `shadow-sm`
- 可选左侧 3px `primary` 色条示选中（风格卡 V1.1+ 用）
- 上传区：虚线边框 `border`，拖入时边框 `primary` + 背景 `primary-soft`

### 6.4 单选 / 性格选择

- **药丸标签（Pill）**：未选 `surface` + `border`；选中 `primary-soft` + `primary` 文字 + 2px `primary` 边框
- 5 种性格横排或 2 列网格，图标 + 短标签

### 6.5 进度与加载

**生成中页**
- 居中插画或宠物剪影动画 + 文案 `正在创造你的桌宠…`
- 不确定进度条：顶部 2px `primary`  indeterminate 条，或柔和脉冲圆点
- **不展示** MiniMax / rembg 分步

**经验条**
- 高 6px，轨道 `#F0EEEA`，填充 `primary` 渐变至 `#FFB89E`，圆角 full

### 6.6 提示与空状态

| 类型 | 样式 |
|------|------|
| 信息 | `accent-soft` 底 + `accent` 左边框 3px |
| 成功 | `success-soft` 底 |
| 警告 | `warning-soft` 底 |
| 错误 | `error-soft` 底 + 图标 |

空状态：简单线条插画 + 一句温暖文案 + 一个 Primary 按钮。

---

## 7. 桌面层组件

### 7.1 桌宠气泡

```
┌──────────────────────┐
│  你来啦，今天也要加油哦 │  ← 背景 #FFFFFF，圆角 12px
└──────────┬───────────┘     阴影 shadow-bubble
           ▼ 小三角指向宠物
        [宠物图]
```

- 最大宽度 200px，内边距 10px 14px
- 字号 `body-sm`，颜色 `text`
- 5 秒淡出；悬停暂停消失
- 高优先级提醒：左边框 3px `warning`

### 7.2 右键菜单

- 背景 `surface`，圆角 `radius-md`，阴影 `shadow-md`
- 项高 36px，左右 padding 12px
- 悬停 `primary-soft`；分隔线 `border`
- 危险项（退出）文字 `error`

### 7.3 桌宠状态动画（CSS）

与 `electron-window.mdc` 一致，时长 2–3s ease-in-out infinite：

| 状态 | 效果 |
|------|------|
| idle | `translateY(0→-4px)` |
| happy | `rotate(-3deg→3deg)` |
| focus | `scale(1→1.02)` 呼吸 |
| sleep | `opacity: 0.6` |
| remind | `translateY(0→-6px)` 快 |
| angry | `translateX(-2px→2px)` 0.1s×3 |

---

## 8. 页面规范

### 8.1 欢迎页

- 垂直居中布局
- 主标题 `display`，副标题 `body-sm` + `text-secondary`
- 可选：轻量宠物剪影装饰（opacity 0.15），不喧宾夺主
- Primary：`创建我的桌宠`；Ghost：`先体验示例宠物`

### 8.2 上传页

- 大上传区（虚线框，min-height 200px）
- 中央图标 + `点击或拖拽上传`
- 底部 `text-tertiary` 说明：格式、10MB、版权提示
- 无裁剪器、无编辑器

### 8.3 生成中页

- 全页居中，禁止多余按钮
- 一句动态文案轮换（可选）：`正在塑造它的样子…` / `马上就好…`

### 8.4 结果页

- 宠物预览居中，最大高度 280px，`shadow-md` 轻垫
- 预览区背景：checkerboard 或 `bg` 微网格（示意透明 PNG）
- 三按钮纵向排列，间距 12px：Primary → Secondary → Ghost

### 8.5 命名页

- 宠物名输入 + 性格 Pill 选择 + 用户称呼输入
- 底部 Primary `生成桌宠` 或 `完成`

### 8.6 聊天面板

- 顶栏：宠物名 + 性格标签（`primary-soft` 小标签）
- 消息区：宠物消息左对齐浅底 `primary-soft`；用户消息右对齐 `accent-soft`
- 气泡圆角 12px，max-width 75%
- 底栏输入框 + 发送按钮（Primary 图标按钮）

### 8.7 番茄钟面板

- 大号倒计时 `display` 或 48px 等宽数字
- 环形进度或线性条，进行中用 `accent`
- 状态文案随宠物状态联动（`专注中…` / `休息一下吧`）

### 8.8 成长页

- 顶部宠物名 + 等级徽章
- 经验条 + 数字 `128 / 150`
- 统计卡片 2×2 网格：今日专注、连续天数等

### 8.9 设置页

- 左侧分组列表或顶部 Tab：通用 / AI / 隐私
- 开关用系统风格 Toggle；滑块用于透明度、大小时用步进选择

---

## 9. 图标

- **库：** Lucide React（线条图标，1.5px stroke）
- **尺寸：** 16px 内联 / 20px 按钮 / 24px 空状态
- **颜色：** 默认 `text-secondary`；激活 `primary`
- 避免 emoji 作为唯一图标；宠物相关可用爪印、爱心、番茄等

---

## 10. 动效

| 场景 | 时长 | 曲线 |
|------|------|------|
| 页面切换 | 200ms | ease-out |
| 气泡出现 | 250ms | spring-ish (cubic-bezier 0.34, 1.2, 0.64, 1) |
| 气泡消失 | 300ms | ease-in |
| 按钮反馈 | 150ms | ease |
| 卡片悬停 | 200ms | ease |

原则：**短、软、不闪**；桌面层动画 amplitude 小，避免干扰工作。

---

## 11. 平台差异

| 项 | macOS | Windows |
|----|-------|---------|
| 窗口控件 | 交通灯由系统提供 | 自定义标题栏或系统边框 |
| 字体渲染 | PingFang 优先 | YaHei UI 优先 |
| 透明窗口 | 注意 vibrancy 性能 | 测试 Aero 兼容 |
| 右键菜单 | 可用原生 `Menu` | 可用原生 `Menu` |

控制面板窗口标题栏高度 **40px**（自定义时）。

---

## 12. 无障碍（基础）

- 正文对比度 ≥ 4.5:1（`text` on `bg` 已满足）
- 可聚焦元素可见 focus ring（`primary` 3px outline）
- 按钮/图标带 `aria-label`
- 不只用颜色传达状态（配图标或文案）

---

## 13. 禁止事项（桌面客户端）

- ❌ 深蓝灰企业 Dashboard 风
- ❌ 满屏渐变、霓虹、赛博（留给 Cyber Pet 生成风格，非 App UI）
- ❌ 在生成流程暴露 rembg、API、模型名称
- ❌ 桌面层加 App 标题栏或厚重边框
- ❌ 一次页面超过 2 个 Primary 按钮
- ❌ 裸 `<button>` 随意写样式（必须用 `Button` / `TextButton` / `Pill`）
- ❌ 向用户展示开发命令、内部路径、环境变量名

---

## 14. 管理后台（Admin Console）

> 路径：`server/admin/public/` · 面向运营/管理员，允许信息密度高于客户端，但视觉语言仍属 Petory 体系。

### 14.1 信息架构

**禁止**把所有功能堆在一个长页面。必须采用 **侧边栏 + 单页视图**：

| 导航分组 | 视图 ID | 内容 |
|----------|---------|------|
| 概览 | `overview` | 核心指标、7 日趋势、失败分布 |
| 运营 | `users` | 用户列表与操作 |
| 运营 | `devices` | 设备与异常标记 |
| 运营 | `commerce` | 支付订单、兑换码 |
| 生成 | `generation` | 生成批次、生成任务（可分子 Tab） |
| 日志 | `logs` | 对话日志、管理员审计、登录日志 |
| 系统 | `config` | 系统配置（额度、开关、维护公告） |

- 默认进入 `overview`
- 切换导航时只渲染当前视图；可按需懒加载数据
- 顶栏固定：产品名、角色徽章、刷新、退出

### 14.1.1 字段展示

- 表格与配置项不得直接展示英文枚举、数据库字段名、错误码或 JSON 原文
- 使用 `server/admin/public/admin-labels.js` 将 `status`、`jobType`、`styleType`、`pose`、`action` 等映射为中文
- 技术 ID（UUID）可缩短显示，完整值放在 `title` 或次要行
- 配置项用中文标签 + 简短说明，避免 `jobTimeoutMs` 这类内部字段名

### 14.2 布局

```
┌──────────┬────────────────────────────────────┐
│ Sidebar  │ Topbar（标题 + 操作）               │
│ 200px    ├────────────────────────────────────┤
│          │ 当前视图内容（单区块，可滚动）        │
│          │                                    │
└──────────┴────────────────────────────────────┘
```

- 最小宽度 1024px；表格区域横向滚动
- 登录页独立全屏卡片，不占侧边栏

### 14.3 组件

| 组件 | 规范 |
|------|------|
| Primary 按钮 | `#FF8A7A`，主操作（保存配置、创建兑换码） |
| Secondary 按钮 | 浅底 + 边框，表格行内操作 |
| 统计卡 | 浅暖底 `#FAF7F2`，数字 22px |
| 表格 | 13px，行高舒适，状态用 badge |
| 空状态 | 一句说明，不要留空白 div |

### 14.4 管理端禁止

- ❌ 所有模块纵向无限堆叠在同一页
- ❌ 一次 `loadDashboard` 拉取全部 API（应按视图加载）
- ❌ 使用与客户端无关的随机配色

---

## 15. 官网（Marketing Site）

> 路径：`website/` · 静态页，与客户端同源设计 token。

### 15.1 页面结构

| 页面 | 用途 |
|------|------|
| `index.html` | 产品介绍、功能亮点、下载入口 |
| `download.html` | 系统选择、安装包下载 |
| `privacy.html` / `terms.html` | 法律文档 |

### 15.2 文案规范

- **面向最终用户**：说明能做什么、如何下载，不讲实现细节
- **禁止**出现：`npm run`、`latest.yml`、`UPDATE_FEED_URL`、`releases/latest.json`、数据库表名、API 路径
- 版本号可从 `releases/latest.json` 动态读取，但旁注应为「检查更新」类用户语言
- 功能描述与当前 MVP 一致；未上线能力不写进主文案（可写「即将推出」若 roadmap 需要）

### 15.3 组件

- 按钮复用 `--primary` / `--surface` token，与客户端一致
- Hero 区：一句主标题 + 一句副标题 + 最多 2 个 CTA
- Feature 卡片 2×2 或自适应网格，避免过长段落

### 15.4 导航与页脚（全站统一）

**所有官网页面**（`index` / `download` / `privacy` / `terms`）必须使用同一套顶栏与页脚，不得各页各写一套链接。

**顶栏结构：**

```
[ Logo 横版 wordmark ]    首页 · 下载 · 隐私 · 协议    [ 免费下载 ]
```

| 元素 | 规范 |
|------|------|
| Logo | `assets/logo.png`，高度 **56px**（横版 wordmark，含品牌名） |
| 导航链接 | 固定四项：首页、下载、隐私、协议；字号 14px，`--text-secondary`，悬停 `--text` |
| 当前页 | 对应链接加 `.is-active`（`--text` + 字重 600），由 `site.js` 按路径自动标记 |
| 右侧 CTA | 主按钮「免费下载」→ `download.html`；在下载页可改为锚点 `#mac` |
| 移动端 | `<640px` 隐藏中间链接，保留 Logo + CTA |

**页脚结构（固定）：**

```
© 2026 Petory
隐私政策 · 用户协议 · 下载
```

- 不得使用仅「返回首页」的简化页脚
- 法律页正文区使用 `.page-legal`，样式定义在 `styles.css`，禁止每页内联一套 legal CSS

### 15.5 品牌资产

**唯一源目录：** `petory_logo/`（仅 2 张源图，由 `npm run sync:brand` 派生全部产物，禁止在 `resources/` 等处再放副本）

| 源文件 | 派生产物 |
|--------|----------|
| `01_petory_primary_logo_transparent.png` | 各端 `logo.png`（横版 wordmark） |
| `03_petory_app_icon_transparent.png` | `favicon-*.png`、`apple-touch-icon.png`、`build/icon.png`、`build/icon.icns` |

| 派生资产 | 场景 |
|----------|------|
| `logo.png` | 官网导航、客户端登录、管理端登录/侧栏（高度 44–56px） |
| `favicon-*.png` / `apple-touch-icon.png` | 官网与客户端 HTML 标签图标 |
| `build/icon.png` / `icon.icns` | electron-builder 安装包与系统 Dock/任务栏 |

以上 app-icon 派生图统一为 **实色蓝底、无透明角**，并按尺寸轻微放大以提升小图标可读性。

**图标分工（必须遵守）：**
- **登录页 / 导航** → 横版 `logo.png`
- **Dock / 任务栏 / 窗口 / 浏览器标签** → 方形 app-icon 派生图（`loadAppIcon()` → `apple-touch-icon.png`，与 `index.html` favicon 同源）

**禁止：** 额外存放 `app-icon.png`、`avatar.png` 或 `resources/brand/` 副本；禁止把 wordmark 用作 favicon/Dock 图标。

### 15.6 下载页交互

- 版本号从 `releases/latest.json` 读取；失败时显示「暂不可用」，**不得**写死 `1.0.0`
- 下载按钮文案固定为「下载 macOS 版」「下载 Windows 版」；文件名与体积放在按钮下方 `.download-meta`
- 「查看系统要求」链到 `download.html#requirements`
- `#requirements` 区块列出 macOS / Windows 最低版本与网络说明

### 15.7 法律页

- 与首页相同顶栏 + 页脚；正文 max-width 720px
- 语气用「你」不用「您」；避免法律腔以外的技术术语

---

## 16. 组件库约定（客户端）

所有控制层面板必须使用 `src/renderer/components/ui/` 下组件，禁止复制粘贴一套按钮 class。

| 组件 | 用途 |
|------|------|
| `Button` | Primary / Secondary / Ghost / Danger；`sm` / `md` |
| `TextButton` | 面板「关闭」、返回导航 |
| `LinkButton` | 行内链接（协议、隐私） |
| `Pill` | 性格、尺寸、间隔等单选药丸 |
| `SegmentedControl` | 登录/注册等 Tab 切换 |
| `Toggle` | 开关（替代原生 checkbox） |
| `StyleCard` | 风格选择卡片 |
| `PanelHeader` | 面板标题 + 可选副标题 + 关闭 |
| `Input` | 表单输入，统一 focus 环 |
| `PageShell` | 全页容器 padding |

**按钮层级**：同一操作区 1 个 Primary；destructive 用 `danger` 或 Ghost + 确认框。

---

## 17. 文案与内容分级

| 级别 | 受众 | 示例 |
|------|------|------|
| 用户文案 | 终端用户 | 「正在创造你的桌宠…」「今日次数已用完」 |
| 运营文案 | 管理员 | 「生成批次」「标记异常设备」 |
| 生成 prompt | 仅服务端/模型 | `src/shared/prompts/` — **不得**出现在客户端、官网、错误提示 |
| 开发文案 | 仓库内文档 | `npm run server:dev`、Prisma 模型 |

用户可见界面只允许 **用户文案**；官网、客户端、管理端均不得泄露开发文案或生成 prompt。

---

## 18. 实施检查清单

开发 UI 时自检：

**客户端**
- [ ] 使用 `petory` Tailwind token，不硬编码零散 hex（除桌面气泡等特殊项）
- [ ] 主流程页面宽 420px 左右，留白充足
- [ ] 按钮层级清晰（1 Primary）；使用 `Button` / `Pill` / `TextButton`
- [ ] 错误态用 `error-soft`，文案友好
- [ ] 生成中/结果页符合「三步流程」无多余控件
- [ ] 聊天/番茄钟面板与桌宠气泡视觉语言一致（圆角、暖色）
- [ ] 桌面气泡与右键菜单不依赖 Web 主窗口样式

**管理端**
- [ ] 侧边栏导航，单视图展示，非整页堆叠
- [ ] 按视图懒加载 API
- [ ] 表格有空状态与加载态

**官网**
- [ ] 四页导航、页脚一致（见 §15.4）
- [ ] 无开发/演示/internal 文案
- [ ] 功能描述与当前版本一致
- [ ] CTA 指向 `download.html`；系统要求指向 `#requirements`
- [ ] 登录区不同时堆叠 app-icon 与 logo

---

## 19. 跨端一致性

### 19.1 共享 Design Token

官网 `styles.css`、管理端 `admin.css`、客户端 `tailwind.config.js` 的色值必须与 §3 对齐。新增 token 时三处同步更新。

| Token | 客户端 `petory-*` | 官网 / 管理端 CSS 变量 |
|-------|-------------------|------------------------|
| primary | `petory-primary` | `--primary` |
| accent strong | `petory-accent-strong` | `--accent-strong` |
| track | `petory-track` | `--track` |
| error | `petory-error` | `--error` |

圆角阶梯：`--radius-sm` 8px · `--radius` 12px · `--radius-lg` 16px（卡片 / Hero 面板）。

### 19.2 文案语气

| 端 | 人称 | 风格 |
|----|------|------|
| 客户端 | 你 | 温暖、短句；文案集中在 `src/shared/copy/` |
| 官网 | 你 | 与客户端 onboarding 主标语一致 |
| 管理端 | 中性 | 运营用语，可略正式，仍避免英文枚举直出 |

### 19.3 按钮层级（全端）

- 同一视觉区块最多 **1 个** Primary 实心按钮
- 次要操作用描边 Secondary；取消/关闭用 Ghost 或文字链
- 危险操作用 error 色或二次确认，不混在 Primary 旁并列多个实心按钮

### 19.4 空态与错误

- 空列表：一句说明 + 可选次要操作，不留空白容器
- 网络/加载失败：说明原因 +「请稍后再试」，不展示堆栈、JSON、内部 URL 名

---

## 相关文档

- [文档中心](../README.md)
- [维护手册](../operations/MAINTENANCE.md)
- [客户端发布记录](../releases/client/)

---

## 20. 交互状态契约

所有可交互组件都必须实现完整状态，不能只设计默认态和 hover。

| 状态 | 必须表现 |
|------|----------|
| Default | 清楚表达可点击范围与操作名称 |
| Hover | 仅增强层级，不改变布局尺寸 |
| Focus visible | 2-3px 主色柔光环；键盘用户始终可见 |
| Active | 允许轻微缩放，但不得造成内容跳动 |
| Disabled | 降低对比度、禁止点击，并保留不可用原因的上下文 |
| Loading | 保留原按钮宽度，显示忙碌状态，防止重复提交 |
| Error | 在操作附近给出可恢复说明，不只用颜色或 toast |
| Success | 即时反馈；涉及数据变更时同时刷新对应内容 |

- 桌面客户端按钮最小高度 40px；官网与移动端主要触控目标最小高度 44px。
- 图标按钮必须有可访问名称；只用颜色表达选中、成功或错误均不合格。
- 表单提交时首个错误项应可定位，错误信息使用 `role="alert"` 或等价语义。
- Modal / ConfirmDialog 打开后焦点进入弹窗，Escape 可关闭，关闭后焦点回到触发元素。
- 尊重 `prefers-reduced-motion`：关闭位移、循环脉冲和非必要过渡。

## 21. 页面骨架

### 21.1 客户端

1. 标题栏固定，内容区独立滚动，底部操作不应被小窗口裁掉。
2. 页面标题、说明、主体、操作区顺序稳定；主操作位于视觉流末端。
3. 登录和引导页内容宽度不超过 360px；设置、宠物管理等信息页按区块分组。
4. 加载、空态、错误态占用与真实内容相近的空间，避免页面大幅跳动。
5. 每个流程步骤只保留一个主任务；次要操作使用 Secondary、Ghost 或文字链接。

### 21.2 官网

1. 桌面端展示完整导航；小于 640px 时使用可展开菜单，不得直接删除页面入口。
2. Hero 首屏应在常见笔记本高度内同时看到标题、核心 CTA 与产品形象。
3. 功能卡应有明确阅读顺序和差异化信息，不使用完全同权的占位卡堆叠。
4. 下载按钮必须在链接未就绪时呈禁用/加载态，不能保留 `href="#"` 的假跳转体验。
5. 法务页保持 65-75 个汉字的阅读宽度，标题锚点与键盘焦点可用。

### 21.3 管理端

1. 桌面端侧栏固定；窄屏改为可展开导航，不把全部导航横向折行堆在页面顶部。
2. 列表页结构统一为：标题/说明、筛选、表格、分页；刷新动作不得与业务主操作争夺层级。
3. 表格必须支持横向滚动；关键列固定在左侧或移动端转为摘要卡片。
4. 写操作提供进行中与结果反馈；禁用、封禁、删除等高风险操作必须二次确认并明确对象。
5. Toast 只做结果回执，不能替代表单内错误、空态或失败后的恢复入口。

## 22. 页面验收矩阵

| 表面 | 桌面视口 | 窄视口 | 键盘 | 异步/错误 |
|------|----------|--------|------|-----------|
| 客户端登录/注册 | 420×640 | 380×520 | Tab、Enter、协议链接 | 登录失败、维护、注册关闭 |
| 创建桌宠 | 420×560 | 380×520 | 返回、选择、提交 | 上传失败、生成中、生成失败 |
| 聊天/专注/成长 | 320-360px 宽 | 最小窗口 | 输入、关闭、切换 | 空态、额度、网络失败 |
| 设置/宠物管理/指南 | 480×640 | 最小窗口 | 开关、保存、翻页 | 加载、保存失败、确认弹窗 |
| 官网四页 | 1440×900 | 390×844 | 导航、CTA、链接 | 下载清单失败 |
| 管理端 | 1440×900 | 390×844 | 导航、表单、Tab | 登录、列表、写操作失败 |

每次视觉改动至少完成一轮对应矩阵检查，并将有代表性的截图和结论放入 `docs/audits/YYYY-MM-DD/`。
