# ECRM V1.4b 零售经营统计仪表盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 V1.4a 时间范围底座上，为仪表盘增加线下零售摆摊最常用的出库、客单、SPU、支付、活动和库存风险统计。

**Architecture:** 所有统计先在 `src/domain/dashboard.ts` 领域层按当前 `DashboardDateRange` 计算，再由 `DashboardPage.tsx` 做只读展示。V1.4b 不新增数据库 schema，不做毛利、不做成本快照、不做历史库存回溯，所有指标均基于已有 `orders`、`orderItems`、`refunds`、`products` 计算。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、现有 Dexie repository、现有 CSS。

---

## 0. 执行边界

本计划只实现 V1.4b，不实现 V1.5。

明确不做：

- 毛利、毛利率。
- 成本快照。
- 库存成本金额、库存售价金额。
- 新 Dexie schema。
- CSV 导出。
- 可拖拽或可配置仪表盘。
- 云同步或多设备实时协作。

## 1. 小版本拆分

### V1.4b-1：出库与客单

新增：

- 售出件数。
- 赠品件数。
- 总出库件数。
- 客单价。

### V1.4b-2：SPU 表现

新增：

- 热销 SPU 排名。
- SPU 销售额排名。

### V1.4b-3：支付方式与活动效果

新增：

- 微信、支付宝、现金、其他订单数。
- 微信、支付宝、现金、其他收款金额。
- 优惠加购件数。
- 优惠让利金额。
- 参与优惠订单数。
- 满赠档位触发次数。

### V1.4b-4：库存风险

新增：

- 售罄 SKU。
- 高风险 SKU。
- 滞销 SKU。
- 补货建议。

低库存 SKU 已在 V1.4 中存在，V1.4b-4 只扩展展示和风险口径。

## 2. 统计口径

### 2.1 范围订单

所有新增经营指标只统计当前范围内已支付订单：

```ts
const rangePaidOrders = input.orders.filter(
  (order) => order.status === "paid" && isInDateRange(orderBusinessTime(order), input.dateRange)
);
const rangePaidOrderIds = new Set(rangePaidOrders.map((order) => order.id));
```

### 2.2 出库与客单

- 售出件数：当前范围已支付订单中 `lineType = normal` 或 `lineType = discount_addon` 的 `quantity` 合计。
- 赠品件数：当前范围已支付订单中 `lineType = gift` 的 `quantity` 合计。
- 总出库件数：售出件数 + 赠品件数。
- 客单价：`summary.netAmount / summary.paidOrderCount`。
- 如果当前范围没有已支付订单，客单价为 `0`。

说明：`summary.netAmount` 沿用 V1.4a 口径，即当前范围销售额减当前范围退款金额。退款金额按 `OrderRefund.createdAt` 归属范围。

### 2.3 SPU 表现

- 热销 SPU：按售出件数倒序，只统计 `normal` + `discount_addon`。
- SPU 销售额：按销售额倒序，只统计 `normal` + `discount_addon`。
- 每行展示 SPU、售出件数、销售额。
- 排名最多展示 5 条。
- 排序兜底：数量或金额相同按 SPU 中文排序。

### 2.4 支付方式

统计当前范围内已支付订单：

- 微信、支付宝、现金、其他订单数。
- 微信、支付宝、现金、其他收款金额。

金额使用订单 `payableAmount`，不按退款拆分到支付方式。退款拆分到支付方式留给后续版本。

### 2.5 活动效果

基于当前范围已支付订单和对应订单明细：

- 优惠加购件数：`lineType = discount_addon` 的 `quantity` 合计。
- 优惠让利金额：`discount_addon` 明细中 `(originalUnitPrice - finalUnitPrice) * quantity` 合计。
- 参与优惠订单数：至少有一条 `discount_addon` 明细的订单数。
- 满赠档位触发次数：按 `Order.triggeredGiftTier` 聚合，只统计已支付订单。

### 2.6 库存风险

库存风险使用当前商品库存，不按日期回溯。

- 售罄 SKU：`status = active` 且 `stockQty = 0`。
- 低库存 SKU：沿用现有 `stockQty < 3`。
- 高风险 SKU：当前范围售出件数 >= 2 且当前库存 <= 2。
- 滞销 SKU：当前范围售出件数 = 0，当前库存 > 0，且 `isSellable = true`，且商品启用。
- 补货建议：当前范围售出件数 >= 2 且当前库存 <= 2，与高风险 SKU 使用同一数据，展示文案更偏行动。

## 3. 文件结构

- Modify: `src/domain/dashboard.ts`
  - 新增 V1.4b 所需类型和计算函数。
  - 扩展 `DashboardModel`。

- Modify: `src/domain/dashboard.test.ts`
  - 增加 V1.4b 领域层测试。

- Modify: `src/pages/DashboardPage.tsx`
  - 增加新增指标和列表展示。

- Modify: `src/pages/DashboardPage.test.tsx`
  - 增加页面展示测试。

- Modify: `src/styles.css`
  - 复用现有仪表盘列表样式，必要时补少量紧凑样式。

