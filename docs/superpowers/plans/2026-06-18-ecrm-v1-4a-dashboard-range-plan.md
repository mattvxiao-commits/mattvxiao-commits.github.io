# ECRM V1.4a 仪表盘时间范围切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为仪表盘增加今日、昨天、近 3 天、近 7 天和自定义日期范围切换，让现有 V1.4 统计模块全部按所选范围计算，解决跨 0 点后无法复盘历史摆摊数据的问题。

**Architecture:** 先在 `src/domain/dashboard.ts` 把单日 `day` 口径重构为统一 `dateRange` 口径，所有统计都通过同一范围判断函数计算。再在 `DashboardPage.tsx` 增加范围选择 UI 和自定义日期校验；时间切换只重新计算前端模型，不重新读取 Dexie，刷新按钮才重新加载本地数据。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、现有 Dexie repository、现有 CSS。

---

## 0. 执行边界

本计划只实现 V1.4a 时间范围切换。

明确不做：

- V1.4b 的售出件数、客单价、SPU 排行、支付方式、活动效果、库存风险扩展。
- V1.5 的成本快照、毛利、毛利率、库存价值。
- 新 Dexie schema。
- CSV 导出。
- 拖拽式或可配置仪表盘。
- 云同步或多设备实时协作。

## 1. 文件结构

- Modify: `src/domain/dashboard.ts`
  - 新增 `DashboardRangePreset`、`DashboardDateRange`。
  - 新增 `buildDashboardDateRange()`。
  - 将 `buildDashboardModel(input)` 的输入从 `day` 改为 `dateRange`。
  - 所有订单、退款、作废、异常、排行统计改用范围判断。

- Modify: `src/domain/dashboard.test.ts`
  - 更新旧测试从 `day` 改为 `dateRange`。
  - 新增今日、昨天、近 3 天、近 7 天、自定义范围测试。
  - 新增退款、作废、热销 SKU、赠品、异常订单随范围变化的测试。

- Modify: `src/pages/DashboardPage.tsx`
  - 增加范围 preset state。
  - 增加自定义开始/结束日期 state。
  - 增加顶部范围控制 UI。
  - 使用 `buildDashboardDateRange()` 和 `buildDashboardModel({ dateRange, ...data })`。
  - 自定义结束日期早于开始日期时显示中文错误。

- Modify: `src/pages/DashboardPage.test.tsx`
  - 验证默认今日。
  - 验证切换昨天可看到昨天数据。
  - 验证近 3 天、近 7 天、自定义范围。
  - 验证自定义日期错误。
  - 保留加载失败保护测试。

- Modify: `src/styles.css`
  - 增加时间范围控制区样式。
  - 保持现有高密度工具型界面，小屏可换行。

- Create: `docs/releases/2026-06-18-ecrm-v1-4a-dashboard-range-record.md`
  - 记录 V1.4a 交付范围、口径、验证结果和已知限制。

## 2. 关键口径

### 2.1 范围定义

- 今日：本地当天 `00:00:00.000` 到当前时间。
- 昨天：本地昨天 `00:00:00.000` 到昨天 `23:59:59.999`。
- 近 3 天：包含今天在内的最近 3 个自然日，从起始日 `00:00:00.000` 到当前时间。
- 近 7 天：包含今天在内的最近 7 个自然日，从起始日 `00:00:00.000` 到当前时间。
- 自定义范围：开始日期 `00:00:00.000` 到结束日期 `23:59:59.999`。

### 2.2 归属时间

- 已支付订单：`paidAt ?? createdAt`。
- 作废订单：`cancelledAt`。
- 退款记录：`OrderRefund.createdAt`。
- 已作废异常订单：`cancelledAt`。
- 已支付退款/赠品异常订单：`paidAt ?? createdAt`。

### 2.3 UI 文案

范围切换后，指标标签使用中性文案：

- 销售额
- 退款
- 实收
- 订单
- 作废订单
- 部分退款
- 已退款
- 作废备注

区块标题使用：

- 热销 SKU
- 赠品消耗
- 低库存 SKU
- 异常订单

当前范围说明显示：

