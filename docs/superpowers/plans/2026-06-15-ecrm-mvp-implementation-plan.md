# ECRM MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在三天内交付一个可在 Windows、Mac、iPad 使用的离线优先 PWA 摊位售卖 MVP，覆盖商品管理、促销购物车、收款二维码、订单、库存扣减、备份和极简仪表盘。

**Architecture:** 使用单页 PWA，前端负责全部业务逻辑和本地持久化。IndexedDB 作为唯一数据源，购物车计算由纯函数促销引擎生成派生结果，订单保存时写入快照，确认收款后扣减库存。

**Tech Stack:** Vite, React, TypeScript, Vitest, IndexedDB/Dexie, Zustand, vite-plugin-pwa, JSZip, FileSaver, React Router.

---

## 中文执行说明

本计划对应两份规格文档：

- `docs/specs/2026-06-15-ecrm-mvp-dev-spec.md`
- `docs/specs/2026-06-15-ecrm-product-plan.md`

执行优先级：

1. 先保证应用能安装、打开、离线缓存。
2. 再保证促销计算准确。
3. 再串商品、购物车、订单、库存。
4. 最后做备份、仪表盘和 iPad 验收。

不在本轮做：

- 复合支付二维码。
- 支付 API。
- 云同步。
- 飞书式自定义仪表盘。
- 多设备合并。
- 退款流程。
- 小票打印。

## File Structure

计划创建以下文件：

- `package.json`：项目脚本和依赖。
- `index.html`：PWA HTML 入口。
- `vite.config.ts`：Vite、Vitest、PWA 配置。
- `tsconfig.json`：TypeScript 配置。
- `src/main.tsx`：React 入口。
- `src/App.tsx`：路由和整体布局。
- `src/styles.css`：全局样式和响应式布局。
- `src/domain/types.ts`：商品、订单、促销、购物车类型。
- `src/domain/money.ts`：金额换算和格式化。
- `src/domain/promotions.ts`：促销计算纯函数。
- `src/domain/order.ts`：订单号和订单快照构建。
- `src/db/db.ts`：Dexie 数据库定义。
- `src/db/repositories.ts`：商品、设置、订单、备份数据访问。
- `src/state/cartStore.ts`：购物车状态。
- `src/pages/ProductsPage.tsx`：商品管理页面。
- `src/pages/SalesPage.tsx`：售卖、购物车、收款流程。
- `src/pages/DashboardPage.tsx`：极简仪表盘。
- `src/pages/SettingsPage.tsx`：收款码、促销、备份设置。
- `src/components/ProductForm.tsx`：商品新增/编辑表单。
- `src/components/CartPanel.tsx`：购物车展示和操作。
- `src/components/CheckoutPanel.tsx`：收款确认界面。
- `src/components/Nav.tsx`：导航。
- `src/utils/image.ts`：图片 Blob 和 object URL 工具。
- `src/utils/backup.ts`：备份导入导出。
- `src/test/fixtures.ts`：测试数据。
- `src/domain/promotions.test.ts`：促销规则单元测试。
- `src/domain/order.test.ts`：订单快照单元测试。

## Task 1: Initialize Project, Tooling, and PWA Shell

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Create project metadata and scripts**

Create `package.json`:

```json
{
  "name": "ecrm-offline-pos",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "dexie": "^4.0.11",
    "file-saver": "^2.0.5",
    "jszip": "^3.10.1",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "vite-plugin-pwa": "^0.21.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/file-saver": "^2.0.7",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```powershell
npm install
```

Expected:

```text
added ... packages
found 0 vulnerabilities
```

If npm reports non-critical audit warnings, continue. If install fails because a version is unavailable, use the latest compatible version npm suggests and keep the dependency name unchanged.

- [ ] **Step 3: Create Vite and PWA config**

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "ECRM Booth POS",
        short_name: "ECRM",
        description: "Offline booth sales and inventory MVP",
        theme_color: "#f7f4ee",
        background_color: "#f7f4ee",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        cleanupOutdatedCaches: true
      }
    })
  ],
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

- [ ] **Step 4: Create TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 5: Create HTML entry**

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#f7f4ee" />
    <title>ECRM Booth POS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create React entry and shell**

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

Create `src/App.tsx`:

```tsx
import { NavLink, Route, Routes } from "react-router-dom";

function ProductsPlaceholder() {
  return <section className="page"><h1>商品</h1><p>商品管理待实现</p></section>;
}

function SalesPlaceholder() {
  return <section className="page"><h1>售卖</h1><p>售卖开单待实现</p></section>;
}

function DashboardPlaceholder() {
  return <section className="page"><h1>仪表盘</h1><p>极简数据概览待实现</p></section>;
}

function SettingsPlaceholder() {
  return <section className="page"><h1>设置</h1><p>收款码、促销和备份待实现</p></section>;
}

