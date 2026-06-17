# ECRM V1.3c-1 Cancel Reason Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为订单作废增加原因和备注记录，并在订单详情中可追溯展示。

**Architecture:** 本版本只扩展现有 `Order` 可选字段，不新增 Dexie 表，不升级 Dexie schema，不升级备份版本。`voidPaidOrder` 增加可选参数保存作废原因和备注；订单详情确认弹窗收集原因/备注，售卖页传给 repository，备份校验允许旧备份缺失这些字段。

**Tech Stack:** React 19, TypeScript, Dexie, Vitest, Testing Library, Vite.

---

## File Structure

- Modify `src/domain/types.ts`
  - 新增 `OrderCancelReason` 类型。
  - `Order` 增加 `cancelReason?: OrderCancelReason` 和 `cancelNote?: string`。
- Modify `src/db/repositories.ts`
  - 新增 `VoidPaidOrderOptions` 类型。
  - `voidPaidOrder(orderId, optionsOrNow?, maybeNow?)` 支持旧调用和新调用。
  - 作废成功时写入 `cancelReason` 和 `cancelNote`。
- Modify `src/db/repositories.test.ts`
  - 覆盖保存作废原因和备注。
  - 覆盖旧调用默认原因。
- Modify `src/utils/backup.ts`
  - 导入校验允许 `cancelReason`、`cancelNote`。
  - 校验作废原因必须在允许集合中。
- Modify `src/utils/backup.test.ts`
  - 覆盖导入带作废原因/备注的订单。
  - 覆盖非法作废原因被拒绝。
- Modify `src/components/OrderDetailDialog.tsx`
  - 作废确认弹窗增加原因下拉和备注输入。
  - `onVoidOrder` 改为接收 `{ cancelReason, cancelNote }`。
  - 订单详情展示作废原因和备注。
- Modify `src/components/OrderDetailDialog.test.tsx`
  - 覆盖确认作废传出原因和备注。
  - 覆盖已取消订单展示作废原因和备注。
- Modify `src/pages/SalesPage.tsx`
  - `handleVoidSelectedOrder` 接收作废参数并传给 repository。
- Modify `src/pages/SalesPage.test.tsx`
  - 覆盖页面从弹窗传参到 `voidPaidOrder`。

---

## Task 1: Types, Repository, And Backup Validation

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/db/repositories.ts`
- Modify: `src/db/repositories.test.ts`
- Modify: `src/utils/backup.ts`
- Modify: `src/utils/backup.test.ts`

- [ ] **Step 1: Write failing repository tests**

In `src/db/repositories.test.ts`, add these tests inside `describe("voidPaidOrder", () => { ... })` after the successful void test:

```ts
  test("stores cancel reason and note when voiding a paid order", async () => {
    const voidedAt = "2026-06-17T10:30:00.000Z";

    await db.products.put(product({ id: "normal", stockQty: 5 }));
    await db.orders.put(paidOrder());
    await db.inventoryLogs.bulkPut(inventoryLogs());

    await expect(
      voidPaidOrder(
        "order-1",
        {
          cancelReason: "customer_cancelled",
          cancelNote: "客户临时改为不购买。"
        },
        new Date(voidedAt)
      )
    ).resolves.toEqual(
      expect.objectContaining({
        id: "order-1",
        status: "cancelled",
        cancelledAt: voidedAt,
        cancelReason: "customer_cancelled",
        cancelNote: "客户临时改为不购买。"
      })
    );

    await expect(db.orders.get("order-1")).resolves.toEqual(
      expect.objectContaining({
        cancelReason: "customer_cancelled",
        cancelNote: "客户临时改为不购买。"
      })
    );
  });

  test("uses mistake as the default cancel reason for legacy void calls", async () => {
    await db.products.put(product({ id: "normal", stockQty: 5 }));
    await db.orders.put(paidOrder());
    await db.inventoryLogs.bulkPut(inventoryLogs());

    await voidPaidOrder("order-1", new Date("2026-06-17T10:35:00.000Z"));

    await expect(db.orders.get("order-1")).resolves.toEqual(
      expect.objectContaining({
        cancelReason: "mistake"
      })
    );
  });
```

- [ ] **Step 2: Run repository tests to verify RED**

Run:

```powershell
npm test -- src/db/repositories.test.ts
```

Expected: FAIL because `cancelReason` / `cancelNote` types and `voidPaidOrder` options are not implemented.

- [ ] **Step 3: Write failing backup tests**

In `src/utils/backup.test.ts`, add these tests inside `describe("backup utilities", () => { ... })` near the other order validation tests:

```ts
  test("imports cancelled orders with cancel reason and note", async () => {
    const importData = vi.fn();

    await importJsonBackupFromText(
      JSON.stringify(
        validPayload({
          orders: [
            {
              ...validOrder(),
              status: "cancelled",
              cancelledAt: "2026-06-17T10:00:00.000Z",
              cancelReason: "customer_cancelled",
              cancelNote: "客户取消购买。"
            }
          ]
        })
      ),
      { importData }
    );

    expect(importData).toHaveBeenCalledOnce();
  });

  test("rejects invalid order cancel reasons", async () => {
    const importData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify(
          validPayload({
            orders: [
              {
                ...validOrder(),
                status: "cancelled",
                cancelledAt: "2026-06-17T10:00:00.000Z",
                cancelReason: "bad_reason"
              }
            ]
          })
        ),
        { importData }
      )
    ).rejects.toThrow("备份文件格式不正确。");

    expect(importData).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run backup tests to verify RED**

