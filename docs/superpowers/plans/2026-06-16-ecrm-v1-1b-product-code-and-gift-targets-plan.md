# ECRM V1.1b Product Code And Gift Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SPU/SKU/product-code management and support gift tiers that target either a specific SKU or an SPU gift pool with manual SKU selection before paid confirmation.

**Architecture:** Implement in small, verified slices. Product code fields are additive and backward-compatible for existing data. Gift target support changes promotion settings, cart calculation, checkout validation, order snapshots, backup validation, and inventory deduction, so it must preserve old gift config as SKU-target gifts and avoid automatic SPU inventory deduction.

**Tech Stack:** React 19, TypeScript, Vite, Dexie, Zustand, Vitest, Testing Library.

---

## Scope Boundaries

Included:

- Add `spuCode`, `skuCode`, and `productCode` to product data.
- Generate `productCode` from `spuCode` and `skuCode`.
- Validate duplicate SPU/SKU code content and duplicate product codes.
- Display product code in Products, Sales, Cart, and SKU dropdowns.
- Support gift config target types: SKU and SPU.
- For SPU gift targets, require manual actual SKU selection before confirming paid order.
- Deduct actual selected gift SKU inventory.
- Keep old backups and old settings importable.

Excluded:

- Full cart UI redesign beyond what is required to support gift selection.
- Cloud sync.
- Barcode scanning.
- Product code bulk import/export.
- Generic promotion rule engine.

---

## File Structure

- Modify `src/domain/types.ts`
  - Add product code fields.
  - Add gift target union types.
  - Add calculated gift entitlement / resolved gift line types.
  - Add order item product code snapshots.

- Create `src/domain/productCode.ts`
  - `normalizeCodePart`
  - `buildProductCode`
  - `validateProductCodeParts`
  - `displayProductCode`

- Modify `src/components/ProductForm.tsx`
  - Add SPU code and SKU code fields.
  - Add read-only generated product code preview.
  - Surface duplicate-prefix validation errors.

- Modify `src/pages/ProductsPage.tsx`
  - Enforce product code uniqueness.
  - Save generated product code.
  - Display product code in product list.

- Modify `src/test/fixtures.ts`
  - Add default code fields to `product()`.
  - Add helpers only if needed.

- Modify `src/domain/promotions.ts`
  - Keep existing add-on discount behavior unchanged.
  - Support old `{ productId, quantity }` gifts as SKU target.
  - Support new `{ targetType: "sku" | "spu", ... }` gifts.
  - Return gift entitlements for SPU targets without deducting actual SKU automatically.

- Create `src/domain/giftSelection.ts`
  - Track and validate checkout gift SKU selections for SPU-target gifts.
  - Convert selected gifts into actual calculated gift lines.

- Modify `src/components/CheckoutPanel.tsx`
  - Accept gift selection props.
  - Render required SPU gift selection controls.
  - Disable confirm paid until selections satisfy required quantities.

- Modify `src/pages/SalesPage.tsx`
  - Maintain gift selection state in checkout mode.
  - Pass resolved actual gift lines to order builder.
  - Reset stale selections when cart/promotion changes.

- Modify `src/domain/order.ts`
  - Build paid order using actual selected gift SKU lines.
  - Save product code snapshot on order items.

- Modify `src/pages/SettingsPage.tsx`
  - Gift config supports target type SKU/SPU.
  - SKU dropdown shows product code + name.
  - SPU dropdown shows SPU name + SKU count.
  - Existing A/B simple config can be evolved without changing user-facing tier quantities.

- Modify `src/utils/backup.ts`
  - Accept old and new product fields.
  - Accept old and new gift config shapes.
  - Validate product code uniqueness where codes exist.

- Modify `src/db/db.ts`
  - Add Dexie version for product code indexes if needed.