- Create: `docs/releases/2026-06-18-ecrm-v1-4b-*-record.md`
  - 每个小版本完成后写中文交付记录。

## 4. Task 1：V1.4b-1 领域层出库与客单

**Files:**

- Modify: `src/domain/dashboard.ts`
- Modify: `src/domain/dashboard.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/domain/dashboard.test.ts` 中新增测试：

```ts
test("统计当前范围售出件数、赠品件数、总出库件数和客单价", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [
      order({ id: "paid-a", payableAmount: 50 }),
      order({ id: "paid-b", payableAmount: 30, paidAt: "2026-06-15T10:00:00.000Z" }),
      order({ id: "outside", payableAmount: 99, paidAt: "2026-06-14T10:00:00.000Z" })
    ],
    orderItems: [
      item({ id: "normal-a", orderId: "paid-a", productId: "sku-a", quantity: 2, lineType: "normal", lineTotal: 40 }),
      item({
        id: "addon-a",
        orderId: "paid-a",
        productId: "sku-addon",
        quantity: 1,
        originalUnitPrice: 5,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 3
      }),
      item({ id: "gift-a", orderId: "paid-a", productId: "gift-a", quantity: 2, lineType: "gift", lineTotal: 0 }),
      item({ id: "normal-b", orderId: "paid-b", productId: "sku-b", quantity: 3, lineType: "normal", lineTotal: 30 }),
      item({ id: "outside-normal", orderId: "outside", productId: "sku-old", quantity: 9, lineType: "normal", lineTotal: 99 })
    ],
    refunds: [refund({ orderId: "paid-a", amount: 10, createdAt: "2026-06-15T11:00:00.000Z" })],
    products: []
  });

  expect(model.operationsSummary).toEqual({
    soldQuantity: 6,
    giftQuantity: 2,
    outboundQuantity: 8,
    averageOrderValue: 35
  });
});
```

新增空态测试：

```ts
test("无已支付订单时出库与客单指标为 0", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [],
    orderItems: [],
    refunds: [],
    products: []
  });

  expect(model.operationsSummary).toEqual({
    soldQuantity: 0,
    giftQuantity: 0,
    outboundQuantity: 0,
    averageOrderValue: 0
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- FAIL。
- 失败原因包含 `operationsSummary` 不存在。

- [ ] **Step 3: 实现领域类型**

在 `src/domain/dashboard.ts` 增加：

```ts
export type DashboardOperationsSummary = {
  soldQuantity: number;
  giftQuantity: number;
  outboundQuantity: number;
  averageOrderValue: number;
};
```

扩展 `DashboardModel`：

```ts
export type DashboardModel = {
  summary: DashboardSummary;
  operationsSummary: DashboardOperationsSummary;
  topSellingSkuRows: DashboardSkuRow[];
  giftConsumptionRows: DashboardGiftRow[];
  lowStockRows: DashboardLowStockRow[];
  exceptionRows: DashboardExceptionRow[];
};
```

- [ ] **Step 4: 实现计算函数**

在 `src/domain/dashboard.ts` 增加：

```ts
function buildOperationsSummary(
  rangePaidOrderIds: Set<string>,
  orderItems: OrderItem[],
  netAmount: number,
  paidOrderCount: number
): DashboardOperationsSummary {
  const soldQuantity = orderItems
    .filter((item) => rangePaidOrderIds.has(item.orderId) && item.lineType !== "gift")
    .reduce((sum, item) => sum + item.quantity, 0);
  const giftQuantity = orderItems
    .filter((item) => rangePaidOrderIds.has(item.orderId) && item.lineType === "gift")
    .reduce((sum, item) => sum + item.quantity, 0);

  return {
    soldQuantity,
    giftQuantity,
    outboundQuantity: soldQuantity + giftQuantity,
    averageOrderValue: paidOrderCount > 0 ? roundMoney(netAmount / paidOrderCount) : 0
  };
}
```

在 `buildDashboardModel()` 中先计算：

```ts
const netAmount = roundMoney(paidAmount - refundAmount);
```

再返回：

```ts
operationsSummary: buildOperationsSummary(rangePaidOrderIds, input.orderItems, netAmount, rangePaidOrders.length),
```

并让 `summary.netAmount` 使用 `netAmount`。

- [ ] **Step 5: 运行领域测试**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- PASS。

- [ ] **Step 6: 提交 Task 1**

Run:

```powershell
git add src/domain/dashboard.ts src/domain/dashboard.test.ts
git commit -m "feat: add dashboard operations summary"
```

## 5. Task 2：V1.4b-1 页面展示出库与客单

**Files:**

- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 写失败测试**

在 `src/pages/DashboardPage.test.tsx` 的核心渲染测试中，增加订单明细后断言：

```ts
const operationsOverview = screen.getByLabelText("出库与客单");
expect(operationsOverview).toHaveClass("dashboardOperationsStrip");
expectMetricValue(operationsOverview, "售出件数", "4");
expectMetricValue(operationsOverview, "赠品件数", "2");
expectMetricValue(operationsOverview, "总出库", "6");
expectMetricValue(operationsOverview, "客单价", "¥33.33");
```

再新增空态或空数据断言：

```ts
expectMetricValue(screen.getByLabelText("出库与客单"), "售出件数", "0");
expectMetricValue(screen.getByLabelText("出库与客单"), "客单价", "¥0.00");
```

- [ ] **Step 2: 运行页面测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- FAIL。
- 失败原因包含找不到 `出库与客单`。

- [ ] **Step 3: 增加页面展示**

在 `src/pages/DashboardPage.tsx` 中，在 `售后概览` 后增加：

```tsx
<div className="dashboardOperationsStrip" aria-label="出库与客单">
  <div>
    <span>{dashboard.operationsSummary.soldQuantity}</span>
    <p>售出件数</p>
  </div>
  <div>
    <span>{dashboard.operationsSummary.giftQuantity}</span>
    <p>赠品件数</p>
  </div>
  <div>
    <span>{dashboard.operationsSummary.outboundQuantity}</span>
    <p>总出库</p>
  </div>
  <div>
    <span>{formatMoney(dashboard.operationsSummary.averageOrderValue)}</span>
    <p>客单价</p>
  </div>