Run:

```powershell
npm test -- src/utils/backup.test.ts
```

Expected: FAIL because backup validation does not allow the new optional fields.

- [ ] **Step 5: Update domain types**

In `src/domain/types.ts`, add:

```ts
export type OrderCancelReason =
  | "mistake"
  | "customer_cancelled"
  | "duplicate_order"
  | "inventory_issue"
  | "payment_issue"
  | "other";
```

Update `Order`:

```ts
  cancelledAt?: string;
  cancelReason?: OrderCancelReason;
  cancelNote?: string;
```

- [ ] **Step 6: Update repository implementation**

In `src/db/repositories.ts`, import `OrderCancelReason` if needed and add:

```ts
export type VoidPaidOrderOptions = {
  cancelReason?: OrderCancelReason;
  cancelNote?: string;
};

function normalizeVoidPaidOrderArgs(
  optionsOrNow?: VoidPaidOrderOptions | Date,
  maybeNow?: Date
): { options: VoidPaidOrderOptions; now: Date } {
  if (optionsOrNow instanceof Date) {
    return { options: {}, now: optionsOrNow };
  }

  return { options: optionsOrNow ?? {}, now: maybeNow ?? new Date() };
}
```

Change signature:

```ts
export async function voidPaidOrder(
  orderId: string,
  optionsOrNow?: VoidPaidOrderOptions | Date,
  maybeNow?: Date
): Promise<Order> {
  const { options, now } = normalizeVoidPaidOrderArgs(optionsOrNow, maybeNow);
  const voidedAt = now.toISOString();
```

When building `nextOrder`, write:

```ts
      cancelReason: options.cancelReason ?? "mistake",
      cancelNote: options.cancelNote?.trim() || undefined
```

- [ ] **Step 7: Update backup validation**

In `src/utils/backup.ts`, add:

```ts
const ORDER_CANCEL_REASONS = new Set(["mistake", "customer_cancelled", "duplicate_order", "inventory_issue", "payment_issue", "other"]);
```

Inside order validation, allow:

```ts
    if (order.cancelReason !== undefined && !ORDER_CANCEL_REASONS.has(String(order.cancelReason))) {
      return false;
    }

    if (order.cancelNote !== undefined && !isString(order.cancelNote)) {
      return false;
    }
```

- [ ] **Step 8: Run tests to verify GREEN**

Run:

```powershell
npm test -- src/db/repositories.test.ts src/utils/backup.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add src/domain/types.ts src/db/repositories.ts src/db/repositories.test.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: store order cancel reason"
```

---

## Task 2: Order Detail Dialog Cancel Reason UI

**Files:**
- Modify: `src/components/OrderDetailDialog.tsx`
- Modify: `src/components/OrderDetailDialog.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

In `src/components/OrderDetailDialog.test.tsx`, update the void action test to select `客户取消` and type a note before confirming:

```ts
  fireEvent.click(within(dialog).getByRole("button", { name: "作废订单" }));

  const confirmDialog = screen.getByRole("dialog", { name: "确认作废订单" });
  fireEvent.change(within(confirmDialog).getByLabelText("作废原因"), {
    target: { value: "customer_cancelled" }
  });
  fireEvent.change(within(confirmDialog).getByLabelText("作废备注"), {
    target: { value: "客户临时取消。" }
  });
  fireEvent.click(within(confirmDialog).getByRole("button", { name: "确认作废" }));

  expect(onVoidOrder).toHaveBeenCalledWith({
    cancelReason: "customer_cancelled",
    cancelNote: "客户临时取消。"
  });
```

Add a new display test:

```ts
test("shows cancel reason and note for cancelled orders", () => {
  render(
    <OrderDetailDialog
      order={{
        ...order,
        status: "cancelled",
        cancelledAt: "2026-06-17T10:00:00.000Z",
        cancelReason: "duplicate_order",
        cancelNote: "重复保存了一次订单。"
      }}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      onClose={() => undefined}
    />
  );

  expect(screen.getByText("售后记录")).toBeVisible();
  expect(screen.getByText("作废原因")).toBeVisible();
  expect(screen.getByText("重复下单")).toBeVisible();
  expect(screen.getByText("作废备注")).toBeVisible();
  expect(screen.getByText("重复保存了一次订单。")).toBeVisible();
});
```

- [ ] **Step 2: Run component tests to verify RED**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: FAIL because the dialog has no cancel reason select/note and no after-sales display.

- [ ] **Step 3: Update component props and labels**

In `src/components/OrderDetailDialog.tsx`, import `OrderCancelReason` and add:

```ts
type VoidOrderInput = {
  cancelReason: OrderCancelReason;
  cancelNote?: string;
};
```

Update prop:

```ts
onVoidOrder?: (input: VoidOrderInput) => Promise<void> | void;
```

Add labels:

```ts
const cancelReasonLabels: Record<OrderCancelReason, string> = {
  mistake: "误操作",
  customer_cancelled: "客户取消",
  duplicate_order: "重复下单",
  inventory_issue: "库存/赠品异常",
  payment_issue: "收款异常",
  other: "其他"
};

