# ECRM V1.3b Order Void Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付已支付订单整单作废能力，自动回滚本订单扣减的库存，并在订单详情中可追溯。

**Architecture:** V1.3b 不升级 Dexie schema，不新增订单调整表，沿用现有 `cancelled` 状态表达“已取消/已作废”。库存回滚在 repository 事务中完成，UI 只触发作废并刷新订单详情、订单列表和商品库存。所有用户可见错误均为中文固定文案，不暴露底层异常。

**Tech Stack:** React 19, TypeScript, Dexie, Vitest, Testing Library, Vite, lucide-react.

---

## File Structure

- Modify `src/domain/types.ts`
  - `InventoryLog.reason` 增加 `order_cancelled_rollback`。
- Modify `src/utils/backup.ts`
  - 备份导入校验允许 `order_cancelled_rollback`。
- Modify `src/components/OrderDetailDialog.tsx`
  - 增加可选 `onVoidOrder`、`isVoiding` props。
  - 对 `paid` 订单显示“作废订单”按钮。
  - 增加二次确认弹窗。
  - 库存流水原因显示“作废回滚”。
- Modify `src/components/OrderDetailDialog.test.tsx`
  - 覆盖作废按钮、确认弹窗、已取消订单不显示作废按钮、无退款入口。
- Modify `src/db/repositories.ts`
  - 新增 `voidPaidOrder(orderId: string, now = new Date())`。
  - 在单个 Dexie 事务内更新订单、写回滚流水、更新商品库存。
- Modify `src/db/repositories.test.ts`
  - 覆盖作废成功、重复作废拒绝、非 paid 拒绝、无原始扣减流水拒绝。
- Modify `src/pages/SalesPage.tsx`
  - 引入 `voidPaidOrder`。
  - 在订单详情中传入作废 handler。
  - 作废成功后刷新数据并重新加载当前订单详情。
  - 作废失败显示中文固定错误。
- Modify `src/pages/SalesPage.test.tsx`
  - mock `voidPaidOrder`。
  - 覆盖从订单详情作废订单的成功/失败行为。

---

