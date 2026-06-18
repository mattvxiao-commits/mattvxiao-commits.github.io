# ECRM V1.4b-3 支付方式与活动效果仪表盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 V1.4b-2 仪表盘基础上增加支付方式统计和活动效果统计，让线下摆摊复盘时能快速查看收款结构、优惠加购贡献和满赠触发情况。

**Architecture:** 领域层继续在 `src/domain/dashboard.ts` 中基于当前时间范围内已支付订单与订单明细计算只读统计；页面层在 `DashboardPage.tsx` 中复用现有仪表盘紧凑组件展示。V1.4b-3 不新增 Dexie schema，不改订单写入，不做真实支付接口、不做退款按支付方式拆分、不做复杂图表。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、现有 CSS。

---

## 0. 执行边界

本计划只实现 V1.4b-3 支付方式与活动效果。

明确不做：

- 不新增或修改数据库 schema。
- 不修改订单创建、支付、退款、作废写入逻辑。
- 不接入微信、支付宝真实支付 API。
- 不把退款金额拆分回支付方式。
- 不实现库存风险 V1.4b-4。
- 不实现毛利、成本快照或库存价值 V1.5。
- 不实现可配置图表、拖拽仪表盘或 CSV 导出。

## 1. 统计口径

### 1.1 范围订单

所有新增指标只统计当前范围内已支付订单：

```ts
const rangePaidOrders = input.orders.filter(
  (order) => order.status === "paid" && isInDateRange(orderBusinessTime(order), input.dateRange)
);
const rangePaidOrderIds = new Set(rangePaidOrders.map((order) => order.id));
```

### 1.2 支付方式统计

新增领域类型：

```ts
export type DashboardPaymentMethodRow = {
  method: PaymentMethod | "unrecorded";
  label: string;
  orderCount: number;
  amount: number;
};
```

统计当前范围内已支付订单：

- 微信、支付宝、现金、其他、未记录的订单数。
- 微信、支付宝、现金、其他、未记录的订单 `payableAmount` 合计。
- 排序固定为：微信、支付宝、现金、其他、未记录。
- 金额不扣退款。退款拆分支付方式留给后续版本。
- `paymentMethod` 为空的历史订单归入“未记录”。

固定标签：

```ts
const paymentMethodLabels: Record<PaymentMethod | "unrecorded", string> = {
  wechat: "微信",
  alipay: "支付宝",
  cash: "现金",
  other: "其他",
  unrecorded: "未记录"
};
```

### 1.3 活动效果统计

新增领域类型：

```ts
export type DashboardPromotionSummary = {
  addonQuantity: number;
  addonDiscountAmount: number;
  addonOrderCount: number;
  giftTriggeredOrderCount: number;
};

export type DashboardGiftTierRow = {
  threshold: number;
  orderCount: number;
};
```

基于当前范围内已支付订单与对应订单明细：

- 优惠加购件数：`lineType = "discount_addon"` 的 `quantity` 合计。
- 优惠让利金额：`discount_addon` 明细中 `(originalUnitPrice - finalUnitPrice) * quantity` 合计，使用 `roundMoney`。
- 参与优惠订单数：至少有一条 `discount_addon` 明细的订单数。
- 满赠触发订单数：当前范围已支付订单中 `triggeredGiftTier` 为数字的订单数。
- 满赠档位触发次数：按 `Order.triggeredGiftTier` 聚合，按门槛金额升序展示。
- 范围外订单明细不统计。
- 赠品行 `lineType = "gift"` 不计入优惠加购统计。

## 2. 文件结构

- Modify: `src/domain/dashboard.ts`
  - 新增 `DashboardPaymentMethodRow`。
  - 新增 `DashboardPromotionSummary`。
  - 新增 `DashboardGiftTierRow`。
  - 扩展 `DashboardModel`。
  - 新增支付方式统计与活动效果统计计算函数。

- Modify: `src/domain/dashboard.test.ts`
  - 增加支付方式统计测试。
  - 增加活动效果统计测试。
  - 增加无已支付订单时零值/空列表测试。

- Modify: `src/pages/DashboardPage.tsx`
  - 新增“支付方式”模块。
  - 新增“活动效果”模块。
  - 新增“满赠触发”模块。

- Modify: `src/pages/DashboardPage.test.tsx`
  - 增加页面展示测试。
  - 增加空态测试。
  - 增加加载失败不展示新增模块测试。

- Modify: `src/styles.css`
  - 优先不修改。
  - 只有现有 `dashboardRankList` / `dashboardRankRow` / `dashboardRowMetric` 无法满足密度时才增加局部 `.dashboardPromotion...` 类。

