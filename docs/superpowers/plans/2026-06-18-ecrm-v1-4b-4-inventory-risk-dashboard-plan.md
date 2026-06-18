# ECRM V1.4b-4 库存风险仪表盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 V1.4b-3 仪表盘基础上增加库存风险统计，让线下摆摊收摊后能快速查看售罄、低库存、高风险、滞销和补货建议。

**Architecture:** 领域层继续在 `src/domain/dashboard.ts` 中基于当前商品库存与当前时间范围已支付订单明细计算库存风险；页面层在 `DashboardPage.tsx` 中复用现有紧凑列表展示。V1.4b-4 不新增 Dexie schema，不回溯历史库存，不修改订单或商品写入逻辑。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、现有 CSS。

---

## 0. 执行边界

本计划只实现 V1.4b-4 库存风险。

明确不做：

- 不新增或修改数据库 schema。
- 不修改商品、订单、库存流水写入逻辑。
- 不按日期回溯历史库存。
- 不做成本快照、毛利、毛利率或库存价值。
- 不做自动采购单、自动补货任务或库存预警推送。
- 不做 CSV 导出。
- 不做可配置图表或拖拽仪表盘。

## 1. 统计口径

### 1.1 范围订单

销量类库存风险只统计当前范围内已支付订单：

```ts
const rangePaidOrders = input.orders.filter(
  (order) => order.status === "paid" && isInDateRange(orderBusinessTime(order), input.dateRange)
);
const rangePaidOrderIds = new Set(rangePaidOrders.map((order) => order.id));
```

当前范围销量只统计可销售出库行：

- 统计 `lineType = "normal"`。
- 统计 `lineType = "discount_addon"`。
- 不统计 `lineType = "gift"`。

### 1.2 当前库存

库存风险使用 `input.products` 的当前库存，不按时间范围回溯：

- 当前售罄 SKU：`status = "active"` 且 `stockQty = 0`。
- 当前低库存 SKU：沿用现有 `lowStockRows`，即 `status = "active"` 且 `stockQty < 3`。
- 当前高风险 SKU：`status = "active"`、`isSellable = true`、当前范围售出件数 `soldQuantity >= 2`、当前库存 `stockQty <= 2`。
- 当前滞销 SKU：`status = "active"`、`isSellable = true`、当前库存 `stockQty > 0`、当前范围售出件数 `soldQuantity = 0`。
- 补货建议：与高风险 SKU 使用同一批数据，但页面文案偏行动建议。

说明：

- 仅赠品不可售 SKU 不进入滞销和高风险，因为它不是可售单元。
- 售罄 SKU 可以包含可售商品和仅赠品商品，只要商品启用且库存为 0。
- 低库存 SKU 保持 V1.4 现有口径，不在本版本移除或替换。

### 1.3 排序与截断

高风险和补货建议排序：

1. 当前库存 `stockQty` 升序。
2. 当前范围售出件数 `soldQuantity` 降序。
3. 商品名称中文排序。
4. 最多 5 条。

滞销 SKU 排序：

1. 当前库存 `stockQty` 降序。
2. 商品名称中文排序。
3. 最多 5 条。

售罄 SKU 排序：

1. 商品名称中文排序。
2. 最多 5 条。

## 2. 文件结构

- Modify: `src/domain/dashboard.ts`
  - 新增库存风险类型。
  - 扩展 `DashboardModel`。
  - 新增当前范围可售销量 Map。
  - 新增售罄、高风险、滞销和补货建议计算。

- Modify: `src/domain/dashboard.test.ts`
  - 增加售罄、高风险、滞销、补货建议领域测试。
  - 增加过滤 gift、inactive、不可售商品测试。
  - 增加排序和 top 5 测试。

- Modify: `src/pages/DashboardPage.tsx`
  - 新增“售罄 SKU”模块。
  - 新增“高风险 SKU”模块。
  - 新增“滞销 SKU”模块。
  - 新增“补货建议”模块。

- Modify: `src/pages/DashboardPage.test.tsx`
  - 增加页面展示测试。
  - 增加空态测试。
  - 增加加载失败不展示新增模块测试。

