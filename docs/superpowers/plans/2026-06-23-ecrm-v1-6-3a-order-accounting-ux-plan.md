# ECRM V1.6.3a Order Accounting UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补强订单统计口径修正、非销售备注录入、订单总览识别和浏览器翻译防护体验。

**Architecture:** 保持现有 React + Dexie 架构，不修改订单、退款、库存流水业务写入。新增小型领域 helper 负责订单总览标签，UI 层只增加快速选项、成功提示、必填提示和 `translate="no"` 防护。

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite, CSS.

---

## File Structure

- Modify: `src/domain/orderHistory.ts`
  - 增加订单总览标签 helper：`getOrderHistoryAccountingBadges(order, items?)`。
- Modify: `src/domain/orderHistory.test.ts`
  - 覆盖订单性质和已修正标签输出。
- Modify: `src/components/OrderDetailDialog.tsx`
  - 增加 `campaignGiftActivityName` prop、快速选项、固定错误区域、弹窗内成功提示、翻译防护属性。
- Modify: `src/components/OrderDetailDialog.test.tsx`
  - 覆盖订单修正弹窗的默认活动名称、快速选项、必填提示、翻译防护。
- Modify: `src/pages/SalesPage.tsx`
  - 非销售商品选择弹窗增加快速备注选项和必填提示；订单记录总览增加订单性质/已修正标签；传入运营活动名称；订单详情内成功提示。
- Modify: `src/pages/SalesPage.test.tsx`
  - 覆盖订单总览标签、非销售备注快选、订单详情内成功提示。
- Modify: `src/styles.css`
  - 增加快速选项、固定错误区域、订单性质标签、翻译防护类样式。
- Modify: `index.html`
  - 确认或补齐 `lang="zh-CN"`。
- Create: `docs/releases/2026-06-23-ecrm-v1-6-3a-order-accounting-ux-record.md`
  - 记录交付内容和验收路径。

---

### Task 1: 订单总览标签领域 helper

**Files:**
- Modify: `src/domain/orderHistory.ts`
- Modify: `src/domain/orderHistory.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests to `src/domain/orderHistory.test.ts`:

```ts
test("builds accounting badges from order nature snapshot", () => {
  expect(getOrderHistoryAccountingBadges({ orderNature: "sale" })).toEqual([
    { label: "正常销售", tone: "neutral" }
  ]);
  expect(getOrderHistoryAccountingBadges({ orderNature: "mixed" })).toEqual([
    { label: "销售 + 赠送", tone: "neutral" }
  ]);
  expect(getOrderHistoryAccountingBadges({ orderNature: "non_sales" })).toEqual([
    { label: "非销售出库", tone: "neutral" }
  ]);
});

test("marks adjusted orders in accounting badges", () => {
  expect(
    getOrderHistoryAccountingBadges(
      { orderNature: "sale" },
      [{ lineType: "normal", adjustedAt: "2026-06-23T10:00:00.000Z" }]
    )
  ).toEqual([
    { label: "正常销售", tone: "neutral" },
    { label: "已修正", tone: "warning" }
  ]);
});

test("derives accounting badges from loaded order items when available", () => {
  expect(
    getOrderHistoryAccountingBadges(
      { orderNature: "sale" },
      [
        { lineType: "normal", revenueType: "sale" },
        { lineType: "gift", revenueType: "non_sales" }
      ]
    )
  ).toEqual([{ label: "销售 + 赠送", tone: "neutral" }]);
});
```

Use local helper types or `Partial<Order>` / `Partial<OrderItem>` with casts if the existing test file uses full fixtures.

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts
```

Expected: FAIL because `getOrderHistoryAccountingBadges` does not exist.

- [ ] **Step 3: Implement helper**

In `src/domain/orderHistory.ts`, add:

```ts
export type OrderHistoryAccountingBadgeTone = "neutral" | "warning";

export type OrderHistoryAccountingBadge = {
  label: string;
  tone: OrderHistoryAccountingBadgeTone;
};

export function getOrderHistoryAccountingBadges(
  order: Pick<Order, "orderNature">,
  items?: Array<Pick<OrderItem, "lineType" | "revenueType" | "adjustedAt">>
): OrderHistoryAccountingBadge[] {
  const nature = items && items.length > 0 ? deriveOrderNature(items) : order.orderNature ?? "sale";
  const badges: OrderHistoryAccountingBadge[] = [{ label: orderNatureLabels[nature], tone: "neutral" }];

  if (items?.some((item) => Boolean(item.adjustedAt))) {
    badges.push({ label: "已修正", tone: "warning" });
  }

  return badges;
}
```

- [ ] **Step 4: Run GREEN**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/orderHistory.ts src/domain/orderHistory.test.ts
git commit -m 'feat: add order accounting badges'
```

---

### Task 2: 订单详情修正弹窗体验

**Files:**
- Modify: `src/components/OrderDetailDialog.tsx`
- Modify: `src/components/OrderDetailDialog.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests to `src/components/OrderDetailDialog.test.tsx`:

```ts
test("defaults campaign accounting adjustment activity from settings and quick options fill fields", () => {
  const onAdjustOrderItem = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onAdjustOrderItem={onAdjustOrderItem}
      campaignGiftActivityName="关注社媒赠礼"
    />
  );

  const itemList = screen.getByRole("list", { name: "订单商品明细" });
  fireEvent.click(within(itemList).getAllByRole("button", { name: "修正统计口径" })[0]);

  const adjustDialog = screen.getByRole("dialog", { name: "修正单行统计口径" });
  fireEvent.change(within(adjustDialog).getByLabelText("修正为"), { target: { value: "campaign_gift" } });

  expect(within(adjustDialog).getByLabelText("运营活动快照")).toHaveValue("关注社媒赠礼");

  fireEvent.click(within(adjustDialog).getByRole("button", { name: "现场互动赠礼" }));
  expect(within(adjustDialog).getByLabelText("运营活动快照")).toHaveValue("现场互动赠礼");

  fireEvent.click(within(adjustDialog).getByRole("button", { name: "已完成关注" }));
  expect(within(adjustDialog).getByLabelText("非销售备注")).toHaveValue("已完成关注");

  fireEvent.click(within(adjustDialog).getByRole("button", { name: "历史订单补修正" }));
  expect(within(adjustDialog).getByLabelText("修正备注")).toHaveValue("历史订单补修正");
});

test("shows required note label and stable error slot for manual accounting adjustment", async () => {
  const onAdjustOrderItem = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onAdjustOrderItem={onAdjustOrderItem}
    />
  );

  const itemList = screen.getByRole("list", { name: "订单商品明细" });
  fireEvent.click(within(itemList).getAllByRole("button", { name: "修正统计口径" })[0]);

  const adjustDialog = screen.getByRole("dialog", { name: "修正单行统计口径" });
  fireEvent.change(within(adjustDialog).getByLabelText("修正为"), { target: { value: "manual_gift" } });

  expect(within(adjustDialog).getByText("非销售备注（必填）")).toBeVisible();
  expect(within(adjustDialog).getByLabelText("修正错误提示")).toHaveClass("dialogErrorSlot");

  fireEvent.click(within(adjustDialog).getByRole("button", { name: "好友赠送" }));
  expect(within(adjustDialog).getByLabelText("非销售备注")).toHaveValue("好友赠送");
});

test("marks money and order identifiers as not translatable in order detail", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
    />
  );

  expect(screen.getByText("ECRM-20260617-001")).toHaveAttribute("translate", "no");
  expect(screen.getByText("¥100.00")).toHaveAttribute("translate", "no");
  expect(screen.getByText("CANDLE-ROSE")).toHaveAttribute("translate", "no");
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: FAIL because prop, quick options, error slot and translate attributes are missing.

- [ ] **Step 3: Implement component changes**

In `src/components/OrderDetailDialog.tsx`:

- Add prop `campaignGiftActivityName?: string`.
- Add quick option constants.
- Add `applyQuickText(setter, value)` helper that sets field and clears adjustment error.
- Add a nested `MoneyText` helper or inline `translate="no" className="notranslate"` for money/IDs.
- Add `adjustmentSuccessMessage` state.
- In `confirmAccountingAdjustment`, after successful adjustment, set success message before closing nested dialog.
- In `openItemAdjustment`, if current normalized line is sale and current mode changes to campaign gift, default campaign name should come from `campaignGiftActivityName`.
- In adjustment mode change handler, when switching to campaign gift and field is empty, set current activity name.
- Render quick option chips near relevant fields.
- Replace conditional error paragraph with fixed slot:

```tsx
<p className="dialogErrorSlot" role={adjustmentError ? "alert" : undefined} aria-label="修正错误提示">
  {adjustmentError}