- Create: `docs/releases/2026-06-18-ecrm-v1-4b-3-payment-promotion-dashboard-record.md`
  - 中文交付记录。

## 3. Task 1：领域层支付方式与活动效果

**Files:**

- Modify: `src/domain/dashboard.ts`
- Modify: `src/domain/dashboard.test.ts`

- [ ] **Step 1: 写支付方式失败测试**

在 `src/domain/dashboard.test.ts` 中新增测试：

```ts
test("按支付方式统计当前范围已支付订单数和收款金额", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [
      order({ id: "wechat-1", paymentMethod: "wechat", payableAmount: 40 }),
      order({ id: "wechat-2", paymentMethod: "wechat", payableAmount: 10, paidAt: "2026-06-15T10:00:00.000Z" }),
      order({ id: "alipay-1", paymentMethod: "alipay", payableAmount: 30 }),
      order({ id: "cash-1", paymentMethod: "cash", payableAmount: 20 }),
      order({ id: "other-1", paymentMethod: "other", payableAmount: 8 }),
      order({ id: "unrecorded-1", paymentMethod: undefined, payableAmount: 6 }),
      order({ id: "outside", paymentMethod: "wechat", payableAmount: 99, paidAt: "2026-06-14T10:00:00.000Z" }),
      order({ id: "cancelled", status: "cancelled", paymentMethod: "alipay", payableAmount: 70, paidAt: undefined, cancelledAt: "2026-06-15T11:00:00.000Z" })
    ],
    orderItems: [],
    refunds: [refund({ orderId: "wechat-1", amount: 5 })],
    products: []
  });

  expect(model.paymentMethodRows).toEqual([
    { method: "wechat", label: "微信", orderCount: 2, amount: 50 },
    { method: "alipay", label: "支付宝", orderCount: 1, amount: 30 },
    { method: "cash", label: "现金", orderCount: 1, amount: 20 },
    { method: "other", label: "其他", orderCount: 1, amount: 8 },
    { method: "unrecorded", label: "未记录", orderCount: 1, amount: 6 }
  ]);
});
```

- [ ] **Step 2: 写活动效果失败测试**

在 `src/domain/dashboard.test.ts` 中新增测试：

```ts
test("统计当前范围优惠加购与满赠触发效果", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [
      order({ id: "addon-a", triggeredGiftTier: 35 }),
      order({ id: "addon-b", triggeredGiftTier: 68, paidAt: "2026-06-15T10:00:00.000Z" }),
      order({ id: "gift-only", triggeredGiftTier: 68, paidAt: "2026-06-15T10:30:00.000Z" }),
      order({ id: "outside", triggeredGiftTier: 148, paidAt: "2026-06-14T10:00:00.000Z" })
    ],
    orderItems: [
      item({
        id: "addon-a-1",
        orderId: "addon-a",
        productId: "sku-addon-a",
        quantity: 2,
        originalUnitPrice: 5,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 6
      }),
      item({
        id: "addon-b-1",
        orderId: "addon-b",
        productId: "sku-addon-b",
        quantity: 1,
        originalUnitPrice: 5,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 3
      }),
      item({ id: "normal", orderId: "addon-b", productId: "sku-normal", quantity: 4, lineType: "normal", lineTotal: 40 }),
      item({ id: "gift", orderId: "gift-only", productId: "gift-a", quantity: 2, lineType: "gift", lineTotal: 0 }),
      item({
        id: "outside-addon",
        orderId: "outside",
        productId: "sku-outside-addon",
        quantity: 9,
        originalUnitPrice: 5,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 27
      })
    ],
    refunds: [],
    products: []
  });

  expect(model.promotionSummary).toEqual({
    addonQuantity: 3,
    addonDiscountAmount: 6,
    addonOrderCount: 2,
    giftTriggeredOrderCount: 3
  });
  expect(model.giftTierRows).toEqual([
    { threshold: 35, orderCount: 1 },
    { threshold: 68, orderCount: 2 }
  ]);
});
```

- [ ] **Step 3: 写零值失败测试**

在 `src/domain/dashboard.test.ts` 中新增测试：

