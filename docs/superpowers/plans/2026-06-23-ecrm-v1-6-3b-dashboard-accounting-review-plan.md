# ECRM V1.6.3b Dashboard Accounting Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐仪表盘经营复盘口径，让正常销售、运营活动、人工赠送和其他出库在复盘时可拆分、可解释、不会互相污染。

**Architecture:** 继续以 `src/domain/dashboard.ts` 作为唯一仪表盘聚合入口，复用 `getNormalizedOrderLine` 与 `getLineAccounting`，避免页面层重复业务计算。页面只消费 `DashboardModel`，新增指标通过固定概览条展示，不做 V1.7 全局壳层改版。

**Tech Stack:** React、TypeScript、Vitest、Testing Library、Dexie repository 读取层。

---

### Task 1: 领域层订单口径与成本拆分

**Files:**
- Modify: `src/domain/dashboard.ts`
- Modify: `src/domain/dashboard.test.ts`

- [ ] **Step 1: 写失败测试，覆盖正常销售订单数与客单价不被纯非销售订单污染**

在 `src/domain/dashboard.test.ts` 的 `describe("buildDashboardModel", ...)` 内加入测试：

```ts
test("正常销售口径的订单数和客单价只统计含销售明细订单", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [
      order({ id: "sale-order", payableAmount: 30 }),
      order({ id: "manual-gift-order", payableAmount: 0, paidAt: "2026-06-15T10:00:00.000Z" })
    ],
    orderItems: [
      item({
        id: "sale-item",
        orderId: "sale-order",
        productId: "sale-sku",
        quantity: 1,
        lineTotal: 30,
        unitCostSnapshot: 10,
        costTotal: 10
      }),
      item({
        id: "manual-gift-item",
        orderId: "manual-gift-order",
        productId: "gift-sku",
        productNameSnapshot: "人工赠送商品",
        quantity: 2,
        lineTotal: 0,
        revenueType: "non_sales",
        nonSalesReason: "manual_gift",
        unitCostSnapshot: 3,
        costTotal: 6
      })
    ],
    refunds: [],
    products: [],
    accountingScope: "sales"
  });

  expect(model.summary.paidAmount).toBe(30);
  expect(model.summary.paidOrderCount).toBe(1);
  expect(model.operationsSummary.averageOrderValue).toBe(30);
  expect(model.operationsSummary.outboundQuantity).toBe(1);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- --run src/domain/dashboard.test.ts -t "正常销售口径的订单数和客单价只统计含销售明细订单"`

Expected: FAIL，`paidOrderCount` 或 `averageOrderValue` 仍按全部已支付订单计算。

- [ ] **Step 3: 写失败测试，覆盖订单性质与非销售拆分**

在同一测试文件加入：

```ts
test("全部活动口径提供订单性质和非销售出库数量成本拆分", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [
      order({ id: "mixed-order", payableAmount: 30 }),
      order({ id: "manual-only", payableAmount: 0, paidAt: "2026-06-15T10:00:00.000Z" })
    ],
    orderItems: [
      item({
        id: "sale-item",
        orderId: "mixed-order",
        productId: "sale-sku",
        productNameSnapshot: "正常销售商品",
        quantity: 1,
        lineTotal: 30,
        unitCostSnapshot: 10,
        costTotal: 10
      }),
      item({
        id: "tier-gift",
        orderId: "mixed-order",
        productId: "tier-gift",
        productNameSnapshot: "满赠商品",
        quantity: 1,
        lineType: "gift",
        lineTotal: 0,
        unitCostSnapshot: 2,
        costTotal: 2
      }),
      item({
        id: "campaign-gift",
        orderId: "mixed-order",
        productId: "campaign-gift",
        productNameSnapshot: "运营赠礼商品",
        quantity: 2,
        lineTotal: 0,
        revenueType: "non_sales",
        nonSalesReason: "campaign_gift",
        unitCostSnapshot: 2,
        costTotal: 4
      }),
      item({
        id: "manual-gift",
        orderId: "manual-only",
        productId: "manual-gift",
        productNameSnapshot: "人工赠送商品",
        quantity: 3,
        lineTotal: 0,
        revenueType: "non_sales",
        nonSalesReason: "manual_gift",
        unitCostSnapshot: 3,
        costTotal: 9
      }),
      item({
        id: "other-outbound",
        orderId: "manual-only",
        productId: "other-outbound",
        productNameSnapshot: "其他出库商品",
        quantity: 1,
        lineTotal: 0,
        revenueType: "non_sales",
        nonSalesReason: "other_non_sales",
        unitCostSnapshot: 5,
        costTotal: 5
      })
    ],
    refunds: [],
    products: [],
    accountingScope: "all"
  });

  expect(model.orderNatureSummary).toEqual({
    saleOrderCount: 0,
    mixedOrderCount: 1,
    nonSalesOrderCount: 1,
    campaignGiftOrderCount: 1,
    manualGiftOrderCount: 1,
    otherNonSalesOrderCount: 1
  });
  expect(model.nonSalesBreakdown).toEqual({
    tierGiftQuantity: 1,
    campaignGiftQuantity: 2,
    manualGiftQuantity: 3,
    otherNonSalesQuantity: 1,
    tierGiftCost: 2,
    campaignGiftCost: 4,
    manualGiftCost: 9,
    otherNonSalesCost: 5
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npm test -- --run src/domain/dashboard.test.ts -t "全部活动口径提供订单性质和非销售出库数量成本拆分"`