- `统计范围：2026-06-18 00:00 - 当前`
- `统计范围：2026-06-17 00:00 - 2026-06-17 23:59`

## 3. 任务拆分

### Task 1: 领域层时间范围模型

**Files:**
- Modify: `src/domain/dashboard.ts`
- Modify: `src/domain/dashboard.test.ts`

- [ ] **Step 1: 写失败测试**

Modify `src/domain/dashboard.test.ts`:

```ts
const todayRange = buildDashboardDateRange("today", new Date("2026-06-15T12:00:00.000Z"));
const yesterdayRange = buildDashboardDateRange("yesterday", new Date("2026-06-15T12:00:00.000Z"));
const last3DaysRange = buildDashboardDateRange("last3days", new Date("2026-06-15T12:00:00.000Z"));
const last7DaysRange = buildDashboardDateRange("last7days", new Date("2026-06-15T12:00:00.000Z"));
const customRange = buildDashboardDateRange("custom", new Date("2026-06-15T12:00:00.000Z"), {
  startDate: "2026-06-13",
  endDate: "2026-06-14"
});
```

Add tests:

```ts
test("构建今日、昨天、近 3 天、近 7 天和自定义日期范围", () => {
  expect(todayRange).toMatchObject({ preset: "today", label: "今日" });
  expect(yesterdayRange).toMatchObject({ preset: "yesterday", label: "昨天" });
  expect(last3DaysRange).toMatchObject({ preset: "last3days", label: "近 3 天" });
  expect(last7DaysRange).toMatchObject({ preset: "last7days", label: "近 7 天" });
  expect(customRange).toMatchObject({ preset: "custom", label: "2026-06-13 至 2026-06-14" });
});

test("昨天范围可以统计跨 0 点后需要复盘的昨日订单", () => {
  const model = buildDashboardModel({
    dateRange: yesterdayRange,
    orders: [
      order({ id: "yesterday", payableAmount: 58, paidAt: "2026-06-14T10:00:00.000Z", createdAt: "2026-06-14T09:50:00.000Z" }),
      order({ id: "today", payableAmount: 99, paidAt: "2026-06-15T10:00:00.000Z", createdAt: "2026-06-15T09:50:00.000Z" })
    ],
    orderItems: [
      item({ id: "yesterday-item", orderId: "yesterday", productId: "sku-yesterday", quantity: 2, lineTotal: 58 }),
      item({ id: "today-item", orderId: "today", productId: "sku-today", quantity: 4, lineTotal: 99 })
    ],
    refunds: [],
    products: []
  });

  expect(model.summary.paidAmount).toBe(58);
  expect(model.summary.paidOrderCount).toBe(1);
  expect(model.topSellingSkuRows.map((row) => row.productId)).toEqual(["sku-yesterday"]);
});

test("近 3 天范围包含今天在内的最近 3 个自然日", () => {
  const model = buildDashboardModel({
    dateRange: last3DaysRange,
    orders: [
      order({ id: "day-0", payableAmount: 10, paidAt: "2026-06-15T10:00:00.000Z" }),
      order({ id: "day-1", payableAmount: 20, paidAt: "2026-06-14T10:00:00.000Z" }),
      order({ id: "day-2", payableAmount: 30, paidAt: "2026-06-13T10:00:00.000Z" }),
      order({ id: "day-3", payableAmount: 40, paidAt: "2026-06-12T10:00:00.000Z" })
    ],
    orderItems: [],
    refunds: [],
    products: []
  });

  expect(model.summary.paidAmount).toBe(60);
  expect(model.summary.paidOrderCount).toBe(3);
});

test("自定义范围按开始日期 00:00 到结束日期 23:59 统计退款和作废", () => {
  const model = buildDashboardModel({
    dateRange: customRange,
    orders: [
      order({ id: "paid-in-range", payableAmount: 30, paidAt: "2026-06-13T12:00:00.000Z" }),
      order({ id: "voided-in-range", status: "cancelled", payableAmount: 40, paidAt: undefined, cancelledAt: "2026-06-14T18:00:00.000Z" }),
      order({ id: "outside", payableAmount: 99, paidAt: "2026-06-15T12:00:00.000Z" })
    ],
    orderItems: [],
    refunds: [
      refund({ id: "refund-in-range", orderId: "paid-in-range", amount: 5, createdAt: "2026-06-14T09:00:00.000Z" }),
      refund({ id: "refund-outside", orderId: "paid-in-range", amount: 7, createdAt: "2026-06-15T09:00:00.000Z" })
    ],
    products: []
  });

  expect(model.summary.paidAmount).toBe(30);
  expect(model.summary.refundAmount).toBe(5);
  expect(model.summary.cancelledOrderCount).toBe(1);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- FAIL。
- 失败原因包含 `buildDashboardDateRange` 未导出，或 `buildDashboardModel` 不接受 `dateRange`。

- [ ] **Step 3: 实现时间范围类型和构建函数**

Modify `src/domain/dashboard.ts`:

```ts
export type DashboardRangePreset = "today" | "yesterday" | "last3days" | "last7days" | "custom";