```ts
test("无已支付订单时支付方式与活动效果指标为空或为 0", () => {
  const model = buildDashboardModel({
    dateRange: todayRange,
    orders: [order({ id: "cancelled", status: "cancelled", paidAt: undefined, cancelledAt: "2026-06-15T10:00:00.000Z" })],
    orderItems: [item({ orderId: "cancelled", lineType: "discount_addon", quantity: 3 })],
    refunds: [],
    products: []
  });

  expect(model.paymentMethodRows).toEqual([
    { method: "wechat", label: "微信", orderCount: 0, amount: 0 },
    { method: "alipay", label: "支付宝", orderCount: 0, amount: 0 },
    { method: "cash", label: "现金", orderCount: 0, amount: 0 },
    { method: "other", label: "其他", orderCount: 0, amount: 0 },
    { method: "unrecorded", label: "未记录", orderCount: 0, amount: 0 }
  ]);
  expect(model.promotionSummary).toEqual({
    addonQuantity: 0,
    addonDiscountAmount: 0,
    addonOrderCount: 0,
    giftTriggeredOrderCount: 0
  });
  expect(model.giftTierRows).toEqual([]);
});
```

- [ ] **Step 4: 运行领域测试确认失败**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- FAIL。
- 失败原因包含 `paymentMethodRows` 或 `promotionSummary` 不存在。

- [ ] **Step 5: 实现领域类型**

在 `src/domain/dashboard.ts` 增加：

```ts
type DashboardPaymentMethodKey = PaymentMethod | "unrecorded";

export type DashboardPaymentMethodRow = {
  method: DashboardPaymentMethodKey;
  label: string;
  orderCount: number;
  amount: number;
};

export type DashboardPromotionSummary = {
  addonQuantity: number;
  addonDiscountAmount: number;
  addonOrderCount: number;
  giftTriggeredOrderCount: number;
};

export type DashboardGiftTierRow = {
  threshold: number;
  orderCount: number;
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
  exceptionRows: DashboardExceptionRow[];
};
```

- [ ] **Step 6: 实现支付方式统计**

在 `src/domain/dashboard.ts` 增加：

```ts
const paymentMethodOrder: DashboardPaymentMethodKey[] = ["wechat", "alipay", "cash", "other", "unrecorded"];

const paymentMethodLabels: Record<DashboardPaymentMethodKey, string> = {
  wechat: "微信",
  alipay: "支付宝",
  cash: "现金",
  other: "其他",
  unrecorded: "未记录"
};

function buildPaymentMethodRows(rangePaidOrders: Order[]): DashboardPaymentMethodRow[] {
  const rowsByMethod = new Map<DashboardPaymentMethodKey, DashboardPaymentMethodRow>();

  for (const method of paymentMethodOrder) {
    rowsByMethod.set(method, {
      method,
      label: paymentMethodLabels[method],
      orderCount: 0,
      amount: 0
    });
  }

  for (const order of rangePaidOrders) {
    const method = order.paymentMethod ?? "unrecorded";
    const existing = rowsByMethod.get(method);

    if (!existing) {
      continue;
    }

    rowsByMethod.set(method, {
      ...existing,
      orderCount: existing.orderCount + 1,
      amount: roundMoney(existing.amount + order.payableAmount)
    });
  }

  return paymentMethodOrder.map((method) => rowsByMethod.get(method)).filter((row): row is DashboardPaymentMethodRow => Boolean(row));
}
```

- [ ] **Step 7: 实现活动效果统计**

在 `src/domain/dashboard.ts` 增加：

```ts
function buildPromotionSummary(rangePaidOrders: Order[], rangePaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardPromotionSummary {
  const addonOrderIds = new Set<string>();
  let addonQuantity = 0;
  let addonDiscountAmount = 0;

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId) || item.lineType !== "discount_addon") {
      continue;
    }

    addonOrderIds.add(item.orderId);
    addonQuantity += item.quantity;
    addonDiscountAmount = roundMoney(addonDiscountAmount + (item.originalUnitPrice - item.finalUnitPrice) * item.quantity);
  }

  return {
    addonQuantity,
    addonDiscountAmount,
    addonOrderCount: addonOrderIds.size,
    giftTriggeredOrderCount: rangePaidOrders.filter((order) => typeof order.triggeredGiftTier === "number").length
  };
}

function buildGiftTierRows(rangePaidOrders: Order[]): DashboardGiftTierRow[] {
  const rowsByThreshold = new Map<number, DashboardGiftTierRow>();

  for (const order of rangePaidOrders) {
    if (typeof order.triggeredGiftTier !== "number") {
      continue;
    }

    const existing = rowsByThreshold.get(order.triggeredGiftTier);
    rowsByThreshold.set(order.triggeredGiftTier, {
      threshold: order.triggeredGiftTier,
      orderCount: (existing?.orderCount ?? 0) + 1
    });
  }

  return [...rowsByThreshold.values()].sort((left, right) => left.threshold - right.threshold);
}
```

在 `buildDashboardModel()` 返回值中增加：

