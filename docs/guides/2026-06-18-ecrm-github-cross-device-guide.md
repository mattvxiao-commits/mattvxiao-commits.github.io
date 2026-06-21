# ECRM GitHub 与跨设备使用方案

## 文档目标

本文档用于指导 ECRM V1.5.0 从本机正式版本进入 GitHub 托管、HTTPS 访问、Windows/macOS/iPad 真实设备验收。

当前目标不是云同步，也不是 App Store 原生应用分发，而是：

- 把代码安全地保存到 GitHub。
- 使用免费 HTTPS 静态托管，让 iPad 可以通过 Safari 添加到主屏幕。
- 在 Windows、macOS、iPad 上访问同一个 ECRM 站点。
- 保持本机离线可用。
- 通过 JSON 备份完成设备间数据迁移。

## 当前项目状态

- 当前正式版本 tag：`v1.5.0`
- 当前主分支：`main`
- 技术栈：Vite、React、TypeScript、Dexie、IndexedDB、vite-plugin-pwa。
- 应用数据保存在浏览器 IndexedDB。
- JSON 备份 version 4 已包含商品、设置、促销、订单、订单明细、库存流水、退款记录、商品图和收款码图片。
- 当前没有云端数据库，没有多设备自动同步。

## 关键结论

### iPad 不需要 Apple 开发者账号

当前 ECRM 走 PWA 路线，不走 iOS 原生 App 路线。因此不需要：

- Apple Developer Program。
- 证书签名。
- TestFlight。
- App Store 上架。
- 单独打包 iPad App。

iPad 需要的是：

- 使用 Safari 打开 HTTPS 网站。
- 通过分享菜单添加到主屏幕。
- 首次打开和安装时需要联网。
- 离线使用前必须先成功加载过站点，并让 PWA service worker 缓存静态资源。

### HTTPS 不一定需要自有服务器

GitHub Pages 可以托管静态 HTML、CSS、JavaScript，并提供 HTTPS。ECRM 是纯前端静态站点，适合这种托管方式。

不需要：

- 自购云服务器。
- 自购域名。
- 自建 Nginx。
- 自建 HTTPS 证书。

需要：

- 一个 GitHub 账号。
- 一个 GitHub 仓库。
- 一次 Pages 部署配置。

### 不建议当前阶段做云同步

V1.5.0 的数据模型已经能支持本机摆摊使用，但多设备实时同步会引入新的复杂问题：

- 多设备同时开单时订单号冲突。
- 商品库存冲突。
- 离线后重新联网的数据合并规则。
- 退款、作废、库存流水的一致性。
- 用户误操作后的恢复策略。

当前建议仍然是：一台主设备负责现场售卖，其他设备只做备份验收或备用。

## 推荐方案

### 方案 A：GitHub Pages 用户主页仓库，推荐

使用仓库名：

```text
你的GitHub用户名.github.io
```

部署后访问地址：

```text
https://你的GitHub用户名.github.io/
```

优点：

- URL 在域名根路径 `/`。
- 与当前 ECRM PWA 配置最匹配。
- 不需要修改 `vite.config.ts` 的 `base`。
- 不需要修改 PWA `start_url` 和 `scope`。
- iPad 添加到主屏幕后路径最稳定。

缺点：

- 一个 GitHub 用户通常只有一个用户主页仓库。
- 如果以后还想用同一个 GitHub 账号做个人主页，需要重新规划。

结论：

这是当前最省时间、最少改代码、最适合三天内真实设备验收的方案。

### 方案 B：GitHub Pages 项目仓库，需要少量代码配置

仓库名例如：

```text
ECRM
```

部署后访问地址：

```text
https://你的GitHub用户名.github.io/ECRM/
```

当前代码的 PWA 配置偏向根路径 `/`。如果走项目仓库，需要后续增加配置：

- Vite `base: "/ECRM/"`。
- PWA `start_url: "/ECRM/"`。
- PWA `scope: "/ECRM/"`。
- HTML icon 路径改为适配子路径。

优点：

- 仓库名可以保留为 `ECRM`。
- 不占用用户主页仓库。

缺点：

- 需要额外改配置并重新验证。
- PWA 子路径部署更容易遇到资源路径、service worker scope、离线缓存问题。

结论：

可行，但不适合作为第一轮真实设备验收方案。

### 方案 C：Vercel、Netlify、Cloudflare Pages

这些平台也能免费提供 HTTPS 静态托管。

优点：

- 通常能自动识别 Vite 构建。
- 自定义域名和预览部署体验更好。
- 可以部署到站点根路径。

缺点：

- 需要额外注册平台账号。
- 后续维护界面和概念比 GitHub Pages 多。

