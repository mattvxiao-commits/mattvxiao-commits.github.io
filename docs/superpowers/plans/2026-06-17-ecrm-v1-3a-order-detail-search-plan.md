# ECRM V1.3a Order Detail And Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 V1.3a 的只读订单详情、订单检索、订单筛选和订单库存流水摘要，为 V1.3b 作废与 V1.3c 退款提供稳定入口。

**Architecture:** V1.3a 不改变订单状态、不新增订单调整表、不升级备份版本；所有改动保持只读。新增订单筛选纯函数放在 `src/domain/orderHistory.ts`，订单详情弹窗放在 `src/components/OrderDetailDialog.tsx`，`SalesPage` 只负责加载订单明细/库存流水、维护筛选状态和打开详情弹窗。数据读取沿用 Dexie repository，并新增按订单读取库存流水方法。

**Tech Stack:** React 19, TypeScript, Dexie, Zustand, Vitest, Testing Library, Vite, lucide-react.

---

## File Structure

- Create `src/domain/orderHistory.ts`
  - 订单筛选、排序、日期范围判断、状态/支付方式标签。
  - 保持纯函数，便于单元测试和 V1.4 仪表盘复用。
- Create `src/domain/orderHistory.test.ts`
  - 覆盖订单号搜索、日期筛选、支付方式筛选、状态筛选、支付时间优先排序。
- Modify `src/db/repositories.ts`
  - 新增 `listInventoryLogsForOrder(orderId: string)`。
  - 不改变 `savePaidOrder`。
- Modify `src/db/repositories.test.ts`
  - 覆盖按订单读取库存流水。
- Create `src/components/OrderDetailDialog.tsx`
  - 只读订单详情弹窗。
  - 展示基本信息、商品明细、促销摘要、库存流水摘要。
  - 不显示作废/退款按钮。
- Create `src/components/OrderDetailDialog.test.tsx`
  - 覆盖历史订单快照展示、赠品行、库存流水、关闭按钮。
- Modify `src/pages/SalesPage.tsx`
  - 订单记录从最近 10 笔已支付升级为筛选列表。
  - 点击订单行加载订单明细和库存流水，打开详情弹窗。
  - 增加订单号搜索、日期、状态、支付方式筛选。
- Modify `src/pages/SalesPage.test.tsx`
  - 覆盖筛选搜索、点击订单打开详情、不会显示作废/退款操作。
- Modify `src/styles.css`
  - 添加订单筛选、订单详情弹窗、详情明细行样式。

---

## Task 1: Order History Domain Filters