export type DashboardDateRange = {
  preset: DashboardRangePreset;
  startAt: string;
  endAt: string;
  label: string;
  isCurrentRange: boolean;
};

export type DashboardCustomRangeInput = {
  startDate: string;
  endDate: string;
};
```

Add helpers:

```ts
function startOfLocalDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
}

function addLocalDays(day: Date, days: number): Date {
  const next = new Date(day);
  next.setDate(next.getDate() + days);
  return next;
}

function parseLocalDateInput(value: string): Date {
  const [year, month, date] = value.split("-").map(Number);
  return new Date(year, month - 1, date, 0, 0, 0, 0);
}
```

Export:

```ts
export function buildDashboardDateRange(
  preset: DashboardRangePreset,
  now = new Date(),
  custom?: DashboardCustomRangeInput
): DashboardDateRange {
  if (preset === "custom") {
    if (!custom?.startDate || !custom.endDate) {
      throw new Error("自定义日期范围不完整。");
    }

    const start = startOfLocalDay(parseLocalDateInput(custom.startDate));
    const end = endOfLocalDay(parseLocalDateInput(custom.endDate));

    if (end.getTime() < start.getTime()) {
      throw new Error("结束日期不能早于开始日期。");
    }

    return {
      preset,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      label: `${custom.startDate} 至 ${custom.endDate}`,
      isCurrentRange: false
    };
  }

  if (preset === "yesterday") {
    const yesterday = addLocalDays(now, -1);
    return {
      preset,
      startAt: startOfLocalDay(yesterday).toISOString(),
      endAt: endOfLocalDay(yesterday).toISOString(),
      label: "昨天",
      isCurrentRange: false
    };
  }

  if (preset === "last3days" || preset === "last7days") {
    const days = preset === "last3days" ? 3 : 7;
    const start = startOfLocalDay(addLocalDays(now, -(days - 1)));
    return {
      preset,
      startAt: start.toISOString(),
      endAt: now.toISOString(),
      label: preset === "last3days" ? "近 3 天" : "近 7 天",
      isCurrentRange: true
    };
  }

  return {
    preset,
    startAt: startOfLocalDay(now).toISOString(),
    endAt: now.toISOString(),
    label: "今日",
    isCurrentRange: true
  };
}
```

- [ ] **Step 4: 重构模型输入和范围判断**

Change `DashboardInput`:

```ts
export type DashboardInput = {
  dateRange: DashboardDateRange;
  orders: Order[];
  orderItems: OrderItem[];
  refunds: OrderRefund[];
  products: Product[];
};
```

Replace single-day checks with:

```ts
function isWithinRange(value: string | undefined, range: DashboardDateRange): boolean {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();
  return time >= new Date(range.startAt).getTime() && time <= new Date(range.endAt).getTime();
}
```

Update:

- `todayPaidOrders` becomes `rangePaidOrders`。
- `todayPaidOrderIds` becomes `rangePaidOrderIds`。
- `todayCancelledOrders` becomes `rangeCancelledOrders`。
- refund amount filters by `isWithinRange(refund.createdAt, input.dateRange)`。
- top selling, gift, exception rows use range order ids。

- [ ] **Step 5: 更新旧测试输入**

Every existing `buildDashboardModel({ day, ... })` becomes:

```ts
buildDashboardModel({
  dateRange: todayRange,
  ...
})
```

Keep the existing test intent unchanged.

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
git commit -m "feat: add dashboard date ranges"
```