```ts
paymentMethodRows: buildPaymentMethodRows(rangePaidOrders),
promotionSummary: buildPromotionSummary(rangePaidOrders, rangePaidOrderIds, input.orderItems),
giftTierRows: buildGiftTierRows(rangePaidOrders),
```

- [ ] **Step 8: 运行领域测试**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- PASS。

- [ ] **Step 9: 提交 Task 1**

Run:

```powershell
git add src/domain/dashboard.ts src/domain/dashboard.test.ts
git commit -m "feat: add dashboard payment and promotion metrics"
```

## 4. Task 2：页面展示支付方式与活动效果

**Files:**

- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`
- Modify: `src/styles.css` only if needed.

- [ ] **Step 1: 写失败页面测试**

调整 `src/pages/DashboardPage.test.tsx` 中 `loads full dashboard data and renders core sections` 的测试数据：

- `paid-main` 保持 `paymentMethod: "wechat"`。
- `paid-partial` 改为 `paymentMethod: "alipay"`。
- `paid-full` 改为 `paymentMethod: "cash"`。
- 给 `paid-main` 增加一条 `discount_addon` 明细。
- 给 `paid-main` 设置 `triggeredGiftTier: 35`。
- 给 `paid-partial` 设置 `triggeredGiftTier: 68`。

新增断言：

```ts
const paymentMethods = screen.getByRole("region", { name: "支付方式" });
expect(within(paymentMethods).getByText("微信")).toBeVisible();
expect(within(paymentMethods).getByText("1 单")).toBeVisible();
expect(within(paymentMethods).getByText("¥80.00")).toBeVisible();
expect(within(paymentMethods).getByText("支付宝")).toBeVisible();
expect(within(paymentMethods).getByText("¥30.00")).toBeVisible();
expect(within(paymentMethods).getByText("现金")).toBeVisible();
expect(within(paymentMethods).getByText("¥20.00")).toBeVisible();

const promotionOverview = screen.getByLabelText("活动效果");
expectMetricValue(promotionOverview, "加购件数", "2");
expectMetricValue(promotionOverview, "优惠让利", "¥4.00");
expectMetricValue(promotionOverview, "优惠订单", "1");
expectMetricValue(promotionOverview, "满赠订单", "2");

const giftTiers = screen.getByRole("region", { name: "满赠触发" });
expect(within(giftTiers).getByText("满 35")).toBeVisible();
expect(within(giftTiers).getByText("1 单")).toBeVisible();
expect(within(giftTiers).getByText("满 68")).toBeVisible();
```

在 `shows dashboard empty states after successful empty load` 中新增：

```ts
expect(screen.getByText("当前范围暂无支付记录。")).toBeVisible();
expect(screen.getByText("当前范围暂无满赠触发。")).toBeVisible();
expectMetricValue(screen.getByLabelText("活动效果"), "加购件数", "0");
expectMetricValue(screen.getByLabelText("活动效果"), "优惠让利", "¥0.00");
```

在加载失败测试中新增：

```ts
expect(screen.queryByRole("region", { name: "支付方式" })).not.toBeInTheDocument();
expect(screen.queryByLabelText("活动效果")).not.toBeInTheDocument();
expect(screen.queryByRole("region", { name: "满赠触发" })).not.toBeInTheDocument();
```

- [ ] **Step 2: 运行页面测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- FAIL。
- 失败原因包含找不到 `支付方式`、`活动效果` 或 `满赠触发`。

- [ ] **Step 3: 增加页面展示**

在 `src/pages/DashboardPage.tsx` 的 `dashboardOperationsStrip` 后增加活动效果条：

```tsx
<div className="dashboardOperationsStrip" aria-label="活动效果">
  <div>
    <span>{dashboard.promotionSummary.addonQuantity}</span>
    <p>加购件数</p>
  </div>
  <div>
    <span>{formatMoney(dashboard.promotionSummary.addonDiscountAmount)}</span>
    <p>优惠让利</p>
  </div>
  <div>
    <span>{dashboard.promotionSummary.addonOrderCount}</span>
    <p>优惠订单</p>
  </div>
  <div>
    <span>{dashboard.promotionSummary.giftTriggeredOrderCount}</span>
    <p>满赠订单</p>
  </div>
