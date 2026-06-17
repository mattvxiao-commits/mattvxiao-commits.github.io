# ECRM V1.3c-3 Order After-Sales Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在售卖页订单记录列表中显示已作废订单的售后标识、作废原因和备注提示。

**Architecture:** 扩展现有 `orderHistory` 领域模块，新增纯函数 `getOrderAfterSalesBadges(order)` 生成列表标识；售卖页只负责渲染 badge。此版本不改订单状态、不加表、不改备份版本、不改筛选排序逻辑。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite.

---

## File Structure

- Modify `src/domain/orderHistory.ts`
  - 新增 `orderCancelReasonLabels`。
  - 新增 `OrderAfterSalesBadgeTone`、`OrderAfterSalesBadge`。
  - 新增 `getOrderAfterSalesBadges(order)`。
- Modify `src/domain/orderHistory.test.ts`
  - 覆盖 paid 返回空 badge。
  - 覆盖 cancelled 默认显示 `已作废` + `误操作`。
  - 覆盖 cancelled 指定原因和备注显示 `已作废` + 原因 + `有备注`。
- Modify `src/pages/SalesPage.tsx`
  - 引入 `getOrderAfterSalesBadges`。
  - 订单记录行渲染售后 badge。
- Modify `src/pages/SalesPage.test.tsx`
  - 覆盖订单记录列表展示已作废售后标识。
  - 覆盖 paid 订单不显示售后标识。
- Modify `src/styles.css`
  - 新增 badge 样式。
  - 确保窄屏换行不重叠。

---

## Task 1: Order After-Sales Badge Domain Function

**Files:**
- Modify: `src/domain/orderHistory.test.ts`
- Modify: `src/domain/orderHistory.ts`

- [ ] **Step 1: Write failing domain tests**

In `src/domain/orderHistory.test.ts`, update imports:

```ts
import {
  dateRangeLabels,
  filterAndSortOrders,
  getOrderAfterSalesBadges,
  orderCancelReasonLabels,
  orderStatusLabels,
  paymentMethodLabels,
  type OrderDateRange,
  type OrderHistoryFilters
} from "./orderHistory";
```

Add these tests inside `describe("order history filters", () => { ... })` before `exports Chinese labels used by the sales page`:

```ts
  test("returns no after-sales badges for paid orders", () => {
    expect(getOrderAfterSalesBadges(order({ status: "paid" }))).toEqual([]);
  });

  test("returns default void badges for cancelled orders without a reason", () => {
    expect(getOrderAfterSalesBadges(order({ status: "cancelled", cancelledAt: "2026-06-17T10:00:00.000Z" }))).toEqual([
      { label: "已作废", tone: "danger" },
      { label: "误操作", tone: "neutral" }
    ]);
  });

  test("returns reason and note badges for cancelled orders", () => {
    expect(
      getOrderAfterSalesBadges(
        order({
          status: "cancelled",
          cancelledAt: "2026-06-17T10:00:00.000Z",
          cancelReason: "customer_cancelled",
          cancelNote: " 客户临时取消。 "
        })
      )
    ).toEqual([
      { label: "已作废", tone: "danger" },
      { label: "客户取消", tone: "neutral" },
      { label: "有备注", tone: "neutral" }
    ]);
  });
```

In the existing `exports Chinese labels used by the sales page` test, add:

```ts
    expect(orderCancelReasonLabels).toEqual({
      mistake: "误操作",
      customer_cancelled: "客户取消",
      duplicate_order: "重复下单",
      inventory_issue: "库存/赠品异常",
      payment_issue: "收款异常",
      other: "其他"
    });
```

- [ ] **Step 2: Run domain tests to verify RED**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts
```

Expected: FAIL because `getOrderAfterSalesBadges` and `orderCancelReasonLabels` do not exist.

- [ ] **Step 3: Implement orderHistory badge helpers**

In `src/domain/orderHistory.ts`, update import:

```ts
import type { Order, OrderCancelReason, OrderStatus, PaymentMethod } from "./types";
```

Add after `paymentMethodLabels`:

```ts
export const orderCancelReasonLabels: Record<OrderCancelReason, string> = {
  mistake: "误操作",
  customer_cancelled: "客户取消",
  duplicate_order: "重复下单",
  inventory_issue: "库存/赠品异常",
  payment_issue: "收款异常",
  other: "其他"
};

export type OrderAfterSalesBadgeTone = "danger" | "neutral";

export type OrderAfterSalesBadge = {
  label: string;
  tone: OrderAfterSalesBadgeTone;
};