- Modify tests:
  - `src/components/ProductForm.test.tsx`
  - `src/pages/ProductsPage.test.tsx` if missing, create it only if needed.
  - `src/domain/promotions.test.ts`
  - `src/domain/order.test.ts`
  - `src/components/CheckoutPanel.test.tsx`
  - `src/pages/SalesPage.test.tsx`
  - `src/pages/SettingsPage.test.tsx`
  - `src/utils/backup.test.ts`

---

## Task 1: Product Code Domain Helpers And Product Model

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/productCode.ts`
- Create: `src/domain/productCode.test.ts`
- Modify: `src/test/fixtures.ts`

- [ ] **Step 1: Write product code helper tests**

Create `src/domain/productCode.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildProductCode, displayProductCode, validateProductCodeParts } from "./productCode";

describe("product code helpers", () => {
  test("builds product code from SPU code and SKU code", () => {
    expect(buildProductCode(" CLTH-24001 ", " BLK-M ")).toBe("CLTH-24001-BLK-M");
  });

  test("uses SPU code as preview when SKU code is empty", () => {
    expect(buildProductCode("CLTH-24001", "")).toBe("CLTH-24001");
  });

  test("rejects SKU code that repeats SPU code prefix", () => {
    expect(validateProductCodeParts("CLTH-24001", "CLTH-24001-BLK-M")).toEqual({
      ok: false,
      message:
        "SPU 编码与 SKU 编码存在重复内容。SKU 编码只需填写规格/变体部分，例如：BLK-M。完整商品编码将由系统自动生成：CLTH-24001-BLK-M。"
    });
  });

  test("requires both code parts when saving a product", () => {
    expect(validateProductCodeParts("", "BLK-M")).toEqual({
      ok: false,
      message: "SPU 编码和 SKU 编码均为必填。"
    });
    expect(validateProductCodeParts("CLTH-24001", "")).toEqual({
      ok: false,
      message: "SPU 编码和 SKU 编码均为必填。"
    });
  });

  test("displays fallback when product code is missing", () => {
    expect(displayProductCode(undefined)).toBe("未设置编码");
    expect(displayProductCode("")).toBe("未设置编码");
    expect(displayProductCode("CLTH-24001-BLK-M")).toBe("CLTH-24001-BLK-M");
  });
});
```

- [ ] **Step 2: Run product code tests and verify failure**

Run:

```powershell
npm test -- src/domain/productCode.test.ts
```

Expected: FAIL because `productCode.ts` does not exist.

- [ ] **Step 3: Implement product code helpers**

Create `src/domain/productCode.ts`:

```ts
export type ProductCodeValidationResult =
  | { ok: true; productCode: string }
  | { ok: false; message: string };

export function normalizeCodePart(value: string): string {
  return value.trim();
}

export function buildProductCode(spuCode: string, skuCode: string): string {
  const normalizedSpu = normalizeCodePart(spuCode);
  const normalizedSku = normalizeCodePart(skuCode);

  if (!normalizedSku) {
    return normalizedSpu;
  }

  return `${normalizedSpu}-${normalizedSku}`;
}

export function validateProductCodeParts(spuCode: string, skuCode: string): ProductCodeValidationResult {
  const normalizedSpu = normalizeCodePart(spuCode);
  const normalizedSku = normalizeCodePart(skuCode);

  if (!normalizedSpu || !normalizedSku) {
    return { ok: false, message: "SPU 编码和 SKU 编码均为必填。" };
  }

  if (normalizedSku.toLocaleUpperCase().startsWith(normalizedSpu.toLocaleUpperCase())) {
    return {
      ok: false,
      message:
        `SPU 编码与 SKU 编码存在重复内容。SKU 编码只需填写规格/变体部分，例如：${normalizedSku.slice(normalizedSpu.length).replace(/^-/, "") || "BLK-M"}。完整商品编码将由系统自动生成：${buildProductCode(normalizedSpu, normalizedSku.slice(normalizedSpu.length).replace(/^-/, "") || normalizedSku)}。`
    };
  }

  return { ok: true, productCode: buildProductCode(normalizedSpu, normalizedSku) };
}

