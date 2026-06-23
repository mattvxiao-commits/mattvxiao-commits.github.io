# ECRM V1.7-0 App Shell 可视化草图

## 1. 本轮修正

本轮已取消旧版“一个页面同时展示 4 个方案、每个方案再并排展示 4 个设备”的矩阵式草图。

当前结构改为：

- 一个 HTML 文件只对应一个方案。
- A/B/C/D 四个方案分别打开查看。
- 每个方案默认展示桌面 / Windows 浏览器效果。
- iPad 横屏、iPad 竖屏、移动端竖屏通过页面内按钮切换。
- 不再把多个方案、多个设备效果同时塞进一个页面。

## 2. 文件说明

```text
docs/prototypes/v1-7-app-shell/scheme-a-current-top-nav.html
docs/prototypes/v1-7-app-shell/scheme-b-left-rail.html
docs/prototypes/v1-7-app-shell/scheme-c-bottom-nav.html
docs/prototypes/v1-7-app-shell/scheme-d-hybrid-responsive.html
docs/prototypes/v1-7-app-shell/styles.css
docs/prototypes/v1-7-app-shell/figma/scheme-a-current-top-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-b-left-rail.svg
docs/prototypes/v1-7-app-shell/figma/scheme-c-bottom-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-d-hybrid-responsive.svg
docs/prototypes/v1-7-app-shell/README.md
```

## 3. 浏览器查看入口

建议分别打开以下文件：

```text
docs/prototypes/v1-7-app-shell/scheme-a-current-top-nav.html
docs/prototypes/v1-7-app-shell/scheme-b-left-rail.html
docs/prototypes/v1-7-app-shell/scheme-c-bottom-nav.html
docs/prototypes/v1-7-app-shell/scheme-d-hybrid-responsive.html
```

每个页面顶部都有方案切换链接，也有视图切换按钮：

- 桌面。
- iPad 横屏。
- iPad 竖屏。
- 移动端。

页面默认打开时显示“桌面 / Windows 浏览器”效果。

## 4. 四个方案

### 4.1 方案 A：当前结构进化版

文件：

```text
scheme-a-current-top-nav.html
```

重点：

- 顶部品牌 + 横向主导航。
- 最接近当前产品结构。
- 改动风险最低。
- 适合作为 V1.7a 低风险基线。

重点评审：

- 顶部导航是否稳定。
- 现场模式状态是否清楚。
- 页面标题区和筛选区是否比当前更规范。
- 窄屏下横向导航是否仍可接受。

### 4.2 方案 B：桌面管理工具版

文件：

```text
scheme-b-left-rail.html
```

重点：

- 桌面端使用左侧窄导航。
- 顶部只承载品牌、摊位、现场模式等状态信息。
- 页面标题区和筛选区进入内容区。
- iPad 竖屏、移动端折叠为顶部横向导航。

重点评审：

- 左侧导航是否更适合长期扩展。
- 现场售卖时是否占用过多商品列表空间。
- iPad 竖屏折叠后的使用感是否自然。

### 4.3 方案 C：现场操作优先版

文件：

```text
scheme-c-bottom-nav.html
```

重点：

- 顶部状态栏 + 底部主导航。
- 更接近 iPad / 移动端现场操作。
- 售卖页突出商品列表、购物车和收款路径。

重点评审：

- 底部导航是否更适合现场操作。
- 购物车入口是否和底部导航冲突。
- 转屏给顾客看收款码时，误触主导航风险是否降低。

### 4.4 方案 D：混合响应式示意

文件：

```text
scheme-d-hybrid-responsive.html
```

重点：

- 桌面使用左侧导航。
- iPad 竖屏和移动端使用底部导航。
- 作为长期产品化方向参考。

重点评审：

- 是否值得承担更高开发成本。
- 多种导航模式是否增加认知负担。
- 是否更适合作为 V1.8 或更后续版本。

## 5. Figma 导入

可将以下 SVG 文件拖入 Figma：

```text
docs/prototypes/v1-7-app-shell/figma/scheme-a-current-top-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-b-left-rail.svg
docs/prototypes/v1-7-app-shell/figma/scheme-c-bottom-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-d-hybrid-responsive.svg
```

说明：

- 每个 SVG 只对应一个方案，默认展示桌面 / Windows 浏览器结构。
- SVG 用于 Figma 查看、标注和轻量编辑。
- 它不是原生 `.fig` 文件。
- 不会自动生成 Auto Layout。
- 不会自动生成 Figma Components。

## 6. 当前阶段不做内容

V1.7-0 仍然只做草图，不做产品实现：

- 不改 `src` 产品运行代码。
- 不改业务逻辑。
- 不改数据库。
- 不改真实路由。
- 不推送远端。

## 7. 下一步

建议评审顺序：

1. 单独打开方案 A，看是否足够作为 V1.7a 低风险基线。
2. 单独打开方案 B，看长期扩展价值是否值得更大改动。
3. 单独打开方案 C，看现场 iPad 操作是否明显更好。
4. 单独打开方案 D，看是否作为长期方向保留。

确认方向后，再写 V1.7 正式中文方案文档。