Expected: FAIL，`orderNatureSummary` 和 `nonSalesBreakdown` 尚未定义。

- [ ] **Step 5: 实现领域层类型和统计函数**

在 `src/domain/dashboard.ts` 中：

```ts
import { deriveOrderNature, getLineAccounting, getNormalizedOrderLine } from "./orderLines";
```

新增类型：

```ts
export type DashboardOrderNatureSummary = {
  saleOrderCount: number;
  mixedOrderCount: number;
  nonSalesOrderCount: number;
  campaignGiftOrderCount: number;
  manualGiftOrderCount: number;
  otherNonSalesOrderCount: number;
};

export type DashboardNonSalesBreakdown = {
  tierGiftQuantity: number;
  campaignGiftQuantity: number;
  manualGiftQuantity: number;
  otherNonSalesQuantity: number;
  tierGiftCost: number;
  campaignGiftCost: number;
  manualGiftCost: number;
  otherNonSalesCost: number;
};
```

给 `DashboardActivityCostSummary` 增加：

```ts
basicGrossMargin: number;
activityAdjustedGrossMargin: number;
```

给 `DashboardModel` 增加：

```ts
orderNatureSummary: DashboardOrderNatureSummary;
nonSalesBreakdown: DashboardNonSalesBreakdown;
```

新增辅助函数：

```ts
function hasScopedOrderContribution(items: OrderItem[], accountingScope: DashboardAccountingScope): boolean {
  if (accountingScope === "all") {
    return items.length > 0;
  }

  if (items.length === 0) {
    return accountingScope === "sales";
  }

  return items.some((item) => {
    const normalized = getNormalizedOrderLine(item);
    if (accountingScope === "sales") {
      return normalized.revenueType === "sale";
    }
    return normalized.revenueType === "non_sales" && normalized.nonSalesReason === accountingScope;
  });
}

function calculateScopedOrderCount(
  rangePaidOrders: Order[],
  itemsByOrderId: Map<string, OrderItem[]>,
  accountingScope: DashboardAccountingScope
): number {
  return rangePaidOrders.filter((order) => hasScopedOrderContribution(itemsByOrderId.get(order.id) ?? [], accountingScope)).length;
}
```

新增 `buildOrderNatureSummary` 和 `buildNonSalesBreakdown`，两者都基于范围内全部已支付明细计算。

- [ ] **Step 6: 修正 `paidOrderCount` 与客单价分母**

在 `buildDashboardModel` 中计算：

```ts
const scopedPaidOrderCount = calculateScopedOrderCount(rangePaidOrders, rangeOrderItemsByOrderId, accountingScope);
```

并将：

```ts
paidOrderCount: rangePaidOrders.length
operationsSummary: buildOperationsSummary(scopedOrderItems, netAmount, rangePaidOrders.length)
```

改为：

```ts
paidOrderCount: scopedPaidOrderCount
operationsSummary: buildOperationsSummary(scopedOrderItems, netAmount, scopedPaidOrderCount)
```

- [ ] **Step 7: 运行领域层测试**

Run: `npm test -- --run src/domain/dashboard.test.ts`

Expected: PASS。

- [ ] **Step 8: 提交领域层变更**

```powershell
git add src/domain/dashboard.ts src/domain/dashboard.test.ts
git commit -m 'feat: refine dashboard accounting summaries'
```

### Task 2: 仪表盘页面展示补齐

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: 写页面失败测试**

在 `src/pages/DashboardPage.test.tsx` 加入测试，断言页面显示：