export function displayProductCode(productCode?: string): string {
  return productCode && productCode.trim().length > 0 ? productCode : "未设置编码";
}
```

- [ ] **Step 4: Update product type and fixture**

In `src/domain/types.ts`, add optional fields to `Product`:

```ts
  spuCode?: string;
  skuCode?: string;
  productCode?: string;
```

In `src/test/fixtures.ts`, add defaults:

```ts
    spuCode: "NORMAL",
    skuCode: "BASE",
    productCode: "NORMAL-BASE",
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test -- src/domain/productCode.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/domain/types.ts src/domain/productCode.ts src/domain/productCode.test.ts src/test/fixtures.ts
git commit -m 'feat: add product code helpers'
```

---

## Task 2: Product Form Code Fields And Uniqueness

**Files:**
- Modify: `src/components/ProductForm.tsx`
- Modify: `src/components/ProductForm.test.tsx`
- Modify: `src/pages/ProductsPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add failing ProductForm tests**

Extend `src/components/ProductForm.test.tsx` with tests that:

- Product form shows SPU code, SKU code, and generated product code preview.
- Saving with `spuCode=CLTH-24001` and `skuCode=BLK-M` submits `productCode=CLTH-24001-BLK-M`.
- Saving with `skuCode=CLTH-24001-BLK-M` shows the duplicate content error and does not submit.

Use the exact error text from Task 1.

- [ ] **Step 2: Run ProductForm tests and verify failure**

Run:

```powershell
npm test -- src/components/ProductForm.test.tsx
```

Expected: FAIL because fields do not exist.

- [ ] **Step 3: Implement ProductForm fields**

Update `ProductFormValues` and `Draft` with:

```ts
  spuCode: string;
  skuCode: string;
  productCode: string;
```

Use `buildProductCode` for preview and `validateProductCodeParts` for save validation.

Add fields after SPU:

```tsx
<div className="fieldGrid">
  <label>
    <span>SPU 编码</span>
    <input aria-label="SPU 编码" ... />
  </label>
  <label>
    <span>SKU 编码</span>
    <input aria-label="SKU 编码" ... />
  </label>
  <label>
    <span>完整商品编码</span>
    <input aria-label="完整商品编码" value={productCodePreview || "未设置编码"} readOnly />
  </label>
</div>
```

- [ ] **Step 4: Enforce product code uniqueness in ProductsPage**

Before `upsertProduct`, compute product code and compare against other products. If duplicate, show:

```text
完整商品编码已存在，请调整 SPU 编码或 SKU 编码。
```

Do not save.

- [ ] **Step 5: Run ProductForm tests**

Run:

```powershell
npm test -- src/components/ProductForm.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/components/ProductForm.tsx src/components/ProductForm.test.tsx src/pages/ProductsPage.tsx src/styles.css
git commit -m 'feat: add product code fields'
```

---

## Task 3: Product Code Display Across Product, Sales, Cart, And Orders

**Files:**
- Modify: `src/pages/ProductsPage.tsx`
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/components/CartPanel.tsx`
- Modify: `src/domain/promotions.ts`
- Modify: `src/domain/order.ts`
- Modify: `src/domain/types.ts`
- Modify tests for affected files

- [ ] **Step 1: Add tests for product code snapshots and UI display**

Add/extend tests to verify:

- Products list displays `productCode`.
- Sales compact list displays `productCode`.
- Cart line displays `productCode`.
- `CalculatedCartLine` includes `productCode`.
- `OrderItem` includes `productCodeSnapshot`.

- [ ] **Step 2: Run affected tests and verify failure**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx src/components/CartPanel.test.tsx src/domain/promotions.test.ts src/domain/order.test.ts
```

Expected: FAIL because product code is not included in calculated lines/order items yet.