- Modify: `src/styles.css`
  - 优先不修改。
  - 如需要标记建议文案，只允许新增 `.dashboard...` 命名空间局部样式。

- Create: `docs/releases/2026-06-18-ecrm-v1-4b-4-inventory-risk-dashboard-record.md`
  - 中文交付记录。

## 3. Task 1：领域层库存风险统计

**Files:**

- Modify: `src/domain/dashboard.ts`
- Modify: `src/domain/dashboard.test.ts`

- [ ] **Step 1: 写库存风险失败测试**

在 `src/domain/dashboard.test.ts` 中新增测试：

```ts
test("统计售罄、高风险、滞销和补货建议 SKU", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [
      order({ id: "paid-a" }),
      order({ id: "paid-b", paidAt: "2026-06-15T10:00:00.000Z" }),
      order({ id: "outside", paidAt: "2026-06-14T10:00:00.000Z" })
    ],
    orderItems: [
      item({ id: "risk-a-1", orderId: "paid-a", productId: "risk-a", productNameSnapshot: "热卖低库存 A", quantity: 2, lineType: "normal" }),
      item({
        id: "risk-b-1",
        orderId: "paid-b",
        productId: "risk-b",
        productNameSnapshot: "热卖低库存 B",
        quantity: 3,
        lineType: "discount_addon"
      }),
      item({ id: "gift-only", orderId: "paid-a", productId: "gift-only", productNameSnapshot: "赠品消耗", quantity: 9, lineType: "gift" }),
      item({ id: "outside-risk", orderId: "outside", productId: "outside-risk", productNameSnapshot: "范围外商品", quantity: 9, lineType: "normal" })
    ],
    refunds: [],
    products: [
      product({ id: "sold-out", name: "售罄商品", stockQty: 0, isSellable: true, status: "active" }),
      product({ id: "risk-a", name: "热卖低库存 A", stockQty: 2, isSellable: true, status: "active" }),
      product({ id: "risk-b", name: "热卖低库存 B", stockQty: 1, isSellable: true, status: "active" }),
      product({ id: "stale-a", name: "滞销 A", stockQty: 8, isSellable: true, status: "active" }),
      product({ id: "stale-b", name: "滞销 B", stockQty: 3, isSellable: true, status: "active" }),
      product({ id: "gift-only", name: "仅赠品", stockQty: 1, isSellable: false, isGiftEligible: true, status: "active" }),
      product({ id: "inactive", name: "停用商品", stockQty: 0, status: "inactive" }),
      product({ id: "outside-risk", name: "范围外商品", stockQty: 1, isSellable: true, status: "active" })
    ]
  });

  expect(model.soldOutRows.map((row) => row.productId)).toEqual(["sold-out"]);
  expect(model.highRiskRows.map((row) => row.productId)).toEqual(["risk-b", "risk-a"]);
  expect(model.highRiskRows[0]).toMatchObject({ productId: "risk-b", soldQuantity: 3, stockQty: 1 });
  expect(model.restockSuggestionRows.map((row) => row.productId)).toEqual(["risk-b", "risk-a"]);
  expect(model.slowMovingRows.map((row) => row.productId)).toEqual(["stale-a", "stale-b"]);
});
```

- [ ] **Step 2: 写排序和 top 5 失败测试**

在 `src/domain/dashboard.test.ts` 中新增测试：

