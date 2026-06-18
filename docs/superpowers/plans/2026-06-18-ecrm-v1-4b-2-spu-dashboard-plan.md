# ECRM V1.4b-2 SPU 表现仪表盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 V1.4a 时间范围和 V1.4b-1 出库与客单底座上，为仪表盘增加热销 SPU 排名和 SPU 销售额排名。

**Architecture:** 领域层在 `src/domain/dashboard.ts` 中基于当前范围内已支付订单明细聚合 SPU，再由 `DashboardPage.tsx` 只读展示。V1.4b-2 不新增数据库 schema，不改订单写入，不做支付方式、活动效果、库存风险、毛利或成本快照。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、现有 CSS。

---

## 0. 执行边界

本计划只实现 V1.4b-2 SPU 表现。

明确不做：

- 支付方式统计。
- 活动效果统计。
- 售罄、高风险、滞销和补货建议。
- 毛利、毛利率、成本快照。
- 新 Dexie schema。
- CSV 导出。
- 可配置图表或拖拽仪表盘。

## 1. 统计口径

### 1.1 范围订单

只统计当前范围内已支付订单：

```ts
const rangePaidOrders = input.orders.filter(
  (order) => order.status === "paid" && isInDateRange(orderBusinessTime(order), input.dateRange)
);
const rangePaidOrderIds = new Set(rangePaidOrders.map((order) => order.id));
```

### 1.2 SPU 行

新增领域类型：

```ts
export type DashboardSpuRow = {
  spu: string;
  quantity: number;
  amount: number;
};
```

### 1.3 热销 SPU

- 只统计当前范围已支付订单明细。
- 只统计 `lineType = normal` 和 `lineType = discount_addon`。
- 不统计 `lineType = gift`。
- 按 `spuSnapshot` 聚合。
- 按 `quantity` 倒序。
- 数量相同时按 SPU 中文排序。
- 最多返回 5 条。

### 1.4 SPU 销售额

- 只统计当前范围已支付订单明细。
- 只统计 `lineType = normal` 和 `lineType = discount_addon`。
- 不统计 `lineType = gift`。
- 按 `spuSnapshot` 聚合。
- 金额使用明细 `lineTotal` 合计。
- 按 `amount` 倒序。
- 金额相同时按 SPU 中文排序。
- 最多返回 5 条。

## 2. 文件结构

- Modify: `src/domain/dashboard.ts`
  - 新增 `DashboardSpuRow`。
  - 扩展 `DashboardModel`。
  - 新增 `topSellingSpuRows` 和 `topRevenueSpuRows` 计算。

- Modify: `src/domain/dashboard.test.ts`
  - 增加 SPU 聚合、排序、范围过滤、gift 排除和 top 5 测试。

- Modify: `src/pages/DashboardPage.tsx`
  - 新增“热销 SPU”和“SPU 销售额”两个模块。

- Modify: `src/pages/DashboardPage.test.tsx`
  - 增加页面展示测试和空态测试。

- Modify: `src/styles.css`
  - 优先复用现有 `.dashboardRankList` / `.dashboardRankRow` / `.dashboardRowMetric`。
  - 如不需要新增样式，不修改 CSS。

- Create: `docs/releases/2026-06-18-ecrm-v1-4b-2-spu-dashboard-record.md`
  - 中文交付记录。

## 3. Task 1：领域层 SPU 排行

**Files:**

- Modify: `src/domain/dashboard.ts`
- Modify: `src/domain/dashboard.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/domain/dashboard.test.ts` 中新增：

```ts
test("按 SPU 聚合当前范围热销数量和销售额排行", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [
      order({ id: "paid-a" }),
      order({ id: "paid-b", paidAt: "2026-06-15T10:00:00.000Z" }),
      order({ id: "outside", paidAt: "2026-06-14T10:00:00.000Z" })
    ],
    orderItems: [
      item({ id: "a-1", orderId: "paid-a", productId: "sku-a1", spuSnapshot: "挂件", quantity: 2, lineTotal: 40 }),
      item({ id: "a-2", orderId: "paid-a", productId: "sku-a2", spuSnapshot: "挂件", quantity: 1, lineTotal: 20 }),
      item({ id: "b-1", orderId: "paid-b", productId: "sku-b1", spuSnapshot: "贴纸", quantity: 4, lineTotal: 16 }),
      item({
        id: "addon",
        orderId: "paid-b",
        productId: "sku-addon",
        spuSnapshot: "加购",
        quantity: 3,
        lineType: "discount_addon",
        lineTotal: 9
      }),
      item({ id: "gift", orderId: "paid-a", productId: "gift-a", spuSnapshot: "赠品", quantity: 9, lineType: "gift", lineTotal: 0 }),
      item({ id: "outside", orderId: "outside", productId: "sku-old", spuSnapshot: "旧品", quantity: 99, lineTotal: 99 })
    ],
    refunds: [],
    products: []
  });

  expect(model.topSellingSpuRows).toEqual([
    { spu: "贴纸", quantity: 4, amount: 16 },
    { spu: "加购", quantity: 3, amount: 9 },
    { spu: "挂件", quantity: 3, amount: 60 }
  ]);
  expect(model.topRevenueSpuRows).toEqual([
    { spu: "挂件", quantity: 3, amount: 60 },
    { spu: "贴纸", quantity: 4, amount: 16 },
    { spu: "加购", quantity: 3, amount: 9 }
  ]);
});
```