export default function App() {
  return (
    <div className="appShell">
      <header className="topBar">
        <div>
          <div className="brand">ECRM</div>
          <div className="subtitle">离线摊位售卖</div>
        </div>
        <nav className="nav">
          <NavLink to="/">商品</NavLink>
          <NavLink to="/sales">售卖</NavLink>
          <NavLink to="/dashboard">仪表盘</NavLink>
          <NavLink to="/settings">设置</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<ProductsPlaceholder />} />
          <Route path="/sales" element={<SalesPlaceholder />} />
          <Route path="/dashboard" element={<DashboardPlaceholder />} />
          <Route path="/settings" element={<SettingsPlaceholder />} />
        </Routes>
      </main>
    </div>
  );
}
```

Create `src/styles.css`:

```css
:root {
  color: #241f1a;
  background: #f7f4ee;
  font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: #f7f4ee;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  min-height: 40px;
  border: 1px solid #cfc7bb;
  background: #fff;
  color: #241f1a;
  cursor: pointer;
}

.appShell {
  min-height: 100vh;
}

.topBar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #ded6c9;
  background: rgba(247, 244, 238, 0.96);
  backdrop-filter: blur(10px);
}

.brand {
  font-size: 20px;
  font-weight: 700;
}

.subtitle {
  font-size: 12px;
  color: #70685e;
}

.nav {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}

.nav a {
  padding: 8px 10px;
  border: 1px solid transparent;
  color: #423a32;
  text-decoration: none;
  white-space: nowrap;
}

.nav a.active {
  border-color: #241f1a;
  background: #fff;
}

.page {
  width: min(1180px, calc(100vw - 24px));
  margin: 0 auto;
  padding: 20px 0 88px;
}

@media (max-width: 720px) {
  .topBar {
    align-items: flex-start;
    flex-direction: column;
  }

  .nav {
    width: 100%;
  }
}
```

- [ ] **Step 7: Build and test shell**

Run:

```powershell
npm run build
```

Expected:

```text
vite v...
✓ built in ...
```

- [ ] **Step 8: Commit**

If repository is initialized:

```powershell
git add package.json package-lock.json index.html vite.config.ts tsconfig.json src
git commit -m "chore: initialize pwa app shell"
```

If repository is not initialized, skip commit and record that the workspace has no git repository.

## Task 2: Define Domain Types, Money Helpers, and Fixtures

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/money.ts`
- Create: `src/test/fixtures.ts`

- [ ] **Step 1: Create domain types**

Create `src/domain/types.ts`:

```ts
export type ProductStatus = "active" | "inactive";

export type Product = {
  id: string;
  name: string;
  spu: string;
  imageId?: string;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  isSellable: boolean;
  isGiftEligible: boolean;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  productId: string;
  quantity: number;
  addedAt: string;
};

export type PaymentMethod = "wechat" | "alipay" | "cash" | "other";

export type OrderStatus = "pending_payment" | "paid" | "cancelled";

export type OrderLineType = "normal" | "discount_addon" | "gift";

export type PromotionConfig = {
  enabled: boolean;
  addonDiscount: {
    enabled: boolean;
    discountSpu: string;
    discountPrice: number;
    maxDiscountQty: number;
  };
  giftTiers: GiftTierConfig[];
};

export type GiftTierConfig = {
  threshold: number;
  gifts: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type CalculatedCartLine = {
  productId: string;
  productName: string;
  spu: string;
  quantity: number;
  originalUnitPrice: number;
  finalUnitPrice: number;
  lineType: OrderLineType;
  lineTotal: number;
};

export type GiftStockWarning = {
  productId: string;
  productName: string;
  requiredQty: number;
  availableQty: number;
};

export type CalculatedCart = {
  lines: CalculatedCartLine[];
  giftLines: CalculatedCartLine[];
  subtotalBeforeDiscount: number;
  discountAmount: number;
  payableAmount: number;
  appliedDiscountQty: number;
  maxDiscountQty: number;
  triggeredGiftTier?: GiftTierConfig;
  giftStockWarnings: GiftStockWarning[];
};

export type AppSettings = {
  id: "settings";
  shopName: string;
  orderPrefix: string;
  wechatQrImageId?: string;
  alipayQrImageId?: string;
  promotion: PromotionConfig;
};

export type Order = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  subtotalBeforeDiscount: number;
  discountAmount: number;
  payableAmount: number;
  triggeredGiftTier?: number;
  promotionSnapshot: PromotionConfig;
  giftStockWarning: boolean;
  createdAt: string;
  paidAt?: string;
  cancelledAt?: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productNameSnapshot: string;
  spuSnapshot: string;
  quantity: number;
  originalUnitPrice: number;
  finalUnitPrice: number;
  lineType: OrderLineType;
  lineTotal: number;
};

export type InventoryLog = {
  id: string;
  productId: string;
  orderId: string;
  changeQty: number;
  reason: "order_paid" | "gift_order_paid" | "manual_adjust";
  beforeQty: number;
  afterQty: number;
  createdAt: string;
};
```

- [ ] **Step 2: Create money helpers**

Create `src/domain/money.ts`:

```ts
export function normalizeMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number): string {
  return `¥${normalizeMoney(value).toFixed(2)}`;
}

export function parseMoneyInput(value: string): number {
  const parsed = Number(value);
  return normalizeMoney(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
}
```

- [ ] **Step 3: Create fixtures**

Create `src/test/fixtures.ts`:

```ts
import type { Product, PromotionConfig } from "../domain/types";

export function product(overrides: Partial<Product> = {}): Product {
  const now = "2026-06-15T00:00:00.000Z";
  return {
    id: "product-normal",
    name: "普通商品",
    spu: "普通SPU",
    costPrice: 2,
    salePrice: 20,
    stockQty: 100,
    isSellable: true,
    isGiftEligible: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function defaultPromotion(): PromotionConfig {
  return {
    enabled: true,
    addonDiscount: {
      enabled: true,
      discountSpu: "优惠SPU",
      discountPrice: 3,
      maxDiscountQty: 3
    },
    giftTiers: [
      { threshold: 35, gifts: [{ productId: "gift-a", quantity: 1 }] },
      {
        threshold: 68,
        gifts: [
          { productId: "gift-a", quantity: 2 },
          { productId: "gift-b", quantity: 1 }
        ]
      },
      {
        threshold: 148,
        gifts: [
          { productId: "gift-a", quantity: 5 },
          { productId: "gift-b", quantity: 1 }
        ]
      }
    ]
  };
}
```

- [ ] **Step 4: Run TypeScript build**

Run:

```powershell
npm run build
```

Expected: build succeeds.

## Task 3: Implement Promotion Calculator with Tests

**Files:**
- Create: `src/domain/promotions.ts`
- Create: `src/domain/promotions.test.ts`

- [ ] **Step 1: Write promotion tests**

Create `src/domain/promotions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateCart } from "./promotions";
import type { CartItem } from "./types";
import { defaultPromotion, product } from "../test/fixtures";

const normal = product({ id: "normal", name: "普通商品", spu: "普通SPU", salePrice: 20 });
const addon = product({
  id: "addon",
  name: "商品A",
  spu: "优惠SPU",
  salePrice: 5,
  isGiftEligible: true
});
const giftA = product({
  id: "gift-a",
  name: "商品A赠品",
  spu: "赠品SPU",
  salePrice: 5,
  stockQty: 10,
  isGiftEligible: true
});
const giftB = product({
  id: "gift-b",
  name: "商品B赠品",
  spu: "赠品SPU",
  salePrice: 0,
  stockQty: 10,
  isSellable: false,
  isGiftEligible: true
});

function cart(productId: string, quantity: number, addedAt = "2026-06-15T00:00:00.000Z"): CartItem[] {
  return [{ productId, quantity, addedAt }];
}

describe("calculateCart", () => {
  it("prices only addon SPU as first original, next three discounted, then original", () => {
    const result = calculateCart({
      items: cart("addon", 5),
      products: [addon, giftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.payableAmount).toBe(19);
    expect(result.appliedDiscountQty).toBe(3);
    expect(result.lines).toEqual([
      expect.objectContaining({ productId: "addon", quantity: 2, finalUnitPrice: 5, lineType: "normal", lineTotal: 10 }),
      expect.objectContaining({ productId: "addon", quantity: 3, finalUnitPrice: 3, lineType: "discount_addon", lineTotal: 9 })
    ]);
  });

  it("discounts first three addon units when another normal product exists", () => {
    const result = calculateCart({
      items: [
        { productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" },
        { productId: "addon", quantity: 4, addedAt: "2026-06-15T00:01:00.000Z" }
      ],
      products: [normal, addon, giftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.payableAmount).toBe(34);
    expect(result.appliedDiscountQty).toBe(3);
    expect(result.discountAmount).toBe(6);
  });

  it("uses final payable amount after discount for gift threshold", () => {
    const result = calculateCart({
      items: [
        { productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" },
        { productId: "addon", quantity: 4, addedAt: "2026-06-15T00:01:00.000Z" }
      ],
      products: [normal, addon, giftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.payableAmount).toBe(34);
    expect(result.triggeredGiftTier).toBeUndefined();
    expect(result.giftLines).toEqual([]);
  });

  it("selects only the highest gift tier", () => {
    const expensive = product({ id: "expensive", name: "大额商品", salePrice: 148, spu: "普通SPU" });
    const result = calculateCart({
      items: cart("expensive", 1),
      products: [expensive, giftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.triggeredGiftTier?.threshold).toBe(148);
    expect(result.giftLines).toEqual([
      expect.objectContaining({ productId: "gift-a", quantity: 5, lineType: "gift", lineTotal: 0 }),
      expect.objectContaining({ productId: "gift-b", quantity: 1, lineType: "gift", lineTotal: 0 })
    ]);
  });

  it("reports gift stock warnings without blocking calculation", () => {
    const lowGiftA = { ...giftA, stockQty: 1 };
    const expensive = product({ id: "expensive", name: "大额商品", salePrice: 148, spu: "普通SPU" });
    const result = calculateCart({
      items: cart("expensive", 1),
      products: [expensive, lowGiftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.giftStockWarnings).toEqual([
      { productId: "gift-a", productName: "商品A赠品", requiredQty: 5, availableQty: 1 }
    ]);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm test -- src/domain/promotions.test.ts
```

Expected: FAIL because `src/domain/promotions.ts` does not exist.

- [ ] **Step 3: Implement promotion calculator**

Create `src/domain/promotions.ts`:

```ts
import { normalizeMoney } from "./money";
import type {
  CalculatedCart,
  CalculatedCartLine,
  CartItem,
  GiftTierConfig,
  Product,
  PromotionConfig
} from "./types";

type CalculateCartInput = {
  items: CartItem[];
  products: Product[];
  promotion: PromotionConfig;
};

type Unit = {
  product: Product;
  addedAt: string;
  index: number;
};

export function calculateCart(input: CalculateCartInput): CalculatedCart {
  const productMap = new Map(input.products.map((product) => [product.id, product]));
  const units = expandUnits(input.items, productMap);
  const promotion = input.promotion;
  const addon = promotion.addonDiscount;
  const discountEnabled = promotion.enabled && addon.enabled && addon.discountSpu.trim().length > 0;

  const addonUnits = discountEnabled
    ? units.filter((unit) => unit.product.spu === addon.discountSpu)
    : [];
  const nonAddonUnits = discountEnabled
    ? units.filter((unit) => unit.product.spu !== addon.discountSpu)
    : units;

  const hasOtherNormalTrigger = nonAddonUnits.some((unit) => unit.product.isSellable);
  const sortedAddonUnits = [...addonUnits].sort(compareUnits);
  const discountedUnitIndexes = new Set<number>();
  const originalTriggerIndexes = new Set<number>();

  if (discountEnabled && sortedAddonUnits.length > 0) {
    if (hasOtherNormalTrigger) {
      sortedAddonUnits.slice(0, addon.maxDiscountQty).forEach((unit) => discountedUnitIndexes.add(unit.index));
    } else {
      originalTriggerIndexes.add(sortedAddonUnits[0].index);
      sortedAddonUnits
        .slice(1, 1 + addon.maxDiscountQty)
        .forEach((unit) => discountedUnitIndexes.add(unit.index));
    }
  }

  const pricedLines = mergeLines(
    units.map((unit) => {
      const isDiscounted = discountedUnitIndexes.has(unit.index);
      const finalUnitPrice = isDiscounted ? addon.discountPrice : unit.product.salePrice;
      const lineType = isDiscounted ? "discount_addon" : "normal";
      return toLine(unit.product, 1, unit.product.salePrice, finalUnitPrice, lineType);
    })
  );

  const subtotalBeforeDiscount = normalizeMoney(
    pricedLines.reduce((total, line) => total + line.originalUnitPrice * line.quantity, 0)
  );
  const payableAmount = normalizeMoney(pricedLines.reduce((total, line) => total + line.lineTotal, 0));
  const discountAmount = normalizeMoney(subtotalBeforeDiscount - payableAmount);
  const triggeredGiftTier = findGiftTier(promotion.enabled ? promotion.giftTiers : [], payableAmount);
  const giftLines = triggeredGiftTier ? buildGiftLines(triggeredGiftTier, productMap) : [];
  const giftStockWarnings = giftLines
    .map((line) => {
      const product = productMap.get(line.productId);
      if (!product || product.stockQty >= line.quantity) {
        return undefined;
      }
      return {
        productId: product.id,
        productName: product.name,
        requiredQty: line.quantity,
        availableQty: product.stockQty
      };
    })
    .filter((warning): warning is NonNullable<typeof warning> => Boolean(warning));

  return {
    lines: pricedLines,
    giftLines,
    subtotalBeforeDiscount,
    discountAmount,
    payableAmount,
    appliedDiscountQty: discountedUnitIndexes.size,
    maxDiscountQty: discountEnabled ? addon.maxDiscountQty : 0,
    triggeredGiftTier,
    giftStockWarnings
  };
}

function expandUnits(items: CartItem[], productMap: Map<string, Product>): Unit[] {
  let index = 0;
  const units: Unit[] = [];
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product || item.quantity <= 0) {
      continue;
    }
    for (let count = 0; count < item.quantity; count += 1) {
      units.push({ product, addedAt: item.addedAt, index });
      index += 1;
    }
  }
  return units;
}

function compareUnits(a: Unit, b: Unit): number {
  const timeCompare = a.addedAt.localeCompare(b.addedAt);
  return timeCompare === 0 ? a.index - b.index : timeCompare;
}

function toLine(
  product: Product,
  quantity: number,
  originalUnitPrice: number,
  finalUnitPrice: number,
  lineType: CalculatedCartLine["lineType"]
): CalculatedCartLine {
  return {
    productId: product.id,
    productName: product.name,
    spu: product.spu,
    quantity,
    originalUnitPrice,
    finalUnitPrice,
    lineType,
    lineTotal: normalizeMoney(finalUnitPrice * quantity)
  };
}

function mergeLines(lines: CalculatedCartLine[]): CalculatedCartLine[] {
  const merged = new Map<string, CalculatedCartLine>();
  for (const line of lines) {
    const key = `${line.productId}:${line.finalUnitPrice}:${line.lineType}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...line });
      continue;
    }
    existing.quantity += line.quantity;
    existing.lineTotal = normalizeMoney(existing.finalUnitPrice * existing.quantity);
  }
  return [...merged.values()];
}

function findGiftTier(tiers: GiftTierConfig[], payableAmount: number): GiftTierConfig | undefined {
  return [...tiers]
    .filter((tier) => payableAmount >= tier.threshold)
    .sort((a, b) => b.threshold - a.threshold)[0];
}

