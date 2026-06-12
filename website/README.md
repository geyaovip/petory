# Petory 官网（静态站）

## 本地预览

```bash
npm run website:preview
```

浏览器打开 http://localhost:5180

## 部署

Cloudflare Pages 项目名为 `petory`，已连接 GitHub 仓库
`geyaovip/petory`。`main` 分支更新后会自动部署 `website/` 到：

- 正式域名：`https://petory.chat`
- Pages 域名：`https://petory.pages.dev`

Pages 构建设置：框架预设为 `None`，构建命令留空，输出目录为 `website`。
`main` 推送后自动部署，无需额外操作。

更新 logo 后运行 `npm run sync:brand`，一并提交 `brand/generated/` 与 `website/` 中的图标文件。

## 发布流程

1. 打包应用：`npm run pack:mac` / `npm run pack:win`
2. 同步下载清单：`npm run release:sync`
3. 上传 `release/` 中的安装包到 GitHub Releases 或 CDN
4. 上传 `release/latest*.yml` 到 `https://petory.chat/releases/`（供 electron-updater 使用）
5. 部署 `website/` 静态站

## 自动更新 Feed

`electron-updater` 从 `UPDATE_FEED_URL`（默认 `https://petory.chat/releases`）读取 `latest-mac.yml` / `latest.yml`。

打包后这些文件在 `release/` 目录，与安装包一起上传即可。