const cancelReasonOptions = Object.keys(cancelReasonLabels) as OrderCancelReason[];
```

Add state:

```ts
const [cancelReason, setCancelReason] = useState<OrderCancelReason>("mistake");
const [cancelNote, setCancelNote] = useState("");
```

Update confirm:

```ts
await onVoidOrder({
  cancelReason,
  cancelNote: cancelNote.trim() || undefined
});
```

- [ ] **Step 4: Add confirm fields and after-sales display**

In the confirm dialog before `fieldHint`, add:

```tsx
            <label className="dialogField">
              <span>作废原因</span>
              <select
                aria-label="作废原因"
                value={cancelReason}
                disabled={isVoiding}
                onChange={(event) => setCancelReason(event.target.value as OrderCancelReason)}
              >
                {cancelReasonOptions.map((reason) => (
                  <option key={reason} value={reason}>
                    {cancelReasonLabels[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="dialogField">
              <span>作废备注</span>
              <textarea
                aria-label="作废备注"
                value={cancelNote}
                disabled={isVoiding}
                maxLength={120}
                rows={3}
                onChange={(event) => setCancelNote(event.target.value)}
                placeholder="可选"
              />
            </label>
```

In the order detail body after basic info, show after-sales only for cancelled orders:

```tsx
          {order.status === "cancelled" ? (
            <section className="orderDetailSection" aria-labelledby="order-detail-after-sales-title">
              <div className="sectionTitle">
                <ReceiptText size={19} aria-hidden="true" />
                <div>
                  <h2 id="order-detail-after-sales-title">售后记录</h2>
                  <p>作废原因和处理备注</p>
                </div>
              </div>
              <dl className="orderDetailMetrics">
                <div>
                  <dt>作废时间</dt>
                  <dd>{formatDateTime(order.cancelledAt)}</dd>
                </div>
                <div>
                  <dt>作废原因</dt>
                  <dd>{cancelReasonLabels[order.cancelReason ?? "mistake"]}</dd>
                </div>
                <div>
                  <dt>作废备注</dt>
                  <dd>{order.cancelNote || "未记录"}</dd>
                </div>
              </dl>
            </section>
          ) : null}
```

- [ ] **Step 5: Add minimal CSS**

In `src/styles.css`, add:

```css
.dialogField {
  display: grid;
  gap: 6px;
}

.dialogField span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
}

.dialogField textarea {
  min-height: 72px;
  resize: vertical;
}
```

- [ ] **Step 6: Run component tests to verify GREEN**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/components/OrderDetailDialog.tsx src/components/OrderDetailDialog.test.tsx src/styles.css
git commit -m "feat: collect order cancel reason"
```

---

## Task 3: Sales Page Wiring

**Files:**
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`

- [ ] **Step 1: Write failing page test**

In `src/pages/SalesPage.test.tsx`, update the successful void test to select a reason and note before confirm:

```ts
  fireEvent.click(await screen.findByRole("button", { name: "作废订单" }));
  const confirmDialog = await screen.findByRole("dialog", { name: "确认作废订单" });
  fireEvent.change(within(confirmDialog).getByLabelText("作废原因"), {
    target: { value: "customer_cancelled" }
  });
  fireEvent.change(within(confirmDialog).getByLabelText("作废备注"), {
    target: { value: "客户取消。" }
  });
  fireEvent.click(within(confirmDialog).getByRole("button", { name: "确认作废" }));
```

Update expectation:

```ts
  await waitFor(() =>
    expect(repositories.voidPaidOrder).toHaveBeenCalledWith("order-detail", {
      cancelReason: "customer_cancelled",
      cancelNote: "客户取消。"
    })
  );
```

Set `cancelledOrder` in the test to include:

```ts
cancelReason: "customer_cancelled" as const,
cancelNote: "客户取消。"
```

Assert detail shows:

```ts
expect(within(dialog).getByText("客户取消")).toBeVisible();
expect(within(dialog).getByText("客户取消。")).toBeVisible();
```

- [ ] **Step 2: Run SalesPage tests to verify RED**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: FAIL because `handleVoidSelectedOrder` does not accept or pass the new input yet.

- [ ] **Step 3: Update SalesPage handler**

In `src/pages/SalesPage.tsx`, import `OrderCancelReason` type if needed and add:

```ts
type VoidOrderInput = {
  cancelReason: OrderCancelReason;
  cancelNote?: string;
};
```

Update:

```ts
async function handleVoidSelectedOrder(input: VoidOrderInput) {
```

Change repository call:

```ts
const voidedOrder = await voidPaidOrder(selectedOrder.id, input);
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
git commit -m "feat: pass cancel reason from sales page"
```

---

## Task 4: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused tests**

```powershell
npm test -- src/db/repositories.test.ts src/utils/backup.test.ts src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx
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

