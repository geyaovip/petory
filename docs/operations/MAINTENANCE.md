# Petory Maintenance Guide

这份文档是给后续维护者看的操作约定，目标是让仓库长期保持“入口清楚、发布清楚、改动不互相踩”。

## 我们怎么理解这个仓库

Petory 是一个 Electron 桌面应用，仓库里同时放了客户端、服务端、官网和发布清单。不要把它当成单页前端项目，也不要把服务端和官网混成一套部署逻辑。

## 目录职责

| 路径 | 职责 |
|------|------|
| `src/renderer/` | React 渲染层 |
| `src/shared/` | 客户端与主进程共享的类型、常量、文案、规则 |
| `electron/` | 主进程、预加载、窗口、更新、图片流水线 |
| `server/` | 后台 API、管理端静态资源、Prisma、种子脚本 |
| `website/` | 官网与下载页静态站 |
| `docs/` | 产品、架构、版本、部署文档 |
| `scripts/` | 构建、发布、校验脚本 |
| `deploy/` | 生产环境编排、环境模板与部署说明 |

## 文件格式习惯

1. 目录优先有一个索引文件，通常叫 `README.md`。
2. 文档先给结论，再给表格或清单，最后给链接。
3. 版本说明、部署说明、产品说明分开，不把所有内容堆进一个超长 README。
4. 对外可见的域名、下载地址、更新 feed 只保留一个明确来源，避免散点硬编码。

## 发布与部署的单一事实来源

| 项目 | 主要来源 |
|------|----------|
| 官网域名 | `src/shared/constants.ts` |
| 更新清单 | `scripts/sync-release-manifest.mjs` |
| 官网下载 manifest | `website/releases/latest.json` |
| 自动更新 feed | `src/shared/constants.ts` + `electron/main/updateService.ts` |
| 管理端部署 | `docs/backend/DEPLOY.md` |
| 云服务器部署 | `deploy/server/README.md` |
| GitHub 反馈入口 | `PETORY_GITHUB_ISSUES_URL` / `PETORY_GITHUB_REPO` |

## 维护顺序建议

1. 先改 `src/shared/` 里的常量、类型和文案。
2. 再改 `electron/` 或 `server/` 的实现。
3. 最后同步 `docs/`、`website/`、发布清单和 README。
4. 如果涉及域名或下载链接，记得一起检查 `website/releases/latest.json` 和构建脚本。

## 不要再做的事

- 不要把构建产物当成源码提交思路。
- 不要在多个地方重复写同一个域名或发布地址。
- 不要把客户端、服务端、官网混成一份部署说明。