**Files:**
- Create: `src/domain/orderHistory.ts`
- Create: `src/domain/orderHistory.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/orderHistory.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";
import { defaultPromotion } from "../test/fixtures";
import type { Order } from "./types";
import {
  dateRangeLabels,
  filterAndSortOrders,
  orderStatusLabels,
  paymentMethodLabels,
  type OrderDateRange,
  type OrderHistoryFilters
} from "./orderHistory";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNo: "ECRM-20260617-001",
    status: "paid",
    paymentMethod: "wechat",
    subtotalBeforeDiscount: 20,
    discountAmount: 0,
    payableAmount: 20,
    promotionSnapshot: defaultPromotion(),
    giftStockWarning: false,
    createdAt: "2026-06-17T09:00:00.000Z",
    paidAt: "2026-06-17T09:05:00.000Z",
    ...overrides
  };
}

const emptyFilters: OrderHistoryFilters = {
  query: "",
  dateRange: "all",
  status: "all",
  paymentMethod: "all"
};

describe("order history filters", () => {
  test("filters by order number query case-insensitively", () => {
    const result = filterAndSortOrders(
      [
        order({ id: "match", orderNo: "ECRM-20260617-ABC" }),
        order({ id: "miss", orderNo: "SHOP-20260617-002" })
      ],
      { ...emptyFilters, query: "abc" },
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(["match"]);
  });

  test.each([
    ["today", ["today"]],
    ["yesterday", ["yesterday"]],
    ["last7", ["today", "yesterday", "last7"]],
    ["last30", ["today", "yesterday", "last7", "last30"]],
    ["all", ["today", "yesterday", "last7", "last30", "old"]]
  ] satisfies Array<[OrderDateRange, string[]]>)("filters date range %s", (dateRange, expectedIds) => {
    const result = filterAndSortOrders(
      [
        order({ id: "today", paidAt: "2026-06-17T08:00:00.000Z", createdAt: "2026-06-16T20:00:00.000Z" }),
        order({ id: "yesterday", paidAt: undefined, createdAt: "2026-06-16T09:00:00.000Z" }),
        order({ id: "last7", paidAt: "2026-06-12T09:00:00.000Z" }),
        order({ id: "last30", paidAt: "2026-05-25T09:00:00.000Z" }),
        order({ id: "old", paidAt: "2026-05-01T09:00:00.000Z" })
      ],
      { ...emptyFilters, dateRange },
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(expectedIds);
  });

  test("filters by status and payment method", () => {
    const result = filterAndSortOrders(
      [
        order({ id: "wechat-paid", status: "paid", paymentMethod: "wechat" }),
        order({ id: "cash-paid", status: "paid", paymentMethod: "cash" }),
        order({ id: "pending", status: "pending_payment", paymentMethod: "wechat" })
      ],
      { ...emptyFilters, status: "paid", paymentMethod: "cash" },
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(["cash-paid"]);
  });

  test("sorts by paid time with created time fallback descending", () => {
    const result = filterAndSortOrders(
      [
        order({ id: "created-middle", paidAt: undefined, createdAt: "2026-06-17T10:00:00.000Z" }),
        order({ id: "paid-newest", paidAt: "2026-06-17T11:00:00.000Z", createdAt: "2026-06-17T08:00:00.000Z" }),
        order({ id: "paid-oldest", paidAt: "2026-06-17T09:00:00.000Z" })
      ],
      emptyFilters,
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(["paid-newest", "created-middle", "paid-oldest"]);
  });

  test("exports Chinese labels used by the sales page", () => {
    expect(dateRangeLabels.today).toBe("今日");
    expect(orderStatusLabels.paid).toBe("已支付");
    expect(paymentMethodLabels.alipay).toBe("支付宝");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts
```

Expected: FAIL because `src/domain/orderHistory.ts` does not exist.

- [ ] **Step 3: Implement the domain helper**

Create `src/domain/orderHistory.ts`:

```ts
import type { Order, OrderStatus, PaymentMethod } from "./types";

export type OrderDateRange = "today" | "yesterday" | "last7" | "last30" | "all";
export type OrderHistoryStatusFilter = OrderStatus | "all";
export type OrderHistoryPaymentFilter = PaymentMethod | "all";

export type OrderHistoryFilters = {
  query: string;
  dateRange: OrderDateRange;
  status: OrderHistoryStatusFilter;
  paymentMethod: OrderHistoryPaymentFilter;
};

export const dateRangeLabels: Record<OrderDateRange, string> = {
  today: "今日",
  yesterday: "昨日",
  last7: "近 7 天",
  last30: "近 30 天",
  all: "全部"
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "待支付",
  paid: "已支付",
  cancelled: "已取消"
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  wechat: "微信",
  alipay: "支付宝",
  cash: "现金",
  other: "其他"
};

export function orderBusinessTime(order: Order): string {
  return order.paidAt ?? order.createdAt;
}

export function filterAndSortOrders(orders: Order[], filters: OrderHistoryFilters, now = new Date()): Order[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return orders
    .filter((order) => {
      if (query && !order.orderNo.toLocaleLowerCase().includes(query)) {
        return false;
      }

      if (filters.status !== "all" && order.status !== filters.status) {
        return false;
      }

      if (filters.paymentMethod !== "all" && order.paymentMethod !== filters.paymentMethod) {
        return false;
      }

      return isInDateRange(orderBusinessTime(order), filters.dateRange, now);
    })
    .sort((left, right) => orderBusinessTime(right).localeCompare(orderBusinessTime(left)));
}

function isInDateRange(value: string, range: OrderDateRange, now: Date): boolean {
  if (range === "all") {
    return true;
  }

  const date = startOfLocalDay(new Date(value));
  const today = startOfLocalDay(now);

  if (range === "today") {
    return date.getTime() === today.getTime();
  }

  const yesterday = addLocalDays(today, -1);
  if (range === "yesterday") {
    return date.getTime() === yesterday.getTime();
  }

  const days = range === "last7" ? 6 : 29;
  const start = addLocalDays(today, -days);

  return date.getTime() >= start.getTime() && date.getTime() <= today.getTime();
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/orderHistory.ts src/domain/orderHistory.test.ts
git commit -m "feat: add order history filters"
```

