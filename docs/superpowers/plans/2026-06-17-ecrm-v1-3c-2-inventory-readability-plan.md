# ECRM V1.3c-2 Inventory Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化订单详情的库存展示，让作废订单先显示库存摘要，再按需展开完整流水。

**Architecture:** 新增一个纯领域函数 `buildOrderInventorySummary` 负责汇总库存流水，不改变 repository、Dexie schema、备份版本或订单状态。订单详情组件只消费汇总结果并调整 UI：摘要优先，完整流水放入 `<details>`。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite.

---

## File Structure

- Create `src/domain/orderInventorySummary.ts`
  - 纯函数：输入 `InventoryLog[]`，输出售卖扣减、赠品扣减、作废回滚三类摘要。
- Create `src/domain/orderInventorySummary.test.ts`
  - 覆盖摘要汇总、同 SKU 去重、空流水。
- Modify `src/components/OrderDetailDialog.tsx`
  - 引入摘要函数。
  - 库存区域标题改为“库存摘要”。
  - 渲染三项摘要指标。
  - 完整流水放入 `<details>`，已取消/存在回滚时默认折叠，正常 paid 默认展开。
  - 空流水显示 `暂无库存流水。`。
- Modify `src/components/OrderDetailDialog.test.tsx`
  - 更新库存区域断言。
  - 覆盖 paid 默认展开、cancelled 默认折叠、空流水空态。
- Modify `src/pages/SalesPage.test.tsx`
  - 跟随订单详情可访问名称变化，将 `库存流水摘要` 断言更新为 `完整库存流水`。
- Modify `src/styles.css`
  - 增加库存摘要指标和完整流水折叠区域样式。

---

## Task 1: Inventory Summary Domain Function

**Files:**
- Create: `src/domain/orderInventorySummary.test.ts`
- Create: `src/domain/orderInventorySummary.ts`

- [ ] **Step 1: Write failing domain tests**

Create `src/domain/orderInventorySummary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { InventoryLog } from "./types";
import { buildOrderInventorySummary } from "./orderInventorySummary";

function inventoryLog(overrides: Partial<InventoryLog> = {}): InventoryLog {
  return {
    id: "log-1",
    productId: "sku-normal",
    orderId: "order-1",
    changeQty: -1,
    reason: "order_paid",
    beforeQty: 10,
    afterQty: 9,
    createdAt: "2026-06-17T09:35:01.000Z",
    ...overrides
  };
}

describe("buildOrderInventorySummary", () => {
  it("summarizes paid, gift, and rollback inventory logs", () => {
    const summary = buildOrderInventorySummary([
      inventoryLog({ id: "paid-1", productId: "sku-normal", changeQty: -2, reason: "order_paid" }),
      inventoryLog({ id: "gift-1", productId: "sku-gift", changeQty: -1, reason: "gift_order_paid" }),
      inventoryLog({ id: "rollback-1", productId: "sku-normal", changeQty: 2, reason: "order_cancelled_rollback" })
    ]);

    expect(summary).toEqual({
      paidDeduction: { productCount: 1, quantity: 2 },
      giftDeduction: { productCount: 1, quantity: 1 },
      rollback: { productCount: 1, quantity: 2 }
    });
  });

  it("counts each product once while accumulating quantities", () => {
    const summary = buildOrderInventorySummary([
      inventoryLog({ id: "paid-1", productId: "sku-normal", changeQty: -1, reason: "order_paid" }),
      inventoryLog({ id: "paid-2", productId: "sku-normal", changeQty: -3, reason: "order_paid" }),
      inventoryLog({ id: "paid-3", productId: "sku-other", changeQty: -2, reason: "order_paid" })
    ]);

    expect(summary.paidDeduction).toEqual({ productCount: 2, quantity: 6 });
  });

  it("returns zero metrics for empty logs", () => {
    expect(buildOrderInventorySummary([])).toEqual({
      paidDeduction: { productCount: 0, quantity: 0 },
      giftDeduction: { productCount: 0, quantity: 0 },
      rollback: { productCount: 0, quantity: 0 }
    });
  });
});
```

- [ ] **Step 2: Run domain tests to verify RED**

Run:

```powershell
npm test -- src/domain/orderInventorySummary.test.ts
```

Expected: FAIL because `src/domain/orderInventorySummary.ts` does not exist.

- [ ] **Step 3: Implement the domain function**

Create `src/domain/orderInventorySummary.ts`:

```ts
import type { InventoryLog } from "./types";

export type InventorySummaryMetric = {
  productCount: number;
  quantity: number;
};

export type OrderInventorySummary = {
  paidDeduction: InventorySummaryMetric;
  giftDeduction: InventorySummaryMetric;
  rollback: InventorySummaryMetric;
};

type MutableMetric = {
  productIds: Set<string>;
  quantity: number;
};

function createMetric(): MutableMetric {
  return {
    productIds: new Set<string>(),
    quantity: 0
  };
}

function addLog(metric: MutableMetric, log: InventoryLog) {
  metric.productIds.add(log.productId);
  metric.quantity += Math.abs(log.changeQty);
}

function finalizeMetric(metric: MutableMetric): InventorySummaryMetric {
  return {
    productCount: metric.productIds.size,
    quantity: metric.quantity
  };
}

export function buildOrderInventorySummary(inventoryLogs: InventoryLog[]): OrderInventorySummary {
  const paidDeduction = createMetric();
  const giftDeduction = createMetric();
  const rollback = createMetric();

  for (const log of inventoryLogs) {
    if (log.reason === "order_paid") {
      addLog(paidDeduction, log);
      continue;
    }

    if (log.reason === "gift_order_paid") {
      addLog(giftDeduction, log);
      continue;
    }

    if (log.reason === "order_cancelled_rollback") {
      addLog(rollback, log);
    }
  }

  return {
    paidDeduction: finalizeMetric(paidDeduction),
    giftDeduction: finalizeMetric(giftDeduction),
    rollback: finalizeMetric(rollback)
  };
}
```

- [ ] **Step 4: Run domain tests to verify GREEN**

Run:

```powershell
npm test -- src/domain/orderInventorySummary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/orderInventorySummary.ts src/domain/orderInventorySummary.test.ts
git commit -m "feat: summarize order inventory logs"
```

---

## Task 2: Order Detail Inventory Summary UI

**Files:**
- Modify: `src/components/OrderDetailDialog.test.tsx`
- Modify: `src/components/OrderDetailDialog.tsx`
- Modify: `src/pages/SalesPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Update `src/components/OrderDetailDialog.test.tsx`:

1. In `shows a read-only order detail dialog with order, item snapshot, and inventory summary`, replace the inventory list lookup and first assertions with:

```ts
  expect(within(dialog).getByText("库存摘要")).toBeVisible();
  expect(within(dialog).getByText("售卖扣减")).toBeVisible();
  expect(within(dialog).getByText("1 个SKU / 1 件")).toBeVisible();
  expect(within(dialog).getByText("赠品扣减")).toBeVisible();

  const inventoryDisclosure = within(dialog).getByText("完整库存流水（2 条）").closest("details");
  expect(inventoryDisclosure).toHaveAttribute("open");

  const inventoryList = within(dialog).getByRole("list", { name: "完整库存流水" });
```

2. In `shows readable inventory product snapshots and rollback summary`, replace the test body after render with:

```ts
  expect(screen.getByText("库存摘要")).toBeVisible();
  expect(screen.getByText("作废回滚")).toBeVisible();
  expect(screen.getByText("1 个SKU / 1 件")).toBeVisible();

  const inventoryDisclosure = screen.getByText("完整库存流水（3 条）").closest("details");
  expect(inventoryDisclosure).not.toHaveAttribute("open");

  fireEvent.click(screen.getByText("完整库存流水（3 条）"));

  const inventoryList = screen.getByRole("list", { name: "完整库存流水" });
  const [normalInventoryRow, , rollbackInventoryRow] = within(inventoryList).getAllByRole("listitem");

  expect(within(normalInventoryRow).getByText("玫瑰香氛蜡烛")).toBeVisible();
  expect(within(normalInventoryRow).getByText("CANDLE-ROSE / 香氛系列")).toBeVisible();
  expect(within(rollbackInventoryRow).getByText("玫瑰香氛蜡烛")).toBeVisible();
  expect(within(rollbackInventoryRow).getByText("作废回滚")).toBeVisible();
  expect(within(rollbackInventoryRow).getByText("增加 1")).toBeVisible();
  expect(within(rollbackInventoryRow).getByText("库存 9 -> 10")).toBeVisible();
  expect(within(inventoryList).queryByText("sku-normal")).not.toBeInTheDocument();
```

3. Add this test before `does not show void action for cancelled orders`:

```ts
test("shows an empty inventory state when an order has no inventory logs", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={[]}
      onClose={() => undefined}
    />
  );

  expect(screen.getByText("售卖扣减")).toBeVisible();
  expect(screen.getAllByText("0 个SKU / 0 件")).toHaveLength(3);
  expect(screen.getByText("暂无库存流水。")).toBeVisible();
});
```

- [ ] **Step 2: Run component tests to verify RED**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: FAIL because the component still renders the old `库存流水摘要` list and no summary metrics/details UI.

- [ ] **Step 3: Update OrderDetailDialog implementation**

In `src/components/OrderDetailDialog.tsx`, add import:

```ts
import { buildOrderInventorySummary, type InventorySummaryMetric } from "../domain/orderInventorySummary";
```

Add helper functions near `formatInventoryChange`:

```ts
function formatInventoryMetric(metric: InventorySummaryMetric): string {
  return `${metric.productCount} 个SKU / ${metric.quantity} 件`;
}