结论：

如果 GitHub Pages 卡住，可作为备选方案。当前第一推荐仍是 GitHub Pages 用户主页仓库。

## 推荐执行路线

### 第 1 步：注册或登录 GitHub

1. 打开 GitHub 官网。
2. 注册账号或登录已有账号。
3. 记录你的 GitHub 用户名。
4. 确认邮箱已验证。

后续示例用：

```text
yourname
```

代表你的 GitHub 用户名。

### 第 2 步：创建用户主页仓库

在 GitHub 创建新仓库：

```text
yourname.github.io
```

推荐设置：

- Visibility：Private 或 Public 均可先按你的偏好选择。
- 如果使用 GitHub Free 且需要 GitHub Pages，公开仓库通常最简单。
- 不勾选初始化 README，避免和本地项目冲突。

### 第 3 步：把本地代码推到 GitHub

在本机项目目录：

```powershell
cd D:\Projects\ECRM
```

确认当前状态：

```powershell
git status --short --branch
git tag --list
```

添加远程仓库：

```powershell
git remote add origin https://github.com/yourname/yourname.github.io.git
```

推送主分支：

```powershell
git push -u origin main
```

推送正式版本 tag：

```powershell
git push origin v1.5.0
```

如果提示需要登录：

- 按 GitHub 浏览器登录提示操作。
- 或使用 GitHub Desktop 完成远程发布。
- 不建议把 GitHub token 写入文档或聊天记录。

### 第 4 步：配置 GitHub Pages 自动部署

推荐使用 GitHub Actions 构建并发布 Vite 静态站点。

需要新增文件：

```text
.github/workflows/deploy.yml
```

推荐工作流内容：