新增 top 5 和排序兜底测试：

```ts
test("SPU 排行最多返回 5 条并在数值相同时按 SPU 名称排序", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [order({ id: "order-1" })],
    orderItems: ["A", "B", "C", "D", "E", "F"].map((spu, index) =>
      item({
        id: `spu-${spu}`,
        orderId: "order-1",
        productId: `sku-${spu}`,
        spuSnapshot: spu,
        quantity: index === 0 || index === 1 ? 10 : 6 - index,
        lineTotal: index === 0 || index === 1 ? 100 : (6 - index) * 10
      })
    ),
    refunds: [],
    products: []
  });

  expect(model.topSellingSpuRows).toHaveLength(5);
  expect(model.topSellingSpuRows.map((row) => row.spu)).toEqual(["A", "B", "C", "D", "E"]);
  expect(model.topRevenueSpuRows).toHaveLength(5);
  expect(model.topRevenueSpuRows.map((row) => row.spu)).toEqual(["A", "B", "C", "D", "E"]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- FAIL。
- 失败原因包含 `topSellingSpuRows` 或 `topRevenueSpuRows` 不存在。

- [ ] **Step 3: 实现领域类型**

在 `src/domain/dashboard.ts` 增加：

```ts
export type DashboardSpuRow = {
  spu: string;
  quantity: number;
  amount: number;
};
```

扩展 `DashboardModel`：

```ts
export type DashboardModel = {
  summary: DashboardSummary;
  operationsSummary: DashboardOperationsSummary;
  topSellingSkuRows: DashboardSkuRow[];
  giftConsumptionRows: DashboardGiftRow[];
  topSellingSpuRows: DashboardSpuRow[];
  topRevenueSpuRows: DashboardSpuRow[];
  lowStockRows: DashboardLowStockRow[];
  exceptionRows: DashboardExceptionRow[];
};
```

- [ ] **Step 4: 实现 SPU 聚合与排序**

在 `src/domain/dashboard.ts` 增加：

```ts
function buildSpuRows(rangePaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardSpuRow[] {
  const rowsBySpu = new Map<string, DashboardSpuRow>();

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId) || item.lineType === "gift") {
      continue;
    }

    const existing = rowsBySpu.get(item.spuSnapshot);
    rowsBySpu.set(item.spuSnapshot, {
      spu: item.spuSnapshot,
      quantity: (existing?.quantity ?? 0) + item.quantity,
      amount: roundMoney((existing?.amount ?? 0) + item.lineTotal)
    });
  }

  return [...rowsBySpu.values()];
}

function sortSpuRowsByQuantity(rows: DashboardSpuRow[]): DashboardSpuRow[] {
  return [...rows].sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return left.spu.localeCompare(right.spu, "zh-Hans-CN");
  });
}

function sortSpuRowsByAmount(rows: DashboardSpuRow[]): DashboardSpuRow[] {
  return [...rows].sort((left, right) => {
    if (right.amount !== left.amount) {
      return right.amount - left.amount;
    }

    return left.spu.localeCompare(right.spu, "zh-Hans-CN");
  });
}
```

在 `buildDashboardModel()` 中：

```ts
const spuRows = buildSpuRows(rangePaidOrderIds, input.orderItems);
```

返回：

```ts
topSellingSpuRows: sortSpuRowsByQuantity(spuRows).slice(0, 5),
topRevenueSpuRows: sortSpuRowsByAmount(spuRows).slice(0, 5),
```

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
git commit -m "feat: add dashboard spu rankings"
```

## 4. Task 2：页面展示 SPU 表现

**Files:**

- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`
- Modify: `src/styles.css` only if needed.

- [ ] **Step 1: 写失败测试**

在 `src/pages/DashboardPage.test.tsx` 的核心渲染测试中，让数据包含两个 SPU：

当前已有 `热销挂件` 的 `spuSnapshot: "挂件"` 和 `明信片` 的 `spuSnapshot: "纸品"`，可直接断言。

新增断言：

```ts
const topSellingSpu = screen.getByRole("region", { name: "热销 SPU" });
expect(within(topSellingSpu).getByText("挂件")).toBeVisible();
expect(within(topSellingSpu).getByText("3 件")).toBeVisible();
expect(within(topSellingSpu).getByText("¥60.00")).toBeVisible();
expect(within(topSellingSpu).getByText("纸品")).toBeVisible();