```ts
test("库存风险排行最多 5 条并按库存和销量排序", () => {
  const products = [
    product({ id: "risk-1", name: "风险 1", stockQty: 0 }),
    product({ id: "risk-2", name: "风险 2", stockQty: 1 }),
    product({ id: "risk-3", name: "风险 3", stockQty: 1 }),
    product({ id: "risk-4", name: "风险 4", stockQty: 2 }),
    product({ id: "risk-5", name: "风险 5", stockQty: 2 }),
    product({ id: "risk-6", name: "风险 6", stockQty: 2 }),
    product({ id: "stale-1", name: "滞销 1", stockQty: 9 }),
    product({ id: "stale-2", name: "滞销 2", stockQty: 8 }),
    product({ id: "stale-3", name: "滞销 3", stockQty: 7 }),
    product({ id: "stale-4", name: "滞销 4", stockQty: 6 }),
    product({ id: "stale-5", name: "滞销 5", stockQty: 5 }),
    product({ id: "stale-6", name: "滞销 6", stockQty: 4 })
  ];

  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [order({ id: "paid-a" })],
    orderItems: [
      item({ id: "risk-1-item", orderId: "paid-a", productId: "risk-1", quantity: 2 }),
      item({ id: "risk-2-item", orderId: "paid-a", productId: "risk-2", quantity: 4 }),
      item({ id: "risk-3-item", orderId: "paid-a", productId: "risk-3", quantity: 2 }),
      item({ id: "risk-4-item", orderId: "paid-a", productId: "risk-4", quantity: 5 }),
      item({ id: "risk-5-item", orderId: "paid-a", productId: "risk-5", quantity: 3 }),
      item({ id: "risk-6-item", orderId: "paid-a", productId: "risk-6", quantity: 2 })
    ],
    refunds: [],
    products
  });

  expect(model.highRiskRows.map((row) => row.productId)).toEqual(["risk-1", "risk-2", "risk-3", "risk-4", "risk-5"]);
  expect(model.highRiskRows).toHaveLength(5);
  expect(model.slowMovingRows.map((row) => row.productId)).toEqual(["stale-1", "stale-2", "stale-3", "stale-4", "stale-5"]);
  expect(model.slowMovingRows).toHaveLength(5);
});
```

- [ ] **Step 3: 运行领域测试确认失败**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- FAIL。
- 失败原因包含 `soldOutRows`、`highRiskRows` 或 `slowMovingRows` 不存在。

- [ ] **Step 4: 实现领域类型**

在 `src/domain/dashboard.ts` 增加：

```ts
export type DashboardInventoryRiskRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  stockQty: number;
  soldQuantity: number;
};
```

扩展 `DashboardModel`：

```ts
export type DashboardModel = {
  summary: DashboardSummary;
  operationsSummary: DashboardOperationsSummary;
  paymentMethodRows: DashboardPaymentMethodRow[];
  promotionSummary: DashboardPromotionSummary;
  giftTierRows: DashboardGiftTierRow[];
  topSellingSkuRows: DashboardSkuRow[];
  topSellingSpuRows: DashboardSpuRow[];
  topRevenueSpuRows: DashboardSpuRow[];
  giftConsumptionRows: DashboardGiftRow[];
  lowStockRows: DashboardLowStockRow[];
  soldOutRows: DashboardInventoryRiskRow[];
  highRiskRows: DashboardInventoryRiskRow[];
  slowMovingRows: DashboardInventoryRiskRow[];
  restockSuggestionRows: DashboardInventoryRiskRow[];
  exceptionRows: DashboardExceptionRow[];
};
```

- [ ] **Step 5: 实现销量 Map 与库存风险函数**

在 `src/domain/dashboard.ts` 增加：

