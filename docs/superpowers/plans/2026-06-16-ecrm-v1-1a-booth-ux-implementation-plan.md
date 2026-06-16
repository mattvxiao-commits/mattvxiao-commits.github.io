# ECRM V1.1a Booth UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the existing MVP for real booth operation by adding a compact sales list view, a collapsible cart drawer, cart thumbnails, denser UI styling, and an SPU dropdown for add-on discount configuration.

**Architecture:** Keep the existing React + Zustand + IndexedDB architecture. V1.1a is a UI and interaction upgrade only; it must not change order persistence, promotion calculation, inventory deduction, backup schema, or the V1.1b product-code/gift-SPU data model.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, lucide-react, existing CSS.

---

## File Structure

- Modify `src/pages/SalesPage.tsx`
  - Add `SalesViewMode` state.
  - Add `isCartOpen` state.
  - Render a segmented view switch.
  - Render compact list or image grid from the same product data.
  - Open the cart drawer from the floating cart button.
  - Close the cart drawer from `CartPanel`.
  - Keep checkout behavior unchanged.

- Modify `src/components/CartPanel.tsx`
  - Add optional `close` prop.
  - Load thumbnail URLs for products used in cart/gift lines.
  - Render stable small thumbnails in each cart line.
  - Keep quantity, totals, gift warnings, hold, clear, and checkout behavior unchanged.

- Modify `src/pages/SettingsPage.tsx`
  - Build unique SPU options from products.
  - Replace add-on discount SPU text input with a select.
  - Preserve missing configured SPU values and show a warning.

- Modify `src/pages/SalesPage.test.tsx`
  - Add tests for compact list default, grid switch, cart open/close, and hold closing the cart.
  - Update affected existing tests to open the cart when needed.

- Modify `src/components/CartPanel.test.tsx`
  - Mock `getImageUrl`.
  - Add assertions for thumbnail image rendering and close behavior.

- Create `src/pages/SettingsPage.test.tsx`
  - Test discount SPU dropdown options, selection, missing configured SPU warning, and save behavior.

- Modify `src/styles.css`
  - Add compact sales controls, list rows, drawer/backdrop, thumbnail styles.
  - Compress page headers, navigation, product cards, settings sections, and sales spacing.
  - Add responsive drawer behavior for narrow screens.

---

## Task 1: Sales View Toggle And Cart Drawer State

**Files:**
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing tests for default compact list and grid switch**

Add this test to `src/pages/SalesPage.test.tsx`:

```tsx
test("shows compact sales list by default and can switch to image grid", async () => {
  render(<SalesPage />);

  const list = await screen.findByRole("list", { name: "售卖商品紧凑列表" });
  expect(within(list).getByRole("heading", { level: 2, name: "普通商品" })).toBeVisible();
  expect(screen.queryByRole("grid", { name: "售卖商品图片网格" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "图片网格" }));

  const grid = await screen.findByRole("grid", { name: "售卖商品图片网格" });
  expect(within(grid).getByRole("heading", { level: 2, name: "普通商品" })).toBeVisible();
  expect(screen.queryByRole("list", { name: "售卖商品紧凑列表" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "紧凑列表" }));

  expect(await screen.findByRole("list", { name: "售卖商品紧凑列表" })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: FAIL because the compact list/grid switch roles do not exist yet.

- [ ] **Step 3: Write failing tests for cart open, close, and hold closing the drawer**

Add these tests to `src/pages/SalesPage.test.tsx`:

```tsx
test("opens and closes the cart drawer from the floating cart button", async () => {
  render(<SalesPage />);

  expect(screen.queryByRole("complementary", { name: "购物车" })).not.toBeInTheDocument();

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));

  const cartPanel = await screen.findByRole("complementary", { name: "购物车" });
  expect(within(cartPanel).getByRole("heading", { level: 2, name: "购物车" })).toBeVisible();

  fireEvent.click(within(cartPanel).getByRole("button", { name: "关闭购物车" }));

  expect(screen.queryByRole("complementary", { name: "购物车" })).not.toBeInTheDocument();
});