const topRevenueSpu = screen.getByRole("region", { name: "SPU 销售额" });
expect(within(topRevenueSpu).getByText("挂件")).toBeVisible();
expect(within(topRevenueSpu).getByText("¥60.00")).toBeVisible();
expect(within(topRevenueSpu).getByText("纸品")).toBeVisible();
expect(within(topRevenueSpu).getByText("¥30.00")).toBeVisible();
```

在 empty load 测试中新增：

```ts
expect(screen.getByText("当前范围暂无 SPU 销售。")).toBeVisible();
expect(screen.getByText("当前范围暂无 SPU 销售额。")).toBeVisible();
```

- [ ] **Step 2: 运行页面测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- FAIL。
- 失败原因包含找不到 `热销 SPU` 或 `SPU 销售额`。

- [ ] **Step 3: 增加页面展示**

在 `src/pages/DashboardPage.tsx` 中，在 `热销 SKU` 后、`赠品消耗` 前增加两个 section：

```tsx
<section className="dashboardSection" aria-labelledby="top-selling-spu-title">
  <div className="sectionTitle">
    <BarChart3 size={21} aria-hidden="true" />
    <div>
      <h2 id="top-selling-spu-title">热销 SPU</h2>
      <p>当前范围已支付订单中售出件数最高的 SPU。</p>
    </div>
  </div>

  {!isLoading && dashboard.topSellingSpuRows.length === 0 ? (
    <div className="dashboardEmpty">
      <PackageX size={24} aria-hidden="true" />
      <p>当前范围暂无 SPU 销售。</p>
    </div>
  ) : null}

  <div className="dashboardRankList">
    {dashboard.topSellingSpuRows.map((row) => (
      <article className="dashboardRankRow" key={row.spu}>
        <div>
          <h3>{row.spu}</h3>
          <p>SPU</p>
        </div>
        <div className="dashboardRowMetric">
          <span>{row.quantity} 件</span>
          <strong>{formatMoney(row.amount)}</strong>
        </div>
      </article>
    ))}
  </div>
</section>

<section className="dashboardSection" aria-labelledby="top-revenue-spu-title">
  <div className="sectionTitle">
    <BarChart3 size={21} aria-hidden="true" />
    <div>
      <h2 id="top-revenue-spu-title">SPU 销售额</h2>
      <p>当前范围已支付订单中销售额最高的 SPU。</p>
    </div>
  </div>

  {!isLoading && dashboard.topRevenueSpuRows.length === 0 ? (
    <div className="dashboardEmpty">
      <PackageX size={24} aria-hidden="true" />
      <p>当前范围暂无 SPU 销售额。</p>
    </div>
  ) : null}

  <div className="dashboardRankList">
    {dashboard.topRevenueSpuRows.map((row) => (
      <article className="dashboardRankRow" key={row.spu}>
        <div>
          <h3>{row.spu}</h3>
          <p>SPU</p>
        </div>
        <div className="dashboardRowMetric">
          <span>{row.quantity} 件</span>
          <strong>{formatMoney(row.amount)}</strong>
        </div>
      </article>
    ))}
  </div>
</section>
```

- [ ] **Step 4: 样式处理**

优先复用现有样式，不新增 CSS。

如果页面测试或视觉结构需要新增类，只允许新增局部 `.dashboardSpu...` 类，不修改全局按钮或布局规则。

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
git commit -m "feat: show dashboard spu rankings"
```

## 5. Task 3：V1.4b-2 交付记录与验证

**Files:**

- Create: `docs/releases/2026-06-18-ecrm-v1-4b-2-spu-dashboard-record.md`

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

Create `docs/releases/2026-06-18-ecrm-v1-4b-2-spu-dashboard-record.md`:

```md
# ECRM V1.4b-2 SPU 表现仪表盘交付记录

## 1. 版本定位

V1.4b-2 在 V1.4b-1 基础上增加热销 SPU 和 SPU 销售额排行。

## 2. 已完成内容

- 热销 SPU 排名。
- SPU 销售额排名。

## 3. 统计口径

- 只统计当前范围内已支付订单。
- 只统计 normal 和 discount_addon 明细。
- 不统计 gift 明细。
- 按 spuSnapshot 聚合。
- 热销 SPU 按售出件数倒序。
- SPU 销售额按 lineTotal 合计金额倒序。
- 每个排行最多展示 5 条。

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

- 本版本不做支付方式统计。
- 本版本不做活动效果统计。
- 本版本不做库存风险扩展。
- 本版本不做毛利和成本快照。
```

- [ ] **Step 6: 提交交付记录**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-4b-2-spu-dashboard-record.md
git commit -m "docs: record v1.4b-2 spu dashboard delivery"
```

## 6. 最终验收清单

- [ ] 领域层有 `topSellingSpuRows`。
- [ ] 领域层有 `topRevenueSpuRows`。
- [ ] SPU 聚合只统计当前范围已支付订单。
- [ ] SPU 聚合排除 gift。
- [ ] SPU 聚合包含 discount_addon。
- [ ] 热销 SPU 按数量排序。
- [ ] SPU 销售额按金额排序。
- [ ] 页面展示“热销 SPU”。
- [ ] 页面展示“SPU 销售额”。
- [ ] 空态中文可见。
- [ ] 不新增 Dexie schema。
- [ ] 不实现 V1.4b-3/V1.4b-4/V1.5。
- [ ] 聚焦测试通过。
- [ ] 全量测试通过。
- [ ] 生产构建通过。
