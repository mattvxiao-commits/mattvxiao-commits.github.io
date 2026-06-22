# GitHub Pages 长期部署路径方案评估

日期：2026-06-21

## 1. 背景

ECRM 当前采用 GitHub Pages 发布，仓库远端为：

```text
https://github.com/mattvxiao-commits/mattvxiao-commits.github.io.git
```

该仓库命名符合 GitHub Pages 的用户主页站点规则：

```text
<username>.github.io
```

因此当前线上地址为：

```text
https://mattvxiao-commits.github.io/
```

项目通过 `.github/workflows/deploy.yml` 使用 GitHub Actions 自动部署：

- push 到 `main` 触发部署。
- 使用 Node 22 安装依赖。
- 执行 `npm run build`。
- 上传 `dist`。
- 使用 `actions/deploy-pages@v4` 发布到 GitHub Pages。

当前部署方式对单一产品是可用的，但长期如果同一 GitHub 账号下需要发布多个完全不同的产品，继续把 ECRM 放在账号主页根路径会占用唯一的用户主页位置，不利于后续产品矩阵扩展。

## 2. GitHub Pages 站点类型约束

GitHub Pages 主要有两类站点：

- 用户/组织站点：仓库名必须是 `<owner>.github.io`，每个个人账号或组织账号通常只有一个。
- 项目站点：每个普通仓库可以发布一个项目页，默认路径为 `https://<owner>.github.io/<repository-name>/`。

因此，不需要为每个产品注册一个新的 GitHub 账号。长期更合理的模型是：

```text
一个 GitHub 账号
  ├─ 一个用户主页站点：mattvxiao-commits.github.io
  ├─ 一个项目仓库：ecrm-booth-pos
  ├─ 一个项目仓库：product-a
  └─ 一个项目仓库：product-b
```

对应访问路径：

```text
https://mattvxiao-commits.github.io/
https://mattvxiao-commits.github.io/ecrm-booth-pos/
https://mattvxiao-commits.github.io/product-a/
https://mattvxiao-commits.github.io/product-b/
```

后续如果购买并配置自定义域名，还可以将产品页映射为：

```text
https://ecrm.example.com/
https://product-a.example.com/
https://product-b.example.com/
```

## 3. 当前方案的优点与限制

当前方案：

```text
mattvxiao-commits/mattvxiao-commits.github.io
=> https://mattvxiao-commits.github.io/
```

### 优点

- 地址短，当前已经可正常访问。
- Vite 当前资源根路径 `/`、PWA `start_url` 和 `scope` 均适配根路径部署。
- GitHub Actions 部署链路已经建立，不需要额外配置即可继续发布。
- 适合只有一个主产品的早期阶段。

### 限制

- 用户主页根路径被 ECRM 占用。
- 后续如果需要个人主页、品牌主页或产品矩阵入口，需要重新调整部署结构。
- 多产品发布时，每个产品继续使用账号主页是不现实的；一个账号只有一个 `<username>.github.io` 仓库位置。
- ECRM 当前根路径 PWA 安装和缓存策略与未来项目页路径不同，迁移时需要明确处理。

## 4. 路径方案对比

### 路径 A：重命名当前仓库为项目仓库

操作方式：

```text
mattvxiao-commits/mattvxiao-commits.github.io
=> mattvxiao-commits/ecrm-booth-pos
```

部署地址变为：

```text
https://mattvxiao-commits.github.io/ecrm-booth-pos/
```

然后重新创建一个新的：

```text
mattvxiao-commits/mattvxiao-commits.github.io
```

作为账号主页或产品入口页。

优点：

- 仍是同一个 GitHub 仓库对象，commit、tag、issues、stars、Actions 历史通常会保留在同一仓库下。
- ECRM 仓库身份直接转换为产品仓库。
- 不需要复制或迁移 Git 历史。

缺点：

- 原账号主页仓库被重命名后，需要重新创建账号主页仓库。
- 旧的 Pages 根地址不会自动作为产品页重定向，需要单独处理入口页或迁移说明。
- 仍需要调整 Vite、React Router 和 PWA 配置以适配子路径。
- 操作上会让“当前主页仓库”身份发生变化，对同步给开发者的理解成本略高。

适用情况：