test("holding the cart closes the cart drawer and keeps cart items", async () => {
  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));

  const cartPanel = await screen.findByRole("complementary", { name: "购物车" });
  fireEvent.click(within(cartPanel).getByRole("button", { name: "暂存购物车" }));

  expect(screen.queryByRole("complementary", { name: "购物车" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" })).toBeVisible();
  expect(await screen.findByText("购物车已暂存，可继续选择商品。")).toBeVisible();
});
```

- [ ] **Step 4: Run test to verify it fails**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: FAIL because the cart is still always rendered in cart mode and has no close button.

- [ ] **Step 5: Implement minimal SalesPage behavior**

In `src/pages/SalesPage.tsx`:

- Add `LayoutGrid` and `List` icons from `lucide-react`.
- Add `type SalesViewMode = "list" | "grid";`.
- Add state:

```tsx
const [salesViewMode, setSalesViewMode] = useState<SalesViewMode>("list");
const [isCartOpen, setIsCartOpen] = useState(false);
```

- Add helper rendering so both list/grid use the same stock logic.
- Render a `.salesControls` section above products:

```tsx
<div className="salesControls">
  <div className="spuFilter" aria-label="按 SPU 筛选商品">
    ...
  </div>
  <div className="viewSwitch" aria-label="切换商品展示方式">
    <button type="button" aria-pressed={salesViewMode === "list"} className={salesViewMode === "list" ? "isSelected" : ""} onClick={() => setSalesViewMode("list")}>
      <List size={16} aria-hidden="true" />
      紧凑列表
    </button>
    <button type="button" aria-pressed={salesViewMode === "grid"} className={salesViewMode === "grid" ? "isSelected" : ""} onClick={() => setSalesViewMode("grid")}>
      <LayoutGrid size={16} aria-hidden="true" />
      图片网格
    </button>
  </div>
</div>
```

- Render list:

```tsx
<div className="salesProductList" role="list" aria-label="售卖商品紧凑列表">
  {visibleProducts.map((product) => (
    <article className="salesProductRow" role="listitem" key={product.id}>
      <SalesProductImage product={product} />
      ...
    </article>
  ))}
</div>
```

- Render grid:

```tsx
<div className="salesProductGrid" role="grid" aria-label="售卖商品图片网格">
  ...
</div>
```

- Render cart only when `mode === "checkout"` or `isCartOpen`:

```tsx
{mode === "checkout" && settings ? (
  <CheckoutPanel ... back={() => { setMode("cart"); setIsCartOpen(true); }} />
) : isCartOpen ? (
  <div className="cartDrawerLayer">
    <button type="button" className="cartBackdrop" aria-label="关闭购物车遮罩" onClick={() => setIsCartOpen(false)} />
    <CartPanel ... close={() => setIsCartOpen(false)} hold={() => { setStatus(...); setIsCartOpen(false); }} />
  </div>
) : null}
```

- Update the floating dock click:

```tsx
onClick={() => {
  setMode("cart");
  setIsCartOpen(true);
}}
```

- [ ] **Step 6: Run SalesPage tests**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx
```

Expected: PASS for SalesPage tests after updating existing tests that assumed the cart was always visible.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx src/styles.css
git commit -m 'feat: add compact sales list and cart drawer'
```

---

## Task 2: Cart Thumbnails And Close Control

**Files:**
- Modify: `src/components/CartPanel.tsx`
- Modify: `src/components/CartPanel.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing CartPanel thumbnail and close tests**

At the top of `src/components/CartPanel.test.tsx`, add:

```tsx
const imageUtils = vi.hoisted(() => ({
  getImageUrl: vi.fn()
}));

vi.mock("../utils/image", () => imageUtils);
```

Add this test:

```tsx
test("shows product thumbnails and calls close when close button is clicked", async () => {
  imageUtils.getImageUrl.mockResolvedValue("blob:normal");
  const items: CartItem[] = [{ productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" }];
  const calculated = calculateCart({
    items,
    products: [{ ...normal, imageId: "image-normal" }],
    promotion: { ...defaultPromotion(), giftTiers: [] }
  });
  const onClose = vi.fn();

  render(
    <CartPanel
      products={[{ ...normal, imageId: "image-normal" }]}
      calculated={calculated}
      cartItems={items}
      increment={() => undefined}
      decrement={() => undefined}
      clear={() => undefined}
      checkout={() => undefined}
      hold={() => undefined}
      close={onClose}
    />
  );

  expect(await screen.findByRole("img", { name: "普通商品" })).toHaveAttribute("src", "blob:normal");

  fireEvent.click(screen.getByRole("button", { name: "关闭购物车" }));

  expect(onClose).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/components/CartPanel.test.tsx
```

Expected: FAIL because `CartPanel` has no `close` prop or thumbnail image.

- [ ] **Step 3: Implement cart thumbnails and close button**

In `src/components/CartPanel.tsx`:

- Import `X` from `lucide-react`.
- Import `useEffect`, `useMemo`, `useState`.
- Import `getImageUrl`.
- Add `close?: () => void` to props.
- Build unique product IDs from `calculated.lines`.
- Load image URLs into `imageUrlsByProductId`.
- Add a `CartLineThumb` helper or inline markup:

```tsx
<div className="cartLineThumb">
  {imageUrl ? <img src={imageUrl} alt={line.productName} /> : <span aria-hidden="true">{line.productName.slice(0, 1) || "商"}</span>}
</div>
```

- Add close button in `.panelHeading` only when `close` exists:

```tsx
{close ? (
  <button type="button" className="iconButton" aria-label="关闭购物车" onClick={close}>
    <X size={18} aria-hidden="true" />
  </button>
) : null}
```

- Keep existing line actions unchanged for non-gift lines. Current calculated lines only include normal and discount lines; this task must not alter calculation output.

- [ ] **Step 4: Run CartPanel tests**

Run:

```powershell
npm test -- src/components/CartPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add src/components/CartPanel.tsx src/components/CartPanel.test.tsx src/styles.css
git commit -m 'feat: show thumbnails in cart drawer'
```

---

## Task 3: Settings Add-On SPU Dropdown

**Files:**
- Create: `src/pages/SettingsPage.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing SettingsPage tests**

Create `src/pages/SettingsPage.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AppSettings } from "../domain/types";
import { defaultPromotion, product } from "../test/fixtures";
import SettingsPage from "./SettingsPage";