### Task 2: 页面时间范围控制

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 写页面失败测试**

Update `src/pages/DashboardPage.test.tsx` imports:

```ts
import { fireEvent, render, screen, within } from "@testing-library/react";
```

Add helper data:

```ts
function setupRangeOrders() {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "today", orderNo: "ECRM-TODAY", payableAmount: 80, paidAt: "2026-06-15T09:01:00.000Z" }),
    paidOrder({ id: "yesterday", orderNo: "ECRM-YESTERDAY", payableAmount: 58, paidAt: "2026-06-14T09:01:00.000Z" }),
    paidOrder({ id: "three-days", orderNo: "ECRM-THREE", payableAmount: 30, paidAt: "2026-06-13T09:01:00.000Z" }),
    paidOrder({ id: "outside", orderNo: "ECRM-OUT", payableAmount: 99, paidAt: "2026-06-12T09:01:00.000Z" })
  ]);
  repositories.listOrderItems.mockImplementation((orderId: string) =>
    Promise.resolve([
      orderItem({
        id: `${orderId}-item`,
        orderId,
        productId: `sku-${orderId}`,
        productNameSnapshot: `商品-${orderId}`,
        quantity: 1,
        lineTotal: orderId === "today" ? 80 : orderId === "yesterday" ? 58 : orderId === "three-days" ? 30 : 99
      })
    ])
  );
}
```

Add tests:

```ts
test("defaults to today and can switch to yesterday range", async () => {
  setupRangeOrders();

  render(<DashboardPage />);

  expect(await screen.findByText("商品-today")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥80.00");

  fireEvent.click(screen.getByRole("button", { name: "昨天" }));

  expect(await screen.findByText("商品-yesterday")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥58.00");
  expect(screen.queryByText("商品-today")).not.toBeInTheDocument();
});

test("can switch to last 3 days and last 7 days ranges", async () => {
  setupRangeOrders();

  render(<DashboardPage />);

  fireEvent.click(await screen.findByRole("button", { name: "近 3 天" }));
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥168.00");
  expect(screen.getByText("商品-three-days")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "近 7 天" }));
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥267.00");
  expect(screen.getByText("商品-outside")).toBeVisible();
});

test("supports custom date range and validates end date", async () => {
  setupRangeOrders();

  render(<DashboardPage />);

  fireEvent.click(await screen.findByRole("button", { name: "自定义" }));
  fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-06-13" } });
  fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: "2026-06-14" } });

  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥88.00");
  expect(screen.getByText("商品-yesterday")).toBeVisible();
  expect(screen.getByText("商品-three-days")).toBeVisible();

  fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: "2026-06-12" } });
  expect(screen.getByText("结束日期不能早于开始日期。")).toBeVisible();
});
```

Update existing labels in tests:

- `今日经营概览` becomes `经营概览`。
- `今日售后概览` becomes `售后概览`。
- `今日异常订单` becomes `异常订单`。
- metric label `今日销售额` becomes `销售额`。
- metric label `今日退款` becomes `退款`。
- metric label `今日实收` becomes `实收`。
- metric label `今日订单` becomes `订单`。

- [ ] **Step 2: 运行页面测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- FAIL。
- 失败原因包含范围按钮不存在、标签仍是今日文案，或 `buildDashboardModel` 参数不匹配。

- [ ] **Step 3: 接入时间范围 state 和模型**

Modify `DashboardPage.tsx` imports:

```ts
import { buildDashboardDateRange, buildDashboardModel, type DashboardRangePreset } from "../domain/dashboard";
```

Add constants:

```ts
const RANGE_OPTIONS: Array<{ preset: DashboardRangePreset; label: string }> = [
  { preset: "today", label: "今日" },
  { preset: "yesterday", label: "昨天" },
  { preset: "last3days", label: "近 3 天" },
  { preset: "last7days", label: "近 7 天" },
  { preset: "custom", label: "自定义" }
];
```

Add state:

```ts
const [rangePreset, setRangePreset] = useState<DashboardRangePreset>("today");
const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().slice(0, 10));
const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().slice(0, 10));
```

Build range:

```ts
const rangeResult = useMemo(() => {
  try {
    return {
      dateRange: buildDashboardDateRange(rangePreset, new Date(), {
        startDate: customStartDate,
        endDate: customEndDate
      }),
      error: undefined
    };
  } catch (error) {
    return {
      dateRange: buildDashboardDateRange("today", new Date()),
      error: error instanceof Error ? error.message : "日期范围无效。"
    };
  }
}, [customEndDate, customStartDate, rangePreset]);
```

Use model:

```ts
const dashboard = useMemo(
  () =>
    buildDashboardModel({
      dateRange: rangeResult.dateRange,
      orders: data.orders,
      orderItems: data.orderItems,
      products: data.products,
      refunds: data.refunds
    }),
  [data, rangeResult.dateRange]
);
```

- [ ] **Step 4: 增加范围控制 UI**

Inside `.dashboardHeader`, add:

```tsx
<div className="dashboardHeaderControls" aria-label="仪表盘时间范围">
  <div className="dashboardRangeSwitch" role="group" aria-label="时间范围">
    {RANGE_OPTIONS.map((option) => (
      <button
        type="button"
        className={rangePreset === option.preset ? "isActive" : undefined}
        key={option.preset}
        onClick={() => setRangePreset(option.preset)}
      >
        {option.label}
      </button>
    ))}
  </div>
  {rangePreset === "custom" ? (
    <div className="dashboardCustomRange">
      <label>
        <span>开始日期</span>
        <input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
      </label>
      <label>
        <span>结束日期</span>
        <input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
      </label>
    </div>
  ) : null}
  <button type="button" className="secondaryButton" disabled={isLoading} onClick={() => void refreshDashboard()}>
    <RefreshCw size={17} aria-hidden="true" />
    刷新
  </button>
</div>
```

Replace range copy:

```tsx
<p>统计范围：{rangeResult.dateRange.label}</p>
```

Render custom error:

```tsx
{rangeResult.error ? (
  <p className="errorBanner" role="status">
    {rangeResult.error}
  </p>
) : null}
```

Use neutral labels:

```tsx
<div className="dashboardMetricStrip" aria-label="经营概览">
  <div><span>{formatMoney(dashboard.summary.paidAmount)}</span><p>销售额</p></div>
  <div><span>{formatMoney(dashboard.summary.refundAmount)}</span><p>退款</p></div>
  <div><span>{formatMoney(dashboard.summary.netAmount)}</span><p>实收</p></div>
  <div><span>{dashboard.summary.paidOrderCount}</span><p>订单</p></div>
</div>
```

Use neutral exception heading:

```tsx
<h2 id="exception-orders-title">异常订单</h2>
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
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m "feat: add dashboard range controls"
```

### Task 3: 时间范围控制样式

**Files:**
- Modify: `src/styles.css`
- Modify: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 补充样式契约测试**

Add to `src/pages/DashboardPage.test.tsx`:

```ts
test("renders dashboard range controls with compact classes", async () => {
  render(<DashboardPage />);

  expect(await screen.findByRole("group", { name: "时间范围" })).toHaveClass("dashboardRangeSwitch");
  expect(screen.getByLabelText("仪表盘时间范围")).toHaveClass("dashboardHeaderControls");
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- FAIL if classes are missing; PASS is acceptable only if Task 2 already added these exact classes.

- [ ] **Step 3: 增加 CSS**

Modify `src/styles.css` near existing dashboard styles:

```css
.dashboardHeader {
  align-items: flex-end;
}

.dashboardHeaderControls {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.dashboardRangeSwitch {
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 253, 250, 0.86);
}

.dashboardRangeSwitch button {
  min-height: 34px;
  padding: 0 10px;
  border-color: transparent;
  background: transparent;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 900;
}