---

## Task 2: Repository Inventory Log Lookup

**Files:**
- Modify: `src/db/repositories.ts`
- Modify: `src/db/repositories.test.ts`

- [ ] **Step 1: Write the failing repository test**

Append to `src/db/repositories.test.ts`:

```ts
test("lists inventory logs for one order sorted by created time", async () => {
  await db.inventoryLogs.bulkPut([
    {
      id: "log-late",
      productId: "product-1",
      orderId: "order-1",
      changeQty: -1,
      reason: "order_paid",
      beforeQty: 9,
      afterQty: 8,
      createdAt: "2026-06-17T10:02:00.000Z"
    },
    {
      id: "log-other",
      productId: "product-1",
      orderId: "order-2",
      changeQty: -1,
      reason: "order_paid",
      beforeQty: 8,
      afterQty: 7,
      createdAt: "2026-06-17T10:03:00.000Z"
    },
    {
      id: "log-early",
      productId: "product-2",
      orderId: "order-1",
      changeQty: -2,
      reason: "gift_order_paid",
      beforeQty: 5,
      afterQty: 3,
      createdAt: "2026-06-17T10:01:00.000Z"
    }
  ]);

  await expect(listInventoryLogsForOrder("order-1")).resolves.toEqual([
    expect.objectContaining({ id: "log-early" }),
    expect.objectContaining({ id: "log-late" })
  ]);
});
```

Also add `listInventoryLogsForOrder` to the import list at the top of `src/db/repositories.test.ts`.

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm test -- src/db/repositories.test.ts
```

Expected: FAIL because `listInventoryLogsForOrder` is not exported.

- [ ] **Step 3: Implement repository method**

Add to `src/db/repositories.ts` after `listOrderItems`:

```ts
export async function listInventoryLogsForOrder(orderId: string): Promise<InventoryLog[]> {
  return db.inventoryLogs
    .where("orderId")
    .equals(orderId)
    .sortBy("createdAt");
}
```

- [ ] **Step 4: Run repository tests**

Run:

```powershell
npm test -- src/db/repositories.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/db/repositories.ts src/db/repositories.test.ts
git commit -m "feat: list order inventory logs"
```

---

## Task 3: Order Detail Dialog Component

**Files:**
- Create: `src/components/OrderDetailDialog.tsx`
- Create: `src/components/OrderDetailDialog.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/OrderDetailDialog.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { defaultPromotion } from "../test/fixtures";
import type { InventoryLog, Order, OrderItem } from "../domain/types";
import OrderDetailDialog from "./OrderDetailDialog";

const order: Order = {
  id: "order-1",
  orderNo: "ECRM-20260617-001",
  status: "paid",
  paymentMethod: "wechat",
  subtotalBeforeDiscount: 25,
  discountAmount: 2,
  payableAmount: 23,
  triggeredGiftTier: 35,
  promotionSnapshot: defaultPromotion(),
  giftStockWarning: false,
  createdAt: "2026-06-17T09:00:00.000Z",
  paidAt: "2026-06-17T09:05:00.000Z"
};

const orderItems: OrderItem[] = [
  {
    id: "item-normal",
    orderId: "order-1",
    productId: "product-normal",
    productNameSnapshot: "历史商品名",
    spuSnapshot: "历史SPU",
    productCodeSnapshot: "HIS-001",
    quantity: 1,
    originalUnitPrice: 20,
    finalUnitPrice: 20,
    lineType: "normal",
    lineTotal: 20
  },
  {
    id: "item-gift",
    orderId: "order-1",
    productId: "gift-a",
    productNameSnapshot: "赠品A",
    spuSnapshot: "赠品SPU",
    quantity: 1,
    originalUnitPrice: 0,
    finalUnitPrice: 0,
    lineType: "gift",
    lineTotal: 0
  }
];