</div>
```

- [ ] **Step 4: 增加样式**

在 `src/styles.css` 中让 `dashboardOperationsStrip` 复用售后指标条样式：

```css
.dashboardOperationsStrip {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--line);
}

.dashboardOperationsStrip div {
  min-height: 60px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.86);
}

.dashboardOperationsStrip span {
  display: block;
  color: var(--ink);
  font-size: 20px;
  font-weight: 900;
  line-height: 1;
  overflow-wrap: anywhere;
}

.dashboardOperationsStrip p {
  margin-top: 6px;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 800;
}
```

在 `@media (max-width: 720px)` 中增加：

```css
.dashboardOperationsStrip {
  grid-template-columns: 1fr;
  grid-column: auto;
}
```

- [ ] **Step 5: 运行页面测试**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- PASS。

- [ ] **Step 6: 提交 Task 2**

Run:

```powershell
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/styles.css
git commit -m "feat: show dashboard operations summary"
```

## 6. Task 3：V1.4b-1 交付记录与验证

**Files:**

- Create: `docs/releases/2026-06-18-ecrm-v1-4b-1-operations-dashboard-record.md`

- [ ] **Step 1: 运行聚焦测试**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts src/pages/DashboardPage.test.tsx
```

Expected:

- PASS。

- [ ] **Step 2: 运行全量测试**

Run:

```powershell
npm test
```

Expected:

- PASS。

- [ ] **Step 3: 运行生产构建**

Run:

```powershell
npm run build
```

Expected:

- PASS。

- [ ] **Step 4: 运行空白检查**

Run:

```powershell
git diff --check
```

Expected:

- 无输出。

- [ ] **Step 5: 创建交付记录**

Create `docs/releases/2026-06-18-ecrm-v1-4b-1-operations-dashboard-record.md`:

```md
# ECRM V1.4b-1 出库与客单仪表盘交付记录

## 1. 版本定位

V1.4b-1 在 V1.4a 时间范围底座上增加出库与客单统计。

## 2. 已完成内容

- 售出件数。
- 赠品件数。
- 总出库件数。
- 客单价。

## 3. 统计口径

- 售出件数统计当前范围已支付订单中的 normal 和 discount_addon 明细数量。
- 赠品件数统计当前范围已支付订单中的 gift 明细数量。
- 总出库件数为售出件数加赠品件数。
- 客单价为当前范围实收除以当前范围已支付订单数。

## 4. 验证记录

```powershell
npm test -- src/domain/dashboard.test.ts src/pages/DashboardPage.test.tsx
npm test
npm run build
git diff --check
```

验证结果：

- 聚焦测试通过。
- 全量测试通过。
- 生产构建通过。
- 空白检查通过。

## 5. 已知限制

- 本版本不做 SPU 表现、支付方式、活动效果和库存风险扩展。
- 本版本不做毛利和成本快照。
```

- [ ] **Step 6: 提交交付记录**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-4b-1-operations-dashboard-record.md
git commit -m "docs: record v1.4b-1 operations dashboard delivery"
```

## 7. 后续任务预留

V1.4b-2、V1.4b-3、V1.4b-4 在 V1.4b-1 验收通过后继续按相同流程执行：

1. 先领域层测试和实现。
2. 再页面测试和展示。
3. 最后运行聚焦测试、全量测试、生产构建、空白检查。
4. 每个小版本独立写中文交付记录。

## 8. V1.4b 最终验收清单

- [ ] V1.4b-1 能查看售出件数、赠品件数、总出库件数和客单价。
- [ ] V1.4b-2 能查看热销 SPU 和 SPU 销售额排行。
- [ ] V1.4b-3 能查看支付方式订单数和金额。
- [ ] V1.4b-3 能查看优惠加购和满赠档位统计。
- [ ] V1.4b-4 能查看售罄、高风险、滞销和补货建议。
- [ ] 所有新增统计都随时间范围变化。
- [ ] 不新增 Dexie schema。
- [ ] 不实现毛利、毛利率、成本快照和库存价值。
- [ ] 全量测试通过。
- [ ] 生产构建通过。
