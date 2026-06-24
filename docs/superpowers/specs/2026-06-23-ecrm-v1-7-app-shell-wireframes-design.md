# ECRM V1.7-0 App Shell 可视化草图设计方案

## 1. 背景

V1.6.4 已完成仪表盘复盘结构整理，并修复了窄屏状态下顶部导航被撑高的问题。下一阶段计划进入 V1.7 全局 UI 壳层改版。由于 V1.7 会影响顶部品牌区、主导航、页面标题区、现场模式入口、窄屏与 iPad 基础布局，如果直接进入代码实现，容易在视觉方向和响应式结构上反复返工。

V1.7-0 是 V1.7 正式开发前的可视化草图阶段，用于先比较不同 App Shell 方向，并产出浏览器可查看、Figma 可导入的草图文件。

## 2. 本阶段目标

V1.7-0 只做可视化原型，不改产品运行代码。

目标：

1. 提供 A/B/C/D 四个 App Shell 布局方案进行对比。
2. 每套方案覆盖桌面宽屏、iPad 横屏、iPad 竖屏、窄屏浏览器四类视口。
3. 每套方案展示商品、售卖、仪表盘、设置四个核心页面的壳层位置关系。
4. 明确现场模式状态、受保护页面入口、页面标题区、操作区、筛选区的布局方向。
5. 为仪表盘说明小脚标 / 说明弹层预留入口位置。
6. 提供 Figma-ready SVG，方便导入 Figma 查看、标注和轻量编辑。
7. 输出中文 README，说明如何查看、如何导入 Figma、哪些内容只是草图占位。

## 3. 非目标

V1.7-0 不处理：

- 不修改 `src` 目录下的产品代码。
- 不改变商品、售卖、订单、库存、仪表盘统计等业务逻辑。
- 不新增数据库字段。
- 不实现真实交互，不接入真实数据。
- 不制作高保真视觉稿。
- 不生成原生 `.fig` 文件。
- 不实现 Figma Auto Layout 或 Figma Components。
- 不推送远端，不部署 GitHub Pages。

## 4. 交付文件

本阶段交付文件位于：

```text
docs/prototypes/v1-7-app-shell/
```