- [ ] **Step 3: Add productCode to calculated cart lines**

In `CalculatedCartLine`, add:

```ts
productCode?: string;
```

In `promotions.ts` `toLine`, set `productCode: product.productCode`.

- [ ] **Step 4: Add productCode snapshot to order items**

In `OrderItem`, add:

```ts
productCodeSnapshot?: string;
```

In `makeOrderItem`, set it from the line/product.

- [ ] **Step 5: Render product code in UI**

Use `displayProductCode`:

- Product list facts.
- Sales product rows/cards.
- Cart line main.

- [ ] **Step 6: Run affected tests**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx src/components/CartPanel.test.tsx src/domain/promotions.test.ts src/domain/order.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/domain/types.ts src/domain/promotions.ts src/domain/order.ts src/pages/ProductsPage.tsx src/pages/SalesPage.tsx src/components/CartPanel.tsx src/**/*.test.tsx src/domain/*.test.ts
git commit -m 'feat: display product codes across sales flow'
```

---

## Task 4: Gift Target Types In Domain And Settings

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/promotions.ts`
- Modify: `src/domain/promotions.test.ts`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: Add gift target domain tests**

In `src/domain/promotions.test.ts`, add tests:

- Old `{ productId, quantity }` gift still produces gift line.
- New `{ targetType: "sku", productId, quantity }` produces gift line.
- New `{ targetType: "spu", spu, quantity }` produces gift entitlement but not actual gift line.
- SPU gift stock warning checks total eligible stock.

- [ ] **Step 2: Run promotion tests and verify failure**

Run:

```powershell
npm test -- src/domain/promotions.test.ts
```

Expected: FAIL because new gift target shape is unsupported.

- [ ] **Step 3: Add gift target types**

In `src/domain/types.ts`:

```ts
export type GiftConfig =
  | { targetType?: "sku"; productId: string; quantity: number }
  | { targetType: "spu"; spu: string; quantity: number };
```

Change `GiftTierConfig.gifts` to `GiftConfig[]`.

Add:

```ts
export type GiftEntitlement = {
  targetType: "sku" | "spu";
  productId?: string;
  spu?: string;
  label: string;
  quantity: number;
};
```

Add `giftEntitlements: GiftEntitlement[]` to `CalculatedCart`.

- [ ] **Step 4: Implement promotion support**

In `promotions.ts`:

- Normalize gifts with missing `targetType` as SKU.
- Build actual gift lines only for SKU gifts.
- Build SPU gift entitlements for SPU gifts.
- For SPU gifts, stock warning should use active gift-eligible products in that SPU and total `stockQty`.

- [ ] **Step 5: Update SettingsPage UI**

For each A/B gift target, add:

- Target type segmented/select: `指定 SKU`, `指定 SPU`.
- If SKU: product dropdown.
- If SPU: SPU dropdown.

Keep the existing tier quantity preview.

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test -- src/domain/promotions.test.ts src/pages/SettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/domain/types.ts src/domain/promotions.ts src/domain/promotions.test.ts src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx
git commit -m 'feat: support sku and spu gift targets'
```

---

## Task 5: Checkout Manual Gift SKU Selection

**Files:**
- Create: `src/domain/giftSelection.ts`
- Create: `src/domain/giftSelection.test.ts`
- Modify: `src/components/CheckoutPanel.tsx`
- Modify: `src/components/CheckoutPanel.test.tsx`
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`
- Modify: `src/domain/order.ts`
- Modify: `src/domain/order.test.ts`

- [ ] **Step 1: Write gift selection domain tests**

Create tests for:

- Required SPU gift quantity must be fully selected.
- Cannot select more than available stock.
- Selected SKU gifts convert to actual gift lines.
- Existing SKU gift lines are preserved.

- [ ] **Step 2: Implement giftSelection helpers**

Create helpers:

- `buildGiftSelectionRequirements`
- `validateGiftSelections`
- `resolveGiftLines`

- [ ] **Step 3: Add CheckoutPanel tests**

Verify:

- SPU gift requirement renders.
- Confirm paid button is disabled until enough SKU quantity is selected.
- Selecting SKU enables confirm.

- [ ] **Step 4: Implement CheckoutPanel selection UI**

Use compact controls:

- Requirement label.
- SKU select.
- Quantity stepper.
- Remaining count.

- [ ] **Step 5: Wire SalesPage**

SalesPage owns gift selection state:

- Reset when cart items, products, promotion, or triggered tier changes.
- Pass selection to CheckoutPanel.
- On confirm paid, resolve actual gift lines and build order with resolved gift lines.

- [ ] **Step 6: Update order builder**

Allow `buildPaidOrder` to receive resolved gift lines instead of using unresolved SPU entitlements.

- [ ] **Step 7: Run affected tests**

Run:

```powershell
npm test -- src/domain/giftSelection.test.ts src/components/CheckoutPanel.test.tsx src/pages/SalesPage.test.tsx src/domain/order.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src/domain/giftSelection.ts src/domain/giftSelection.test.ts src/components/CheckoutPanel.tsx src/components/CheckoutPanel.test.tsx src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx src/domain/order.ts src/domain/order.test.ts
git commit -m 'feat: require manual sku selection for spu gifts'
```

---

## Task 6: Backup Compatibility And Final Verification

**Files:**
- Modify: `src/utils/backup.ts`
- Modify: `src/utils/backup.test.ts`
- Modify: `src/db/db.ts` if indexes are added
- Verify all tests and build

- [ ] **Step 1: Add backup tests**

Add tests for:

- Old product without code fields imports successfully.
- New product with code fields imports successfully.
- Duplicate non-empty `productCode` rejects.
- Old gift `{ productId, quantity }` imports successfully.
- New SKU gift imports successfully.
- New SPU gift imports successfully.

- [ ] **Step 2: Run backup tests and verify failure**

Run:

```powershell
npm test -- src/utils/backup.test.ts
```

Expected: FAIL for new shapes until validation is updated.

- [ ] **Step 3: Update backup validation**

Implement permissive optional code fields:

- Missing code fields allowed.
- If present, must be strings.
- Non-empty duplicate product codes reject.

Update promotion validation to accept old and new gifts.

- [ ] **Step 4: Run full tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/utils/backup.ts src/utils/backup.test.ts src/db/db.ts
git commit -m 'fix: keep backup compatible with product codes and gift targets'
```

---

## Final Acceptance Checklist

- Product can be saved with SPU code, SKU code, and generated product code.
- Duplicate SPU/SKU prefix is rejected with the confirmed Chinese message.
- Duplicate full product code is rejected.
- Old products still load.
- Product code displays in product management, sales, cart, and order snapshots.
- Add-on discount remains SPU-group based and unchanged.
- Gift tiers can target SKU or SPU.
- SPU gift target requires manual actual SKU selection before paid confirmation.
- Actual selected gift SKU inventory is deducted.
- Old backups import.
- New backups export/import.
- `npm test` passes.
- `npm run build` passes.

---

## Self-Review

Spec coverage:

- Product code model: Tasks 1-3.
- Duplicate prefix and duplicate product code validation: Tasks 1-2.
- Display across user-facing flows: Task 3.
- Gift target SKU/SPU: Task 4.
- Manual SKU selection before confirmation: Task 5.
- Backup compatibility: Task 6.

Risk control:

- Tasks are sequenced from additive data fields to larger gift workflow changes.
- Old gift shape remains valid until migration is complete.
- SPU gifts never auto-deduct inventory.

Placeholder scan:

- No TBD/TODO placeholders.

Type consistency:

- `Product.productCode` is optional for old data.
- Old gift config omitting `targetType` is interpreted as SKU target.
- `OrderItem.productCodeSnapshot` is optional for old orders.
