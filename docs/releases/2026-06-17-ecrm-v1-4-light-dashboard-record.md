# ECRM V1.4 轻量实用仪表盘交付记录

## 1. 版本定位

V1.4 在 V1.3 订单、售后、退款和备份能力稳定后，新增固定轻量仪表盘，用于线下摆摊现场快速查看今日经营、售后异常、热销 SKU、赠品消耗和低库存情况。

本版本不做飞书式可配置仪表盘，不做拖拽图表，不做云同步，不新增数据库 schema，不处理复合二维码。

## 2. 已完成内容

- 今日经营概览：今日销售额、今日退款、今日实收、今日订单。
- 今日售后概览：作废订单、部分退款、已退款、作废备注。
- 热销 SKU 排名：显示今日已支付订单中销量靠前的可售 SKU。
- 赠品消耗统计：显示今日已支付订单中发出的赠品数量。
- 低库存 SKU：显示库存小于 3 的启用商品，包含售卖 SKU 和仅赠品 SKU。
- 今日异常订单清单：显示今日作废、退款、备注或赠品异常订单。
- 仪表盘加载失败保护：初始加载失败时只显示脱敏错误和刷新入口，不显示 0 值经营概览或空数据状态。
- 仪表盘高密度布局：顶部概览横跨全宽，下方模块在桌面端两列显示，小屏单列显示。

## 3. 统计口径

- 今日销售额只统计状态为 `paid` 的订单。
- 今日订单数只统计状态为 `paid` 的订单。
- 作废订单不计入今日销售额。
- 今日订单归属日期优先使用 `paidAt`，缺失时使用 `createdAt`。
- 今日退款按人工退款记录 `createdAt` 归属日期统计。
- 今日实收 = 今日销售额 - 今日退款。
- 人工退款不改变订单主状态，但会计入今日退款、部分退款和已退款统计。
- 热销 SKU 只统计 `normal` 和 `discount_addon` 明细，不统计 `gift`。
- 赠品消耗只统计 `gift` 明细。
- 低库存阈值固定为库存小于 3。
- 异常订单最多显示 8 条，按异常时间倒序展示。

## 4. 主要提交

- `7ef45b6 feat: add dashboard domain model`
- `460ca25 test: cover dashboard date and limit rules`
- `a3c5232 fix: limit dashboard ranking rows`
- `83aab8b feat: show light dashboard sections`
- `44b6ce7 fix: hide dashboard content before successful load`
- `6eb6636 style: tighten light dashboard layout`

## 5. 验证记录

### 5.1 聚焦测试

```powershell
npm test -- src/domain/dashboard.test.ts src/pages/DashboardPage.test.tsx
```

验证结果：

- 2 个测试文件通过。
- 14 个测试通过。

### 5.2 全量测试

```powershell
npm test
```

验证结果：

- 19 个测试文件通过。
- 179 个测试通过。

### 5.3 生产构建

```powershell
npm run build
```

验证结果：

- `tsc --noEmit && vite build` 通过。
- Vite production build 通过。
- PWA service worker 和 precache 文件生成成功。

### 5.4 空白检查

```powershell
git diff --check
```

验证结果：

- 无空白错误。

## 6. 已知限制

- 不支持自定义日期范围。
- 不支持自定义图表。
- 不支持拖拽式仪表盘组件布局。
- 不支持从仪表盘直接打开订单详情。
- 不支持 CSV 导出。
- 不支持多设备实时同步。
- 当前仪表盘按本地浏览器日期统计，不提供时区设置。

## 7. 后续建议

- 用户验收 V1.4 后，再处理 GitHub 上传、跨设备访问和离线安装说明。
- V1.5 可评估订单调整、补差价、换货记录或更细的活动复盘统计。
- 如果后续订单量明显增加，可再为订单明细新增批量读取 repository 方法，替代当前逐订单读取明细的 MVP 实现。
