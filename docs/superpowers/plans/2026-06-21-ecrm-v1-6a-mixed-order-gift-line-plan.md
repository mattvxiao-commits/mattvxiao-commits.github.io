# ECRM V1.6a 混合订单与赠送明细 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现同一订单内同时包含正常销售、运营赠礼、人工赠送和其他非销售出库明细，并让订单、库存、仪表盘、导出和备份按真实销售口径计算。

**Architecture:** 先在领域层建立明细收入类型、非销售原因和经营口径归一化函数，再让购物车状态保存行级类型和原因，最后复用同一归一化口径驱动订单保存、订单详情、历史修正、仪表盘和 Excel 导出。旧订单读取时默认保持正常销售口径，不回写原始事实。

**Tech Stack:** Vite, React, TypeScript, Dexie, Zustand, Vitest, Testing Library, write-excel-file。

---

## 执行原则

- V1.6a 需要新建实施分支或工作树，不直接在 `main` 上做业务代码改动。
- 每个任务先写测试，再实现，再运行目标测试，再提交。
- 子代理只执行单个任务；主控在每个任务后做规格符合性审查和代码质量审查。
- 所有用户可见文案使用中文。
- 不删除历史订单、退款记录、库存流水、支付事实。
- 旧备份、旧订单、旧购物车数据必须能继续读取。

## 建议分支

```powershell
git switch -c v1.6a-mixed-order-lines
```

如果当前 `main` 尚未推送文档提交，先推送或确认保留本地领先提交，再创建分支。

## 文件结构

### 领域与类型

- Modify: `src/domain/types.ts`
  - 新增 `OrderLineRevenueType`、`NonSalesReason`、`OrderNature`、`CampaignGiftConfig`。
  - 扩展 `CartItem`、`CalculatedCartLine`、`CalculatedCart`、`AppSettings`、`Order`、`OrderItem`、`InventoryLog`。

- Create: `src/domain/orderLines.ts`
  - 统一归一化旧订单明细。
  - 判断销售 / 非销售口径。
  - 计算成本归属、经营归属、统计小计、优惠让利。
  - 派生订单性质。

- Test: `src/domain/orderLines.test.ts`

### 设置与配置

- Modify: `src/db/db.ts`
  - 默认设置新增 `campaignGift`。

- Modify: `src/pages/SettingsPage.tsx`
  - 设置页新增“运营赠礼”配置区。

- Test: `src/pages/SettingsPage.test.tsx`

### 购物车与售卖

- Modify: `src/state/cartStore.ts`
  - 支持行级明细类型、非销售原因、原因备注、活动名称快照。
  - 支持通过不同入口添加同一商品的不同行级类型。

- Test: `src/state/cartStore.test.ts`

- Modify: `src/domain/promotions.ts`
  - 促销只读取正常销售行。
  - 满赠自动生成 `non_sales / tier_gift` 行。

- Test: `src/domain/promotions.test.ts`

- Modify: `src/components/CartPanel.tsx`
  - 行级类型切换。
  - 运营赠礼、人工赠送、其他出库快捷入口。
  - 原因 / 备注校验。

- Modify: `src/pages/SalesPage.tsx`
  - 商品选择弹窗、非销售出库保存、纯非销售出库保存。
  - 运营赠礼必须依附正常销售。

- Test: `src/components/CartPanel.test.tsx`
- Test: `src/pages/SalesPage.test.tsx`

### 订单保存、详情、修正

- Modify: `src/domain/order.ts`
  - 保存销售和非销售明细。
  - 非销售明细价格为 0，扣库存，保存成本快照。
  - 纯非销售订单不要求支付方式。

- Test: `src/domain/order.test.ts`

- Modify: `src/db/repositories.ts`
  - 保存纯非销售出库订单。
  - 保存统计口径修正。
  - 校验库存流水与订单明细一致。

- Test: `src/db/repositories.test.ts`

- Modify: `src/components/OrderDetailDialog.tsx`
  - 展示订单性质、明细类型、非销售原因、运营活动快照、成本归属。
  - 增加整单 / 明细统计口径修正入口。

- Test: `src/components/OrderDetailDialog.test.tsx`

### 仪表盘与导出

- Modify: `src/domain/dashboard.ts`
  - 默认正常销售口径。
  - 新增全部活动、运营赠礼、人工赠送、其他非销售出库口径。
  - 新增销售成本、优惠让利、运营活动成本、活动后毛利、非经营出库成本。

- Test: `src/domain/dashboard.test.ts`

- Modify: `src/pages/DashboardPage.tsx`
  - 增加口径切换控件。
  - 展示新增成本和出库指标。

- Test: `src/pages/DashboardPage.test.tsx`

- Modify: `src/domain/orderExport.ts`
  - Excel 明细表和汇总表新增 V1.6a 字段。

- Test: `src/domain/orderExport.test.ts`

- Modify: `src/utils/backup.ts`
  - 备份版本升级。
  - 校验并导入 V1.6a 新字段。
  - 旧备份默认归一化为正常销售。

- Test: `src/utils/backup.test.ts`

### 发布记录

- Modify: `package.json`
  - 版本升级为 `1.6.0`。

- Create: `docs/releases/2026-06-21-ecrm-v1-6a-mixed-order-lines-record.md`
  - 中文记录功能范围、验收项、兼容说明、已知边界。

---

## Task 1: 建立明细归一化与经营口径

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/orderLines.ts`
- Create: `src/domain/orderLines.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/domain/orderLines.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  deriveOrderNature,
  getLineAccounting,
  getNormalizedOrderLine,
  isRevenueLine,
  isNonSalesLine
} from "./orderLines";
import type { OrderItem } from "./types";

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    productId: "product-1",
    productNameSnapshot: "贴纸 A",
    spuSnapshot: "贴纸",
    quantity: 2,
    originalUnitPrice: 5,
    finalUnitPrice: 3,
    lineType: "discount_addon",
    lineTotal: 6,
    unitCostSnapshot: 1,
    costTotal: 2,
    grossProfit: 4,
    ...overrides
  };
}