const repositories = vi.hoisted(() => ({
  getSettings: vi.fn(),
  listProducts: vi.fn(),
  saveImage: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock("../db/repositories", () => repositories);

vi.mock("../utils/backup", () => ({
  IMAGE_BACKUP_NOTE: "图片会随 JSON 备份导出",
  exportJsonBackup: vi.fn(),
  importJsonBackup: vi.fn()
}));

const settings: AppSettings = {
  id: "settings",
  shopName: "ECRM 摊位",
  orderPrefix: "ECRM",
  promotion: defaultPromotion()
};

beforeEach(() => {
  vi.clearAllMocks();
  repositories.getSettings.mockResolvedValue(settings);
  repositories.listProducts.mockResolvedValue([
    product({ id: "addon-1", name: "优惠商品 1", spu: "优惠SPU" }),
    product({ id: "addon-2", name: "优惠商品 2", spu: "优惠SPU" }),
    product({ id: "normal", name: "普通商品", spu: "普通SPU" })
  ]);
  repositories.saveSettings.mockResolvedValue(undefined);
});

test("selects add-on discount SPU from product SPU options and saves it", async () => {
  render(<SettingsPage />);

  const select = await screen.findByLabelText("优惠 SPU");

  expect(within(select).getByRole("option", { name: "优惠SPU（2 个商品）" })).toBeVisible();
  expect(within(select).getByRole("option", { name: "普通SPU（1 个商品）" })).toBeVisible();

  fireEvent.change(select, { target: { value: "普通SPU" } });
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
  expect(repositories.saveSettings.mock.calls[0][0].promotion.addonDiscount.discountSpu).toBe("普通SPU");
});

test("keeps and warns about a configured discount SPU that is missing from products", async () => {
  repositories.getSettings.mockResolvedValue({
    ...settings,
    promotion: {
      ...settings.promotion,
      addonDiscount: {
        ...settings.promotion.addonDiscount,
        discountSpu: "旧SPU"
      }
    }
  });

  render(<SettingsPage />);

  const select = await screen.findByLabelText("优惠 SPU");

  expect(within(select).getByRole("option", { name: "旧SPU（当前商品库未找到）" })).toBeVisible();
  expect(await screen.findByText("当前商品库未找到该 SPU，请确认是否已停用或删除相关商品。")).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/pages/SettingsPage.test.tsx
```

Expected: FAIL because the settings page still uses a text input.

- [ ] **Step 3: Implement SPU option derivation and select**

In `src/pages/SettingsPage.tsx`:

- Add:

```tsx
const discountSpuOptions = useMemo(() => {
  const counts = new Map<string, number>();
  for (const product of products) {
    const spu = product.spu.trim();
    if (spu.length > 0) {
      counts.set(spu, (counts.get(spu) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"));
}, [products]);
```

- Add:

```tsx
const configuredDiscountSpu = settings.promotion.addonDiscount.discountSpu;
const hasMissingDiscountSpu =
  configuredDiscountSpu.trim().length > 0 && !discountSpuOptions.some(([spu]) => spu === configuredDiscountSpu);
```

- Replace the input under `优惠 SPU` with:

```tsx
<select
  value={settings.promotion.addonDiscount.discountSpu}
  onChange={(event) =>
    updateSettings((current) => ({
      ...current,
      promotion: {
        ...current.promotion,
        addonDiscount: { ...current.promotion.addonDiscount, discountSpu: event.target.value }
      }
    }))
  }
>
  <option value="">不选择</option>
  {hasMissingDiscountSpu ? (
    <option value={configuredDiscountSpu}>{configuredDiscountSpu}（当前商品库未找到）</option>
  ) : null}
  {discountSpuOptions.map(([spu, count]) => (
    <option key={spu} value={spu}>
      {spu}（{count} 个商品）
    </option>
  ))}
</select>
```

- Below the field, render:

```tsx
{hasMissingDiscountSpu ? (
  <p className="fieldHint isWarning">当前商品库未找到该 SPU，请确认是否已停用或删除相关商品。</p>
) : null}
```

- [ ] **Step 4: Run SettingsPage tests**

Run:

```powershell
npm test -- src/pages/SettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx src/styles.css
git commit -m 'feat: select discount spu from products'
```

---

## Task 4: Density Styling, Regression Tests, And Build

**Files:**
- Modify: `src/styles.css`
- Verify: all tests and build

- [ ] **Step 1: Apply density CSS**

In `src/styles.css`, adjust these selectors:

```css
.topBar { padding: max(8px, env(safe-area-inset-top)) 16px 8px; gap: 14px; }
.brandMark { width: 36px; height: 36px; }
.brand { font-size: 18px; }
.subtitle { font-size: 11px; margin-top: 2px; }
.nav a { min-height: 38px; padding: 0 11px; font-size: 14px; }
button { min-height: 40px; }
input, select { min-height: 40px; }
.productsPage, .settingsPage, .dashboardPage, .salesPage { padding: 16px 0 76px; }
.productsToolbar, .settingsHeader, .dashboardHeader, .salesHeader { padding: 12px 0; }
.productsToolbar h1, .settingsHeader h1, .dashboardHeader h1, .salesHeader h1 { font-size: clamp(24px, 4vw, 34px); line-height: 1.05; }
.salesHeader p:not(.eyebrow), .settingsHeader p:not(.eyebrow), .dashboardHeader p:not(.eyebrow) { margin-top: 4px; font-size: 13px; }
.settingsSection, .dashboardSection, .formPanel { padding: 14px; gap: 12px; }
```

Add new styles for:

- `.salesControls`
- `.viewSwitch`
- `.salesProductList`
- `.salesProductRow`
- `.salesProductRowMain`
- `.salesProductRowMeta`
- `.cartDrawerLayer`
- `.cartBackdrop`
- `.cartLineContent`
- `.cartLineThumb`
- `.fieldHint`

Ensure:

- Touch targets remain close to 40px or larger.
- Text wraps or truncates without overlap.
- Drawer uses `position: fixed` and a high z-index.
- Narrow screens use bottom/fullscreen drawer behavior.

- [ ] **Step 2: Run focused tests**

Run:

```powershell
npm test -- src/pages/SalesPage.test.tsx src/components/CartPanel.test.tsx src/pages/SettingsPage.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run:

```powershell
npm test
```

Expected: PASS for all test files.

- [ ] **Step 4: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS with TypeScript and Vite build success.

- [ ] **Step 5: Commit final styling and verification fixes**

Run:

```powershell
git add src/styles.css src/pages/SalesPage.tsx src/components/CartPanel.tsx src/pages/SettingsPage.tsx src/pages/SalesPage.test.tsx src/components/CartPanel.test.tsx src/pages/SettingsPage.test.tsx
git commit -m 'style: compact booth operation layout'
```

---

## Self-Review

Spec coverage:

- V1.1a compact list/grid switch: Task 1.
- Cart drawer open/close: Task 1.
- Cart thumbnails: Task 2.
- UI density compression: Task 4.
- Add-on discount SPU dropdown: Task 3.
- No V1.1b data-model work: explicitly out of scope in the architecture and tasks.

Placeholder scan:

- No TBD/TODO/fill-later steps.
- Every code behavior step includes concrete tests or implementation direction.

Type consistency:

- `SalesViewMode` is local to `SalesPage.tsx`.
- `CartPanel.close` is optional and only used for drawer mode.
- `discountSpuOptions` derives from existing `Product.spu`, so no schema migration is needed.
