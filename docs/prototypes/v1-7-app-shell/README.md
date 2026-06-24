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
docs/prototypes/v1-7-app-shell/hybrid-desktop.html
docs/prototypes/v1-7-app-shell/hybrid-mobile.html
docs/prototypes/v1-7-app-shell/hybrid-real-shell.css
docs/prototypes/v1-7-app-shell/hybrid-real-shell.js
docs/prototypes/v1-7-app-shell/top-nav-desktop.html
docs/prototypes/v1-7-app-shell/scheme-a-current-top-nav.html
docs/prototypes/v1-7-app-shell/scheme-b-left-rail.html
docs/prototypes/v1-7-app-shell/scheme-c-bottom-nav.html
docs/prototypes/v1-7-app-shell/scheme-d-hybrid-responsive.html
docs/prototypes/v1-7-app-shell/styles.css
docs/prototypes/v1-7-app-shell/figma/top-nav-desktop-real-shell.svg
docs/prototypes/v1-7-app-shell/figma/hybrid-desktop-real-shell.svg
docs/prototypes/v1-7-app-shell/figma/scheme-a-current-top-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-b-left-rail.svg
docs/prototypes/v1-7-app-shell/figma/scheme-c-bottom-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-d-hybrid-responsive.svg
docs/prototypes/v1-7-app-shell/README.md
```

## 3. 方案 D 实操草图入口

在确认倾向“方案 D：混合响应式示意”后，新增一套更接近真实产品的实操草图。

这套草图只保留两个入口：

```text
docs/prototypes/v1-7-app-shell/hybrid-desktop.html
docs/prototypes/v1-7-app-shell/hybrid-mobile.html
```

规则：

- 桌面版使用固定窄侧边导航菜单，不再提供展开 / 收起功能。
- 移动端使用底部导航菜单。
- 页面打开后不再显示 A/B/C/D 方案切换。
- 页面打开后不再显示桌面、iPad 横屏、iPad 竖屏、移动端四类设备切换按钮。
- 桌面版菜单固定为“模式 / 商品 / 售卖 / 订单 / 数据 / 设置”，图标在上、两字中文在下。
- “模式”不是可进入页面，只作为现场模式状态提示入口；默认显示“未锁定”，开启现场模式后显示“现场模式”，点击后在侧栏旁显示 3 秒状态提示。
- 商品、售卖、订单、数据、设置等菜单可以通过真实产品式导航切换。
- `hybrid-desktop.html` 已补充主要弹窗和子页面原型：新增商品、编辑商品、复制商品、购物车、去收款、订单详情、现场模式 PIN 弹窗、运营赠礼 / 人工赠送 / 其他出库选择弹窗。
- 这些交互只服务 UI/UE 验证，新增商品、购物车、下单和出库数据只保存在当前页面内存中，刷新后恢复为原型初始数据。
- 可在“设置 / 备份与恢复”中导入 ECRM JSON 备份用于当前草图预览；该导入只影响当前 HTML 页面，不会覆盖正式产品 IndexedDB 数据。
- 商品表单新增“系列（筛选）”字段，默认为空；同时补齐 SPU 编码、SKU 编码和只读完整商品编码预览。
- 当可售商品中存在 2 个及以上不同系列时，售卖页会在 SPU 筛选上方显示系列筛选。
- 购物车展开按正式版抽屉结构表达，收款页按正式版“本单复核 + 收款确认”结构表达。
- 订单页采用两列列表预览，最新订单显示在第一行右侧；订单详情补齐基本信息、售后记录、商品明细、库存摘要、库存流水和订单操作模块。
- 数据页补齐经营概览、销售库存、成本毛利、活动成本、非销售出库、库存异常等正式版高优先级复盘内容。
- 设置页现场模式补齐两次 PIN 输入、锁定范围多选展示、更新 PIN、立即重新锁定、关闭现场模式等入口。

建议先看：

1. `hybrid-desktop.html`：确认桌面左侧导航、顶部状态栏和各页面首屏结构。
2. `hybrid-mobile.html`：确认移动端底部导航、首屏密度和购物车区域占位。

## 4. 顶部导航压缩实操草图入口

为对比当前顶部导航方案的压缩改法，新增一版桌面 HTML：

```text
docs/prototypes/v1-7-app-shell/top-nav-desktop.html
```

规则：

- 只做桌面版，不做移动端版。
- 保留顶部品牌区和顶部主导航。
- 各页面移除导航下方的大标题、英文标题和说明文字。
- 商品页商品统计与列表左移。
- 售卖页 SPU 筛选区左移。
- 仪表盘日期筛选和统计口径筛选水平对齐。
- 设置页现场模式模块提升到最高，保存设置按钮下移到现场模式与下方设置模块之间。

## 5. A/B/C/D 方案对比入口

以下文件保留为前一轮方案对比稿，用于回看不同方向。正式评审方案 D 实操效果时，优先使用上方两个 `hybrid-*` 文件。

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

## 6. 四个方案

### 6.1 方案 A：当前结构进化版

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

### 6.2 方案 B：桌面管理工具版

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

### 6.3 方案 C：现场操作优先版

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

### 6.4 方案 D：混合响应式示意

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

## 7. Figma 导入

可将以下 SVG 文件拖入 Figma：

```text
docs/prototypes/v1-7-app-shell/figma/top-nav-desktop-real-shell.svg
docs/prototypes/v1-7-app-shell/figma/hybrid-desktop-real-shell.svg
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

## 8. 当前阶段不做内容

V1.7-0 仍然只做草图，不做产品实现：

- 不改 `src` 产品运行代码。
- 不改业务逻辑。
- 不改数据库。
- 不改真实路由。
- 不把原型内的新增、下单、出库、导入预览写入正式产品 IndexedDB。
- 不推送远端。

## 9. 下一步

建议评审顺序：

1. 打开 `top-nav-desktop.html`，检查顶部导航压缩版是否解决空间浪费。
2. 打开 `hybrid-desktop.html`，检查方案 D 左侧导航修正版。
3. 打开 `hybrid-mobile.html`，检查移动端底部导航和四个菜单首屏。
4. 在设置页导入 JSON 备份，检查真实商品、订单、仪表盘数据密度。
5. 确认 V1.7 正式实现采用顶部导航压缩版，还是方案 D 混合壳层。

确认方向后，按以下中文实施规格进入 V1.7 正式开发：

```text
docs/superpowers/specs/2026-06-24-ecrm-v1-7-app-shell-implementation-spec.md
```