```ts
function buildSoldQuantityByProduct(rangePaidOrderIds: Set<string>, orderItems: OrderItem[]): Map<string, number> {
  const soldQuantityByProduct = new Map<string, number>();

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId) || item.lineType === "gift") {
      continue;
    }

    soldQuantityByProduct.set(item.productId, (soldQuantityByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  return soldQuantityByProduct;
}

function toInventoryRiskRow(product: Product, soldQuantity: number): DashboardInventoryRiskRow {
  return {
    productId: product.id,
    productName: product.name,
    spu: product.spu,
    productCode: product.productCode,
    stockQty: product.stockQty,
    soldQuantity
  };
}

function sortInventoryRiskRows(rows: DashboardInventoryRiskRow[]): DashboardInventoryRiskRow[] {
  return [...rows].sort((left, right) => {
    if (left.stockQty !== right.stockQty) {
      return left.stockQty - right.stockQty;
    }

    if (right.soldQuantity !== left.soldQuantity) {
      return right.soldQuantity - left.soldQuantity;
    }

    return left.productName.localeCompare(right.productName, "zh-Hans-CN");
  });
}

function buildInventoryRiskRows(
  products: Product[],
  soldQuantityByProduct: Map<string, number>
): {
  soldOutRows: DashboardInventoryRiskRow[];
  highRiskRows: DashboardInventoryRiskRow[];
  slowMovingRows: DashboardInventoryRiskRow[];
  restockSuggestionRows: DashboardInventoryRiskRow[];
} {
  const activeProducts = products.filter((product) => product.status === "active");

  const soldOutRows = activeProducts
    .filter((product) => product.stockQty === 0)
    .map((product) => toInventoryRiskRow(product, soldQuantityByProduct.get(product.id) ?? 0))
    .sort((left, right) => left.productName.localeCompare(right.productName, "zh-Hans-CN"))
    .slice(0, 5);

  const highRiskRows = sortInventoryRiskRows(
    activeProducts
      .filter((product) => product.isSellable && product.stockQty <= 2 && (soldQuantityByProduct.get(product.id) ?? 0) >= 2)
      .map((product) => toInventoryRiskRow(product, soldQuantityByProduct.get(product.id) ?? 0))
  ).slice(0, 5);

  const slowMovingRows = activeProducts
    .filter((product) => product.isSellable && product.stockQty > 0 && (soldQuantityByProduct.get(product.id) ?? 0) === 0)
    .map((product) => toInventoryRiskRow(product, 0))
    .sort((left, right) => {
      if (right.stockQty !== left.stockQty) {
        return right.stockQty - left.stockQty;
      }

      return left.productName.localeCompare(right.productName, "zh-Hans-CN");
    })
    .slice(0, 5);

  return {
    soldOutRows,
    highRiskRows,
    slowMovingRows,
    restockSuggestionRows: highRiskRows
  };
}
```

在 `buildDashboardModel()` 中增加：

```ts
const soldQuantityByProduct = buildSoldQuantityByProduct(rangePaidOrderIds, input.orderItems);
const inventoryRiskRows = buildInventoryRiskRows(input.products, soldQuantityByProduct);
```

返回值增加：

```ts
soldOutRows: inventoryRiskRows.soldOutRows,
highRiskRows: inventoryRiskRows.highRiskRows,
slowMovingRows: inventoryRiskRows.slowMovingRows,
restockSuggestionRows: inventoryRiskRows.restockSuggestionRows,
```

- [ ] **Step 6: 运行领域测试**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- PASS。

- [ ] **Step 7: 提交 Task 1**

Run:

```powershell
git add src/domain/dashboard.ts src/domain/dashboard.test.ts
git commit -m "feat: add dashboard inventory risk metrics"
```

## 4. Task 2：页面展示库存风险

**Files:**

- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`
- Modify: `src/styles.css` only if needed.

- [ ] **Step 1: 写失败页面测试**

在 `src/pages/DashboardPage.test.tsx` 的 `loads full dashboard data and renders core sections` 测试中调整 `listProducts` 数据，增加：

```ts
product({ id: "sku-a", name: "热销挂件", spu: "挂件", stockQty: 1, status: "active" }),
product({ id: "sold-out", name: "售罄商品", spu: "挂件", stockQty: 0, status: "active" }),
product({ id: "stale-a", name: "滞销库存", spu: "纸品", stockQty: 9, isSellable: true, status: "active" })
```

新增断言：

```ts
const soldOut = screen.getByRole("region", { name: "售罄 SKU" });
expect(within(soldOut).getByText("售罄商品")).toBeVisible();
expect(within(soldOut).getByText("库存 0")).toBeVisible();

const highRisk = screen.getByRole("region", { name: "高风险 SKU" });
expect(within(highRisk).getByText("热销挂件")).toBeVisible();
expect(within(highRisk).getByText("售出 3 件")).toBeVisible();
expect(within(highRisk).getByText("库存 1")).toBeVisible();

const slowMoving = screen.getByRole("region", { name: "滞销 SKU" });
expect(within(slowMoving).getByText("滞销库存")).toBeVisible();
expect(within(slowMoving).getByText("库存 9")).toBeVisible();