计划文件：

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
docs/prototypes/v1-7-app-shell/figma/scheme-a-current-top-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-b-left-rail.svg
docs/prototypes/v1-7-app-shell/figma/scheme-c-bottom-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-d-hybrid-responsive.svg
docs/prototypes/v1-7-app-shell/README.md
```

每个 HTML 文件只对应一个方案。每个方案默认打开桌面 / Windows 浏览器视图，iPad 横屏、iPad 竖屏、移动端竖屏通过页面内视图按钮切换，不在同一页面并排展示。

在用户确认倾向方案 D 后，额外交付一套方案 D 实操草图：

- `hybrid-desktop.html`：桌面版，左侧导航菜单。
- `hybrid-mobile.html`：移动端，底部导航菜单。
- 这两个页面不显示 A/B/C/D 方案切换。
- 这两个页面不显示桌面、iPad 横屏、iPad 竖屏、移动端四平台切换。
- 页面内部通过真实产品式导航在商品、售卖、仪表盘、设置之间切换。
- 桌面版侧边导航收敛为固定窄竖条，不再提供展开功能；菜单统一为图标在上、两字中文在下，包含“模式 / 商品 / 售卖 / 订单 / 数据 / 设置”。
- 桌面版补充主要弹窗和子页面交互原型，包括新增商品、编辑商品、复制商品、购物车、去收款、订单详情、现场模式 PIN、运营赠礼 / 人工赠送 / 其他出库选择。
- 桌面版新增商品表单包含“系列（筛选）”字段；售卖页只有在可售商品中存在 2 个及以上不同系列时才显示系列筛选，并放在 SPU 筛选上方。
- 上述交互只用于 UI/UE 验证，数据仅存在当前 HTML 页面内存中，刷新后恢复为原型初始状态，不写入正式产品 IndexedDB。
- 支持导入 ECRM JSON 备份用于当前原型预览，但不写入正式产品 IndexedDB。

在用户追加顶部导航方案对比后，额外交付 `top-nav-desktop.html`：

- 只做桌面版。
- 保留当前产品顶部品牌和顶部导航菜单。
- 移除各页面导航下方的大标题、英文标题和说明文字。
- 商品、售卖、仪表盘、设置首屏按用户截图反馈压缩和左移。
- 该文件与方案 D 实操草图共享静态预览数据和 JSON 备份预览能力。

对应 Figma-ready SVG：

```text
docs/prototypes/v1-7-app-shell/figma/top-nav-desktop-real-shell.svg
docs/prototypes/v1-7-app-shell/figma/hybrid-desktop-real-shell.svg
```

## 5. 四个方案

### 5.1 方案 A：当前结构进化版

定位：低风险、最贴近现有产品。

结构：

- 顶部保留品牌区、版本号、现场模式状态。
- 主导航仍在顶部，但变为独立稳定的横向滚动 tab。
- 页面标题、操作按钮、筛选器放在页面内容区顶部。
- 说明按钮放在模块标题右侧。

优势：

- 学习成本最低。
- 代码改动风险最低。
- 最适合快速落地 V1.7a。

风险：

- 顶部导航未来扩展能力有限。
- 仍偏 Web 管理工具，不是强 App 化体验。

### 5.2 方案 B：桌面管理工具版

定位：桌面端清晰、扩展能力强。

结构：

- 顶部作为状态栏，放品牌、版本、现场模式状态。
- 桌面和 iPad 横屏使用左侧窄导航。
- 页面内容区顶部统一放页面标题、主操作、筛选器。
- iPad 竖屏和窄屏状态下，左侧导航折叠为顶部横向导航。

优势：

- 主导航不占用页面顶部横向空间。
- 后续增加订单、库存、活动等模块时更稳定。
- 仪表盘、设置等管理型页面更容易组织。

风险：

- 与当前产品差异更大。
- iPad 竖屏折叠状态需要设计清楚。
- 现场售卖时左侧导航可能占用商品列表宽度。

### 5.3 方案 C：现场操作优先版

定位：iPad / 手持现场售卖优先。

结构：

- 顶部只保留品牌、当前页面标题、现场模式状态。
- 主导航放到底部，接近移动 App 操作习惯。
- 售卖页将购物车、订单记录、现场模式重锁等入口放在页面内操作区。
- 仪表盘和设置页仍保留内容区标题和筛选区。

优势：

- 手持 iPad 操作更自然。
- 顶部区域更干净。
- 转屏给顾客看收款码时，顶部误触主导航的概率更低。

风险：

- 底部导航会与购物车浮动按钮、收款操作区产生空间竞争。
- 桌面端看起来可能不如顶部或侧边导航自然。
- 售卖页需要更严格的操作区边界。

## 6. 方案 D：混合响应式示意

方案 D 作为长期方向参考，细节密度低于 A/B/C，但仍以独立 HTML 和独立 SVG 交付。

定位：混合响应式方案。

结构：

- 桌面宽屏使用左侧导航。
- iPad 横屏可选择左侧导航或顶部横向导航。
- iPad 竖屏和窄屏使用底部导航。

用途：

- 用作 A/B/C 的边界参考。
- 如果用户希望长期产品化，可作为 V1.8 或后续壳层演进方向。

## 7. 视口覆盖

每个方案至少支持四个视口：

- Desktop：1366 x 768。
- iPad Landscape：1180 x 820。
- iPad Portrait：820 x 1180。
- Narrow：390 x 844。

草图中不要求真实像素完全等比，但必须表达布局结构、导航位置和信息优先级。

## 8. 页面覆盖

每个方案至少展示以下页面壳层：

- 商品：顶部操作、新增商品、商品列表区域。
- 售卖：商品筛选、商品列表、购物车入口、订单记录入口、现场模式状态。
- 仪表盘：日期筛选、统计口径筛选、复盘分区、说明按钮入口。
- 设置：现场模式、备份、促销、系统信息入口。

草图不展示真实商品、真实订单和真实统计数据，只展示布局占位和信息层级。

## 9. Figma 导入说明

本阶段提供 SVG 文件用于 Figma 导入：

```text
docs/prototypes/v1-7-app-shell/figma/scheme-a-current-top-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-b-left-rail.svg
docs/prototypes/v1-7-app-shell/figma/scheme-c-bottom-nav.svg
docs/prototypes/v1-7-app-shell/figma/scheme-d-hybrid-responsive.svg
```

预期能力：

- 每个 SVG 对应一个方案，可分别拖入 Figma 查看。
- 可缩放、移动、复制单方案画板。
- 基础矩形、文本、线条可做轻量编辑。
- 可用于批注和方案评审。

限制：

- 不是原生 `.fig` 文件。
- 不保证自动生成 Auto Layout。
- 不保证自动生成 Figma Components。
- 不作为最终设计系统文件。

## 10. UI 表达原则

草图采用低保真到中保真之间的表达：

- 颜色沿用 ECRM 当前米白、深墨、绿色强调的工具型风格。
- 不使用营销式大 hero。
- 不使用装饰性渐变球、插画和复杂阴影。
- 强调信息密度、导航稳定性和现场操作效率。
- 所有中文文案保持简洁、专业、贴近线下摆摊场景。

## 11. 验收标准

V1.7-0 完成后应满足：

- 浏览器可分别打开 A/B/C/D 四个 HTML 文件查看对应方案。
- 每个方案默认展示桌面 / Windows 浏览器视图。
- 每个方案可通过页面内按钮切换桌面、iPad 横屏、iPad 竖屏、移动端竖屏四类视口。
- 不把多套方案、多种设备效果并排塞在同一个页面里。
- 草图中可清楚看出主导航、品牌区、页面标题区、筛选区、现场模式状态的位置。
- Figma-ready SVG 文件按方案拆分存在，可分别拖入 Figma 查看。
- README 中文说明完整。
- 不修改 `src` 产品代码。
- 本地提交，不推送远端。

## 12. 后续衔接

用户确认 V1.7-0 草图后，再进入：

1. V1.7 正式中文方案文档。
2. V1.7a App Shell 基础结构实现。
3. V1.7b 页面顶部与筛选区规范化。
4. V1.7c 仪表盘说明体系。

如果用户选择方案混合方向，应先更新 V1.7 正式方案文档，再开始代码实现。
