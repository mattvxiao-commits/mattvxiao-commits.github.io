# ECRM V1.4 轻量实用仪表盘设计方案

## 1. 版本定位

V1.4 的目标不是实现飞书多维表格式的复杂可配置仪表盘，而是在 V1.3 已稳定的订单、售后、退款和库存数据基础上，提供一个适合线下摆摊现场使用的固定统计面板。

这个仪表盘应优先服务以下场景：

- 摊主快速判断今天卖了多少。
- 摊主快速判断今天实际收了多少。
- 摊主快速知道哪些 SKU 卖得最好。
- 摊主快速知道哪些商品快没库存。
- 摊主快速复核今天有多少作废、退款和异常订单。
- 摊主快速查看赠品消耗，避免赠品库存失控。

本版本不做拖拽组件、不做自由配置图表、不做云端同步、不做多人协作分析。

## 2. 设计原则

### 2.1 固定面板优先

仪表盘使用固定模块，不提供复杂配置。原因是：

- 当前目标是三天内可用、线下摆摊实用。
- 配置式仪表盘会明显增加 UI、数据口径和测试复杂度。
- 当前系统数据量较小，固定统计更直接。

### 2.2 口径必须明确

所有统计都要有明确口径，避免现场对账混乱：

- 销售额默认只统计状态为 `paid` 的订单。
- 作废订单不计入销售额。
- 人工退款不改变订单主状态，但会进入退款金额统计。
- 实收金额 = 已支付订单应收金额 - 人工退款金额。
- 今日统计优先使用支付时间 `paidAt`；如果缺失，则使用创建时间 `createdAt`。
- 退款按退款记录 `createdAt` 归属日期。
- 赠品消耗按订单明细中 `lineType = gift` 统计。

### 2.3 面向现场操作

仪表盘应保持高密度、低噪音、快速浏览：

- 不做大面积营销式 hero。
- 不做过多装饰卡片。
- 不使用复杂图表作为首屏核心。
- 优先使用数字、排行、短列表和清晰标签。
- 信息必须适合 iPad、笔记本和普通浏览器窗口。

## 3. 数据来源

V1.4 只使用当前已经存在的数据：

- `orders`
- `orderItems`
- `orderRefunds`
- `products`
- `inventoryLogs`

不新增 Dexie schema。

### 3.1 当前 repository 需求

当前仪表盘页面已经使用：

- `listOrders()`
- `listProducts()`

V1.4 需要增加使用：

- `listRefunds()`
- 用于读取订单明细的能力。

如果当前 repository 只有 `listOrderItems(orderId)`，V1.4 可以先采用逐订单读取订单明细的方式；由于本地离线数据量较小，这在 MVP 阶段可接受。若后续订单数量增长，再新增批量读取订单明细的 repository 方法。

## 4. 页面模块设计

### 4.1 顶部经营概览

顶部保留紧凑标题和刷新按钮。

核心指标建议为 4 个：

- 今日销售额
  - 口径：今日已支付订单 `payableAmount` 合计。
- 今日退款
  - 口径：今日人工退款记录 `amount` 合计。
- 今日实收
  - 口径：今日销售额 - 今日退款。
- 今日订单
  - 口径：今日已支付订单数量。

显示建议：

- 使用同一行或两行指标带。
- 金额突出，标签简短。
- 退款金额可使用弱红或警示色，但不要过度强调。

### 4.2 售后概览

售后概览用于快速发现异常：

- 今日作废订单数。
- 今日部分退款订单数。
- 今日已退款订单数。
- 今日有备注的作废订单数。

口径：

- 作废订单按 `status = cancelled` 且 `cancelledAt` 在今日统计。
- 部分退款和已退款基于订单累计退款金额与订单 `payableAmount` 比较。
- 有备注的作废订单基于 `cancelNote` 是否存在。

### 4.3 热销 SKU 排名

显示今日销量前 5 的 SKU。

字段建议：

- 排名。
- 商品名称快照。
- 商品编码快照。
- SPU 快照。
- 销售数量。
- 销售金额。

口径：

- 只统计 `paid` 订单。
- 只统计 `lineType = normal` 和 `lineType = discount_addon`。
- 不把赠品计入销售数量。
- 销售金额使用订单明细 `lineTotal`。

### 4.4 赠品消耗统计

显示今日赠品消耗前 5。

字段建议：

- 商品名称快照。
- 商品编码快照。
- SPU 快照。
- 赠出数量。

口径：

- 只统计 `paid` 订单。
- 只统计 `lineType = gift`。
- 赠品金额不计入销售额。

### 4.5 低库存 SKU

当前仪表盘已有低库存商品列表，V1.4 应继续保留并增强：