function shouldOpenInventoryDetails(order: Order, inventoryLogs: InventoryLog[]): boolean {
  return order.status !== "cancelled" && !inventoryLogs.some((log) => log.reason === "order_cancelled_rollback");
}
```

Inside the component, replace `rollbackProductCount` memo with:

```ts
  const inventorySummary = useMemo(() => buildOrderInventorySummary(inventoryLogs), [inventoryLogs]);
  const shouldShowInventoryDetailsOpen = useMemo(
    () => shouldOpenInventoryDetails(order, inventoryLogs),
    [order, inventoryLogs]
  );
```

Replace the inventory section with:

```tsx
          <section className="orderDetailSection" aria-labelledby="order-detail-inventory-title">
            <div className="sectionTitle">
              <PackageCheck size={19} aria-hidden="true" />
              <div>
                <h2 id="order-detail-inventory-title">库存摘要</h2>
                <p>先看汇总，完整流水可展开复核</p>
              </div>
            </div>
            <div className="inventorySummaryGrid" aria-label="库存摘要指标">
              <div>
                <span>售卖扣减</span>
                <strong>{formatInventoryMetric(inventorySummary.paidDeduction)}</strong>
              </div>
              <div>
                <span>赠品扣减</span>
                <strong>{formatInventoryMetric(inventorySummary.giftDeduction)}</strong>
              </div>
              <div>
                <span>作废回滚</span>
                <strong>{formatInventoryMetric(inventorySummary.rollback)}</strong>
              </div>
            </div>
            <details className="inventoryDetails" open={shouldShowInventoryDetailsOpen}>
              <summary>{`完整库存流水（${inventoryLogs.length} 条）`}</summary>
              {inventoryLogs.length > 0 ? (
                <div className="orderDetailList" role="list" aria-label="完整库存流水">
                  {inventoryLogs.map((log) => {
                    const item = orderItemByProductId.get(log.productId);

                    return (
                      <article className="inventoryLogRow" role="listitem" key={log.id}>
                        <div className="inventoryProductCell">
                          <span>商品</span>
                          <strong>{item?.productNameSnapshot ?? log.productId}</strong>
                          {item ? <em>{productSnapshotLabel(item)}</em> : null}
                        </div>
                        <div>
                          <span>库存原因</span>
                          <strong>{inventoryReasonLabels[log.reason]}</strong>
                        </div>
                        <div>
                          <span>数量</span>
                          <strong>{formatInventoryChange(log.changeQty)}</strong>
                        </div>
                        <div>
                          <span>库存</span>
                          <strong>{`库存 ${log.beforeQty} -> ${log.afterQty}`}</strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="emptyStateText">暂无库存流水。</p>
              )}
            </details>
          </section>
```

- [ ] **Step 4: Update SalesPage test for accessible list name**

In `src/pages/SalesPage.test.tsx`, find:

```ts
  const inventoryList = within(dialog).getByRole("list", { name: "库存流水摘要" });
```

Replace it with:

```ts
  const inventoryList = within(dialog).getByRole("list", { name: "完整库存流水" });
```

- [ ] **Step 5: Add CSS**

In `src/styles.css`, add after `.inventoryRollbackSummary` or replace the obsolete summary styling if no longer used:

```css
.inventorySummaryGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.inventorySummaryGrid div {
  min-width: 0;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid rgba(47, 111, 94, 0.2);
  border-radius: 8px;
  background: var(--accent-soft);
}

.inventorySummaryGrid span,
.inventoryDetails summary {
  color: var(--muted);
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0;
}

.inventorySummaryGrid strong {
  color: var(--accent-strong);
  font-size: 14px;
  font-weight: 950;
  overflow-wrap: anywhere;
}

.inventoryDetails {
  display: grid;
  gap: 8px;
}

.inventoryDetails summary {
  cursor: pointer;
  width: fit-content;
  padding: 7px 10px;
  border: 1px solid rgba(222, 214, 201, 0.92);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--ink);
}

.inventoryDetails[open] summary {
  margin-bottom: 8px;
}

.emptyStateText {
  margin: 0;
  padding: 10px 12px;
  border: 1px dashed rgba(122, 112, 98, 0.34);
  border-radius: 8px;
  color: var(--muted-strong);
  font-size: 13px;
  font-weight: 800;
}
```

Inside the existing mobile media query where `.orderDetailMetrics, .orderDetailLine, .inventoryLogRow` are adjusted, add `.inventorySummaryGrid` to stack on narrow screens:

```css
  .inventorySummaryGrid,
```

- [ ] **Step 6: Run component and page tests to verify GREEN**

Run:

```powershell
npm test -- src/domain/orderInventorySummary.test.ts src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/components/OrderDetailDialog.tsx src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx src/styles.css
git commit -m "feat: improve order inventory readability"
```

---

## Task 3: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused tests**

```powershell
npm test -- src/domain/orderInventorySummary.test.ts src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx
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
- Modify backup version constants.
- Add refund tables or order adjustment tables.
- Add new order statuses.
- Change inventory transaction behavior in `src/db/repositories.ts`.
