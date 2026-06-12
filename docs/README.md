# Petory 文档中心

这里是 Petory 的唯一文档入口。文档按用途归档，不再把早期路线、客户端交付和服务端交付混在同一层。

## 当前文档

| 分类 | 入口 | 维护原则 |
|------|------|----------|
| 产品 | [product/FEATURES.md](./product/FEATURES.md) · [product/BACKLOG.md](./product/BACKLOG.md) | 只描述当前能力和下一步工作 |
| 设计 | [design/UI-GUIDELINES.md](./design/UI-GUIDELINES.md) | 三端 UI、交互与无障碍的唯一规范 |
| 服务端 | [backend/README.md](./backend/README.md) | API、数据库、管理端和部署说明 |
| 开发 | [development/DOCKER-DEV.md](./development/DOCKER-DEV.md) | 本地环境与联调 |
| 运维 | [operations/MAINTENANCE.md](./operations/MAINTENANCE.md) | 日常维护、发布和故障处理 |
| 质量 | [quality/QA-INTERNAL.md](./quality/QA-INTERNAL.md) | 自动化与人工验收清单 |
| UI 审查 | [audits/](./audits/) | 按日期保存审查结论和证据截图 |

## 发布记录

- [客户端 C2.x](./releases/client/)：Electron 客户端各阶段交付说明。
- [服务端 B1.x](./releases/server/)：API 与管理端各阶段交付说明及后续路线。
- [早期 v0.x-v1.x 路线归档](./archive/roadmap-v0/)：仅用于追溯历史，不代表当前计划。

## 放置规则

1. 当前行为以代码、product/FEATURES.md 和对应运维文档为准。
2. 一次发布的冻结说明放到 releases/client/ 或 releases/server/，不在根目录新增版本文件。
3. 已失效但仍有追溯价值的内容放到 archive/，并在文件开头标注历史状态。
4. UI 变更必须同步检查 design/UI-GUIDELINES.md；部署变更必须同步检查 backend/DEPLOY.md。
5. 新文档先归类，再从本页或子目录索引链接，避免形成新的散落入口。