- 默认显示库存小于 3 的启用商品。
- 按库存从低到高排序。
- 售卖商品和仅赠品库存都应显示。
- 显示商品名称、SPU、商品编码、当前库存。

后续可以增加低库存阈值设置，但 V1.4 不做配置，继续使用固定阈值 3。

### 4.6 今日订单异常清单

显示今天需要复核的订单，最多 8 条：

- 已作废订单。
- 有退款记录的订单。
- 有作废备注的订单。
- giftStockWarning 为 true 的订单。

字段建议：

- 订单号。
- 时间。
- 支付方式。
- 应收金额。
- 标签：`已作废`、`部分退款`、`已退款`、`有备注`、`赠品异常`。

点击订单详情是否从仪表盘直接打开可作为可选项。V1.4 第一版可以先只展示清单，不做跳转，降低风险。

## 5. UI/UE 设计

### 5.1 页面风格

沿用现有 ECRM 风格：

- 浅色背景。
- 8px 圆角。
- 低饱和绿色作为主色。
- 弱边框和高密度信息。
- 不新增大面积插画、hero 或装饰背景。

### 5.2 信息密度

仪表盘应比商品页和售卖页更偏“复盘扫描”：

- 顶部指标条紧凑。
- 下方使用两列布局：
  - 左侧：热销 SKU、赠品消耗。
  - 右侧：低库存、异常订单。
- 小屏时改为单列。

### 5.3 空态

每个模块都需要独立空态：

- 今日暂无已支付订单。
- 今日暂无退款。
- 暂无低库存商品。
- 今日暂无赠品消耗。
- 今日暂无异常订单。

空态文案要短，不解释功能。

## 6. 数据计算设计

### 6.1 领域函数

建议新增纯函数文件：

- `src/domain/dashboard.ts`

建议导出：

```ts
export type DashboardSummary = {
  paidAmount: number;
  refundAmount: number;
  netAmount: number;
  paidOrderCount: number;
  cancelledOrderCount: number;
  partialRefundOrderCount: number;
  fullyRefundedOrderCount: number;
  notedCancelledOrderCount: number;
};

export function buildDashboardSummary(input: DashboardInput, day: Date): DashboardSummary;
export function buildTopSellingSkuRows(input: DashboardInput, day: Date): DashboardSkuRow[];
export function buildGiftConsumptionRows(input: DashboardInput, day: Date): DashboardGiftRow[];
export function buildDashboardExceptionRows(input: DashboardInput, day: Date): DashboardExceptionRow[];
```

这些函数不访问 Dexie，不访问 React state，只处理传入数据，便于测试。

### 6.2 日期处理

沿用当前本地日期判断方式：

- `new Date(value)`
- 比较 `year/month/date`

V1.4 不增加时区设置。

### 6.3 退款聚合

退款需要按 `orderId` 聚合：

- 累计退款 = 同一订单全部退款记录金额之和。
- 部分退款：累计退款 > 0 且累计退款 < payableAmount。
- 已退款：累计退款 >= payableAmount。

## 7. 测试方案

### 7.1 领域函数测试

新增：

- `src/domain/dashboard.test.ts`

覆盖：

- 今日销售额、退款额、实收额。
- 作废订单不计入销售额。
- 今日退款按退款记录时间统计。
- 部分退款和已退款计数。
- 热销 SKU 排名。
- 赠品消耗排名。
- 低库存排序可继续由页面层或辅助函数覆盖。

### 7.2 页面测试

扩展：

- `src/pages/DashboardPage.test.tsx`

覆盖：

- 页面加载 orders、products、refunds 和 orderItems。
- 显示今日销售额、退款、实收、订单数。
- 显示热销 SKU。
- 显示赠品消耗。
- 显示低库存商品。
- 加载失败时显示脱敏中文错误。

### 7.3 回归验证

完成后执行：

```powershell
npm test -- src/domain/dashboard.test.ts src/pages/DashboardPage.test.tsx
npm test
npm run build
git diff --check
```

## 8. 不做内容

V1.4 明确不做：

- 飞书式拖拽仪表盘。
- 自定义图表组件配置。
- Excel 式图表生成器。
- 云端统计。
- 多设备同步。
- CSV 导出。
- 按自定义日期范围筛选。
- 订单详情从仪表盘直接弹出。
- 新增 Dexie schema。

这些内容可以在 V1.5 以后再评估。

## 9. 验收标准

V1.4 完成后应满足：

- 仪表盘顶部显示今日销售额、退款、实收和订单数。
- 作废订单不计入销售额。
- 人工退款能减少实收金额。
- 热销 SKU 排名正确。
- 赠品消耗排名正确。
- 低库存列表仍可用。
- 异常订单概览能显示作废、退款、有备注等订单。
- 旧有售卖、订单、退款、备份功能测试不回归。
- 全量测试和生产构建通过。