describe("orderLines", () => {
  it("旧订单明细默认归一化为销售明细", () => {
    const line = getNormalizedOrderLine(makeItem());

    expect(line.revenueType).toBe("sale");
    expect(line.statisticalUnitPrice).toBe(3);
    expect(line.statisticalSubtotal).toBe(6);
    expect(isRevenueLine(line)).toBe(true);
    expect(isNonSalesLine(line)).toBe(false);
  });

  it("赠品旧 lineType 归一化为满赠赠品", () => {
    const line = getNormalizedOrderLine(makeItem({
      lineType: "gift",
      originalUnitPrice: 0,
      finalUnitPrice: 0,
      lineTotal: 0,
      grossProfit: -2
    }));

    expect(line.revenueType).toBe("non_sales");
    expect(line.nonSalesReason).toBe("tier_gift");
    expect(line.statisticalSubtotal).toBe(0);
  });

  it("加购优惠销售计算优惠让利但成本仍归销售成本", () => {
    const accounting = getLineAccounting(getNormalizedOrderLine(makeItem()));

    expect(accounting.revenue).toBe(6);
    expect(accounting.discountGiveawayAmount).toBe(4);
    expect(accounting.salesCost).toBe(2);
    expect(accounting.operatingActivityCost).toBe(0);
    expect(accounting.basicGrossProfit).toBe(4);
  });

  it("运营赠礼计入运营活动成本，不计收入", () => {
    const line = getNormalizedOrderLine(makeItem({
      revenueType: "non_sales",
      nonSalesReason: "campaign_gift",
      campaignNameSnapshot: "关注小红书赠礼",
      finalUnitPrice: 0,
      lineTotal: 0,
      costTotal: 2,
      grossProfit: -2
    }));
    const accounting = getLineAccounting(line);

    expect(accounting.revenue).toBe(0);
    expect(accounting.campaignGiftCost).toBe(2);
    expect(accounting.operatingActivityCost).toBe(2);
    expect(accounting.nonOperatingOutboundCost).toBe(0);
  });

  it("人工赠送计入非经营出库成本", () => {
    const line = getNormalizedOrderLine(makeItem({
      revenueType: "non_sales",
      nonSalesReason: "manual_gift",
      nonSalesNote: "好友赠送",
      finalUnitPrice: 0,
      lineTotal: 0,
      costTotal: 2,
      grossProfit: -2
    }));
    const accounting = getLineAccounting(line);

    expect(accounting.manualGiftCost).toBe(2);
    expect(accounting.nonOperatingOutboundCost).toBe(2);
    expect(accounting.operatingActivityCost).toBe(0);
  });

  it("按明细派生订单性质", () => {
    expect(deriveOrderNature([getNormalizedOrderLine(makeItem())])).toBe("sale");
    expect(deriveOrderNature([
      getNormalizedOrderLine(makeItem()),
      getNormalizedOrderLine(makeItem({ revenueType: "non_sales", nonSalesReason: "manual_gift", lineTotal: 0 }))
    ])).toBe("mixed");
    expect(deriveOrderNature([
      getNormalizedOrderLine(makeItem({ revenueType: "non_sales", nonSalesReason: "other_non_sales", lineTotal: 0 }))
    ])).toBe("non_sales");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/orderLines.test.ts
```

Expected: FAIL，因为 `src/domain/orderLines.ts` 尚不存在。

- [ ] **Step 3: 扩展类型**

Modify `src/domain/types.ts`:

```ts
export type OrderLineRevenueType = "sale" | "non_sales";

export type NonSalesReason =
  | "tier_gift"
  | "campaign_gift"
  | "manual_gift"
  | "other_non_sales";

export type OrderNature = "sale" | "mixed" | "non_sales";

export type CampaignGiftConfig = {
  enabled: boolean;
  activityName: string;
  defaultProductId: string;
  requireSaleLine: boolean;
};
```

Extend `CartItem`:

```ts
export type CartItem = {
  id?: string;
  productId: string;
  quantity: number;
  addedAt: string;
  revenueType?: OrderLineRevenueType;
  nonSalesReason?: NonSalesReason;
  nonSalesNote?: string;
  campaignNameSnapshot?: string;
};
```

Extend `PromotionConfig` or `AppSettings` by adding to `AppSettings`:

```ts
campaignGift: CampaignGiftConfig;
```

Extend `CalculatedCartLine`:

```ts
revenueType?: OrderLineRevenueType;
nonSalesReason?: NonSalesReason;
nonSalesNote?: string;
campaignNameSnapshot?: string;
statisticalUnitPrice?: number;
statisticalSubtotal?: number;
discountGiveawayAmount?: number;
```

Extend `CalculatedCart`:

```ts
salesSubtotal: number;
nonSalesQuantity: number;
nonSalesCost: number;
```

Extend `Order`:

```ts
orderNature?: OrderNature;
salesAmount?: number;
nonSalesQuantity?: number;
nonSalesCost?: number;
operatingActivityCost?: number;
nonOperatingOutboundCost?: number;
```

Extend `OrderItem`:

```ts
revenueType?: OrderLineRevenueType;
nonSalesReason?: NonSalesReason;
nonSalesNote?: string;
campaignNameSnapshot?: string;
statisticalUnitPrice?: number;
statisticalSubtotal?: number;
discountGiveawayAmount?: number;
originalRevenueType?: OrderLineRevenueType;
originalNonSalesReason?: NonSalesReason;
adjustedAt?: string;
adjustmentNote?: string;
```

Extend `InventoryLog["reason"]` union:

```ts
| "non_sales_outbound"
```

- [ ] **Step 4: 实现归一化函数**

Create `src/domain/orderLines.ts`:

```ts
import { normalizeMoney } from "./money";
import type { NonSalesReason, OrderItem, OrderLineRevenueType, OrderNature } from "./types";

export type NormalizedOrderLine = OrderItem & {
  revenueType: OrderLineRevenueType;
  statisticalUnitPrice: number;
  statisticalSubtotal: number;
  discountGiveawayAmount: number;
};

export type LineAccounting = {
  revenue: number;
  discountGiveawayAmount: number;
  salesCost: number;
  basicGrossProfit: number;
  tierGiftCost: number;
  campaignGiftCost: number;
  operatingActivityCost: number;
  manualGiftCost: number;
  otherNonSalesCost: number;
  nonOperatingOutboundCost: number;
  fullOutboundCost: number;
};

export function getNormalizedOrderLine(item: OrderItem): NormalizedOrderLine {
  const inferredRevenueType = inferRevenueType(item);
  const statisticalUnitPrice = item.statisticalUnitPrice ?? (inferredRevenueType === "sale" ? item.finalUnitPrice : 0);
  const statisticalSubtotal = item.statisticalSubtotal ?? normalizeMoney(statisticalUnitPrice * item.quantity);
  const discountGiveawayAmount = item.discountGiveawayAmount ?? inferDiscountGiveawayAmount(item, inferredRevenueType);

  return {
    ...item,
    revenueType: inferredRevenueType,
    nonSalesReason: inferNonSalesReason(item, inferredRevenueType),
    statisticalUnitPrice,
    statisticalSubtotal,
    discountGiveawayAmount
  };
}

export function isRevenueLine(item: OrderItem): boolean {
  return getNormalizedOrderLine(item).revenueType === "sale";
}

export function isNonSalesLine(item: OrderItem): boolean {
  return getNormalizedOrderLine(item).revenueType === "non_sales";
}

export function deriveOrderNature(items: OrderItem[]): OrderNature {
  const normalized = items.map(getNormalizedOrderLine);
  const hasSale = normalized.some((item) => item.revenueType === "sale");
  const hasNonSales = normalized.some((item) => item.revenueType === "non_sales");

  if (hasSale && hasNonSales) {
    return "mixed";
  }

  if (hasNonSales) {
    return "non_sales";
  }

  return "sale";
}

export function getLineAccounting(item: OrderItem): LineAccounting {
  const line = getNormalizedOrderLine(item);
  const costTotal = normalizeMoney(line.costTotal ?? 0);
  const revenue = line.revenueType === "sale" ? normalizeMoney(line.statisticalSubtotal) : 0;
  const salesCost = line.revenueType === "sale" ? costTotal : 0;
  const tierGiftCost = line.nonSalesReason === "tier_gift" ? costTotal : 0;
  const campaignGiftCost = line.nonSalesReason === "campaign_gift" ? costTotal : 0;
  const manualGiftCost = line.nonSalesReason === "manual_gift" ? costTotal : 0;
  const otherNonSalesCost = line.nonSalesReason === "other_non_sales" ? costTotal : 0;
  const operatingActivityCost = normalizeMoney(tierGiftCost + campaignGiftCost);
  const nonOperatingOutboundCost = normalizeMoney(manualGiftCost + otherNonSalesCost);

  return {
    revenue,
    discountGiveawayAmount: line.revenueType === "sale" ? normalizeMoney(line.discountGiveawayAmount) : 0,
    salesCost,
    basicGrossProfit: normalizeMoney(revenue - salesCost),
    tierGiftCost,
    campaignGiftCost,
    operatingActivityCost,
    manualGiftCost,
    otherNonSalesCost,
    nonOperatingOutboundCost,
    fullOutboundCost: normalizeMoney(salesCost + operatingActivityCost + nonOperatingOutboundCost)
  };
}

function inferRevenueType(item: OrderItem): OrderLineRevenueType {
  if (item.revenueType) {
    return item.revenueType;
  }

  return item.lineType === "gift" ? "non_sales" : "sale";
}

function inferNonSalesReason(item: OrderItem, revenueType: OrderLineRevenueType): NonSalesReason | undefined {
  if (revenueType === "sale") {
    return undefined;
  }

  return item.nonSalesReason ?? (item.lineType === "gift" ? "tier_gift" : "other_non_sales");
}

function inferDiscountGiveawayAmount(item: OrderItem, revenueType: OrderLineRevenueType): number {
  if (revenueType !== "sale" || item.lineType !== "discount_addon") {
    return 0;
  }

  return normalizeMoney(Math.max(0, item.originalUnitPrice - item.finalUnitPrice) * item.quantity);
}
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```powershell
npm test -- src/domain/orderLines.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add src/domain/types.ts src/domain/orderLines.ts src/domain/orderLines.test.ts
git commit -m 'feat: add order line accounting model'
```

---

## Task 2: 设置页增加运营赠礼配置

**Files:**
- Modify: `src/db/db.ts`
- Modify: `src/db/repositories.ts`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.test.tsx`
- Modify: `src/utils/backup.ts`
- Modify: `src/utils/backup.test.ts`

- [ ] **Step 1: 写默认设置测试**

Add to `src/db/repositories.test.ts` or `src/utils/backup.test.ts`:

```ts
it("为旧设置补齐运营赠礼默认配置", async () => {
  const settings = await getSettings();

  expect(settings.campaignGift).toEqual({
    enabled: false,
    activityName: "运营赠礼",
    defaultProductId: "",
    requireSaleLine: true
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/db/repositories.test.ts src/utils/backup.test.ts
```

Expected: FAIL，因为 `campaignGift` 尚不存在或未归一化。

- [ ] **Step 3: 实现默认设置和归一化**

Modify `src/db/db.ts`:

```ts
const defaultCampaignGift = {
  enabled: false,
  activityName: "运营赠礼",
  defaultProductId: "",
  requireSaleLine: true
};

export function createDefaultSettings(): AppSettings {
  return {
    id: "settings",
    shopName: "ECRM 摊位",
    orderPrefix: "ECRM",
    promotion: structuredClone(defaultPromotion),
    campaignGift: structuredClone(defaultCampaignGift),
    fieldLock: createDefaultFieldLockSettings()
  };
}
```

Modify `src/db/repositories.ts` in `getSettings()`:

```ts
const normalizedSettings = {
  ...existing,
  campaignGift: {
    enabled: existing.campaignGift?.enabled ?? false,
    activityName: existing.campaignGift?.activityName?.trim() || "运营赠礼",
    defaultProductId: existing.campaignGift?.defaultProductId ?? "",
    requireSaleLine: existing.campaignGift?.requireSaleLine ?? true
  },
  fieldLock: normalizeFieldLockSettings(existing.fieldLock)
};
```

- [ ] **Step 4: 扩展备份校验**

Modify `src/utils/backup.ts`:

```ts
function validateCampaignGift(value: unknown): void {
  assertRecord(value, "备份文件格式不正确。");
  assertBoolean(value, "enabled");
  assertString(value, "activityName");
  assertString(value, "defaultProductId");
  assertBoolean(value, "requireSaleLine");
}
```

Call inside `validateSettings`:

```ts
if (setting.campaignGift !== undefined) {
  validateCampaignGift(setting.campaignGift);
}
```

In `normalizeBackupData`, normalize missing campaign config by reusing the same default shape.

- [ ] **Step 5: 增加设置页 UI 测试**

Add to `src/pages/SettingsPage.test.tsx`:

```ts
it("可以配置运营赠礼活动名称和默认赠礼 SKU", async () => {
  render(<SettingsPage />);

  expect(await screen.findByRole("heading", { name: "运营赠礼" })).toBeInTheDocument();
  expect(screen.getByLabelText("启用运营赠礼")).toBeInTheDocument();
  expect(screen.getByLabelText("运营活动名称")).toBeInTheDocument();
  expect(screen.getByLabelText("默认运营赠礼 SKU")).toBeInTheDocument();
});
```

- [ ] **Step 6: 实现设置页 UI**

Modify `src/pages/SettingsPage.tsx` inside `settingsGrid`:

```tsx
<section className="settingsSection wideSection" aria-labelledby="campaign-gift-settings-title">
  <div className="sectionTitle">
    <Gift size={21} aria-hidden="true" />
    <div>
      <h2 id="campaign-gift-settings-title">运营赠礼</h2>
      <p>用于记录关注社媒、加入社群、现场互动等运营活动赠品。</p>
    </div>
  </div>

  <div className="toggleRow">
    <label className="checkControl">
      <input
        aria-label="启用运营赠礼"
        type="checkbox"
        checked={settings.campaignGift.enabled}
        onChange={(event) =>
          updateSettings((current) => ({
            ...current,
            campaignGift: { ...current.campaignGift, enabled: event.target.checked }
          }))
        }
      />
      <span>启用运营赠礼</span>
    </label>
  </div>

  <div className="settingsFieldGrid">
    <label>
      <span>运营活动名称</span>
      <input
        aria-label="运营活动名称"
        value={settings.campaignGift.activityName}
        onChange={(event) =>
          updateSettings((current) => ({
            ...current,
            campaignGift: { ...current.campaignGift, activityName: event.target.value }
          }))
        }
      />
    </label>
    <label>
      <span>默认运营赠礼 SKU</span>
      <select
        aria-label="默认运营赠礼 SKU"
        value={settings.campaignGift.defaultProductId}
        onChange={(event) =>
          updateSettings((current) => ({
            ...current,
            campaignGift: { ...current.campaignGift, defaultProductId: event.target.value }
          }))
        }
      >
        <option value="">不选择</option>
        {giftProducts.map((product) => (
          <option key={product.id} value={product.id}>
            {displayProductCode(product.productCode)} / {product.name} / {product.spu}
          </option>
        ))}
      </select>
    </label>
  </div>
</section>
```

- [ ] **Step 7: 运行目标测试**

Run:

```powershell
npm test -- src/db/repositories.test.ts src/pages/SettingsPage.test.tsx src/utils/backup.test.ts
```

Expected: PASS。

- [ ] **Step 8: 提交**

```powershell
git add src/db/db.ts src/db/repositories.ts src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx src/utils/backup.ts src/utils/backup.test.ts
git commit -m 'feat: configure campaign gift settings'
```

---

## Task 3: 购物车支持混合明细和非销售出库

**Files:**
- Modify: `src/state/cartStore.ts`
- Modify: `src/state/cartStore.test.ts`
- Modify: `src/domain/promotions.ts`
- Modify: `src/domain/promotions.test.ts`
- Modify: `src/components/CartPanel.tsx`
- Modify: `src/components/CartPanel.test.tsx`
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`

- [ ] **Step 1: 写 cartStore 测试**

Add to `src/state/cartStore.test.ts`:

```ts
it("同一商品可以同时存在销售行和非销售出库行", () => {
  const store = useCartStore.getState();

  store.clear();
  store.addProduct("product-a");
  store.addNonSalesProduct({
    productId: "product-a",
    reason: "manual_gift",
    note: "好友赠送"
  });

  expect(useCartStore.getState().items).toMatchObject([
    { productId: "product-a", quantity: 1, revenueType: "sale" },
    { productId: "product-a", quantity: 1, revenueType: "non_sales", nonSalesReason: "manual_gift", nonSalesNote: "好友赠送" }
  ]);
});
```

- [ ] **Step 2: 写促销测试**

Add to `src/domain/promotions.test.ts`:

```ts
it("非销售明细不参与加购优惠和满赠门槛", () => {
  const calculated = calculateCart({
    items: [
      { productId: "sale-a", quantity: 1, addedAt: "2026-06-21T10:00:00.000Z", revenueType: "sale" },
      {
        productId: "gift-a",
        quantity: 3,
        addedAt: "2026-06-21T10:01:00.000Z",
        revenueType: "non_sales",
        nonSalesReason: "manual_gift",
        nonSalesNote: "好友赠送"
      }
    ],
    products,
    promotion
  });

  expect(calculated.payableAmount).toBe(5);
  expect(calculated.nonSalesQuantity).toBe(3);
  expect(calculated.lines.find((line) => line.productId === "gift-a")?.lineTotal).toBe(0);
  expect(calculated.triggeredGiftTier).toBeUndefined();
});
```

Use existing fixtures in the test file; if local fixtures use different IDs, create explicit products inside the test.

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
npm test -- src/state/cartStore.test.ts src/domain/promotions.test.ts
```

Expected: FAIL，因为 store action 和促销口径尚未实现。

- [ ] **Step 4: 实现 cartStore 行级 key**

Modify `src/state/cartStore.ts`:

```ts
type AddNonSalesInput = {
  productId: string;
  reason: Exclude<NonSalesReason, "tier_gift">;
  note?: string;
  campaignNameSnapshot?: string;
};

type CartState = {
  items: CartItem[];
  addProduct: (productId: string) => void;
  addNonSalesProduct: (input: AddNonSalesInput) => void;
  increment: (itemIdOrProductId: string) => void;
  decrement: (itemIdOrProductId: string) => void;
  updateLineType: (itemId: string, patch: Partial<CartItem>) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
};
```

Implementation rule:

- Sale rows use `revenueType: "sale"`.
- Non-sales rows always receive a stable `id`.
- Increment / decrement should first match `item.id`, then fallback to existing product ID behavior for old carts.
- Persisted old cart items without `id` remain readable.

- [ ] **Step 5: 实现促销口径**

Modify `src/domain/promotions.ts`:

- Build sale candidate lines only from `item.revenueType !== "non_sales"`.
- Build non-sales manual lines from `item.revenueType === "non_sales"`.
- For non-sales lines set:

```ts
finalUnitPrice: 0,
lineTotal: 0,
lineType: "gift",
revenueType: "non_sales",
nonSalesReason: item.nonSalesReason,
nonSalesNote: item.nonSalesNote,
campaignNameSnapshot: item.campaignNameSnapshot,
statisticalUnitPrice: 0,
statisticalSubtotal: 0,
discountGiveawayAmount: 0
```

- Full `CalculatedCart.lines` should include sale lines and manual non-sales lines.
- `CalculatedCart.giftLines` should remain automatic tier gifts.
- Automatic tier gifts should have `revenueType: "non_sales"` and `nonSalesReason: "tier_gift"`.

- [ ] **Step 6: 实现购物车 UI 测试**

Add to `src/components/CartPanel.test.tsx`:

```ts
it("展示非销售明细类型和 0 元小计", () => {
  render(<CartPanel {...propsWithNonSalesLine} />);

  expect(screen.getByText("人工赠送")).toBeInTheDocument();
  expect(screen.getByText("¥0.00")).toBeInTheDocument();
});
```

Add to `src/pages/SalesPage.test.tsx`:

```ts
it("购物车没有销售商品时不能添加运营赠礼", async () => {
  render(<SalesPage />);

  await user.click(await screen.findByRole("button", { name: "打开购物车" }));
  await user.click(screen.getByRole("button", { name: "添加运营赠礼" }));

  expect(screen.getByText("运营赠礼需要本单存在正常消费商品。")).toBeInTheDocument();
});
```

- [ ] **Step 7: 实现购物车 UI**

Modify `src/components/CartPanel.tsx` props:

```ts
addCampaignGift: () => void;
addManualGift: () => void;
addOtherOutbound: () => void;
updateLineType: (itemId: string, patch: Partial<CartItem>) => void;
```

Add three compact action buttons near cart heading or below promotion summary:

```tsx
<div className="nonSalesQuickActions" role="group" aria-label="非销售出库">
  <button type="button" className="secondaryButton" onClick={addCampaignGift}>运营赠礼</button>
  <button type="button" className="secondaryButton" onClick={addManualGift}>人工赠送</button>
  <button type="button" className="secondaryButton" onClick={addOtherOutbound}>其他出库</button>
</div>
```

Line labels:

```ts
const nonSalesReasonLabels = {
  tier_gift: "满赠赠品",
  campaign_gift: "运营赠礼",
  manual_gift: "人工赠送",
  other_non_sales: "其他出库"
} as const;
```

- [ ] **Step 8: 实现 SalesPage 非销售商品选择**

Modify `src/pages/SalesPage.tsx`:

- Add state for pending non-sales picker:

```ts
type NonSalesPickerMode = "campaign_gift" | "manual_gift" | "other_non_sales";
const [nonSalesPickerMode, setNonSalesPickerMode] = useState<NonSalesPickerMode>();
const [nonSalesNote, setNonSalesNote] = useState("");
const addNonSalesProduct = useCartStore((state) => state.addNonSalesProduct);
```

- For `campaign_gift`, product options must be `products.filter(product => product.status === "active" && product.isGiftEligible)`.
- For `manual_gift` and `other_non_sales`, default options show gift-eligible products, with a toggle to show all active products.
- When adding `campaign_gift`, block if no sale cart line exists and show:

```text
运营赠礼需要本单存在正常消费商品。
```

- Manual gift and other outbound require note before confirming.
- If campaign default product exists and is valid, add it directly; otherwise open picker.

- [ ] **Step 9: 运行目标测试**

Run:

```powershell
npm test -- src/state/cartStore.test.ts src/domain/promotions.test.ts src/components/CartPanel.test.tsx src/pages/SalesPage.test.tsx
```

Expected: PASS。

- [ ] **Step 10: 提交**

```powershell
git add src/state/cartStore.ts src/state/cartStore.test.ts src/domain/promotions.ts src/domain/promotions.test.ts src/components/CartPanel.tsx src/components/CartPanel.test.tsx src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx
git commit -m 'feat: support mixed cart non-sales lines'
```

---

## Task 4: 订单保存支持销售 / 非销售混合订单

**Files:**
- Modify: `src/domain/order.ts`
- Modify: `src/domain/order.test.ts`
- Modify: `src/db/repositories.ts`
- Modify: `src/db/repositories.test.ts`
- Modify: `src/components/CheckoutPanel.tsx`
- Modify: `src/components/CheckoutPanel.test.tsx`
- Modify: `src/pages/SalesPage.tsx`

- [ ] **Step 1: 写订单领域测试**

Add to `src/domain/order.test.ts`:

```ts
it("保存混合订单时只按销售明细计算应收，非销售明细扣库存并保留成本", () => {
  const result = buildPaidOrder({
    products,
    calculated: mixedCalculatedCart,
    promotion,
    orderPrefix: "ECRM",
    paymentMethod: "cash",
    now: "2026-06-21T10:00:00.000Z"
  });

  expect(result.order.orderNature).toBe("mixed");
  expect(result.order.payableAmount).toBe(30);
  expect(result.order.salesAmount).toBe(30);
  expect(result.order.nonSalesQuantity).toBe(1);
  expect(result.orderItems.find((item) => item.nonSalesReason === "campaign_gift")).toMatchObject({
    revenueType: "non_sales",
    finalUnitPrice: 0,
    lineTotal: 0,
    campaignNameSnapshot: "关注小红书赠礼"
  });
  expect(result.inventoryLogs).toHaveLength(2);
});
```

- [ ] **Step 2: 写纯非销售订单测试**

Add to `src/domain/order.test.ts`:

```ts
it("纯非销售出库订单应收为 0 且不需要支付方式", () => {
  const result = buildPaidOrder({
    products,
    calculated: nonSalesOnlyCalculatedCart,
    promotion,
    orderPrefix: "ECRM",
    now: "2026-06-21T10:00:00.000Z"
  });

  expect(result.order.orderNature).toBe("non_sales");
  expect(result.order.paymentMethod).toBeUndefined();
  expect(result.order.payableAmount).toBe(0);
});
```

Update `BuildPaidOrderInput` so `paymentMethod?: PaymentMethod`.

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/order.test.ts src/db/repositories.test.ts src/components/CheckoutPanel.test.tsx
```

Expected: FAIL。

- [ ] **Step 4: 修改订单构建**

Modify `src/domain/order.ts`:

- Use `getNormalizedOrderLine` / `deriveOrderNature`.
- `Order.paymentMethod` optional when payable is 0.
- `InventoryLog.reason` should be:
  - `order_paid` for `revenueType = "sale"`.
  - `gift_order_paid` for `nonSalesReason = "tier_gift"`.
  - `non_sales_outbound` for `campaign_gift/manual_gift/other_non_sales`.
- `grossProfit` for non-sales lines can be `-costTotal`, while statistical revenue remains 0.
- Order summary fields:

```ts
salesAmount: calculated.salesSubtotal,
nonSalesQuantity: calculated.nonSalesQuantity,
nonSalesCost: calculated.nonSalesCost,
orderNature: deriveOrderNature(orderItems),
operatingActivityCost,
nonOperatingOutboundCost
```

- [ ] **Step 5: 修改仓储校验**

Modify `src/db/repositories.ts`:

- Rename user-facing error from “订单状态必须为已支付” only if needed; pure non-sales can still use status `paid` as “已完成” for minimal schema change.
- `validateInventoryLogsMatchOrderItems` remains product quantity based and should accept `non_sales_outbound`.
- `voidPaidOrder` rollback filters should include `non_sales_outbound`.

```ts
const deductionReasons = new Set(["order_paid", "gift_order_paid", "non_sales_outbound"]);
```

- [ ] **Step 6: 修改收款页**

Modify `src/components/CheckoutPanel.tsx`:

- If `calculated.payableAmount === 0`, hide payment method buttons and QR code.
- Button text:

```text
确认保存非销售出库
```

- Manual confirm copy:

```text
本单无应收金额，保存后会扣减对应库存并记录为非销售出库。
```

- [ ] **Step 7: 运行目标测试**

Run:

```powershell
npm test -- src/domain/order.test.ts src/db/repositories.test.ts src/components/CheckoutPanel.test.tsx src/pages/SalesPage.test.tsx
```

Expected: PASS。

- [ ] **Step 8: 提交**

```powershell
git add src/domain/order.ts src/domain/order.test.ts src/db/repositories.ts src/db/repositories.test.ts src/components/CheckoutPanel.tsx src/components/CheckoutPanel.test.tsx src/pages/SalesPage.tsx
git commit -m 'feat: save mixed and non-sales orders'
```

---

## Task 5: 订单详情与历史统计口径修正

**Files:**
- Modify: `src/domain/orderHistory.ts`
- Modify: `src/domain/orderHistory.test.ts`
- Modify: `src/db/repositories.ts`
- Modify: `src/db/repositories.test.ts`
- Modify: `src/components/OrderDetailDialog.tsx`
- Modify: `src/components/OrderDetailDialog.test.tsx`
- Modify: `src/pages/SalesPage.tsx`

- [ ] **Step 1: 写仓储修正测试**

Add to `src/db/repositories.test.ts`:

```ts
it("可以把历史订单单行修正为人工赠送且不修改库存流水", async () => {
  await adjustOrderItemAccounting({
    orderItemId: "item-1",
    revenueType: "non_sales",
    nonSalesReason: "manual_gift",
    nonSalesNote: "好友赠送",
    adjustedAt: "2026-06-21T12:00:00.000Z"
  });

  const items = await listOrderItems("order-1");
  const logs = await listInventoryLogsForOrder("order-1");

  expect(items[0]).toMatchObject({
    revenueType: "non_sales",
    nonSalesReason: "manual_gift",
    nonSalesNote: "好友赠送",
    statisticalUnitPrice: 0,
    statisticalSubtotal: 0,
    adjustedAt: "2026-06-21T12:00:00.000Z"
  });
  expect(logs).toHaveLength(1);
});
```

- [ ] **Step 2: 写详情 UI 测试**

Add to `src/components/OrderDetailDialog.test.tsx`:

```ts
it("展示订单性质、明细收入类型和非销售原因", () => {
  render(<OrderDetailDialog {...propsWithMixedOrder} />);

  expect(screen.getByText("销售 + 赠送")).toBeInTheDocument();
  expect(screen.getByText("运营赠礼")).toBeInTheDocument();
  expect(screen.getByText("关注小红书赠礼")).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
npm test -- src/db/repositories.test.ts src/components/OrderDetailDialog.test.tsx src/domain/orderHistory.test.ts
```

Expected: FAIL。

- [ ] **Step 4: 实现修正仓储方法**

Modify `src/db/repositories.ts`:

```ts
export type AdjustOrderItemAccountingInput = {
  orderItemId: string;
  revenueType: OrderLineRevenueType;
  nonSalesReason?: NonSalesReason;
  nonSalesNote?: string;
  campaignNameSnapshot?: string;
  adjustedAt?: string;
};

export async function adjustOrderItemAccounting(input: AdjustOrderItemAccountingInput): Promise<OrderItem> {
  const adjustedAt = input.adjustedAt ?? new Date().toISOString();

  return db.transaction("rw", db.orderItems, async () => {
    const item = await db.orderItems.get(input.orderItemId);

    if (!item) {
      throw new Error("订单明细不存在，无法修正统计口径。");
    }

    const nextItem: OrderItem = {
      ...item,
      originalRevenueType: item.originalRevenueType ?? item.revenueType,
      revenueType: input.revenueType,
      nonSalesReason: input.revenueType === "non_sales" ? input.nonSalesReason : undefined,
      nonSalesNote: input.revenueType === "non_sales" ? input.nonSalesNote?.trim() || undefined : undefined,
      campaignNameSnapshot: input.campaignNameSnapshot ?? item.campaignNameSnapshot,
      statisticalUnitPrice: input.revenueType === "sale" ? item.finalUnitPrice : 0,
      statisticalSubtotal: input.revenueType === "sale" ? item.lineTotal : 0,
      adjustedAt
    };

    await db.orderItems.put(nextItem);
    return nextItem;
  });
}
```

Add `adjustOrderAccounting` to batch all lines in one order.

- [ ] **Step 5: 实现订单详情展示**

Modify `src/components/OrderDetailDialog.tsx`:

- Use `deriveOrderNature` and `getNormalizedOrderLine`.
- Add labels:

```ts
const orderNatureLabels = {
  sale: "正常销售",
  mixed: "销售 + 赠送",
  non_sales: "非销售出库"
} as const;
```

- Add non-sales labels:

```ts
const nonSalesReasonLabels = {
  tier_gift: "满赠赠品",
  campaign_gift: "运营赠礼",
  manual_gift: "人工赠送",
  other_non_sales: "其他出库"
} as const;
```

- For each item show:
  - 明细收入类型。
  - 非销售原因。
  - 运营活动。
  - 统计小计。
  - 是否修正。

- [ ] **Step 6: 实现历史修正入口**

Modify `src/components/OrderDetailDialog.tsx` props:

```ts
onAdjustOrderItem?: (input: AdjustOrderItemAccountingInput) => Promise<void> | void;
onAdjustWholeOrder?: (input: AdjustWholeOrderAccountingInput) => Promise<void> | void;
```

UI rules:

- 修正为 `campaign_gift` 时，如果商品不是赠品资格，需要提示并阻止。第一版可由 `SalesPage` 传入 `products` 或在打开订单详情时读取商品状态。
- 修正为 `manual_gift` / `other_non_sales` 时，必须填写备注。
- 修正回 `sale` 时清空非销售原因并恢复统计小计。

- [ ] **Step 7: 更新 SalesPage 详情回调**

Modify `src/pages/SalesPage.tsx`:

- Import `adjustOrderItemAccounting` and batch method.
- After adjustment, reload selected order items.
- Show success banner:

```text
订单统计口径已修正，原始支付、退款和库存流水未改动。
```

- [ ] **Step 8: 运行目标测试**

Run:

```powershell
npm test -- src/db/repositories.test.ts src/components/OrderDetailDialog.test.tsx src/domain/orderHistory.test.ts src/pages/SalesPage.test.tsx
```

Expected: PASS。

- [ ] **Step 9: 提交**

```powershell
git add src/domain/orderHistory.ts src/domain/orderHistory.test.ts src/db/repositories.ts src/db/repositories.test.ts src/components/OrderDetailDialog.tsx src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.tsx
git commit -m 'feat: add order accounting adjustments'
```

---

## Task 6: 仪表盘口径切换与经营成本指标

**Files:**
- Modify: `src/domain/dashboard.ts`
- Modify: `src/domain/dashboard.test.ts`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 写仪表盘口径测试**

Add to `src/domain/dashboard.test.ts`:

```ts
it("正常销售口径排除运营赠礼、人工赠送和其他出库", () => {
  const dashboard = buildDashboardModel({
    dateRange,
    orders: [mixedOrder],
    orderItems: mixedOrderItems,
    refunds: [],
    products,
    accountingScope: "sales"
  });

  expect(dashboard.summary.paidAmount).toBe(30);
  expect(dashboard.operationsSummary.soldQuantity).toBe(1);
  expect(dashboard.operationsSummary.giftQuantity).toBe(0);
  expect(dashboard.profitSummary.costAmount).toBe(10);
  expect(dashboard.profitSummary.giftCostAmount).toBe(0);
});

it("全部活动口径展示运营活动成本和非经营出库成本", () => {
  const dashboard = buildDashboardModel({
    dateRange,
    orders: [mixedOrder],
    orderItems: mixedOrderItems,
    refunds: [],
    products,
    accountingScope: "all"
  });

  expect(dashboard.activityCostSummary.operatingActivityCost).toBe(2);
  expect(dashboard.activityCostSummary.nonOperatingOutboundCost).toBe(3);
  expect(dashboard.activityCostSummary.fullOutboundCost).toBe(15);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts src/pages/DashboardPage.test.tsx
```

Expected: FAIL。

- [ ] **Step 3: 扩展仪表盘输入和模型**

Modify `src/domain/dashboard.ts`:

```ts
export type DashboardAccountingScope =
  | "sales"
  | "all"
  | "campaign_gift"
  | "manual_gift"
  | "other_non_sales";
```

Extend `DashboardInput`:

```ts
accountingScope?: DashboardAccountingScope;
```

Add model:

```ts
export type DashboardActivityCostSummary = {
  discountGiveawayAmount: number;
  salesCost: number;
  basicGrossProfit: number;
  tierGiftCost: number;
  campaignGiftCost: number;
  operatingActivityCost: number;
  activityAdjustedGrossProfit: number;
  manualGiftCost: number;
  otherNonSalesCost: number;
  nonOperatingOutboundCost: number;
  fullOutboundCost: number;
};
```

Add to `DashboardModel`:

```ts
accountingScope: DashboardAccountingScope;
activityCostSummary: DashboardActivityCostSummary;
nonSalesReasonRows: DashboardGiftRow[];
```

- [ ] **Step 4: 实现过滤逻辑**

Rules:

- `sales`: only `revenueType = sale`.
- `all`: all paid order lines, but revenue only from sale lines.
- `campaign_gift`: only `nonSalesReason = campaign_gift`.
- `manual_gift`: only `nonSalesReason = manual_gift`.
- `other_non_sales`: only `nonSalesReason = other_non_sales`.
- Cancelled orders remain excluded from paid statistics; cancelled count still follows existing logic.
- Refunds still subtract from sales net amount only.

- [ ] **Step 5: 更新 DashboardPage UI**

Add state:

```ts
const [accountingScope, setAccountingScope] = useState<DashboardAccountingScope>("sales");
```

Add controls near date range:

```tsx
<div className="dashboardScopeSwitch" role="group" aria-label="统计口径">
  {scopeOptions.map((option) => (
    <button
      type="button"
      className={accountingScope === option.value ? "secondaryButton isActive" : "secondaryButton"}
      key={option.value}
      onClick={() => setAccountingScope(option.value)}
    >
      {option.label}
    </button>
  ))}
</div>
```

Labels:

```ts
const scopeOptions = [
  { value: "sales", label: "正常销售" },
  { value: "all", label: "全部活动" },
  { value: "campaign_gift", label: "运营赠礼" },
  { value: "manual_gift", label: "人工赠送" },
  { value: "other_non_sales", label: "其他出库" }
] as const;
```

Add a compact metric strip:

- 优惠让利
- 销售成本
- 运营活动成本
- 活动后毛利
- 非经营出库成本
- 全出库成本

- [ ] **Step 6: 运行目标测试**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts src/pages/DashboardPage.test.tsx
```

Expected: PASS。

- [ ] **Step 7: 提交**

```powershell
git add src/domain/dashboard.ts src/domain/dashboard.test.ts src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m 'feat: add dashboard accounting scopes'
```

---

## Task 7: Excel 导出与 JSON 备份兼容 V1.6a

**Files:**
- Modify: `src/domain/orderExport.ts`
- Modify: `src/domain/orderExport.test.ts`
- Modify: `src/utils/backup.ts`
- Modify: `src/utils/backup.test.ts`

- [ ] **Step 1: 写 Excel 导出测试**

Add to `src/domain/orderExport.test.ts`:

```ts
it("订单明细导出包含 V1.6a 明细口径字段", () => {
  const sheets = buildOrderExportSheets(inputWithMixedOrder);
  const detailRows = sheets.find((sheet) => sheet.name === "订单明细")?.rows ?? [];

  expect(detailRows[0]).toHaveProperty("明细收入类型");
  expect(detailRows[0]).toHaveProperty("非销售原因");
  expect(detailRows[0]).toHaveProperty("运营活动名称快照");
  expect(detailRows[0]).toHaveProperty("统计销售小计");
  expect(detailRows[0]).toHaveProperty("优惠让利金额");
  expect(detailRows[0]).toHaveProperty("成本归属");
  expect(detailRows[0]).toHaveProperty("经营归属");
});
```

- [ ] **Step 2: 写备份兼容测试**

Add to `src/utils/backup.test.ts`:

```ts
it("旧版备份导入后不会因为缺少 V1.6a 字段而失败", async () => {
  const result = await importJsonBackupFromText(JSON.stringify(legacyPayload), {
    importData: async (data) => {
      expect(data.orderItems[0].revenueType).toBeUndefined();
      expect(data.orderItems[0].nonSalesReason).toBeUndefined();
    }
  });

  expect(result.version).toBe(legacyPayload.version);
});
```

The key assertion is that optional new fields do not block import. Runtime display and calculations should rely on `getNormalizedOrderLine()` instead of mutating old backup rows during import.

- [ ] **Step 3: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/orderExport.test.ts src/utils/backup.test.ts
```

Expected: FAIL。

- [ ] **Step 4: 更新 Excel 导出**

Modify `src/domain/orderExport.ts`:

- Use `getNormalizedOrderLine` and `getLineAccounting`.
- Add labels:

```ts
const revenueTypeLabels = {
  sale: "销售",
  non_sales: "非销售出库"
} as const;

const nonSalesReasonLabels = {
  tier_gift: "满赠赠品",
  campaign_gift: "运营赠礼",
  manual_gift: "人工赠送",
  other_non_sales: "其他非销售出库"
} as const;
```

Add detail columns:

- 明细收入类型
- 非销售原因
- 非销售备注
- 运营活动名称快照
- 是否统计修正
- 原始销售小计
- 统计销售小计
- 优惠让利金额
- 成本归属
- 经营归属

Add summary columns:

- 订单整体性质
- 销售金额
- 优惠让利
- 销售成本
- 基础销售毛利
- 运营活动成本
- 活动后毛利
- 非经营出库成本
- 非销售出库件数
- 非销售出库成本
- 是否含统计修正

- [ ] **Step 5: 更新备份版本与校验**

Modify `src/utils/backup.ts`:

- Increment `BACKUP_VERSION` to `5`.
- Extend `ParsedBackupPayload` version union to include `5`.
- Add allowed sets:

```ts
const REVENUE_TYPES = new Set(["sale", "non_sales"]);
const NON_SALES_REASONS = new Set(["tier_gift", "campaign_gift", "manual_gift", "other_non_sales"]);
```

In `validateOrderItems`, allow optional fields:

```ts
if (item.revenueType !== undefined) {
  assertEnum(item, "revenueType", REVENUE_TYPES);
}

if (item.nonSalesReason !== undefined) {
  assertEnum(item, "nonSalesReason", NON_SALES_REASONS);
}

assertOptionalString(item, "nonSalesNote");
assertOptionalString(item, "campaignNameSnapshot");
assertOptionalNonNegativeNumber(item, "statisticalUnitPrice");
assertOptionalNonNegativeNumber(item, "statisticalSubtotal");
assertOptionalNonNegativeNumber(item, "discountGiveawayAmount");
assertOptionalString(item, "adjustedAt");
assertOptionalString(item, "adjustmentNote");
```

Do not force old backups to physically add fields during import; normalization is handled in domain functions.

- [ ] **Step 6: 运行目标测试**

Run:

```powershell
npm test -- src/domain/orderExport.test.ts src/utils/backup.test.ts
```

Expected: PASS。

- [ ] **Step 7: 提交**

```powershell
git add src/domain/orderExport.ts src/domain/orderExport.test.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m 'feat: export v1.6a accounting fields'
```

---

## Task 8: UI 密度、样式和全量回归

**Files:**
- Modify: `src/styles.css`
- Modify: `package.json`
- Create: `docs/releases/2026-06-21-ecrm-v1-6a-mixed-order-lines-record.md`
- Modify tests as needed only when user-visible labels changed intentionally.

- [ ] **Step 1: 更新版本号**

Modify `package.json`:

```json
"version": "1.6.0"
```

If `package-lock.json` version is updated by `npm install` or `npm pkg set`, include it in the commit.

- [ ] **Step 2: 调整样式**

Modify `src/styles.css`:

- Non-sales quick actions should be compact and not expand cart height excessively.
- Non-sales badges should be visually distinct but restrained.
- Dashboard scope switch should match existing date range / refresh button scale.
- Order detail adjustment controls should fit existing modal density.

Suggested class names:

```css
.nonSalesQuickActions {}
.lineTypeBadge {}
.lineTypeBadge.isNonSales {}
.nonSalesPickerDialog {}
.dashboardScopeSwitch {}
.activityCostStrip {}
.accountingAdjustPanel {}
```

- [ ] **Step 3: 写发布记录**

Create `docs/releases/2026-06-21-ecrm-v1-6a-mixed-order-lines-record.md`:

```md
# ECRM V1.6a 混合订单与赠送明细交付记录

## 版本

- 版本号：v1.6.0
- 日期：2026-06-21

## 本版重点

- 支持同一订单内同时记录正常销售和非销售赠送 / 出库明细。
- 新增运营赠礼、人工赠送、其他非销售出库。
- 非销售明细自动 0 元，不计入应收金额，但扣减库存并保留成本快照。
- 仪表盘支持正常销售、全部活动、运营赠礼、人工赠送、其他出库口径。
- Excel 导出增加明细口径、成本归属和经营归属字段。

## 兼容说明

- 旧订单默认按正常销售读取。
- 旧满赠赠品可通过 lineType 归一化为满赠赠品。
- 旧 JSON 备份仍可导入。
- 历史修正只影响统计口径，不删除原始订单、退款和库存流水。

## 已知边界

- 不自动验证社媒关注状态。
- 不接入微信 / 支付宝支付 API。
- 不做商品级退款、退货入库、换货。
- 不做云同步。

## 验收建议

- 消费 + 运营赠礼。
- 纯人工赠送。
- 其他非销售出库。
- 历史订单整单修正。
- 历史订单明细修正。
- 仪表盘口径切换。
- JSON 备份导出 / 导入。
- 订单 Excel 导出。
```

- [ ] **Step 4: 运行全量测试**

Run:

```powershell
npm test
```

Expected: PASS。

- [ ] **Step 5: 构建**

Run:

```powershell
npm run build
```

Expected: PASS。

- [ ] **Step 6: 提交**

```powershell
git add src/styles.css package.json package-lock.json docs/releases/2026-06-21-ecrm-v1-6a-mixed-order-lines-record.md
git commit -m 'chore: release v1.6.0 mixed order lines'
```

---

## Task 9: 主控验收清单

**Files:**
- No required file changes unless defects are found.

- [ ] **Step 1: 运行全量验证**

Run:

```powershell
git status --short --branch
npm test
npm run build
```

Expected:

- `npm test` PASS。
- `npm run build` PASS。
- 工作区只有预期变更或干净。

- [ ] **Step 2: 手动验收路径**

Run local preview:

```powershell
npm run build
npm run preview -- --host 0.0.0.0
```

Open:

```text
http://localhost:4173/
```

Manual scenarios:

- 新建可售商品 A，赠品资格商品 G，普通商品 B。
- 设置页启用运营赠礼，活动名称填写“关注小红书赠礼”，默认赠礼选择 G。
- 售卖页加入 A，再添加运营赠礼 G，应收只包含 A。
- 售卖页创建纯人工赠送 B，收款页不显示二维码，不要求支付方式，保存后扣库存。
- 订单详情展示“销售 + 赠送”或“非销售出库”，明细显示正确类型。
- 历史订单单行修正为人工赠送后，库存流水不新增、不删除。
- 仪表盘默认正常销售口径不统计赠品 / 人工赠送。
- 仪表盘切到全部活动能看到运营活动成本和非经营出库成本。
- 导出订单 Excel，检查“订单明细”和“订单汇总”含 V1.6a 字段。
- 导出 JSON 备份，再导入，订单与非销售明细仍存在。

- [ ] **Step 3: 最终审查**

Review:

```powershell
git log --oneline -10
git diff --check
```

Expected:

- 每个任务有独立提交。
- `git diff --check` 无输出。

---

## 计划自检

- Spec 覆盖：
  - 明细级销售 / 非销售模型：Task 1。
  - 运营赠礼配置：Task 2。
  - 购物车混合明细：Task 3。
  - 订单保存、库存扣减、纯非销售订单：Task 4。
  - 订单详情与历史修正：Task 5。
  - 仪表盘口径：Task 6。
  - Excel 与 JSON 备份：Task 7。
  - UI、版本和发布记录：Task 8。
  - 全量验收：Task 9。

- 类型一致性：
  - 明细收入类型统一使用 `revenueType`。
  - 非销售原因统一使用 `nonSalesReason`。
  - 运营赠礼统一使用 `campaign_gift`。
  - 活动名称快照统一使用 `campaignNameSnapshot`。
  - 统计小计统一使用 `statisticalSubtotal`。
  - 优惠让利统一使用 `discountGiveawayAmount`。

- 实施边界：
  - 不接入外部平台关注验证。
  - 不接入支付 API。
  - 不做商品级退货 / 换货。
  - 不做云同步。
