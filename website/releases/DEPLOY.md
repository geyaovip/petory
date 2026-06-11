# Petory 发布与更新通道

## 推荐：GitHub Actions 自动发布

推送版本 tag 后，`.github/workflows/release.yml` 会自动：

1. 在 `macos-latest` 构建 Universal `.dmg`
2. 在 `windows-latest` 构建 x64 `Petory-Setup-{version}.exe`
3. 创建 [GitHub Release](https://github.com/geyaovip/petory/releases) 并上传安装包
4. 更新 `website/releases/latest.json`、`latest-mac.yml`、`latest.yml` 并推回 `main`

```bash
# 1. 确认 package.json 版本号
# 2. 提交代码后打 tag
git tag v2.4.0
git push origin v2.4.0

# 或在 GitHub Actions 页面手动 Run workflow（workflow_dispatch）
```

发布完成后，`latest.json` 中的 macOS / Windows 下载链接会指向 GitHub Release 资源。

### 可选：镜像安装包到 API 服务器

若希望安装包从 `https://api.petory.chat/downloads/` 分发（例如 mac 走国内 VPS CDN）：

```bash
scp release/Petory-*.dmg release/Petory-Setup-*.exe \
  ubuntu@165.154.203.52:/home/ubuntu/apps/petory/current/deploy/server/downloads/

# 仅 mac 走 API、Windows 仍走 GitHub：
npm run release:prepare

# mac + win 都走 API：
PETORY_RELEASE_ASSET_BASE= PETORY_HOST_WIN_ON_API=1 npm run release:prepare
```

## 本地打包（开发/应急）

```bash
npm run typecheck
npm run qa

# macOS（本机架构）
npm run pack:mac

# macOS Universal
npm run build && npx electron-builder --mac --universal

# Windows x64（建议在 windows-latest CI 或 Windows 机器上构建）
npm run pack:win
```

产物在 `release/` 目录。

## 同步官网与更新清单

```bash
npm run release:prepare
```

会执行：

- `release:sync` → 更新 `website/releases/latest.json`
- `copy-update-feed` → 将 `release/latest*.yml` 复制到 `website/releases/`

环境变量：

| 变量 | 说明 |
|------|------|
| `PETORY_RELEASE_ASSET_BASE` | 安装包基础 URL（CI 设为 GitHub Release 地址） |
| `PETORY_DOWNLOAD_BASE_URL` | API 下载目录，默认 `https://api.petory.chat/downloads` |
| `PETORY_HOST_WIN_ON_API` | 设为 `1` 时 Windows 安装包也走 API |

## 部署到 petory.chat

`website/` 随 `main` 推送到 GitHub 后，Cloudflare Pages 自动部署。

| 路径 | 内容 |
|------|------|
| `/releases/latest.json` | 下载页读取 |
| `/releases/latest-mac.yml` | macOS 自动更新 |
| `/releases/latest.yml` | Windows 自动更新 |

`electron-updater` 默认读取 `https://petory.chat/releases`。

## 发布后验收

- [ ] GitHub Release 页面有 `.dmg` 与 `.exe`
- [ ] 下载页显示正确版本号与可点击链接
- [ ] `latest-mac.yml` / `latest.yml` 返回 YAML 而非 HTML
- [ ] 设置 → 检查更新 能发现新版本