```yaml
name: Deploy ECRM to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

GitHub 仓库页面中还需要检查：

1. 打开仓库 Settings。
2. 打开 Pages。
3. Source 选择 GitHub Actions。
4. 等待 Actions 执行成功。
5. 打开 Pages 给出的 HTTPS 地址。

### 第 5 步：Windows 验收

在 Windows 上打开：

```text
https://yourname.github.io/
```

验收内容：

- 页面能打开。
- 商品管理可新增商品。
- 图片可上传并显示。
- 售卖页可加入购物车。
- 设置页可导出 JSON 备份。
- 设置页可导出订单 Excel。
- 刷新页面后数据仍在。
- 断网后刷新可能依赖缓存状态，建议先在线完整打开一次，再做离线测试。

### 第 6 步：macOS 验收

在 Mac 上打开同一个地址：

```text
https://yourname.github.io/
```

验收内容：

- Safari、Chrome 至少选一个浏览器验证。
- 如使用 Safari 且 macOS 支持，可添加到 Dock 作为 Web App。
- 导入 Windows 导出的 JSON 备份。
- 验证商品、图片、收款码、订单、库存流水是否恢复。
- 新建一笔测试订单。
- 再导出一份 JSON 备份。

### 第 7 步：iPad 验收

首次安装必须联网。

步骤：

1. 在 iPad 打开 Safari。
2. 访问：

```text
https://yourname.github.io/
```

3. 等页面完整加载。
4. 点击分享按钮。
5. 选择“添加到主屏幕”。
6. 如系统提供“作为 Web App 打开”选项，保持开启。
7. 点击添加。
8. 从主屏幕图标打开 ECRM。
9. 导入从 Windows 或 Mac 导出的 JSON 备份。
10. 验证商品、图片、收款码、设置、订单、库存是否恢复。
11. 开启飞行模式。
12. 从主屏幕重新打开 ECRM。
13. 完成一笔测试开单。
14. 确认订单保存、库存扣减、仪表盘更新。

## 数据迁移规则

### 单设备主用

推荐摆摊当天只指定一台主设备开单，例如 iPad。

原因：

- 当前没有云同步。
- 多台设备各自开单会产生不同的本地数据库。
- 后续无法自动合并多个设备的订单、库存流水和退款记录。

### 设备迁移

从设备 A 迁移到设备 B：

1. 在设备 A 设置页导出 JSON 备份。
2. 把 JSON 文件传到设备 B。
3. 在设备 B 打开同一个 ECRM HTTPS 地址。
4. 设置页导入 JSON 备份。
5. 确认商品、图片、收款码、订单、库存、设置恢复。
6. 从此之后只在设备 B 继续开单。

### 备份频率

建议：

- 摆摊前导出一次。
- 摆摊中午或销售高峰后导出一次。
- 摆摊结束后立即导出一次。
- 每次大量修改商品、促销、收款码后导出一次。

文件命名建议：

```text
ecrm-backup-2026-06-18-before-booth.json
ecrm-backup-2026-06-18-noon.json
ecrm-backup-2026-06-18-after-booth.json
```

## 离线使用边界

离线可用的前提：

- 当前设备已经在线打开过 ECRM。
- PWA 静态资源已经被缓存。
- 浏览器没有清除该站点数据。
- 没有卸载主屏幕 Web App。
- 没有切换到另一个浏览器或另一个域名。

会导致数据不可见或丢失的操作：

- 清除 Safari/Chrome 网站数据。
- 删除主屏幕 Web App，并同时清掉站点数据。
- 换浏览器。
- 换 GitHub Pages 地址。
- 用另一个设备打开但未导入备份。

## 版本更新与缓存处理

ECRM 是离线优先 PWA。线上部署新版本后，旧页面可能仍在使用已缓存的应用资源，这是 PWA 的正常更新机制，不代表业务数据丢失。

当前版本检测到新应用资源时，会在页面顶部显示“发现新版本”提示：

1. 空闲时点击“刷新更新”。
2. 页面刷新后重新进入应用。
3. 商品、订单、库存、收款码和设置仍保存在当前设备 IndexedDB 中，不会因为应用资源更新而清空。

如果 GitHub Actions 已显示部署成功，但设备上仍看到旧界面，可以依次处理：

1. 点击应用内“刷新更新”提示。
2. 关闭当前页面后重新打开线上地址。
3. 在浏览器中手动刷新。
4. iPad 主屏幕 Web App 未更新时，先联网打开 Safari 中的同一地址，再重新打开主屏幕图标。
5. 仍异常时，再检查浏览器网站数据和 PWA 安装状态。

不要通过清除网站数据来处理普通版本更新。清除网站数据会导致当前设备 IndexedDB 中的本地业务数据不可见，除非已经提前导出 JSON 备份。

## GitHub Pages 注意事项

### 仓库公开性

GitHub Free 对 GitHub Pages 的可用性和公开/私有仓库策略可能随账号类型变化。为了减少配置阻碍，第一版建议用公开仓库部署。

如果担心源码公开：

- 先用临时公开仓库完成验收。
- 后续再评估私有仓库 Pages、Vercel、Netlify、Cloudflare Pages 或自有部署。

### 不要上传敏感真实数据

代码仓库不应该包含：

- 真实订单 JSON 备份。
- 真实顾客信息。
- 真实收款码原图。
- GitHub token。
- 任何账号密码。

ECRM 的业务数据在浏览器 IndexedDB 和本地导出的 JSON 备份中，不应该提交进 Git。

### Pages 部署延迟

推送后 GitHub Actions 需要一段时间构建和发布。一般等待 1-3 分钟，再刷新 Pages 地址。

如果页面 404：

- 检查 Actions 是否成功。
- 检查 Pages Source 是否选择 GitHub Actions。
- 检查仓库名是否为 `yourname.github.io`。
- 检查浏览器缓存。

## 后续可选优化

### 路径适配

如果后续想用项目仓库 `ECRM` 而不是用户主页仓库，需要增加子路径配置：

- Vite `base`。
- PWA `start_url`。
- PWA `scope`。
- HTML 图标资源路径。

这建议作为单独小版本处理，不混入当前真实设备验收。

### 首屏体积优化

当前 Excel 导出依赖会增加前端包体积。后续可把 Excel 导出改成点击时按需加载：

```ts
const { exportOrderExcel } = await import("../utils/orderExcelExport");
```

这样可以降低首屏主包体积。

### 云同步

云同步应作为独立大版本规划，至少需要先定义：

- 订单编号全局唯一规则。
- 多设备库存冲突规则。
- 离线写入和联网合并规则。
- 退款/作废/库存流水同步规则。
- 数据备份和回滚策略。

当前不建议在 V1.x 快速验收阶段引入。

## 官方资料

- GitHub Pages 是静态站点托管服务，可发布 HTML、CSS、JavaScript。
  - https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- GitHub Pages 可通过 GitHub Actions 作为发布来源。
  - https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- GitHub Pages 支持 HTTPS，并可强制 HTTPS。
  - https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- GitHub Pages 有站点大小、构建时间、带宽等限制。
  - https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Apple 官方说明 iPad Safari 可将网站添加到主屏幕，并可作为 Web App 打开。
  - https://support.apple.com/guide/ipad/bookmark-a-website-ipadc602b75b/ipados
- Apple 官方说明 macOS Safari 可将网页添加到 Dock 作为 Web App。
  - https://support.apple.com/en-us/104996
- MDN 说明 PWA 安装依赖 Web App Manifest，离线体验依赖 Service Worker。
  - https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
  - https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest
  - https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