- 希望最大程度保留当前仓库对象及其 GitHub 侧历史。
- 不介意重新创建账号主页仓库。

### 路径 B：新建 ECRM 项目仓库并迁移代码

操作方式：

```text
保留：
mattvxiao-commits/mattvxiao-commits.github.io

新建：
mattvxiao-commits/ecrm-booth-pos
```

目标部署结构：

```text
https://mattvxiao-commits.github.io/
=> 账号主页、品牌主页、产品矩阵入口或旧地址说明页

https://mattvxiao-commits.github.io/ecrm-booth-pos/
=> ECRM Booth POS
```

优点：

- 最符合 GitHub Pages 的长期多产品模型。
- 账号主页可以转为长期入口，不再被单一产品占用。
- ECRM 拥有独立产品仓库，边界清晰。
- 后续每个产品都可以复制同样模式：一个产品一个仓库、一个项目页、一个独立 Actions 部署流程。
- 旧仓库可以保留为历史说明、跳转入口和产品矩阵页。
- 对未来绑定自定义域名更自然。

缺点：

- 新仓库的 Actions 历史从迁移后第一次运行开始，不会继承旧仓库的 workflow run 页面。
- 需要通过 Git 方式迁移代码和版本历史，确保 commit/tag 保留。
- 需要调整 Vite、React Router 和 PWA 配置以适配项目页子路径。
- 已安装旧根路径 PWA 的用户可能需要访问新地址并重新安装或重新缓存。

适用情况：

- 长期会在同一 GitHub 账号下发布多个不同产品。
- 希望账号主页承担产品入口或品牌入口职责。
- 希望 ECRM 产品仓库与主页仓库职责分离。

### 路径 C：保持当前仓库结构并绑定自定义域名

操作方式：

```text
mattvxiao-commits/mattvxiao-commits.github.io
=> https://ecrm.example.com/
```

优点：

- 当前仓库和部署结构基本不变。
- Actions 历史、仓库历史、当前根路径配置都不需要大幅调整。
- 真实用户访问产品域名，不必关注 `github.io` 地址。
- 对短期对外使用较平滑。

缺点：

- 账号主页仓库仍然被 ECRM 占用。
- 后续做产品矩阵入口时仍需要重新规划。
- 如果多个产品都要清晰分离，最终仍会走向项目仓库或独立部署平台。
- 需要购买或管理域名。

适用情况：

- 短期已有用户使用根路径，不希望立即改 URL。
- 需要快速让产品看起来更正式，但暂不整理多产品仓库结构。

## 5. Actions 历史与版本记录处理

GitHub Actions 的 workflow run 记录是仓库级自动化运行记录，不是产品版本档案。

它记录的是：

- 哪个仓库。
- 哪个 workflow。
- 哪个 commit。
- 什么时候运行。
- 成功或失败。
- 当时的日志与 artifact。

迁移时不需要、也不应补跑历史 workflow。

### 不同路径下的 Actions 处理

| 路径 | 旧 Actions runs | 新 Actions runs | 是否需要补跑历史 |
| --- | --- | --- | --- |
| 路径 A：重命名当前仓库 | 通常保留在同一仓库对象下 | 继续在同一仓库产生 | 不需要 |
| 路径 B：新建项目仓库迁移代码 | 留在旧主页仓库 | 新项目仓库从第一次部署开始产生 | 不需要 |
| 路径 C：保持当前仓库并绑定域名 | 不变 | 不变 | 不需要 |

### 长期版本记录应依赖的对象

正式产品版本记录应使用：

- Git commits。
- Git tags，例如 `v1.5.4`、`v1.6.0`。
- GitHub Releases，如后续需要面向用户发布正式版本说明。
- `CHANGELOG.md`，如后续需要集中维护版本变化。
- `docs/releases` 和 `docs/specs` 中的交付与方案记录。

Actions logs 和 artifacts 有保留期，不应作为永久版本档案。重要迁移信息应写入仓库文档，而不是依赖 Actions 页面长期可查。

## 6. 最终推荐路径

推荐采用路径 B：

```text
保留账号主页仓库：
mattvxiao-commits/mattvxiao-commits.github.io

新建 ECRM 项目仓库：
mattvxiao-commits/ecrm-booth-pos
```

最终结构：

