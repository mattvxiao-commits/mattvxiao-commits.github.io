# ECRM V1.1b-0 Responsive Compact List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Sales compact list from a single-column relaxed list to a responsive multi-column compact list that uses available booth screen width more efficiently.

**Architecture:** This is a CSS-first UI refinement. It must not change product data, cart state, promotion calculation, checkout, order saving, inventory, settings, or the V1.1b product-code data model.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS Grid.

---

## File Structure

- Modify `src/styles.css`
  - Change `.salesProductList` to responsive CSS Grid with `repeat(auto-fit, minmax(...))`.
  - Tighten `.salesProductRow` inner spacing and thumbnail size for multi-column use.
  - Keep `.salesProductGrid` image-grid behavior unchanged.
  - Add a narrow-screen override to force one column and slightly smaller row content.

- Modify `src/pages/SalesPage.test.tsx`
  - Add a regression test with multiple products to ensure compact list still renders all products and the image grid switch remains separate.

---

## Task 1: Responsive Compact List

**Files:**
- Modify: `src/pages/SalesPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing/guard regression test**

Add this test to `src/pages/SalesPage.test.tsx`:

```tsx
test("renders multiple products in the compact list without switching to image grid", async () => {
  repositories.listProducts.mockResolvedValue([
    sellableProduct,
    product({ id: "pin", name: "徽章商品", spu: "徽章SPU", salePrice: 15, stockQty: 8 }),
    product({ id: "stand", name: "立牌商品", spu: "立牌SPU", salePrice: 30, stockQty: 5 })
  ]);

  render(<SalesPage />);

  const list = await screen.findByRole("list", { name: "售卖商品紧凑列表" });

  expect(within(list).getByRole("heading", { level: 2, name: "普通商品" })).toBeVisible();
  expect(within(list).getByRole("heading", { level: 2, name: "徽章商品" })).toBeVisible();
  expect(within(list).getByRole("heading", { level: 2, name: "立牌商品" })).toBeVisible();
  expect(screen.queryByRole("list", { name: "售卖商品图片网格" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run focused test**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: PASS or FAIL only if existing rendering has regressed. This is a guard test; the CSS density change itself is verified by code review and build because jsdom does not compute actual column layout.

- [ ] **Step 3: Implement responsive multi-column CSS**

In `src/styles.css`, update `.salesProductList`:

```css
.salesProductList {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr));
  gap: 8px;
}
```

Update `.salesProductRow` for multi-column density:

```css
.salesProductRow {
  grid-template-columns: 54px minmax(0, 1fr) 42px;
  gap: 8px;
  min-height: 76px;
  padding: 7px;
}

.salesProductRow .salesProductImage {
  width: 54px;
  height: 54px;
  padding: 5px;
}

.salesProductRowMain {
  gap: 6px;
}

.salesProductRowMain h2 {
  font-size: 15px;
}

.salesProductRowMeta span {
  min-height: 24px;
  padding: 0 7px;
  font-size: 11px;
}

.salesProductRow .addSaleButton {
  width: 40px;
  height: 40px;
  min-height: 40px;
}
```

Add a mobile override inside `@media (max-width: 720px)`:

```css
.salesProductList {
  grid-template-columns: 1fr;
}
```

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run build**

Run:

```powershell
npm run build
```

Expected: PASS, proving CSS and TypeScript build cleanly.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/pages/SalesPage.test.tsx src/styles.css docs/superpowers/plans/2026-06-16-ecrm-v1-1b-0-responsive-compact-list-plan.md
git commit -m 'feat: make compact sales list responsive'
```

---

## Self-Review

Spec coverage:

- Wide screens can naturally form 2-3 compact list columns via CSS Grid auto-fit.
- Narrow screens stay single-column.
- Image grid remains a separate mode.
- No data-model or cart logic changes.

Placeholder scan:

- No placeholders.

Type consistency:

- Test uses existing `product` fixture and repository mock.
- CSS class names match current `SalesPage.tsx` markup.