</p>
```

- [ ] **Step 4: Run GREEN**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/OrderDetailDialog.tsx src/components/OrderDetailDialog.test.tsx
git commit -m 'feat: improve order accounting adjustment dialog'
```

---

### Task 3: 售卖页非销售备注和订单总览标签

**Files:**
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`

- [ ] **Step 1: Write failing tests**

Add or update tests in `src/pages/SalesPage.test.tsx`:

```ts
test("non-sales picker shows required note quick options with stable error slot", async () => {
  repositories.listProducts.mockResolvedValue([
    sellableProduct,
    product({ id: "manual-gift", name: "人工赠品", spu: "赠品SPU", stockQty: 5, isGiftEligible: true, isSellable: false })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "打开购物车，当前 0 件，应收 ¥0.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 人工赠送" }));

  const picker = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  expect(within(picker).getByText("备注（必填）")).toBeVisible();
  expect(within(picker).getByLabelText("非销售出库错误提示")).toHaveClass("dialogErrorSlot");

  fireEvent.click(within(picker).getByRole("button", { name: "好友赠送" }));
  expect(within(picker).getByLabelText("备注")).toHaveValue("好友赠送");
});

test("order history shows accounting nature and adjusted badges", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "normal-order",
      orderNo: "ECRM-NORMAL",
      orderNature: "sale",
      paidAt: localIsoDateTime(0, 9, 25)
    }),
    order({
      id: "mixed-order",
      orderNo: "ECRM-MIXED",
      orderNature: "mixed",
      paidAt: localIsoDateTime(0, 10, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValueOnce([
    orderItem({
      id: "mixed-line",
      orderId: "mixed-order",
      adjustedAt: localIsoDateTime(0, 10, 30),
      revenueType: "non_sales",
      nonSalesReason: "manual_gift"
    })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  expect(within(history).getByText("正常销售")).toHaveClass("orderHistoryChip", "isAccounting");
  expect(within(history).getByText("销售 + 赠送")).toHaveClass("orderHistoryChip", "isAccounting");
});
```

If per-order item loading is not used for history badges, adjust this test to assert order snapshot labels and add a separate SalesPage test after opening a detail and refreshing list for adjusted badge if the implementation stores temporary item badge state.

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: FAIL because quick options, error slot, and accounting badges are missing.

- [ ] **Step 3: Implement SalesPage changes**

In `src/pages/SalesPage.tsx`:

- Import `getOrderHistoryAccountingBadges`.
- Add quick note options for `manual_gift` and `other_non_sales`.
- In `NonSalesProductPicker`, render `备注（必填）` and quick option buttons for required modes.
- Replace conditional error with fixed slot:

```tsx
<p className="dialogErrorSlot" role={error ? "alert" : undefined} aria-label="非销售出库错误提示">
  {error}
</p>
```

- Render order accounting badges in the order history meta area:

```tsx
{getOrderHistoryAccountingBadges(order).map((badge) => (
  <span className={badge.tone === "warning" ? "orderHistoryChip isAccounting isWarning" : "orderHistoryChip isAccounting"} key={`${order.id}-${badge.label}`}>
    {badge.label}
  </span>
))}
```

- Pass `campaignGiftActivityName={campaignGift.activityName}` to `OrderDetailDialog`.
- Ensure order amount in history has `translate="no" className="notranslate"`.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx
git commit -m 'feat: improve non sales picker and order history badges'
```

---

### Task 4: 样式、HTML 语言和发布记录

**Files:**
- Modify: `src/styles.css`
- Modify: `index.html`
- Create: `docs/releases/2026-06-23-ecrm-v1-6-3a-order-accounting-ux-record.md`

- [ ] **Step 1: Add CSS**

Add CSS:

```css
.notranslate {
  unicode-bidi: plaintext;
}

.quickOptionGroup {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quickOptionButton {
  min-height: 28px;
  padding: 0 8px;
  border-radius: 7px;
  font-size: 12px;
}

.dialogErrorSlot {
  min-height: 18px;
  color: #9f2f1d;
  font-size: 12px;
  font-weight: 850;
}

.orderHistoryChip.isAccounting {
  border-color: rgba(47, 111, 94, 0.22);
  background: rgba(219, 233, 228, 0.72);
  color: var(--accent-strong);
}

.orderHistoryChip.isWarning {
  border-color: rgba(168, 95, 24, 0.3);
  background: #fff7eb;
  color: #8a4512;
}
```

Tune selector names if existing CSS requires more specific placement.

- [ ] **Step 2: Ensure HTML language**

In `index.html`, ensure:

```html
<html lang="zh-CN">
```

- [ ] **Step 3: Add release record**

Create `docs/releases/2026-06-23-ecrm-v1-6-3a-order-accounting-ux-record.md` with:

```md
# ECRM V1.6.3a 订单统计口径修正体验补强记录

## 版本

- 版本号：v1.6.3a
- 日期：2026-06-23
- 分支：v1.6.3a-order-accounting-ux

## 本版重点

- 订单详情统计口径修正弹窗增加快速选项。
- 运营赠礼修正默认带入设置页运营活动名称。
- 人工赠送和其他出库备注必填提示前置。
- 非销售出库商品选择弹窗增加备注快速选项。
- 订单记录总览显示订单性质标签。
- 金额和订单号增加浏览器翻译防护属性。

## 不变内容

- 不修改订单、退款和库存流水事实。
- 不新增仪表盘统计。
- 不做全局 UI 壳层改版。

## 验收建议

- 修正历史订单为运营赠礼，确认活动快照默认带入并可快速切换。
- 修正历史订单为人工赠送或其他出库，确认备注必填和快速备注可用。
- 在售卖页添加人工赠送或其他出库，确认备注必填标识和快速备注可用。
- 查看订单记录总览，确认订单性质标签显示。
- 开启浏览器翻译时复查金额显示。
```

- [ ] **Step 4: Run targeted tests**

Run:

```powershell
npm test -- src/domain/orderHistory.test.ts src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/styles.css index.html docs/releases/2026-06-23-ecrm-v1-6-3a-order-accounting-ux-record.md
git commit -m 'docs: record v1.6.3a accounting ux updates'
```

---

### Task 5: Final verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run build**

Run:

```powershell
npm run build
```

Expected: build passes. Existing Vite chunk warning is acceptable.

- [ ] **Step 3: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors. Windows LF/CRLF warnings are acceptable.

- [ ] **Step 4: Review diff**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -8
git diff main...HEAD --stat
```

Expected: branch has only V1.6.3a scoped commits and no unrelated files.

- [ ] **Step 5: Report manual validation URL**

If the dev server is needed, run:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: local URL is available for user testing.