```ts
expect(screen.getByLabelText("订单性质")).toBeVisible();
expectMetricValue(screen.getByLabelText("订单性质"), "正常销售", "0");
expectMetricValue(screen.getByLabelText("订单性质"), "销售 + 赠送", "1");
expectMetricValue(screen.getByLabelText("订单性质"), "非销售出库", "1");
expectMetricValue(screen.getByLabelText("订单性质"), "运营赠礼订单", "1");

expect(screen.getByLabelText("非销售拆分")).toBeVisible();
expectMetricValue(screen.getByLabelText("非销售拆分"), "满赠", "1 / ¥2.00");
expectMetricValue(screen.getByLabelText("非销售拆分"), "运营赠礼", "2 / ¥4.00");
expectMetricValue(screen.getByLabelText("非销售拆分"), "人工赠送", "3 / ¥9.00");
expectMetricValue(screen.getByLabelText("非销售拆分"), "其他出库", "1 / ¥5.00");

expectMetricValue(screen.getByLabelText("经营成本口径"), "基础毛利率", "66.7%");
expectMetricValue(screen.getByLabelText("经营成本口径"), "活动后毛利率", "46.7%");
```

- [ ] **Step 2: 运行页面测试确认失败**

Run: `npm test -- --run src/pages/DashboardPage.test.tsx -t "switches dashboard accounting scope and shows activity cost metrics"`

Expected: FAIL，页面还没有新增概览条和毛利率字段。

- [ ] **Step 3: 实现页面展示**

在 `DashboardPage.tsx` 的 `dashboardGrid` 中，经营概览和售后概览后增加两个概览条：

```tsx
<div className="dashboardOperationsStrip" aria-label="订单性质">
  <div>
    <span>{dashboard.orderNatureSummary.saleOrderCount}</span>
    <p>正常销售</p>
  </div>
  <div>
    <span>{dashboard.orderNatureSummary.mixedOrderCount}</span>
    <p>销售 + 赠送</p>
  </div>
  <div>
    <span>{dashboard.orderNatureSummary.nonSalesOrderCount}</span>
    <p>非销售出库</p>
  </div>
  <div>
    <span>{dashboard.orderNatureSummary.campaignGiftOrderCount}</span>
    <p>运营赠礼订单</p>
  </div>
</div>
```

增加非销售拆分概览条：

```tsx
<div className="dashboardOperationsStrip dashboardNonSalesBreakdownStrip" aria-label="非销售拆分">
  <div>
    <span>{dashboard.nonSalesBreakdown.tierGiftQuantity} / {formatMoney(dashboard.nonSalesBreakdown.tierGiftCost)}</span>
    <p>满赠</p>
  </div>
  <div>
    <span>{dashboard.nonSalesBreakdown.campaignGiftQuantity} / {formatMoney(dashboard.nonSalesBreakdown.campaignGiftCost)}</span>
    <p>运营赠礼</p>
  </div>
  <div>
    <span>{dashboard.nonSalesBreakdown.manualGiftQuantity} / {formatMoney(dashboard.nonSalesBreakdown.manualGiftCost)}</span>
    <p>人工赠送</p>
  </div>
  <div>
    <span>{dashboard.nonSalesBreakdown.otherNonSalesQuantity} / {formatMoney(dashboard.nonSalesBreakdown.otherNonSalesCost)}</span>
    <p>其他出库</p>
  </div>
</div>
```

在经营成本口径条中加入基础毛利、基础毛利率、活动后毛利率。

- [ ] **Step 4: 调整 CSS**

在 `src/styles.css` 中复用现有 dashboard strip 样式；如新增类，只控制 grid 自适应列数和文本不换到异常布局。

- [ ] **Step 5: 运行页面测试**

Run: `npm test -- --run src/pages/DashboardPage.test.tsx`

Expected: PASS。

- [ ] **Step 6: 提交页面变更**

```powershell
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/styles.css
git commit -m 'feat: show dashboard accounting review metrics'
```

### Task 3: 文档、验证与本地收尾

**Files:**
- Create: `docs/releases/2026-06-23-ecrm-v1-6-3b-dashboard-accounting-review-record.md`

- [ ] **Step 1: 写中文 release 记录**

记录：

- 本轮补齐了哪些仪表盘口径。
- 正常销售口径如何排除纯非销售出库。
- 全部活动口径如何拆分销售成本、运营活动成本、非经营出库成本。
- 本轮未推送远端。

- [ ] **Step 2: 运行全量验证**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected:

- `npm test` 全部通过。
- `npm run build` 通过；允许既有 Vite chunk-size warning。
- `git diff --check` 无输出。

- [ ] **Step 3: 提交文档记录**

```powershell
git add docs/releases/2026-06-23-ecrm-v1-6-3b-dashboard-accounting-review-record.md
git commit -m 'docs: record v1.6.3b dashboard accounting review'
```

- [ ] **Step 4: 主控审查**

检查：

```powershell
git status --short --branch
git log --oneline --decorate -8
```

确认工作树干净、提交顺序清楚，准备向用户汇报。