const restockSuggestions = screen.getByRole("region", { name: "补货建议" });
expect(within(restockSuggestions).getByText("热销挂件")).toBeVisible();
expect(within(restockSuggestions).getByText("建议补货")).toBeVisible();
```

在 `shows dashboard empty states after successful empty load` 中新增：

```ts
expect(screen.getByText("暂无售罄 SKU。")).toBeVisible();
expect(screen.getByText("暂无高风险 SKU。")).toBeVisible();
expect(screen.getByText("暂无滞销 SKU。")).toBeVisible();
expect(screen.getByText("暂无补货建议。")).toBeVisible();
```

在加载失败测试中新增：

```ts
expect(screen.queryByRole("region", { name: "售罄 SKU" })).not.toBeInTheDocument();
expect(screen.queryByRole("region", { name: "高风险 SKU" })).not.toBeInTheDocument();
expect(screen.queryByRole("region", { name: "滞销 SKU" })).not.toBeInTheDocument();
expect(screen.queryByRole("region", { name: "补货建议" })).not.toBeInTheDocument();
```

- [ ] **Step 2: 运行页面测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- FAIL。
- 失败原因包含找不到 `售罄 SKU`、`高风险 SKU`、`滞销 SKU` 或 `补货建议`。

- [ ] **Step 3: 增加页面展示**

在 `src/pages/DashboardPage.tsx` 中，在现有“低库存 SKU”section 后、“异常订单”section 前增加四个 section：

```tsx
<section className="dashboardSection" aria-labelledby="sold-out-sku-title">
  <div className="sectionTitle">
    <AlertTriangle size={21} aria-hidden="true" />
    <div>
      <h2 id="sold-out-sku-title">售罄 SKU</h2>
      <p>当前库存为 0 的启用商品。</p>
    </div>
  </div>

  {!isLoading && dashboard.soldOutRows.length === 0 ? (
    <div className="dashboardEmpty">
      <PackageX size={24} aria-hidden="true" />
      <p>暂无售罄 SKU。</p>
    </div>
  ) : null}

  <div className="dashboardRankList">
    {dashboard.soldOutRows.map((row) => (
      <article className="dashboardRankRow" key={row.productId}>
        <div>
          <h3>{row.productName}</h3>
          <p>{row.productCode ?? row.spu}</p>
        </div>
        <div className="dashboardRowMetric isOut">
          <span>库存 {row.stockQty}</span>
        </div>
      </article>
    ))}
  </div>
</section>
```

高风险 SKU：

```tsx
<section className="dashboardSection" aria-labelledby="high-risk-sku-title">
  <div className="sectionTitle">
    <AlertTriangle size={21} aria-hidden="true" />
    <div>
      <h2 id="high-risk-sku-title">高风险 SKU</h2>
      <p>当前范围卖得快且库存低的可售商品。</p>
    </div>
  </div>

  {!isLoading && dashboard.highRiskRows.length === 0 ? (
    <div className="dashboardEmpty">
      <PackageX size={24} aria-hidden="true" />
      <p>暂无高风险 SKU。</p>
    </div>
  ) : null}

  <div className="dashboardRankList">
    {dashboard.highRiskRows.map((row) => (
      <article className="dashboardRankRow" key={row.productId}>
        <div>
          <h3>{row.productName}</h3>
          <p>{row.productCode ?? row.spu}</p>
        </div>
        <div className={row.stockQty === 0 ? "dashboardRowMetric isOut" : "dashboardRowMetric"}>
          <span>售出 {row.soldQuantity} 件</span>
          <strong>库存 {row.stockQty}</strong>
        </div>
      </article>
    ))}
  </div>
</section>
```

滞销 SKU：

```tsx
<section className="dashboardSection" aria-labelledby="slow-moving-sku-title">
  <div className="sectionTitle">
    <BarChart3 size={21} aria-hidden="true" />
    <div>
      <h2 id="slow-moving-sku-title">滞销 SKU</h2>
      <p>当前范围无销量且仍有库存的可售商品。</p>
    </div>
  </div>

  {!isLoading && dashboard.slowMovingRows.length === 0 ? (
    <div className="dashboardEmpty">
      <PackageX size={24} aria-hidden="true" />
      <p>暂无滞销 SKU。</p>
    </div>
  ) : null}

  <div className="dashboardRankList">
    {dashboard.slowMovingRows.map((row) => (
      <article className="dashboardRankRow" key={row.productId}>
        <div>
          <h3>{row.productName}</h3>
          <p>{row.productCode ?? row.spu}</p>
        </div>
        <div className="dashboardRowMetric">
          <span>售出 {row.soldQuantity} 件</span>
          <strong>库存 {row.stockQty}</strong>
        </div>
      </article>
    ))}
  </div>