</div>
```

在 `热销 SKU` 前增加支付方式 section：

```tsx
<section className="dashboardSection" aria-labelledby="payment-methods-title">
  <div className="sectionTitle">
    <BarChart3 size={21} aria-hidden="true" />
    <div>
      <h2 id="payment-methods-title">支付方式</h2>
      <p>当前范围已支付订单的收款方式分布。</p>
    </div>
  </div>

  {!isLoading && dashboard.paymentMethodRows.every((row) => row.orderCount === 0) ? (
    <div className="dashboardEmpty">
      <PackageX size={24} aria-hidden="true" />
      <p>当前范围暂无支付记录。</p>
    </div>
  ) : null}

  <div className="dashboardRankList">
    {dashboard.paymentMethodRows.map((row) => (
      <article className="dashboardRankRow" key={row.method}>
        <div>
          <h3>{row.label}</h3>
          <p>支付方式</p>
        </div>
        <div className="dashboardRowMetric">
          <span>{row.orderCount} 单</span>
          <strong>{formatMoney(row.amount)}</strong>
        </div>
      </article>
    ))}
  </div>
</section>
```

在支付方式 section 后增加满赠触发 section：

```tsx
<section className="dashboardSection" aria-labelledby="gift-tier-title">
  <div className="sectionTitle">
    <BarChart3 size={21} aria-hidden="true" />
    <div>
      <h2 id="gift-tier-title">满赠触发</h2>
      <p>当前范围已支付订单触发的满赠档位。</p>
    </div>
  </div>

  {!isLoading && dashboard.giftTierRows.length === 0 ? (
    <div className="dashboardEmpty">
      <PackageX size={24} aria-hidden="true" />
      <p>当前范围暂无满赠触发。</p>
    </div>
  ) : null}

  <div className="dashboardRankList">
    {dashboard.giftTierRows.map((row) => (
      <article className="dashboardRankRow" key={row.threshold}>
        <div>
          <h3>满 {row.threshold}</h3>
          <p>赠品档位</p>
        </div>
        <div className="dashboardRowMetric">
          <span>{row.orderCount} 单</span>
        </div>
      </article>
    ))}
  </div>
</section>
```

- [ ] **Step 4: 样式处理**

优先不改 `src/styles.css`。

如果页面出现明显密度问题，只允许新增 dashboard 命名空间内的局部样式，不修改商品管理、售卖管理、设置页共享规则。

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
git commit -m "feat: show dashboard payment and promotion metrics"
```

## 5. Task 3：V1.4b-3 交付记录与验证

**Files:**

- Create: `docs/releases/2026-06-18-ecrm-v1-4b-3-payment-promotion-dashboard-record.md`

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

Create `docs/releases/2026-06-18-ecrm-v1-4b-3-payment-promotion-dashboard-record.md`:

```md
# ECRM V1.4b-3 支付方式与活动效果仪表盘交付记录

## 1. 版本定位

V1.4b-3 在 V1.4b-2 基础上增加支付方式统计和活动效果统计。

## 2. 已完成内容

- 支付方式订单数与金额统计。
- 优惠加购件数、优惠让利金额、参与优惠订单数统计。
- 满赠触发订单数与满赠档位触发次数统计。
- 仪表盘新增“支付方式”“活动效果”“满赠触发”展示。

## 3. 统计口径

- 只统计当前范围内已支付订单。
- 支付方式金额使用订单 payableAmount，不扣退款。
- 无 paymentMethod 的历史订单归入“未记录”。
- 优惠加购只统计 discount_addon 明细。
- 优惠让利金额为 `(originalUnitPrice - finalUnitPrice) * quantity`。
- 满赠触发按 Order.triggeredGiftTier 聚合。

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

- 本版本不把退款拆分回支付方式。
- 本版本不接入真实微信或支付宝支付 API。
- 本版本不做库存风险 V1.4b-4。
- 本版本不做毛利和成本快照 V1.5。
```

- [ ] **Step 6: 提交交付记录**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-4b-3-payment-promotion-dashboard-record.md
git commit -m "docs: record v1.4b-3 payment promotion dashboard delivery"
```

## 6. 最终验收清单

- [ ] 领域层有 `paymentMethodRows`。
- [ ] 领域层有 `promotionSummary`。
- [ ] 领域层有 `giftTierRows`。
- [ ] 支付方式只统计当前范围已支付订单。
- [ ] 支付方式金额不扣退款。
- [ ] 未记录支付方式能归类展示。
- [ ] 活动效果只统计当前范围已支付订单明细。
- [ ] 优惠加购只统计 `discount_addon`。
- [ ] 满赠档位按 `triggeredGiftTier` 聚合。
- [ ] 页面展示“支付方式”。
- [ ] 页面展示“活动效果”。
- [ ] 页面展示“满赠触发”。
- [ ] 空态中文可见。
- [ ] 不新增 Dexie schema。
- [ ] 不实现 V1.4b-4/V1.5。
- [ ] 聚焦测试通过。
- [ ] 全量测试通过。
- [ ] 生产构建通过。