const inventoryLogs: InventoryLog[] = [
  {
    id: "log-normal",
    productId: "product-normal",
    orderId: "order-1",
    changeQty: -1,
    reason: "order_paid",
    beforeQty: 10,
    afterQty: 9,
    createdAt: "2026-06-17T09:05:00.000Z"
  },
  {
    id: "log-gift",
    productId: "gift-a",
    orderId: "order-1",
    changeQty: -1,
    reason: "gift_order_paid",
    beforeQty: 3,
    afterQty: 2,
    createdAt: "2026-06-17T09:05:00.000Z"
  }
];

test("renders order snapshot details, gift lines, totals, and inventory logs", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      onClose={() => undefined}
    />
  );

  expect(screen.getByRole("dialog", { name: "订单详情 ECRM-20260617-001" })).toBeVisible();
  expect(screen.getByText("已支付")).toBeVisible();
  expect(screen.getByText("微信")).toBeVisible();
  expect(screen.getByText("应收 ¥23.00")).toBeVisible();
  expect(screen.getByText("优惠 -¥2.00")).toBeVisible();
  expect(screen.getByText("满赠档位 35")).toBeVisible();

  const itemList = screen.getByRole("list", { name: "订单商品明细" });
  expect(within(itemList).getByText("历史商品名")).toBeVisible();
  expect(within(itemList).getByText("历史SPU")).toBeVisible();
  expect(within(itemList).getByText("HIS-001")).toBeVisible();
  expect(within(itemList).getByText("赠品A")).toBeVisible();
  expect(within(itemList).getByText("赠品")).toBeVisible();

  const inventoryList = screen.getByRole("list", { name: "库存流水摘要" });
  expect(within(inventoryList).getByText("product-normal")).toBeVisible();
  expect(within(inventoryList).getByText("库存 10 -> 9")).toBeVisible();
  expect(within(inventoryList).getByText("扣减 1")).toBeVisible();
  expect(within(inventoryList).getByText("赠品扣减")).toBeVisible();
});