function buildGiftLines(tier: GiftTierConfig, productMap: Map<string, Product>): CalculatedCartLine[] {
  return tier.gifts
    .map((gift) => {
      const product = productMap.get(gift.productId);
      if (!product) {
        return undefined;
      }
      return toLine(product, gift.quantity, 0, 0, "gift");
    })
    .filter((line): line is CalculatedCartLine => Boolean(line));
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```powershell
npm test -- src/domain/promotions.test.ts
```

Expected: all promotion tests pass.

## Task 4: Implement Database and Repositories

**Files:**
- Create: `src/db/db.ts`
- Create: `src/db/repositories.ts`

- [ ] **Step 1: Create Dexie database**

Create `src/db/db.ts`:

```ts
import Dexie, { type Table } from "dexie";
import type { AppSettings, InventoryLog, Order, OrderItem, Product } from "../domain/types";
import { defaultPromotion } from "../test/fixtures";

export type StoredImage = {
  id: string;
  blob: Blob;
  mimeType: string;
  originalName: string;
  createdAt: string;
};

export class EcrmDatabase extends Dexie {
  products!: Table<Product, string>;
  images!: Table<StoredImage, string>;
  settings!: Table<AppSettings, string>;
  orders!: Table<Order, string>;
  orderItems!: Table<OrderItem, string>;
  inventoryLogs!: Table<InventoryLog, string>;

  constructor() {
    super("ecrm-offline-pos");
    this.version(1).stores({
      products: "id, spu, name, status, createdAt",
      images: "id, createdAt",
      settings: "id",
      orders: "id, orderNo, status, createdAt, paidAt",
      orderItems: "id, orderId, productId, lineType",
      inventoryLogs: "id, productId, orderId, createdAt"
    });
  }
}

export const db = new EcrmDatabase();

export function createDefaultSettings(): AppSettings {
  return {
    id: "settings",
    shopName: "ECRM 摊位",
    orderPrefix: "ECRM",
    promotion: defaultPromotion()
  };
}
```

- [ ] **Step 2: Create repositories**

Create `src/db/repositories.ts`:

```ts
import { db, createDefaultSettings, type StoredImage } from "./db";
import type { AppSettings, InventoryLog, Order, OrderItem, Product } from "../domain/types";

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function listProducts(): Promise<Product[]> {
  return db.products.orderBy("createdAt").toArray();
}

export async function upsertProduct(product: Product): Promise<void> {
  await db.products.put(product);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export async function saveImage(file: File): Promise<StoredImage> {
  const image: StoredImage = {
    id: makeId("image"),
    blob: file,
    mimeType: file.type,
    originalName: file.name,
    createdAt: new Date().toISOString()
  };
  await db.images.put(image);
  return image;
}

export async function getImage(id?: string): Promise<StoredImage | undefined> {
  if (!id) {
    return undefined;
  }
  return db.images.get(id);
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("settings");
  if (existing) {
    return existing;
  }
  const settings = createDefaultSettings();
  await db.settings.put(settings);
  return settings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put(settings);
}

export async function savePaidOrder(input: {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  updatedProducts: Product[];
}): Promise<void> {
  await db.transaction("rw", db.orders, db.orderItems, db.inventoryLogs, db.products, async () => {
    await db.orders.put(input.order);
    await db.orderItems.bulkPut(input.orderItems);
    if (input.inventoryLogs.length > 0) {
      await db.inventoryLogs.bulkPut(input.inventoryLogs);
    }
    await db.products.bulkPut(input.updatedProducts);
  });
}

export async function listOrders(): Promise<Order[]> {
  return db.orders.orderBy("createdAt").reverse().toArray();
}

export async function listOrderItems(orderId: string): Promise<OrderItem[]> {
  return db.orderItems.where("orderId").equals(orderId).toArray();
}

export async function clearAllData(): Promise<void> {
  await db.transaction("rw", db.products, db.images, db.settings, db.orders, db.orderItems, db.inventoryLogs, async () => {
    await Promise.all([
      db.products.clear(),
      db.images.clear(),
      db.settings.clear(),
      db.orders.clear(),
      db.orderItems.clear(),
      db.inventoryLogs.clear()
    ]);
  });
}
```

- [ ] **Step 3: Build**

Run:

```powershell
npm run build
```

Expected: build succeeds.

## Task 5: Implement Order Snapshot and Inventory Deduction

**Files:**
- Create: `src/domain/order.ts`
- Create: `src/domain/order.test.ts`

- [ ] **Step 1: Write order tests**

Create `src/domain/order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPaidOrder } from "./order";
import type { CalculatedCart } from "./types";
import { defaultPromotion, product } from "../test/fixtures";

describe("buildPaidOrder", () => {
  it("creates order snapshots and inventory updates", () => {
    const normal = product({ id: "normal", name: "普通商品", stockQty: 10, salePrice: 20 });
    const gift = product({ id: "gift-a", name: "赠品A", stockQty: 5, isGiftEligible: true });
    const calculated: CalculatedCart = {
      lines: [
        {
          productId: "normal",
          productName: "普通商品",
          spu: "普通SPU",
          quantity: 1,
          originalUnitPrice: 20,
          finalUnitPrice: 20,
          lineType: "normal",
          lineTotal: 20
        }
      ],
      giftLines: [
        {
          productId: "gift-a",
          productName: "赠品A",
          spu: "赠品SPU",
          quantity: 1,
          originalUnitPrice: 0,
          finalUnitPrice: 0,
          lineType: "gift",
          lineTotal: 0
        }
      ],
      subtotalBeforeDiscount: 20,
      discountAmount: 0,
      payableAmount: 20,
      appliedDiscountQty: 0,
      maxDiscountQty: 3,
      giftStockWarnings: []
    };

    const result = buildPaidOrder({
      products: [normal, gift],
      calculated,
      promotion: defaultPromotion(),
      orderPrefix: "ECRM",
      paymentMethod: "cash",
      now: new Date("2026-06-15T14:35:22.000Z")
    });

    expect(result.order.orderNo).toContain("ECRM-20260615-143522");
    expect(result.orderItems).toHaveLength(2);
    expect(result.updatedProducts.find((item) => item.id === "normal")?.stockQty).toBe(9);
    expect(result.updatedProducts.find((item) => item.id === "gift-a")?.stockQty).toBe(4);
    expect(result.inventoryLogs).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```powershell
npm test -- src/domain/order.test.ts
```

Expected: FAIL because `src/domain/order.ts` does not exist.

- [ ] **Step 3: Implement order builder**

Create `src/domain/order.ts`:

```ts
import type {
  CalculatedCart,
  InventoryLog,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  PromotionConfig
} from "./types";

type BuildPaidOrderInput = {
  products: Product[];
  calculated: CalculatedCart;
  promotion: PromotionConfig;
  orderPrefix: string;
  paymentMethod: PaymentMethod;
  now?: Date;
};

export function buildPaidOrder(input: BuildPaidOrderInput): {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  updatedProducts: Product[];
} {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const orderId = crypto.randomUUID();
  const orderNo = createOrderNo(input.orderPrefix, now);
  const productMap = new Map(input.products.map((product) => [product.id, { ...product }]));
  const allLines = [...input.calculated.lines, ...input.calculated.giftLines];

  const order: Order = {
    id: orderId,
    orderNo,
    status: "paid",
    paymentMethod: input.paymentMethod,
    subtotalBeforeDiscount: input.calculated.subtotalBeforeDiscount,
    discountAmount: input.calculated.discountAmount,
    payableAmount: input.calculated.payableAmount,
    triggeredGiftTier: input.calculated.triggeredGiftTier?.threshold,
    promotionSnapshot: input.promotion,
    giftStockWarning: input.calculated.giftStockWarnings.length > 0,
    createdAt: nowIso,
    paidAt: nowIso
  };

  const orderItems: OrderItem[] = allLines.map((line) => ({
    id: crypto.randomUUID(),
    orderId,
    productId: line.productId,
    productNameSnapshot: line.productName,
    spuSnapshot: line.spu,
    quantity: line.quantity,
    originalUnitPrice: line.originalUnitPrice,
    finalUnitPrice: line.finalUnitPrice,
    lineType: line.lineType,
    lineTotal: line.lineTotal
  }));

  const inventoryLogs: InventoryLog[] = [];
  for (const line of allLines) {
    const product = productMap.get(line.productId);
    if (!product) {
      continue;
    }
    const beforeQty = product.stockQty;
    const afterQty = beforeQty - line.quantity;
    product.stockQty = afterQty;
    inventoryLogs.push({
      id: crypto.randomUUID(),
      productId: product.id,
      orderId,
      changeQty: -line.quantity,
      reason: line.lineType === "gift" ? "gift_order_paid" : "order_paid",
      beforeQty,
      afterQty,
      createdAt: nowIso
    });
  }

  return {
    order,
    orderItems,
    inventoryLogs,
    updatedProducts: [...productMap.values()]
  };
}

export function createOrderNo(prefix: string, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const suffix = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${suffix}`;
}
```

- [ ] **Step 4: Run order tests**

Run:

```powershell
npm test -- src/domain/order.test.ts
```

Expected: PASS.

## Task 6: Implement Cart Store and Image Utilities

**Files:**
- Create: `src/state/cartStore.ts`
- Create: `src/utils/image.ts`

- [ ] **Step 1: Create cart store**

Create `src/state/cartStore.ts`:

```ts
import { create } from "zustand";
import type { CartItem } from "../domain/types";

type CartState = {
  items: CartItem[];
  addProduct: (productId: string) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
};

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addProduct: (productId) =>
    set((state) => {
      const existing = state.items.find((item) => item.productId === productId);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
          )
        };
      }
      return {
        items: [
          ...state.items,
          {
            productId,
            quantity: 1,
            addedAt: new Date().toISOString()
          }
        ]
      };
    }),
  increment: (productId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    })),
  decrement: (productId) =>
    set((state) => ({
      items: state.items
        .map((item) => (item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0)
    })),
  clear: () => set({ items: [] }),
  replace: (items) => set({ items })
}));
```

- [ ] **Step 2: Create image utilities**

Create `src/utils/image.ts`:

```ts
import { getImage } from "../db/repositories";

const objectUrlCache = new Map<string, string>();

export async function getImageUrl(imageId?: string): Promise<string | undefined> {
  if (!imageId) {
    return undefined;
  }
  const cached = objectUrlCache.get(imageId);
  if (cached) {
    return cached;
  }
  const image = await getImage(imageId);
  if (!image) {
    return undefined;
  }
  const url = URL.createObjectURL(image.blob);
  objectUrlCache.set(imageId, url);
  return url;
}

export function revokeImageUrls(): void {
  for (const url of objectUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  objectUrlCache.clear();
}
```

- [ ] **Step 3: Build**

Run:

```powershell
npm run build
```

Expected: build succeeds.

## Task 7: Implement Products Page and Product Form

**Files:**
- Create: `src/components/ProductForm.tsx`
- Create: `src/pages/ProductsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create product form component**

Create `src/components/ProductForm.tsx` with a controlled form for `name`, `spu`, `costPrice`, `salePrice`, `stockQty`, `isSellable`, `isGiftEligible`, `status`, and image upload. On save, create/update product through props.

Required implementation details:

- Use numeric inputs for price and stock.
- Use checkboxes for sellable and gift-eligible.
- Use file input for image.
- Validate `name` and `spu` are non-empty.
- Save button disabled when invalid.

- [ ] **Step 2: Create products page**

Create `src/pages/ProductsPage.tsx` with:

- Product list loaded from `listProducts`.
- Add button.
- Edit button.
- Sort select with `createdAt`, `name`, `spu`, `salePrice`.
- Product image preview via `getImageUrl`.
- Soft delete by setting `status = inactive`.

- [ ] **Step 3: Wire products route**

Modify `src/App.tsx`:

```tsx
import { NavLink, Route, Routes } from "react-router-dom";
import ProductsPage from "./pages/ProductsPage";

function SalesPlaceholder() {
  return <section className="page"><h1>售卖</h1><p>售卖开单待实现</p></section>;
}

function DashboardPlaceholder() {
  return <section className="page"><h1>仪表盘</h1><p>极简数据概览待实现</p></section>;
}

function SettingsPlaceholder() {
  return <section className="page"><h1>设置</h1><p>收款码、促销和备份待实现</p></section>;
}

export default function App() {
  return (
    <div className="appShell">
      <header className="topBar">
        <div>
          <div className="brand">ECRM</div>
          <div className="subtitle">离线摊位售卖</div>
        </div>
        <nav className="nav">
          <NavLink to="/">商品</NavLink>
          <NavLink to="/sales">售卖</NavLink>
          <NavLink to="/dashboard">仪表盘</NavLink>
          <NavLink to="/settings">设置</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/sales" element={<SalesPlaceholder />} />
          <Route path="/dashboard" element={<DashboardPlaceholder />} />
          <Route path="/settings" element={<SettingsPlaceholder />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Manual test**

Run:

```powershell
npm run dev
```

Expected:

- Open `http://localhost:5173`.
- Add a product.
- Edit the product.
- Upload an image.
- Sort list.
- Mark inactive and verify it remains in product management.

## Task 8: Implement Settings, QR Upload, Promotion Config, and Backup

**Files:**
- Create: `src/utils/backup.ts`
- Create: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement backup utilities**

Create `src/utils/backup.ts`:

```ts
import { saveAs } from "file-saver";
import { db } from "../db/db";
import { clearAllData } from "../db/repositories";

type BackupPayload = {
  version: 1;
  exportedAt: string;
  products: unknown[];
  settings: unknown[];
  orders: unknown[];
  orderItems: unknown[];
  inventoryLogs: unknown[];
};

export async function exportJsonBackup(): Promise<void> {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    products: await db.products.toArray(),
    settings: await db.settings.toArray(),
    orders: await db.orders.toArray(),
    orderItems: await db.orderItems.toArray(),
    inventoryLogs: await db.inventoryLogs.toArray()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  saveAs(blob, `ecrm-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function importJsonBackup(file: File): Promise<void> {
  const text = await file.text();
  const payload = JSON.parse(text) as BackupPayload;
  if (payload.version !== 1) {
    throw new Error("备份版本不支持");
  }
  await clearAllData();
  await db.transaction("rw", db.products, db.settings, db.orders, db.orderItems, db.inventoryLogs, async () => {
    await db.products.bulkPut(payload.products as never[]);
    await db.settings.bulkPut(payload.settings as never[]);
    await db.orders.bulkPut(payload.orders as never[]);
    await db.orderItems.bulkPut(payload.orderItems as never[]);
    await db.inventoryLogs.bulkPut(payload.inventoryLogs as never[]);
  });
}
```

- [ ] **Step 2: Create settings page**

Create `src/pages/SettingsPage.tsx` with:

- Load settings via `getSettings`.
- Shop name input.
- Order prefix input.
- WeChat QR file input stored through `saveImage`.
- Alipay QR file input stored through `saveImage`.
- Promotion enable checkbox.
- Discount SPU input.
- Discount price numeric input.
- Max discount quantity numeric input.
- Gift tier product selectors from `isGiftEligible = true` products.
- Save settings button.
- Export backup button.
- Import backup file input.

- [ ] **Step 3: Wire settings route**

Modify `src/App.tsx` to import and use `SettingsPage` for `/settings`.

- [ ] **Step 4: Manual test**

Expected:

- Configure QR images.
- Configure discount SPU and gift tiers.
- Export backup JSON.
- Import backup JSON after clearing browser data in a test browser profile.

## Task 9: Implement Sales Page, Cart, Checkout, and Paid Order Save

**Files:**
- Create: `src/components/CartPanel.tsx`
- Create: `src/components/CheckoutPanel.tsx`
- Create: `src/pages/SalesPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create cart panel**

Create `src/components/CartPanel.tsx` with:

- Props: products, calculated cart, cart items, increment, decrement, clear, checkout.
- Display normal, discount, and gift lines.
- Display `已享加购优惠 X/Y 个`.
- Display triggered gift tier text.
- Display gift stock warnings.
- Display payable total.

- [ ] **Step 2: Create checkout panel**

Create `src/components/CheckoutPanel.tsx` with:

- Props: calculated cart, settings, QR image URLs, payment method, set payment method, confirm paid, back.
- Display order amount.
- Display WeChat QR if available.
- Display Alipay QR if available.
- Display manual payment confirmation controls.

- [ ] **Step 3: Create sales page**

Create `src/pages/SalesPage.tsx` with:

- Load active sellable products.
- Load settings.
- Derive unique SPU list.
- Filter product list by SPU.
- Use `useCartStore`.
- Calculate cart through `calculateCart`.
- On confirm paid:
  - call `buildPaidOrder`.
  - call `savePaidOrder`.
  - clear cart.
  - show success message.
- Product cards show image, name, SPU, price, stock, plus button.

- [ ] **Step 4: Wire sales route**

Modify `src/App.tsx` to import and use `SalesPage` for `/sales`.

- [ ] **Step 5: Manual test**

Expected:

- Add only A x1, total is 5.
- Add only A x4, total is 14.
- Add normal x1 at 20 and A x4, total is 34.
- Add enough products to reach 35/68/148 and verify highest gift tier text.
- Confirm paid and verify stock is deducted.

## Task 10: Implement Dashboard and Order History

**Files:**
- Create: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create dashboard**

Create `src/pages/DashboardPage.tsx` with:

- Load orders where status is `paid`.
- Compute today's paid sales amount.
- Compute today's paid order count.
- Load products and list stock below 3.

- [ ] **Step 2: Add order history section to Sales page**

Modify `src/pages/SalesPage.tsx`:

- Add recent paid orders list below sales interface or behind a simple `订单记录` toggle.
- Each order row shows order number, paid time, payable amount, payment method.

- [ ] **Step 3: Wire dashboard route**

Modify `src/App.tsx` to import and use `DashboardPage` for `/dashboard`.

- [ ] **Step 4: Manual test**

Expected:

- Create paid order.
- Dashboard sales amount updates.
- Order count updates.
- Low inventory product appears when stock is below 3.

## Task 11: PWA Build, Local Preview, and iPad Acceptance

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```md
# ECRM Booth POS

离线优先摊位售卖 MVP。

## 本地开发

```powershell
npm install
npm run dev
```

## 构建

```powershell
npm run build
npm run preview
```

## iPad 使用

1. 将构建后的静态站点部署到 GitHub Pages、Cloudflare Pages、Netlify 或 Vercel。
2. 在 iPad Safari 打开 HTTPS 地址。
3. 添加到主屏幕。
4. 首次打开并完成商品、二维码、促销配置。
5. 开启飞行模式验证离线可用。

## 摆摊前检查

- 商品已录入。
- 商品 A 允许售卖且允许赠品。
- 商品 B 不允许售卖但允许赠品。
- 微信和支付宝二维码已上传。
- 加购优惠 SPU 已配置。
- 满赠档位已配置。
- 已导出初始备份。
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run build
npm run preview
```

Expected:

- Tests pass.
- Build succeeds.
- Preview serves app locally.

- [ ] **Step 3: Deploy to free HTTPS static host**

Choose one:

- Vercel.
- Netlify.
- Cloudflare Pages.
- GitHub Pages.

For fastest manual deployment, use Vercel or Netlify drag-and-drop of the `dist` folder.

Expected:

- HTTPS URL opens on desktop.
- HTTPS URL opens on iPad Safari.

- [ ] **Step 4: iPad offline acceptance**

Run this exact checklist:

- Open HTTPS URL in iPad Safari.
- Add to Home Screen.
- Open from Home Screen.
- Create product A with sale price 5, sellable yes, gift yes.
- Create product B with sale price 0, sellable no, gift yes.
- Create one normal product with sale price 20.
- Configure promotion SPU for product A.
- Upload WeChat and Alipay QR images.
- Add A x4 and verify total 14.
- Add normal x1 and A x4 and verify total 34.
- Add products to reach 68 and verify A x2 + B x1 gift text.
- Confirm paid.
- Verify stock deduction.
- Close app.
- Enable airplane mode.
- Reopen from Home Screen.
- Create another order.
- Verify order history persists.

## Self-Review

Spec coverage:

- PWA and iPad install: Task 1 and Task 11.
- IndexedDB persistence: Task 4.
- Product management: Task 7.
- Product image upload: Task 7 and Task 8.
- Sellable/gift flags: Task 2, Task 7, Task 8.
- Sales list and cart: Task 6 and Task 9.
- Add-on discount: Task 3 and Task 9.
- Highest-tier gift: Task 3 and Task 9.
- QR display: Task 8 and Task 9.
- Manual paid confirmation: Task 9.
- Order snapshots: Task 5 and Task 9.
- Inventory deduction: Task 5 and Task 9.
- Backup: Task 8.
- Dashboard: Task 10.
- Offline acceptance: Task 11.

Placeholder scan:

- 未发现待定占位词。
- 未发现未完成标记。
- Deferred scope is explicitly out of MVP.

Type consistency:

- Product, order, cart, settings, and promotion types are defined in `src/domain/types.ts`.
- Promotion calculation consumes `PromotionConfig`, `Product[]`, and `CartItem[]`.
- Order builder consumes `CalculatedCart` and creates `Order`, `OrderItem`, `InventoryLog`, and updated `Product[]`.