</section>
```

补货建议：

```tsx
<section className="dashboardSection" aria-labelledby="restock-suggestion-title">
  <div className="sectionTitle">
    <AlertTriangle size={21} aria-hidden="true" />
    <div>
      <h2 id="restock-suggestion-title">补货建议</h2>
      <p>建议优先补货的高风险可售商品。</p>
    </div>
  </div>

  {!isLoading && dashboard.restockSuggestionRows.length === 0 ? (
    <div className="dashboardEmpty">
      <PackageX size={24} aria-hidden="true" />
      <p>暂无补货建议。</p>
    </div>
  ) : null}

  <div className="dashboardRankList">
    {dashboard.restockSuggestionRows.map((row) => (
      <article className="dashboardRankRow" key={row.productId}>
        <div>
          <h3>{row.productName}</h3>
          <p>{row.productCode ?? row.spu}</p>
        </div>
        <div className={row.stockQty === 0 ? "dashboardRowMetric isOut" : "dashboardRowMetric"}>
          <span>建议补货</span>
          <strong>售出 {row.soldQuantity} / 库存 {row.stockQty}</strong>
        </div>
      </article>
    ))}
  </div>
</section>
```

- [ ] **Step 4: 样式处理**

优先不改 `src/styles.css`。

如果出现明显拥挤或文字溢出，只允许新增 dashboard 命名空间内局部样式，不修改商品管理、售卖管理、设置页共享规则。

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
git commit -m "feat: show dashboard inventory risk metrics"
```

## 5. Task 3：V1.4b-4 交付记录与验证

**Files:**

- Create: `docs/releases/2026-06-18-ecrm-v1-4b-4-inventory-risk-dashboard-record.md`

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

- 无 whitespace error。

- [ ] **Step 5: 创建交付记录**

Create `docs/releases/2026-06-18-ecrm-v1-4b-4-inventory-risk-dashboard-record.md`:

```md
# ECRM V1.4b-4 库存风险仪表盘交付记录

## 1. 版本定位

V1.4b-4 在 V1.4b-3 基础上增加库存风险统计。

## 2. 已完成内容

- 售罄 SKU。
- 高风险 SKU。
- 滞销 SKU。
- 补货建议。

## 3. 统计口径

- 库存使用当前商品库存，不按日期回溯。
- 售罄 SKU 为启用且库存为 0 的商品。
- 高风险 SKU 为当前范围售出件数 >= 2 且当前库存 <= 2 的启用可售商品。
- 滞销 SKU 为当前范围售出件数 = 0、当前库存 > 0、启用且可售的商品。
- 补货建议与高风险 SKU 使用同一数据。
- gift 明细不计入销量判断。

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

- 本版本不按日期回溯历史库存。
- 本版本不自动生成采购单。
- 本版本不做成本、毛利或库存价值统计。
```

- [ ] **Step 6: 提交交付记录**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-4b-4-inventory-risk-dashboard-record.md
git commit -m "docs: record v1.4b-4 inventory risk dashboard delivery"
```

## 6. 最终验收清单

- [ ] 领域层有 `soldOutRows`。
- [ ] 领域层有 `highRiskRows`。
- [ ] 领域层有 `slowMovingRows`。
- [ ] 领域层有 `restockSuggestionRows`。
- [ ] 高风险统计使用当前范围 normal + discount_addon 销量。
- [ ] 高风险统计排除 gift 销量。
- [ ] 高风险统计排除 inactive 和不可售商品。
- [ ] 滞销统计排除 inactive 和不可售商品。
- [ ] 售罄统计使用当前库存。
- [ ] 页面展示“售罄 SKU”。
- [ ] 页面展示“高风险 SKU”。
- [ ] 页面展示“滞销 SKU”。
- [ ] 页面展示“补货建议”。
- [ ] 空态中文可见。
- [ ] 不新增 Dexie schema。
- [ ] 不实现 V1.5。
- [ ] 聚焦测试通过。
- [ ] 全量测试通过。
- [ ] 生产构建通过。