test("closes from the close button and does not show adjustment actions in v1.3a", () => {
  const onClose = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      onClose={onClose}
    />
  );

  expect(screen.queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "退款" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "关闭订单详情" }));

  expect(onClose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run component tests to verify RED**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: FAIL because `OrderDetailDialog` does not exist.

- [ ] **Step 3: Implement `OrderDetailDialog`**

Create `src/components/OrderDetailDialog.tsx`:

```tsx
import { X } from "lucide-react";
import { formatMoney } from "../domain/money";
import { orderStatusLabels, paymentMethodLabels } from "../domain/orderHistory";
import type { InventoryLog, Order, OrderItem, OrderLineType } from "../domain/types";

type OrderDetailDialogProps = {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  onClose: () => void;
};

const lineTypeLabels: Record<OrderLineType, string> = {
  normal: "正常",
  discount_addon: "加购优惠",
  gift: "赠品"
};

const inventoryReasonLabels: Record<InventoryLog["reason"], string> = {
  order_paid: "订单扣减",
  gift_order_paid: "赠品扣减",
  manual_adjust: "手动调整"
};

function formatDateTime(value?: string): string {
  if (!value) {
    return "未记录";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function OrderDetailDialog({ order, orderItems, inventoryLogs, onClose }: OrderDetailDialogProps) {
  return (
    <div className="modalBackdrop" role="presentation">
      <section
        className="orderDetailDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`订单详情 ${order.orderNo}`}
      >
        <div className="dialogHeader">
          <div>
            <p className="eyebrow">Order Detail</p>
            <h2>{order.orderNo}</h2>
            <p>{orderStatusLabels[order.status]} / {order.paymentMethod ? paymentMethodLabels[order.paymentMethod] : "未记录支付方式"}</p>
          </div>
          <button type="button" className="iconButton" aria-label="关闭订单详情" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="orderDetailBody">
          <section className="orderDetailSection" aria-label="订单基本信息">
            <div className="orderDetailMetrics">
              <span>创建 {formatDateTime(order.createdAt)}</span>
              <span>支付 {formatDateTime(order.paidAt)}</span>
              <strong>应收 {formatMoney(order.payableAmount)}</strong>
              <span>原价 {formatMoney(order.subtotalBeforeDiscount)}</span>
              <span>优惠 -{formatMoney(order.discountAmount)}</span>
              {order.triggeredGiftTier ? <span>满赠档位 {order.triggeredGiftTier}</span> : <span>未触发满赠</span>}
            </div>
          </section>

          <section className="orderDetailSection">
            <div className="sectionTitle">
              <div>
                <h3>商品明细</h3>
                <p>使用订单保存时的商品快照。</p>
              </div>
            </div>
            <div className="orderDetailLineList" role="list" aria-label="订单商品明细">
              {orderItems.map((item) => (
                <article className={`orderDetailLine orderLine-${item.lineType}`} role="listitem" key={item.id}>
                  <div>
                    <h4>{item.productNameSnapshot}</h4>
                    <p>{item.spuSnapshot}</p>
                    {item.productCodeSnapshot ? <p>{item.productCodeSnapshot}</p> : null}
                  </div>
                  <div className="orderDetailLineMeta">
                    <span>{lineTypeLabels[item.lineType]}</span>
                    <span>单价 {formatMoney(item.finalUnitPrice)}</span>
                    {item.originalUnitPrice !== item.finalUnitPrice ? <span>原价 {formatMoney(item.originalUnitPrice)}</span> : null}
                    <span>数量 x{item.quantity}</span>
                    <strong>{formatMoney(item.lineTotal)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="orderDetailSection">
            <div className="sectionTitle">
              <div>
                <h3>库存流水摘要</h3>
                <p>展示本订单保存时写入的库存变化。</p>
              </div>
            </div>
            {inventoryLogs.length > 0 ? (
              <div className="inventoryLogList" role="list" aria-label="库存流水摘要">
                {inventoryLogs.map((log) => (
                  <article className="inventoryLogRow" role="listitem" key={log.id}>
                    <div>
                      <h4>{log.productId}</h4>
                      <p>{inventoryReasonLabels[log.reason]}</p>
                    </div>
                    <div className="inventoryLogMeta">
                      <span>扣减 {Math.abs(log.changeQty)}</span>
                      <strong>库存 {log.beforeQty} -&gt; {log.afterQty}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="cartEmpty">暂无库存流水。</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Add styles**

Append near the dialog/cart styles in `src/styles.css`:

```css
.orderDetailDialog {
  width: min(940px, 100%);
  max-height: min(88vh, 820px);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid rgba(47, 111, 94, 0.24);
  border-radius: 8px;
  background: #fffdfa;
  box-shadow: 0 24px 64px rgba(36, 31, 26, 0.2);
}

.orderDetailBody {
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 10px;
  padding: 14px;
}

.orderDetailSection {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.74);
}

.orderDetailMetrics,
.orderDetailLineMeta,
.inventoryLogMeta {
  display: flex;
  gap: 7px;
  align-items: center;
  flex-wrap: wrap;
}

.orderDetailMetrics span,
.orderDetailMetrics strong,
.orderDetailLineMeta span,
.orderDetailLineMeta strong,
.inventoryLogMeta span,
.inventoryLogMeta strong {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 850;
}

.orderDetailMetrics strong,
.orderDetailLineMeta strong,
.inventoryLogMeta strong {
  color: var(--ink);
}

.orderDetailLineList,
.inventoryLogList {
  display: grid;
  gap: 7px;
}

.orderDetailLine,
.inventoryLogRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
}

.orderDetailLine h4,
.inventoryLogRow h4 {
  margin: 0;
  color: var(--ink);
  font-size: 14px;
  line-height: 1.2;
}

.orderDetailLine p,
.inventoryLogRow p {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.35;
}
```

- [ ] **Step 5: Run component tests**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/OrderDetailDialog.tsx src/components/OrderDetailDialog.test.tsx src/styles.css
git commit -m "feat: add order detail dialog"
```

---

## Task 4: Sales Page Order Search, Filters, And Detail Wiring

**Files:**
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing SalesPage tests**

Add these tests to `src/pages/SalesPage.test.tsx`:

```tsx
test("filters order history by order number, status, date range, and payment method", async () => {
  repositories.listOrders.mockResolvedValue([
    order({ id: "wechat-today", orderNo: "ECRM-TODAY-WECHAT", paymentMethod: "wechat", paidAt: "2026-06-15T09:25:00.000Z", createdAt: "2026-06-15T09:20:00.000Z" }),
    order({ id: "cash-today", orderNo: "ECRM-TODAY-CASH", paymentMethod: "cash", paidAt: "2026-06-15T10:25:00.000Z", createdAt: "2026-06-15T10:20:00.000Z" }),
    order({ id: "pending", orderNo: "ECRM-PENDING", status: "pending_payment", paymentMethod: "cash", paidAt: undefined, createdAt: "2026-06-15T11:20:00.000Z" }),
    order({ id: "old", orderNo: "ECRM-OLD-WECHAT", paymentMethod: "wechat", paidAt: "2026-06-01T09:25:00.000Z", createdAt: "2026-06-01T09:20:00.000Z" })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  expect(within(history).getByText("ECRM-TODAY-WECHAT")).toBeVisible();
  expect(within(history).getByText("ECRM-TODAY-CASH")).toBeVisible();

  fireEvent.change(screen.getByLabelText("搜索订单号"), { target: { value: "cash" } });
  expect(within(history).queryByText("ECRM-TODAY-WECHAT")).not.toBeInTheDocument();
  expect(within(history).getByText("ECRM-TODAY-CASH")).toBeVisible();

  fireEvent.change(screen.getByLabelText("搜索订单号"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("订单状态"), { target: { value: "pending_payment" } });
  expect(within(history).getByText("ECRM-PENDING")).toBeVisible();
  expect(within(history).queryByText("ECRM-TODAY-CASH")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("订单状态"), { target: { value: "all" } });
  fireEvent.change(screen.getByLabelText("支付方式"), { target: { value: "wechat" } });
  fireEvent.change(screen.getByLabelText("订单日期范围"), { target: { value: "today" } });
  expect(within(history).getByText("ECRM-TODAY-WECHAT")).toBeVisible();
  expect(within(history).queryByText("ECRM-OLD-WECHAT")).not.toBeInTheDocument();
});

test("opens order detail dialog with order items and inventory logs", async () => {
  repositories.listOrders.mockResolvedValue([
    order({ id: "order-detail", orderNo: "ECRM-DETAIL", paymentMethod: "alipay", payableAmount: 42.5 })
  ]);
  repositories.listOrderItems.mockResolvedValue([
    {
      id: "item-1",
      orderId: "order-detail",
      productId: "normal",
      productNameSnapshot: "历史普通商品",
      spuSnapshot: "历史SPU",
      productCodeSnapshot: "HIS-BASE",
      quantity: 2,
      originalUnitPrice: 25,
      finalUnitPrice: 20,
      lineType: "discount_addon",
      lineTotal: 40
    }
  ]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([
    {
      id: "log-1",
      productId: "normal",
      orderId: "order-detail",
      changeQty: -2,
      reason: "order_paid",
      beforeQty: 10,
      afterQty: 8,
      createdAt: "2026-06-15T09:25:00.000Z"
    }
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));

  const dialog = await screen.findByRole("dialog", { name: "订单详情 ECRM-DETAIL" });
  expect(within(dialog).getByText("历史普通商品")).toBeVisible();
  expect(within(dialog).getByText("HIS-BASE")).toBeVisible();
  expect(within(dialog).getByText("加购优惠")).toBeVisible();
  expect(within(dialog).getByText("库存 10 -> 8")).toBeVisible();
  expect(within(dialog).queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "退款" })).not.toBeInTheDocument();
});
```

Update the hoisted repositories mock at the top of `src/pages/SalesPage.test.tsx`:

```ts
const repositories = vi.hoisted(() => ({
  getSettings: vi.fn(),
  listInventoryLogsForOrder: vi.fn(),
  listOrderItems: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  savePaidOrder: vi.fn()
}));
```

In `beforeEach`, add:

```ts
repositories.listOrderItems.mockResolvedValue([]);
repositories.listInventoryLogsForOrder.mockResolvedValue([]);
```

- [ ] **Step 2: Run SalesPage tests to verify RED**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: FAIL because filters, detail dialog, and repository imports are not wired.

- [ ] **Step 3: Modify SalesPage imports and state**

In `src/pages/SalesPage.tsx`, update imports:

```ts
import OrderDetailDialog from "../components/OrderDetailDialog";
import {
  dateRangeLabels,
  filterAndSortOrders,
  orderBusinessTime,
  orderStatusLabels,
  paymentMethodLabels,
  type OrderDateRange,
  type OrderHistoryPaymentFilter,
  type OrderHistoryStatusFilter
} from "../domain/orderHistory";
import { getSettings, listInventoryLogsForOrder, listOrderItems, listOrders, listProducts, savePaidOrder } from "../db/repositories";
import type { AppSettings, InventoryLog, Order, OrderItem, PaymentMethod, Product } from "../domain/types";
```

Remove the local `paymentMethodLabels`, `orderPaidTime`, and `compareRecentPaidOrders` definitions. Keep `formatPaidTime`, but make it call `orderBusinessTime(order)` where needed.

Add state inside `SalesPage`:

```ts
const [orderQuery, setOrderQuery] = useState("");
const [orderDateRange, setOrderDateRange] = useState<OrderDateRange>("today");
const [orderStatusFilter, setOrderStatusFilter] = useState<OrderHistoryStatusFilter>("paid");
const [orderPaymentFilter, setOrderPaymentFilter] = useState<OrderHistoryPaymentFilter>("all");
const [selectedOrder, setSelectedOrder] = useState<Order>();
const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
const [selectedOrderInventoryLogs, setSelectedOrderInventoryLogs] = useState<InventoryLog[]>([]);
const [isOrderDetailLoading, setIsOrderDetailLoading] = useState(false);
```

Replace `recentPaidOrders` with:

```ts
const filteredOrders = useMemo(
  () =>
    filterAndSortOrders(
      orders,
      {
        query: orderQuery,
        dateRange: orderDateRange,
        status: orderStatusFilter,
        paymentMethod: orderPaymentFilter
      }
    ),
  [orders, orderQuery, orderDateRange, orderStatusFilter, orderPaymentFilter]
);
```

Add handler:

```ts
async function openOrderDetail(order: Order) {
  setIsOrderDetailLoading(true);
  setStatus(undefined);

  try {
    const [items, inventoryLogs] = await Promise.all([
      listOrderItems(order.id),
      listInventoryLogsForOrder(order.id)
    ]);
    setSelectedOrder(order);
    setSelectedOrderItems(items);
    setSelectedOrderInventoryLogs(inventoryLogs);
  } catch {
    setStatus({ kind: "error", text: "订单详情加载失败，请稍后重试。" });
  } finally {
    setIsOrderDetailLoading(false);
  }
}
```

- [ ] **Step 4: Replace order history JSX**

Replace the existing `orderHistorySection` body with:

```tsx
<section className="orderHistorySection" aria-labelledby="order-history-title">
  <button
    type="button"
    className="orderHistoryToggle"
    aria-expanded={isOrderHistoryOpen}
    aria-controls="recent-order-history"
    onClick={() => setIsOrderHistoryOpen((current) => !current)}
  >
    <span>
      <ReceiptText size={18} aria-hidden="true" />
      <strong id="order-history-title">订单记录</strong>
      <em>{filteredOrders.length} 笔</em>
    </span>
    {isOrderHistoryOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
  </button>

  {isOrderHistoryOpen ? (
    <div id="recent-order-history" className="orderHistoryPanel" role="region" aria-label="订单记录列表">
      <div className="orderHistoryFilters">
        <label>
          <span>搜索</span>
          <input
            aria-label="搜索订单号"
            value={orderQuery}
            onChange={(event) => setOrderQuery(event.target.value)}
            placeholder="订单号"
          />
        </label>
        <label>
          <span>日期</span>
          <select
            aria-label="订单日期范围"
            value={orderDateRange}
            onChange={(event) => setOrderDateRange(event.target.value as OrderDateRange)}
          >
            {(Object.keys(dateRangeLabels) as OrderDateRange[]).map((key) => (
              <option key={key} value={key}>{dateRangeLabels[key]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            aria-label="订单状态"
            value={orderStatusFilter}
            onChange={(event) => setOrderStatusFilter(event.target.value as OrderHistoryStatusFilter)}
          >
            <option value="all">全部状态</option>
            {(Object.keys(orderStatusLabels) as Array<keyof typeof orderStatusLabels>).map((key) => (
              <option key={key} value={key}>{orderStatusLabels[key]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>支付</span>
          <select
            aria-label="支付方式"
            value={orderPaymentFilter}
            onChange={(event) => setOrderPaymentFilter(event.target.value as OrderHistoryPaymentFilter)}
          >
            <option value="all">全部方式</option>
            {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((key) => (
              <option key={key} value={key}>{paymentMethodLabels[key]}</option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? <p className="emptyState">正在加载订单记录...</p> : null}
      {!isLoading && filteredOrders.length === 0 ? <p className="emptyState">当前筛选下暂无订单。</p> : null}
      {filteredOrders.map((order) => (
        <article className="orderHistoryRow" key={order.id}>
          <button
            type="button"
            className="orderHistoryOpenButton"
            aria-label={`查看订单 ${order.orderNo}`}
            disabled={isOrderDetailLoading}
            onClick={() => void openOrderDetail(order)}
          >
            <span>
              <strong>{order.orderNo}</strong>
              <em>{formatPaidTime(orderBusinessTime(order))}</em>
            </span>
            <span className="orderHistoryMeta">
              <span>{orderStatusLabels[order.status]}</span>
              <span>{order.paymentMethod ? paymentMethodLabels[order.paymentMethod] : "未记录"}</span>
              <strong>{formatMoney(order.payableAmount)}</strong>
            </span>
          </button>
        </article>
      ))}
    </div>
  ) : null}
</section>

{selectedOrder ? (
  <OrderDetailDialog
    order={selectedOrder}
    orderItems={selectedOrderItems}
    inventoryLogs={selectedOrderInventoryLogs}
    onClose={() => {
      setSelectedOrder(undefined);
      setSelectedOrderItems([]);
      setSelectedOrderInventoryLogs([]);
    }}
  />
) : null}
```

- [ ] **Step 5: Add SalesPage styles**

Append or replace order history styles in `src/styles.css`:

```css
.orderHistoryFilters {
  display: grid;
  grid-template-columns: minmax(180px, 1.4fr) repeat(3, minmax(132px, 1fr));
  gap: 8px;
}

.orderHistoryFilters label {
  display: grid;
  gap: 5px;
}

.orderHistoryFilters span {
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 850;
}

.orderHistoryOpenButton {
  width: 100%;
  min-height: 52px;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
}

.orderHistoryOpenButton > span:first-child {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.orderHistoryOpenButton strong {
  color: var(--ink);
}

.orderHistoryOpenButton em {
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}
```

In the `@media (max-width: 720px)` block, add:

```css
.orderHistoryFilters {
  grid-template-columns: 1fr;
}

.orderHistoryOpenButton {
  align-items: stretch;
  flex-direction: column;
}
```

- [ ] **Step 6: Run SalesPage tests**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx src/styles.css
git commit -m "feat: search and inspect orders"
```

---

## Task 5: Full Verification And V1.3a Review

**Files:**
- Verify all files changed in Tasks 1-4.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts src/db/repositories.test.ts src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx
```

Expected: all selected tests pass.

- [ ] **Step 2: Run full test suite**

Run:

```powershell
npm test
```

Expected: all test files pass.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 4: Check whitespace and status**

Run:

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors; working tree clean after commits.

- [ ] **Step 5: Manual UI smoke check**

Run or confirm dev server:

```powershell
try { (Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 3).StatusCode } catch { "DOWN" }
```

If down:

```powershell
Start-Process -FilePath npm -ArgumentList @('run','dev','--','--port','5173') -WorkingDirectory 'D:\Projects\ECRM\.worktrees\ecrm-mvp' -WindowStyle Hidden
```

Manual check at `http://localhost:5173`:

- 售卖页打开订单记录。
- 日期筛选、订单号搜索、状态筛选、支付方式筛选可操作。
- 点击订单行打开订单详情弹窗。
- 订单详情展示商品快照和库存流水摘要。
- 订单详情没有作废/退款按钮。

- [ ] **Step 6: Final V1.3a summary**

Report:

- Commits created.
- Tests run and results.
- Build result.
- Known non-goals: V1.3a 不包含作废、退款、库存回滚、订单调整表和备份版本升级。