## Task 1: Types And Backup Validation

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/utils/backup.ts`
- Modify: `src/utils/backup.test.ts`

- [ ] **Step 1: Write the failing backup validation test**

In `src/utils/backup.test.ts`, add this test inside `describe("backup utilities", () => { ... })` near the other import validation tests:

```tsx
test("imports order cancelled rollback inventory logs", async () => {
  const importData = vi.fn();

  await importJsonBackupFromText(
    JSON.stringify(
      validPayload({
        inventoryLogs: [
          {
            id: "rollback-log-1",
            productId: "product-1",
            orderId: "order-1",
            changeQty: 2,
            reason: "order_cancelled_rollback",
            beforeQty: 3,
            afterQty: 5,
            createdAt: "2026-06-17T10:00:00.000Z"
          }
        ]
      })
    ),
    { importData }
  );

  expect(importData).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the backup test to verify RED**

Run:

```powershell
npm test -- src/utils/backup.test.ts
```

Expected: FAIL because `order_cancelled_rollback` is not allowed by `INVENTORY_REASONS`.

- [ ] **Step 3: Update types and backup validation**

In `src/domain/types.ts`, update:

```ts
reason: "order_paid" | "gift_order_paid" | "order_cancelled_rollback" | "manual_adjust";
```

In `src/utils/backup.ts`, update:

```ts
const INVENTORY_REASONS = new Set(["order_paid", "gift_order_paid", "order_cancelled_rollback", "manual_adjust"]);
```

- [ ] **Step 4: Run backup test to verify GREEN**

Run:

```powershell
npm test -- src/utils/backup.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/types.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: allow order void inventory reason"
```

---

## Task 2: Repository Order Void Transaction

**Files:**
- Modify: `src/db/repositories.ts`
- Modify: `src/db/repositories.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add tests for `voidPaidOrder(orderId: string, now = new Date())`:

1. Paid order with one normal log and one gift log:
   - Current products have changed stock after the original order.
   - `voidPaidOrder("order-1", new Date("2026-06-17T10:00:00.000Z"))`:
     - updates order to `cancelled`;
     - sets `cancelledAt`;
     - increases product stocks by the absolute value of original negative logs;
     - writes positive `order_cancelled_rollback` logs.
2. Calling again rejects with `只有已支付订单可以作废。`
3. Pending/cancelled order rejects with `只有已支付订单可以作废。`
4. Paid order without original negative inventory logs rejects with `订单缺少可回滚的库存流水。`

- [ ] **Step 2: Run repository tests to verify RED**

Run:

```powershell
npm test -- src/db/repositories.test.ts
```

Expected: FAIL because `voidPaidOrder` is not exported.

- [ ] **Step 3: Implement `voidPaidOrder`**

Add to `src/db/repositories.ts`:

```ts
export async function voidPaidOrder(orderId: string, now = new Date()): Promise<Order> {
  const voidedAt = now.toISOString();

  return db.transaction("rw", db.orders, db.inventoryLogs, db.products, async () => {
    const order = await db.orders.get(orderId);

    if (!order || order.status !== "paid") {
      throw new Error("只有已支付订单可以作废。");
    }

    const originalLogs = (await db.inventoryLogs.where("orderId").equals(orderId).toArray())
      .filter((log) => log.changeQty < 0 && (log.reason === "order_paid" || log.reason === "gift_order_paid"));

    if (originalLogs.length === 0) {
      throw new Error("订单缺少可回滚的库存流水。");
    }

    const rollbackLogs: InventoryLog[] = [];
    const updatedProducts = new Map<string, Product>();

    for (const originalLog of originalLogs) {
      const product = updatedProducts.get(originalLog.productId) ?? await db.products.get(originalLog.productId);

      if (!product) {
        throw new Error("订单关联商品不存在，无法回滚库存。");
      }

      const beforeQty = product.stockQty;
      const changeQty = Math.abs(originalLog.changeQty);
      const afterQty = beforeQty + changeQty;

      const updatedProduct = {
        ...product,
        stockQty: afterQty,
        updatedAt: voidedAt
      };

      updatedProducts.set(product.id, updatedProduct);
      rollbackLogs.push({
        id: makeId("inventory"),
        productId: product.id,
        orderId,
        changeQty,
        reason: "order_cancelled_rollback",
        beforeQty,
        afterQty,
        createdAt: voidedAt
      });
    }

    const nextOrder: Order = {
      ...order,
      status: "cancelled",
      cancelledAt: voidedAt
    };

    await db.orders.put(nextOrder);
    await db.products.bulkPut([...updatedProducts.values()]);
    await db.inventoryLogs.bulkPut(rollbackLogs);

    return nextOrder;
  });
}
```

- [ ] **Step 4: Run repository tests to verify GREEN**

Run:

```powershell
npm test -- src/db/repositories.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/db/repositories.ts src/db/repositories.test.ts
git commit -m "feat: void paid orders with inventory rollback"
```

---

## Task 3: Order Detail Dialog Void Action

**Files:**
- Modify: `src/components/OrderDetailDialog.tsx`
- Modify: `src/components/OrderDetailDialog.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Add tests that verify:

- Paid order shows `作废订单`.
- Clicking it opens `确认作废订单`.
- Clicking `确认作废` calls `onVoidOrder`.
- Cancelled order does not show `作废订单`.
- Dialog still does not show `退款`.
- Inventory log reason `order_cancelled_rollback` shows `作废回滚`.

- [ ] **Step 2: Run component tests to verify RED**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: FAIL because the component has no void action.

- [ ] **Step 3: Implement props and UI**

Update props:

```ts
type OrderDetailDialogProps = {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  onClose: () => void;
  onVoidOrder?: () => Promise<void> | void;
  isVoiding?: boolean;
};
```

Add reason label:

```ts
order_cancelled_rollback: "作废回滚"
```

Add local state:

```ts
const [isVoidConfirmOpen, setIsVoidConfirmOpen] = useState(false);
```

Show action button only when:

```ts
order.status === "paid" && onVoidOrder
```

Add confirm dialog with Chinese text and buttons `取消` / `确认作废`.

- [ ] **Step 4: Run component tests to verify GREEN**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/OrderDetailDialog.tsx src/components/OrderDetailDialog.test.tsx src/styles.css
git commit -m "feat: add order void confirmation"
```

---

## Task 4: Sales Page Void Wiring

**Files:**
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`

- [ ] **Step 1: Write failing SalesPage tests**

Update repository mock to include:

```ts
voidPaidOrder: vi.fn()
```

Add tests:

1. Open paid order detail, click `作废订单`, confirm, expect:
   - `voidPaidOrder("order-detail")` called;
   - data refresh functions called again;
   - dialog shows `已取消`;
   - success message `订单 ECRM-DETAIL 已作废，库存已回滚。`.
2. If `voidPaidOrder` rejects, expect:
   - UI shows `订单作废失败，请刷新后重试。`;
   - no raw error message is shown.

- [ ] **Step 2: Run SalesPage tests to verify RED**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: FAIL because `voidPaidOrder` is not wired.

- [ ] **Step 3: Implement SalesPage wiring**

Import:

```ts
voidPaidOrder
```

Add state:

```ts
const [isVoidingOrder, setIsVoidingOrder] = useState(false);
```

Add handler:

```ts
async function handleVoidSelectedOrder() {
  if (!selectedOrder) {
    return;
  }

  setIsVoidingOrder(true);
  setStatus(undefined);

  try {
    const voidedOrder = await voidPaidOrder(selectedOrder.id);
    const [items, inventoryLogs] = await Promise.all([
      listOrderItems(voidedOrder.id),
      listInventoryLogsForOrder(voidedOrder.id)
    ]);
    setSelectedOrder(voidedOrder);
    setSelectedOrderItems(items);
    setSelectedOrderInventoryLogs(inventoryLogs);
    setStatus({ kind: "success", text: `订单 ${voidedOrder.orderNo} 已作废，库存已回滚。` });
    await refreshSalesData({ preserveStatus: true });
  } catch {
    setStatus({ kind: "error", text: "订单作废失败，请刷新后重试。" });
  } finally {
    setIsVoidingOrder(false);
  }
}
```

Pass to dialog:

```tsx
onVoidOrder={handleVoidSelectedOrder}
isVoiding={isVoidingOrder}
```

- [ ] **Step 4: Run SalesPage tests to verify GREEN**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx
git commit -m "feat: void orders from sales detail"
```

---

## Task 5: Verification

- [ ] **Step 1: Run focused tests**

```powershell
npm test -- src/utils/backup.test.ts src/db/repositories.test.ts src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx
```

Expected: all pass.

- [ ] **Step 2: Run full test suite**

```powershell
npm test
```

Expected: all pass.

- [ ] **Step 3: Run production build**

```powershell
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Check git status and whitespace**

```powershell
git diff --check
git status --short --branch
```

Expected: no whitespace errors and clean tree after commits.

- [ ] **Step 5: Dev server smoke check**

```powershell
try { (Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 3).StatusCode } catch { "DOWN" }
```

Expected: `200`. If down, start dev server on port 5173.