```text
https://mattvxiao-commits.github.io/
=> 个人主页、品牌主页、产品矩阵入口、旧地址说明页

https://mattvxiao-commits.github.io/ecrm-booth-pos/
=> ECRM Booth POS
```

选择路径 B 的原因：

- 它最符合一个 GitHub 账号发布多个产品的长期模型。
- 它把账号主页和具体产品仓库解耦。
- 它避免未来每新增一个产品就重新思考主页归属。
- 它允许当前主页仓库平滑转型为入口页，而不是被删除或重命名后再补建。
- 它让 ECRM 的代码、版本、部署、issue 和后续 release 都集中在产品仓库中。

## 7. 建议迁移节奏

建议不要在功能开发过程中顺手迁移部署结构，而是作为独立任务执行。

推荐节奏：

1. 当前阶段继续使用根路径部署，保证 ECRM 功能稳定。
2. 在迁移前冻结一个明确版本，作为用户主页部署阶段最后版本。
3. 为迁移前版本打 tag，并在 `docs/releases` 中记录。
4. 新建 `mattvxiao-commits/ecrm-booth-pos` 仓库。
5. 使用保留 Git 历史的方式迁移代码和 tag。
6. 修改项目页部署相关配置。
7. 将 ECRM 发布到 `https://mattvxiao-commits.github.io/ecrm-booth-pos/`。
8. 将 `https://mattvxiao-commits.github.io/` 调整为入口页或迁移说明页。
9. 发布迁移后首个版本，例如 `v1.6.x` 或后续 minor 版本。

## 8. 迁移时需要修改的技术点

当前 ECRM 适配根路径部署。迁移到项目页时，需要至少检查以下配置：

### Vite base

项目页部署需要设置子路径：

```ts
base: "/ecrm-booth-pos/"
```

### React Router basename

当前使用 `BrowserRouter`。项目页部署后需要设置 basename：

```tsx
<BrowserRouter basename="/ecrm-booth-pos">
  <App />
</BrowserRouter>
```

### PWA manifest

当前 PWA 配置使用根路径：

```ts
start_url: "/",
scope: "/",
```

项目页部署后应调整为：

```ts
start_url: "/ecrm-booth-pos/",
scope: "/ecrm-booth-pos/",
```

### README 和用户文档

需要同步更新：

- 在线访问地址。
- PWA 安装说明。
- 旧地址说明。
- 跨设备使用说明。
- 缓存更新说明。

### 旧地址处理

迁移后应避免让旧根地址直接空置。推荐将根地址改为入口页或迁移说明页，至少包含：

- ECRM 新地址。
- 当前推荐访问路径。
- 已安装旧 PWA 的处理建议。
- 后续其他产品入口预留。

## 9. 迁移风险与应对

### 风险：资源路径错误导致白屏

应对：

- 在迁移分支中先执行本地 build。
- 检查 `dist/index.html` 中 JS/CSS 路径是否带有 `/ecrm-booth-pos/`。
- 部署后在无缓存浏览器中验证。

### 风险：BrowserRouter 子路径刷新 404

应对：

- 设置 `basename`。
- 验证主要页面直接刷新。
- 如 GitHub Pages 对深层路径刷新仍有问题，再评估是否需要 404 回退页或改用 HashRouter。

### 风险：PWA 缓存仍指向旧根路径

应对：

- README 和入口页明确提示访问新地址。
- 发布迁移后版本时说明旧 PWA 可能需要重新安装。
- 在迁移说明页提醒用户先导出 JSON 备份。

### 风险：开发者误以为 Actions 历史需要迁移

应对：

- 明确记录：Actions runs 不迁移、不补跑。
- 产品版本历史以 Git tag、release 文档和仓库文档为准。

## 10. 决策结论

长期方案采用路径 B：

```text
新建 ECRM 项目仓库，迁移代码和 Git 历史；
保留当前用户主页仓库，转为产品矩阵入口或迁移说明页。
```

迁移后，ECRM 的正式发布地址应从：

```text
https://mattvxiao-commits.github.io/
```

调整为：

```text
https://mattvxiao-commits.github.io/ecrm-booth-pos/
```

当前根地址保留为长期入口：

```text
https://mattvxiao-commits.github.io/
```

Actions 历史不作为迁移目标。迁移前后的版本边界应通过 Git tag、release 记录和文档明确表达。