export function getOrderAfterSalesBadges(order: Order): OrderAfterSalesBadge[] {
  if (order.status !== "cancelled") {
    return [];
  }

  const badges: OrderAfterSalesBadge[] = [
    { label: "已作废", tone: "danger" },
    { label: orderCancelReasonLabels[order.cancelReason ?? "mistake"], tone: "neutral" }
  ];

  if (order.cancelNote?.trim()) {
    badges.push({ label: "有备注", tone: "neutral" });
  }

  return badges;
}
```

- [ ] **Step 4: Run domain tests to verify GREEN**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/orderHistory.ts src/domain/orderHistory.test.ts
git commit -m "feat: derive order after-sales badges"
```

---

## Task 2: Sales Page Order History Badge UI

**Files:**
- Modify: `src/pages/SalesPage.test.tsx`
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing SalesPage test**

In `src/pages/SalesPage.test.tsx`, add this test after `shows recent paid order history behind a toggle`:

```ts
test("shows after-sales badges for cancelled orders in order history", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "paid-order",
      orderNo: "ECRM-PAID",
      status: "paid",
      paidAt: localIsoDateTime(0, 9, 25)
    }),
    order({
      id: "cancelled-order",
      orderNo: "ECRM-CANCELLED",
      status: "cancelled",
      paymentMethod: "cash",
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25),
      cancelledAt: localIsoDateTime(0, 10, 0),
      cancelReason: "customer_cancelled",
      cancelNote: "客户取消。"
    })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  const paidOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-PAID" });
  const cancelledOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-CANCELLED" });

  expect(within(cancelledOrderButton).getByText("已作废")).toBeVisible();
  expect(within(cancelledOrderButton).getByText("客户取消")).toBeVisible();
  expect(within(cancelledOrderButton).getByText("有备注")).toBeVisible();
  expect(within(paidOrderButton).queryByText("已作废")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run SalesPage tests to verify RED**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: FAIL because order history rows do not render after-sales badges.

- [ ] **Step 3: Update SalesPage implementation**

In `src/pages/SalesPage.tsx`, add `getOrderAfterSalesBadges` to the `orderHistory` import:

```ts
  getOrderAfterSalesBadges,
```

Replace the `filteredOrders.map` block with a version that computes badges:

```tsx
            {filteredOrders.map((order) => {
              const afterSalesBadges = getOrderAfterSalesBadges(order);

              return (
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
                      {afterSalesBadges.length > 0 ? (
                        <span className="orderAfterSalesBadges" aria-label="订单售后标识">
                          {afterSalesBadges.map((badge) => (
                            <span
                              className={badge.tone === "danger" ? "orderAfterSalesBadge isDanger" : "orderAfterSalesBadge"}
                              key={`${order.id}-${badge.label}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </article>
              );
            })}
```

- [ ] **Step 4: Add CSS**

In `src/styles.css`, add near order history styles:

```css
.orderAfterSalesBadges {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.orderAfterSalesBadge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 3px 7px;
  border: 1px solid rgba(122, 112, 98, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.74);
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.orderAfterSalesBadge.isDanger {
  border-color: rgba(175, 54, 38, 0.28);
  background: rgba(175, 54, 38, 0.08);
  color: #8f2f22;
}
```

Inside the existing mobile section where `.orderHistoryOpenButton` is column layout, add:

```css
  .orderAfterSalesBadges {
    justify-content: flex-start;
  }
```

- [ ] **Step 5: Run SalesPage tests to verify GREEN**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts src/pages/SalesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx src/styles.css
git commit -m "feat: show after-sales badges in order history"
```

---

## Task 3: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused tests**

```powershell
npm test -- src/domain/orderHistory.test.ts src/pages/SalesPage.test.tsx src/utils/backup.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 4: Check whitespace and worktree**

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors and clean worktree after commits.

- [ ] **Step 5: Dev server smoke check**

```powershell
try { (Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 3).StatusCode } catch { "DOWN" }
```

Expected: `200`. If it returns `DOWN`, start the dev server:

```powershell
Start-Process -FilePath npm -ArgumentList @('run','dev','--','--port','5173') -WorkingDirectory 'D:\Projects\ECRM\.worktrees\ecrm-mvp' -WindowStyle Hidden
```

---

## Scope Guard

This plan must not:

- Modify `src/db/db.ts`.
- Modify `src/db/repositories.ts`.
- Modify backup version constants.
- Add refund tables or order adjustment tables.
- Add new order statuses.
- Change order filtering or sorting semantics.