.dashboardRangeSwitch button.isActive {
  border-color: rgba(47, 111, 94, 0.42);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.dashboardCustomRange {
  display: grid;
  grid-template-columns: repeat(2, minmax(132px, 1fr));
  gap: 8px;
  width: min(360px, 100%);
}

.dashboardCustomRange label {
  display: grid;
  gap: 4px;
}

.dashboardCustomRange span {
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 850;
}

.dashboardCustomRange input {
  min-height: 34px;
  padding: 0 9px;
  font-size: 13px;
}
```

Update `@media (max-width: 720px)`:

```css
.dashboardHeaderControls {
  justify-items: stretch;
}

.dashboardRangeSwitch {
  justify-content: flex-start;
}

.dashboardRangeSwitch button {
  flex: 1 1 auto;
}
```

Update `@media (max-width: 420px)`:

```css
.dashboardCustomRange {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 4: 运行页面测试**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- PASS。

- [ ] **Step 5: 提交 Task 3**

Run:

```powershell
git add src/styles.css src/pages/DashboardPage.test.tsx
git commit -m "style: tighten dashboard range controls"
```

### Task 4: 集成验证和交付记录

**Files:**
- Create: `docs/releases/2026-06-18-ecrm-v1-4a-dashboard-range-record.md`

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

- 无实际空白错误。

- [ ] **Step 5: 创建交付记录**

Create `docs/releases/2026-06-18-ecrm-v1-4a-dashboard-range-record.md`:

```md
# ECRM V1.4a 仪表盘时间范围切换交付记录

## 1. 版本定位

V1.4a 为仪表盘增加今日、昨天、近 3 天、近 7 天和自定义日期范围切换，解决跨 0 点后无法查看昨天或前几天摆摊数据的问题。

本版本不做 V1.4b 经营统计扩展，不做 V1.5 毛利和库存价值。

## 2. 已完成内容

- 今日、昨天、近 3 天、近 7 天、自定义日期范围。
- 当前 V1.4 仪表盘模块全部按所选范围统计。
- 自定义日期范围错误提示。
- 时间范围切换不重复读取 Dexie，点击刷新才重新加载数据。
- 加载失败保护保持可用。

## 3. 统计口径

- 已支付订单按 `paidAt ?? createdAt` 归属范围。
- 作废订单按 `cancelledAt` 归属范围。
- 退款按 `OrderRefund.createdAt` 归属范围。
- 当前范围使用本地浏览器时间。
- 近 3 天和近 7 天包含今天。

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
- 空白检查无实际错误。

## 5. 已知限制

- 不支持时区设置。
- 自定义范围只按日期选择，不支持精确到小时。
- 暂不增加 V1.4b 经营指标。
- 暂不做毛利、毛利率和库存价值。
```

Replace verification bullets with actual counts after commands complete.

- [ ] **Step 6: 提交交付记录**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-4a-dashboard-range-record.md
git commit -m "docs: record v1.4a dashboard range delivery"
```

## 4. 最终验收清单

主控 agent 完成后必须核对：

- [ ] 默认显示今日范围。
- [ ] 切换昨天后能查看昨天数据。
- [ ] 近 3 天包含今天在内 3 个自然日。
- [ ] 近 7 天包含今天在内 7 个自然日。
- [ ] 自定义范围从开始日期 00:00 到结束日期 23:59。
- [ ] 自定义结束日期早于开始日期时显示 `结束日期不能早于开始日期。`
- [ ] 订单、退款、作废、热销 SKU、赠品、异常订单都随范围变化。
- [ ] 低库存仍显示当前库存，不做历史库存回溯。
- [ ] 时间范围切换不触发 repository 重新加载。
- [ ] 刷新按钮仍触发 repository 重新加载。
- [ ] 初始加载失败保护不回归。
- [ ] 不新增 Dexie schema。
- [ ] 不实现 V1.4b/V1.5 内容。
- [ ] 聚焦测试通过。
- [ ] 全量测试通过。
- [ ] 生产构建通过。
- [ ] `git diff --check` 无实际空白错误。
