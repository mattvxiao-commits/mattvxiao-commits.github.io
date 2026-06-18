# ECRM V1.5 成本、毛利与订单 Excel 导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ECRM 增加订单成本快照、毛利仪表盘和订单 Excel 导出能力，支持线下摆摊后的成本、利润、盘点和复盘。

**Architecture:** 先在订单领域层写入下单时成本快照，再升级本地数据库和 JSON 备份格式保持历史兼容。仪表盘只读取有成本快照的订单明细计算准确毛利，Excel 导出通过独立领域整理模块生成中文 sheet 数据，再由浏览器端工具模块写出 `.xlsx` 文件。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Dexie、file-saver、xlsx、IndexedDB、本地离线 PWA。

---

## 1. 范围与非目标

### 1.1 本计划实现

- V1.5a：新订单明细写入成本快照，订单详情展示成本/毛利，Dexie 升级到 version 3，JSON 备份升级到 version 4 并兼容旧版本。
- V1.5b：仪表盘增加成本、毛利、毛利率、赠品成本、SKU 毛利排行、SPU 毛利排行、低毛利 SKU、缺少成本快照提示。
- V1.5c：设置页增加订单 Excel 导出，导出真正 `.xlsx` 文件，包含订单汇总、订单明细、退款记录、库存流水、商品当前数据、导出说明 6 个 sheet。
- 每个子版本完成后新增中文交付记录。

### 1.2 本计划不实现

- 不做商品级退款、退货入库、换货、补差价、退差价。
- 不把人工退款拆分到 SKU/SPU 毛利。
- 不为旧订单伪造成本快照。
- 不做 GitHub/跨设备方案文档。
- 不做真实设备验收。
- 不做复杂拖拽仪表盘或复合收款二维码。

## 2. 文件结构

### 2.1 修改文件

- `src/domain/types.ts`
  - 扩展 `OrderItem`，新增 `unitCostSnapshot`、`costTotal`、`grossProfit` 可选字段。
- `src/domain/order.ts`
  - 在 `makeOrderItem()` 内从商品表读取成本价并写入成本快照。
- `src/domain/order.test.ts`
  - 增加普通商品、优惠加购、赠品、成本修改不影响已生成快照等测试。
- `src/db/db.ts`
  - Dexie 增加 version 3，store 索引不变。
- `src/utils/backup.ts`
  - `BACKUP_VERSION` 升级为 4。
  - 解析、校验、导入、导出支持 version 1/2/3/4。
  - 校验订单明细可选成本字段。
- `src/utils/backup.test.ts`
  - 覆盖 version 4 导出导入和旧版本兼容。
- `src/components/OrderDetailDialog.tsx`
  - 订单明细中显示成本、毛利或“缺少成本快照”。
- `src/components/OrderDetailDialog.test.tsx`
  - 覆盖成本显示和旧订单缺少快照提示。
- `src/domain/dashboard.ts`
  - 扩展 Dashboard 类型和 `buildDashboardModel()`，增加毛利模型。
- `src/domain/dashboard.test.ts`
  - 覆盖毛利概览、排行、低毛利、缺少快照、日期范围。
- `src/pages/DashboardPage.tsx`
  - 增加毛利相关 UI 模块。
- `src/pages/DashboardPage.test.tsx`
  - 覆盖页面展示和缺少快照提醒。
- `src/pages/SettingsPage.tsx`
  - 增加“表格导出”区块和“导出订单 Excel”按钮。
- `src/pages/SettingsPage.test.tsx`
  - 覆盖导出按钮调用、成功提示、失败提示。
- `package.json`
  - 增加 `xlsx` 依赖。
- `package-lock.json`
  - 安装依赖后自动更新。

### 2.2 新增文件

- `src/domain/orderExport.ts`
  - 纯函数，把订单、订单明细、退款、库存流水、商品整理为 6 个中文 sheet 的二维/对象数组数据。
- `src/domain/orderExport.test.ts`
  - 覆盖导出数据结构、中文表头、缺少成本快照、退款、库存流水、商品数据、导出说明。
- `src/utils/orderExcelExport.ts`
  - 调用 `xlsx` 生成工作簿，调用 `file-saver` 下载 `.xlsx` 文件。
- `src/utils/orderExcelExport.test.ts`
  - mock `xlsx` 和 `file-saver`，验证 sheet 生成和文件名。
- `docs/releases/2026-06-18-ecrm-v1-5a-cost-snapshot-delivery-record.md`
  - V1.5a 中文交付记录。
- `docs/releases/2026-06-18-ecrm-v1-5b-profit-dashboard-delivery-record.md`
  - V1.5b 中文交付记录。
- `docs/releases/2026-06-18-ecrm-v1-5c-order-excel-export-delivery-record.md`
  - V1.5c 中文交付记录。
- `docs/releases/2026-06-18-ecrm-v1-5-final-delivery-record.md`
  - V1.5 总体验证记录。

## 3. 执行规则

- 每个 Task 使用 TDD：先写失败测试，再实现，再运行聚焦测试，再提交。
- 子代理不得跨 Task 修改未授权范围。
- 每个实现 Task 完成后必须执行两轮审查：规格符合性审查、代码质量审查。
- 发现审查问题必须先修复并复审，不允许带问题进入下一 Task。
- 所有新增页面文案、文档和错误提示使用中文。
- 手工编辑文件使用 `apply_patch`。
- 不回滚用户或其他流程已有改动。

## 4. V1.5a Task 1：订单成本快照领域实现

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/order.ts`
- Test: `src/domain/order.test.ts`

- [ ] **Step 1: 写失败测试：普通商品写入成本快照**

在 `src/domain/order.test.ts` 的 `describe("buildPaidOrder", ...)` 内新增测试：

```ts
it("为普通订单明细写入下单时成本快照、成本小计和毛利", () => {
  const result = buildPaidOrder({
    products: [
      makeProduct({
        id: "product_badge",
        name: "徽章 A",
        spu: "徽章",
        costPrice: 8,
        salePrice: 20,
        stockQty: 10
      })
    ],
    calculated: makeCalculatedCart({
      lines: [
        makeCartLine({
          productId: "product_badge",
          productName: "徽章 A",
          spu: "徽章",
          quantity: 2,
          originalUnitPrice: 20,
          finalUnitPrice: 20,
          lineType: "normal",
          lineTotal: 40
        })
      ],
      subtotalBeforeDiscount: 40,
      payableAmount: 40
    }),
    promotion: makePromotion(),
    orderPrefix: "ECRM",
    paymentMethod: "wechat",
    now: "2026-06-18T10:00:00.000Z"
  });

  expect(result.orderItems[0]).toMatchObject({
    unitCostSnapshot: 8,
    costTotal: 16,
    grossProfit: 24
  });
});
```

- [ ] **Step 2: 写失败测试：优惠加购和赠品写入成本快照**

继续在同一 `describe` 内新增测试：

```ts
it("为优惠加购和赠品明细按成交小计计算毛利", () => {
  const result = buildPaidOrder({
    products: [
      makeProduct({
        id: "product_addon",
        name: "贴纸 A",
        spu: "贴纸",
        costPrice: 2,
        salePrice: 5,
        stockQty: 20
      }),
      makeProduct({
        id: "product_gift",
        name: "赠品卡 A",
        spu: "赠品卡",
        costPrice: 1.5,
        salePrice: 0,
        stockQty: 20,
        isSellable: false,
        isGiftEligible: true
      })
    ],
    calculated: makeCalculatedCart({
      lines: [
        makeCartLine({
          productId: "product_addon",
          productName: "贴纸 A",
          spu: "贴纸",
          quantity: 3,
          originalUnitPrice: 5,
          finalUnitPrice: 3,
          lineType: "discount_addon",
          lineTotal: 9
        })
      ],
      giftLines: [
        makeCartLine({
          productId: "product_gift",
          productName: "赠品卡 A",
          spu: "赠品卡",
          quantity: 2,
          originalUnitPrice: 0,
          finalUnitPrice: 0,
          lineType: "gift",
          lineTotal: 0
        })
      ],
      subtotalBeforeDiscount: 15,
      discountAmount: 6,
      payableAmount: 9
    }),
    promotion: makePromotion(),
    orderPrefix: "ECRM",
    paymentMethod: "cash",
    now: "2026-06-18T10:00:00.000Z"
  });

  expect(result.orderItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        productId: "product_addon",
        unitCostSnapshot: 2,
        costTotal: 6,
        grossProfit: 3
      }),
      expect.objectContaining({
        productId: "product_gift",
        unitCostSnapshot: 1.5,
        costTotal: 3,
        grossProfit: -3
      })
    ])
  );
});
```

- [ ] **Step 3: 写失败测试：已生成快照不受商品成本后续变化影响**

继续新增测试：

```ts
it("生成订单后商品成本变化不会改写已有订单明细快照", () => {
  const product = makeProduct({
    id: "product_print",
    name: "明信片 A",
    spu: "明信片",
    costPrice: 4,
    salePrice: 12,
    stockQty: 10
  });

  const result = buildPaidOrder({
    products: [product],
    calculated: makeCalculatedCart({
      lines: [
        makeCartLine({
          productId: "product_print",
          productName: "明信片 A",
          spu: "明信片",
          quantity: 1,
          originalUnitPrice: 12,
          finalUnitPrice: 12,
          lineType: "normal",
          lineTotal: 12
        })
      ],
      subtotalBeforeDiscount: 12,
      payableAmount: 12
    }),
    promotion: makePromotion(),
    orderPrefix: "ECRM",
    paymentMethod: "alipay",
    now: "2026-06-18T10:00:00.000Z"
  });

  product.costPrice = 9;

  expect(result.orderItems[0].unitCostSnapshot).toBe(4);
  expect(result.orderItems[0].costTotal).toBe(4);
  expect(result.orderItems[0].grossProfit).toBe(8);
});
```

- [ ] **Step 4: 运行失败测试**

Run:

```powershell
npm test -- src/domain/order.test.ts
```

Expected: FAIL，错误包含 `unitCostSnapshot` / `costTotal` / `grossProfit` 期望字段缺失。

- [ ] **Step 5: 扩展 `OrderItem` 类型**

在 `src/domain/types.ts` 的 `OrderItem` 增加：

```ts
  unitCostSnapshot?: number;
  costTotal?: number;
  grossProfit?: number;
```

- [ ] **Step 6: 实现订单成本快照**

在 `src/domain/order.ts` 修改 `makeOrderItem()`，核心实现如下：

```ts
function makeOrderItem(
  line: CalculatedCartLine,
  orderId: string,
  productById: Map<string, Product>
): OrderItem {
  const product = getProductForLine(line, productById);
  const unitCostSnapshot = product.costPrice;
  const costTotal = roundMoney(unitCostSnapshot * line.quantity);
  const grossProfit = roundMoney(line.lineTotal - costTotal);

  return {
    id: makeLineId(),
    orderId,
    productId: line.productId,
    productNameSnapshot: line.productName,
    spuSnapshot: line.spu,
    productCodeSnapshot: line.productCode,
    quantity: line.quantity,
    originalUnitPrice: line.originalUnitPrice,
    finalUnitPrice: line.finalUnitPrice,
    lineType: line.lineType,
    lineTotal: line.lineTotal,
    unitCostSnapshot,
    costTotal,
    grossProfit
  };
}
```

如果 `src/domain/order.ts` 尚无 `roundMoney()`，在 `makeOrderItem()` 前后增加本地函数：

```ts
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
```

- [ ] **Step 7: 运行聚焦测试**

Run:

```powershell
npm test -- src/domain/order.test.ts
```

Expected: PASS。

- [ ] **Step 8: 提交**

Run:

```powershell
git add src/domain/types.ts src/domain/order.ts src/domain/order.test.ts
git commit -m "feat: snapshot order item costs"
```

## 5. V1.5a Task 2：Dexie 与 JSON 备份 version 4

**Files:**
- Modify: `src/db/db.ts`
- Modify: `src/utils/backup.ts`
- Test: `src/utils/backup.test.ts`

- [ ] **Step 1: 写失败测试：导出 version 4 且保留成本字段**

在 `src/utils/backup.test.ts` 增加或扩展导出测试：

```ts
it("导出 version 4 备份并保留订单明细成本快照字段", async () => {
  const backup = await exportJsonBackup({
    products: [makeProduct({ id: "product_1", name: "徽章 A" })],
    images: [],
    settings: makeSettings(),
    orders: [makeOrder({ id: "order_1", orderNo: "ECRM-001" })],
    orderItems: [
      makeOrderItem({
        id: "line_1",
        orderId: "order_1",
        productId: "product_1",
        unitCostSnapshot: 8,
        costTotal: 16,
        grossProfit: 24
      })
    ],
    inventoryLogs: [],
    orderRefunds: []
  });

  const parsed = JSON.parse(backup.jsonText);
  expect(parsed.version).toBe(4);
  expect(parsed.orderItems[0]).toMatchObject({
    unitCostSnapshot: 8,
    costTotal: 16,
    grossProfit: 24
  });
});
```

实际 helper 名称必须沿用当前 `backup.test.ts` 已存在工厂函数；如果现有 `exportJsonBackup()` 入参不同，按当前测试模式传入同等数据。

- [ ] **Step 2: 写失败测试：导入 version 4 接受成本字段**

新增测试：

```ts
it("导入 version 4 备份时接受订单明细成本快照字段", async () => {
  const payload = makeBackupPayload({
    version: 4,
    orderItems: [
      makeOrderItem({
        id: "line_1",
        orderId: "order_1",
        productId: "product_1",
        unitCostSnapshot: 8,
        costTotal: 16,
        grossProfit: 24
      })
    ],
    orderRefunds: []
  });

  const result = await importJsonBackup(JSON.stringify(payload));

  expect(result.version).toBe(4);
  expect(result.orderItems[0]).toMatchObject({
    unitCostSnapshot: 8,
    costTotal: 16,
    grossProfit: 24
  });
});
```

- [ ] **Step 3: 写失败测试：旧版本缺少成本字段仍可导入**

新增测试：

```ts
it.each([1, 2, 3] as const)("导入 version %s 旧备份时不要求订单明细成本字段", async (version) => {
  const payload = makeBackupPayload({
    version,
    orderItems: [
      makeOrderItem({
        id: "line_legacy",
        orderId: "order_1",
        productId: "product_1",
        unitCostSnapshot: undefined,
        costTotal: undefined,
        grossProfit: undefined
      })
    ],
    orderRefunds: version >= 3 ? [] : undefined
  });

  const result = await importJsonBackup(JSON.stringify(payload));

  expect(result.orderItems[0].unitCostSnapshot).toBeUndefined();
  expect(result.orderItems[0].costTotal).toBeUndefined();
  expect(result.orderItems[0].grossProfit).toBeUndefined();
});
```

- [ ] **Step 4: 写失败测试：畸形成本字段被拒绝，version 5 被拒绝**

新增测试：

```ts
it("导入时拒绝非数字成本快照字段", async () => {
  const payload = makeBackupPayload({
    version: 4,
    orderItems: [
      {
        ...makeOrderItem({ id: "line_bad", orderId: "order_1", productId: "product_1" }),
        unitCostSnapshot: "8"
      }
    ],
    orderRefunds: []
  });

  await expect(importJsonBackup(JSON.stringify(payload))).rejects.toThrow("订单明细");
});

it("导入时拒绝未支持的备份版本", async () => {
  const payload = makeBackupPayload({
    version: 5,
    orderItems: [],
    orderRefunds: []
  });

  await expect(importJsonBackup(JSON.stringify(payload))).rejects.toThrow("备份版本");
});
```

- [ ] **Step 5: 运行失败测试**

Run:

```powershell
npm test -- src/utils/backup.test.ts
```

Expected: FAIL，version 4 解析或成本字段校验未支持。

- [ ] **Step 6: Dexie 升级到 version 3**

在 `src/db/db.ts` 构造函数中追加：

```ts
    this.version(3).stores({
      products: "id, spu, status, createdAt",
      productImages: "id, createdAt",
      settings: "id",
      orders: "id, orderNo, status, createdAt, paidAt",
      orderItems: "id, orderId, productId, lineType",
      inventoryLogs: "id, productId, orderId, createdAt",
      orderRefunds: "id, orderId, createdAt"
    });
```

- [ ] **Step 7: 备份版本升级为 4**

在 `src/utils/backup.ts`：

```ts
const BACKUP_VERSION = 4;
```

把所有 `1 | 2 | 3` 版本联合类型改为：

```ts
1 | 2 | 3 | 4
```

把解析判断改为接受 1、2、3、4：

```ts
if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== BACKUP_VERSION) {
  throw new Error("备份版本不受支持。");
}
```

- [ ] **Step 8: 校验订单明细可选成本字段**

在 `validateOrderItems()` 内对每条 item 增加可选数字校验：

```ts
validateOptionalNumber(item.unitCostSnapshot, `订单明细 ${index + 1} 的单位成本快照格式不正确。`);
validateOptionalNumber(item.costTotal, `订单明细 ${index + 1} 的成本小计格式不正确。`);
validateOptionalNumber(item.grossProfit, `订单明细 ${index + 1} 的毛利格式不正确。`);
```

如果 `backup.ts` 尚无 `validateOptionalNumber()`，新增：

```ts
function validateOptionalNumber(value: unknown, message: string): void {
  if (value !== undefined && typeof value !== "number") {
    throw new Error(message);
  }
}
```

- [ ] **Step 9: 运行聚焦测试**

Run:

```powershell
npm test -- src/utils/backup.test.ts
```

Expected: PASS。

- [ ] **Step 10: 提交**

Run:

```powershell
git add src/db/db.ts src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: support cost snapshot backups"
```

## 6. V1.5a Task 3：订单详情展示成本与毛利

**Files:**
- Modify: `src/components/OrderDetailDialog.tsx`
- Test: `src/components/OrderDetailDialog.test.tsx`

- [ ] **Step 1: 写失败测试：显示成本和毛利**

在 `src/components/OrderDetailDialog.test.tsx` 增加测试：

```ts
it("在订单明细中显示成本和毛利", () => {
  renderOrderDetailDialog({
    order: makeOrder({ id: "order_1", orderNo: "ECRM-001" }),
    orderItems: [
      makeOrderItem({
        id: "line_1",
        orderId: "order_1",
        productNameSnapshot: "徽章 A",
        quantity: 2,
        lineTotal: 40,
        unitCostSnapshot: 8,
        costTotal: 16,
        grossProfit: 24
      })
    ]
  });

  expect(screen.getByText("成本 ¥16.00")).toBeInTheDocument();
  expect(screen.getByText("毛利 ¥24.00")).toBeInTheDocument();
});
```

- [ ] **Step 2: 写失败测试：旧订单显示缺少成本快照**

新增测试：

```ts
it("旧订单明细缺少成本字段时显示缺少成本快照", () => {
  renderOrderDetailDialog({
    order: makeOrder({ id: "order_legacy", orderNo: "ECRM-OLD" }),
    orderItems: [
      makeOrderItem({
        id: "line_legacy",
        orderId: "order_legacy",
        productNameSnapshot: "旧商品",
        quantity: 1,
        lineTotal: 12,
        unitCostSnapshot: undefined,
        costTotal: undefined,
        grossProfit: undefined
      })
    ]
  });

  expect(screen.getByText("缺少成本快照")).toBeInTheDocument();
});
```

实际渲染 helper 名称按现有测试文件调整。

- [ ] **Step 3: 运行失败测试**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: FAIL，页面尚未显示成本/毛利。

- [ ] **Step 4: 实现展示**

在订单明细商品辅助信息处增加：

```tsx
{typeof item.costTotal === "number" && typeof item.grossProfit === "number" ? (
  <span className="order-detail-dialog__line-meta">
    成本 {formatCurrency(item.costTotal)} · 毛利 {formatCurrency(item.grossProfit)}
  </span>
) : (
  <span className="order-detail-dialog__line-meta order-detail-dialog__line-meta--warning">
    缺少成本快照
  </span>
)}
```

如果现有测试需要单独匹配“成本 ¥16.00”和“毛利 ¥24.00”，可拆成两个 `span`：

```tsx
<span>成本 {formatCurrency(item.costTotal)}</span>
<span>毛利 {formatCurrency(item.grossProfit)}</span>
```

- [ ] **Step 5: 运行聚焦测试**

Run:

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx
```

Expected: PASS。

- [ ] **Step 6: 提交**

Run:

```powershell
git add src/components/OrderDetailDialog.tsx src/components/OrderDetailDialog.test.tsx
git commit -m "feat: show order item cost snapshots"
```

## 7. V1.5a Task 4：V1.5a 中文交付记录

**Files:**
- Create: `docs/releases/2026-06-18-ecrm-v1-5a-cost-snapshot-delivery-record.md`

- [ ] **Step 1: 创建交付记录**

写入内容：

```md
# ECRM V1.5a 订单成本快照交付记录

## 交付范围

- 新订单明细已写入单位成本快照、成本小计和明细毛利。
- 普通商品、优惠加购、赠品均按下单时商品成本价生成快照。
- 旧订单不伪造成本快照，详情页显示“缺少成本快照”。
- Dexie 数据库升级到 version 3。
- JSON 备份升级到 version 4，并兼容 version 1、2、3 旧备份导入。

## 验证记录

- `npm test -- src/domain/order.test.ts`
- `npm test -- src/utils/backup.test.ts`
- `npm test -- src/components/OrderDetailDialog.test.tsx`

## 已知边界

- V1.5a 不计算仪表盘毛利汇总。
- V1.5a 不把人工退款拆分到商品明细。
- V1.5a 不为历史订单补写当前成本。
```

- [ ] **Step 2: 提交**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-5a-cost-snapshot-delivery-record.md
git commit -m "docs: record v1.5a cost snapshot delivery"
```

## 8. V1.5b Task 1：毛利仪表盘领域模型

**Files:**
- Modify: `src/domain/dashboard.ts`
- Test: `src/domain/dashboard.test.ts`

- [ ] **Step 1: 写失败测试：毛利概览**

在 `src/domain/dashboard.test.ts` 新增测试：

```ts
it("基于有成本快照的已支付订单明细计算毛利概览", () => {
  const model = buildDashboardModel({
    dateRange: buildDashboardDateRange("today", new Date("2026-06-18T12:00:00.000Z")),
    orders: [
      makeOrder({ id: "order_1", status: "paid", payableAmount: 40, paidAt: "2026-06-18T10:00:00.000Z" })
    ],
    orderItems: [
      makeOrderItem({ orderId: "order_1", productId: "sku_1", lineType: "normal", lineTotal: 40, quantity: 2, unitCostSnapshot: 8, costTotal: 16, grossProfit: 24 })
    ],
    refunds: [],
    products: []
  });

  expect(model.profitSummary).toMatchObject({
    revenueWithCostSnapshot: 40,
    costAmount: 16,
    grossProfit: 24,
    grossMargin: 60,
    giftCostAmount: 0,
    missingCostItemCount: 0,
    missingCostOrderCount: 0
  });
});
```

- [ ] **Step 2: 写失败测试：赠品成本降低毛利，旧订单不纳入准确毛利**

新增测试：

```ts
it("赠品成本降低毛利，并统计缺少成本快照的旧订单明细", () => {
  const model = buildDashboardModel({
    dateRange: buildDashboardDateRange("today", new Date("2026-06-18T12:00:00.000Z")),
    orders: [
      makeOrder({ id: "order_1", status: "paid", payableAmount: 40, paidAt: "2026-06-18T10:00:00.000Z" }),
      makeOrder({ id: "order_legacy", status: "paid", payableAmount: 12, paidAt: "2026-06-18T11:00:00.000Z" })
    ],
    orderItems: [
      makeOrderItem({ orderId: "order_1", productId: "sku_1", lineType: "normal", lineTotal: 40, quantity: 2, unitCostSnapshot: 8, costTotal: 16, grossProfit: 24 }),
      makeOrderItem({ orderId: "order_1", productId: "gift_1", lineType: "gift", lineTotal: 0, quantity: 1, unitCostSnapshot: 2, costTotal: 2, grossProfit: -2 }),
      makeOrderItem({ orderId: "order_legacy", productId: "sku_old", lineType: "normal", lineTotal: 12, quantity: 1 })
    ],
    refunds: [],
    products: []
  });

  expect(model.profitSummary).toMatchObject({
    revenueWithCostSnapshot: 40,
    costAmount: 18,
    grossProfit: 22,
    giftCostAmount: 2,
    missingCostItemCount: 1,
    missingCostOrderCount: 1
  });
});
```

- [ ] **Step 3: 写失败测试：SKU/SPU 毛利排行和低毛利 SKU**

新增测试：

```ts
it("生成 SKU 毛利排行、SPU 毛利排行和低毛利 SKU", () => {
  const model = buildDashboardModel({
    dateRange: buildDashboardDateRange("today", new Date("2026-06-18T12:00:00.000Z")),
    orders: [
      makeOrder({ id: "order_1", status: "paid", payableAmount: 125, paidAt: "2026-06-18T10:00:00.000Z" })
    ],
    orderItems: [
      makeOrderItem({ orderId: "order_1", productId: "sku_high", productNameSnapshot: "高毛利徽章", spuSnapshot: "徽章", productCodeSnapshot: "BADGE-H", lineType: "normal", quantity: 5, lineTotal: 100, unitCostSnapshot: 6, costTotal: 30, grossProfit: 70 }),
      makeOrderItem({ orderId: "order_1", productId: "sku_low", productNameSnapshot: "低毛利贴纸", spuSnapshot: "贴纸", productCodeSnapshot: "STICKER-L", lineType: "normal", quantity: 5, lineTotal: 25, unitCostSnapshot: 4.5, costTotal: 22.5, grossProfit: 2.5 })
    ],
    refunds: [],
    products: []
  });

  expect(model.profitSkuRows[0]).toMatchObject({
    productId: "sku_high",
    productName: "高毛利徽章",
    grossProfit: 70,
    grossMargin: 70
  });
  expect(model.profitSpuRows[0]).toMatchObject({
    spu: "徽章",
    grossProfit: 70,
    grossMargin: 70
  });
  expect(model.lowProfitSkuRows[0]).toMatchObject({
    productId: "sku_low",
    productName: "低毛利贴纸"
  });
});
```

- [ ] **Step 4: 运行失败测试**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected: FAIL，`profitSummary` 等字段未定义。

- [ ] **Step 5: 增加 Dashboard 类型**

在 `src/domain/dashboard.ts` 增加：

```ts
export type DashboardProfitSummary = {
  revenueWithCostSnapshot: number;
  costAmount: number;
  grossProfit: number;
  grossMargin: number;
  giftCostAmount: number;
  missingCostItemCount: number;
  missingCostOrderCount: number;
};

export type DashboardProfitSkuRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  quantity: number;
  revenue: number;
  costAmount: number;
  grossProfit: number;
  grossMargin: number;
};

export type DashboardProfitSpuRow = {
  spu: string;
  quantity: number;
  revenue: number;
  costAmount: number;
  grossProfit: number;
  grossMargin: number;
};
```

在 `DashboardModel` 增加：

```ts
  profitSummary: DashboardProfitSummary;
  profitSkuRows: DashboardProfitSkuRow[];
  profitSpuRows: DashboardProfitSpuRow[];
  lowProfitSkuRows: DashboardProfitSkuRow[];
```

- [ ] **Step 6: 实现毛利纯计算**

在 `src/domain/dashboard.ts` 增加 helper：

```ts
function hasCostSnapshot(item: OrderItem): item is OrderItem & {
  unitCostSnapshot: number;
  costTotal: number;
  grossProfit: number;
} {
  return (
    typeof item.unitCostSnapshot === "number" &&
    typeof item.costTotal === "number" &&
    typeof item.grossProfit === "number"
  );
}

function calculateGrossMargin(grossProfit: number, revenue: number): number {
  if (revenue === 0) {
    return 0;
  }

  return roundMoney((grossProfit / revenue) * 100);
}
```

实现 `buildProfitMetrics(rangePaidOrderIds, orderItems)`，规则：

- 只处理 `rangePaidOrderIds` 内的 item。
- 有成本快照才纳入准确毛利。
- `revenueWithCostSnapshot += item.lineTotal`。
- `costAmount += item.costTotal`。
- `grossProfit += item.grossProfit`。
- `giftCostAmount` 只累计 `lineType === "gift"` 的 `costTotal`。
- SKU/SPU 数量不含 `gift`。
- `missingCostItemCount` 统计范围内缺少成本字段的 item。
- `missingCostOrderCount` 对缺少成本字段的 item 按 `orderId` 去重。
- 排行 slice 5。

- [ ] **Step 7: 接入 `buildDashboardModel()`**

在 `buildDashboardModel()` 中：

```ts
const profitMetrics = buildProfitMetrics(rangePaidOrderIds, input.orderItems);
```

返回对象增加：

```ts
    profitSummary: profitMetrics.profitSummary,
    profitSkuRows: profitMetrics.profitSkuRows,
    profitSpuRows: profitMetrics.profitSpuRows,
    lowProfitSkuRows: profitMetrics.lowProfitSkuRows,
```

- [ ] **Step 8: 运行聚焦测试**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected: PASS。

- [ ] **Step 9: 提交**

Run:

```powershell
git add src/domain/dashboard.ts src/domain/dashboard.test.ts
git commit -m "feat: add dashboard profit metrics"
```

## 9. V1.5b Task 2：仪表盘页面展示毛利模块

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Test: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 写失败测试：展示毛利概览和缺少快照提示**

在 `src/pages/DashboardPage.test.tsx` 新增或扩展测试：

```ts
it("展示毛利概览、赠品成本和缺少成本快照提示", async () => {
  seedDashboardData({
    orders: [makeOrder({ id: "order_1", status: "paid", payableAmount: 40, paidAt: "2026-06-18T10:00:00.000Z" })],
    orderItems: [
      makeOrderItem({ orderId: "order_1", productId: "sku_1", lineTotal: 40, quantity: 2, unitCostSnapshot: 8, costTotal: 16, grossProfit: 24 }),
      makeOrderItem({ orderId: "order_1", productId: "gift_1", lineType: "gift", lineTotal: 0, quantity: 1, unitCostSnapshot: 2, costTotal: 2, grossProfit: -2 }),
      makeOrderItem({ orderId: "order_1", productId: "legacy_1", lineTotal: 5, quantity: 1 })
    ]
  });

  render(<DashboardPage />);

  expect(await screen.findByText("毛利概览")).toBeInTheDocument();
  expect(screen.getByText("成本")).toBeInTheDocument();
  expect(screen.getByText("毛利")).toBeInTheDocument();
  expect(screen.getByText("赠品成本")).toBeInTheDocument();
  expect(screen.getByText(/1 条旧订单明细缺少成本快照/)).toBeInTheDocument();
});
```

实际数据注入 helper 按当前测试文件写法调整。

- [ ] **Step 2: 写失败测试：展示 SKU/SPU 毛利排行和低毛利 SKU**

新增测试：

```ts
it("展示 SKU 毛利排行、SPU 毛利排行和低毛利 SKU", async () => {
  seedDashboardData({
    orders: [makeOrder({ id: "order_1", status: "paid", payableAmount: 125, paidAt: "2026-06-18T10:00:00.000Z" })],
    orderItems: [
      makeOrderItem({ orderId: "order_1", productId: "sku_high", productNameSnapshot: "高毛利徽章", spuSnapshot: "徽章", lineTotal: 100, quantity: 5, unitCostSnapshot: 6, costTotal: 30, grossProfit: 70 }),
      makeOrderItem({ orderId: "order_1", productId: "sku_low", productNameSnapshot: "低毛利贴纸", spuSnapshot: "贴纸", lineTotal: 25, quantity: 5, unitCostSnapshot: 4.5, costTotal: 22.5, grossProfit: 2.5 })
    ]
  });

  render(<DashboardPage />);

  expect(await screen.findByText("SKU 毛利排行")).toBeInTheDocument();
  expect(screen.getByText("SPU 毛利排行")).toBeInTheDocument();
  expect(screen.getByText("低毛利 SKU")).toBeInTheDocument();
  expect(screen.getByText("高毛利徽章")).toBeInTheDocument();
  expect(screen.getByText("低毛利贴纸")).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行失败测试**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected: FAIL，页面尚未展示毛利模块。

- [ ] **Step 4: 实现 UI**

在 `DashboardPage.tsx` 使用现有卡片/表格样式新增模块，文案：

- `毛利概览`
- `销售额（有成本快照）`
- `成本`
- `毛利`
- `毛利率`
- `赠品成本`
- `当前范围有 X 条旧订单明细缺少成本快照，未纳入准确毛利。`
- `SKU 毛利排行`
- `SPU 毛利排行`
- `低毛利 SKU`

金额使用现有 `formatCurrency()`，百分比使用：

```ts
function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}
```

UI 密度要求：

- 不新增大 hero。
- 不使用大面积装饰卡。
- 排行列表复用已有仪表盘紧凑表格/列表样式。
- 空数据时显示短文案：`暂无可统计数据`。

- [ ] **Step 5: 运行聚焦测试**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected: PASS。

- [ ] **Step 6: 提交**

Run:

```powershell
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m "feat: show dashboard profit metrics"
```

## 10. V1.5b Task 3：V1.5b 中文交付记录

**Files:**
- Create: `docs/releases/2026-06-18-ecrm-v1-5b-profit-dashboard-delivery-record.md`

- [ ] **Step 1: 创建交付记录**

写入内容：

```md
# ECRM V1.5b 毛利仪表盘交付记录

## 交付范围

- 仪表盘新增毛利概览，展示销售额（有成本快照）、成本、毛利、毛利率和赠品成本。
- 新增 SKU 毛利排行、SPU 毛利排行和低毛利 SKU。
- 缺少成本快照的旧订单明细不会纳入准确毛利，并在页面显示提示。
- 毛利统计沿用仪表盘时间范围：今日、昨天、近 3 天、近 7 天、自定义日期。

## 统计口径

- 只统计当前范围内状态为已支付的订单明细。
- 赠品成本计入成本，赠品明细毛利可为负数。
- 人工退款仍为订单级记录，V1.5b 不拆分到商品级毛利。

## 验证记录

- `npm test -- src/domain/dashboard.test.ts`
- `npm test -- src/pages/DashboardPage.test.tsx`
```

- [ ] **Step 2: 提交**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-5b-profit-dashboard-delivery-record.md
git commit -m "docs: record v1.5b profit dashboard delivery"
```

## 11. V1.5c Task 1：订单 Excel 导出数据整理

**Files:**
- Create: `src/domain/orderExport.ts`
- Test: `src/domain/orderExport.test.ts`

- [ ] **Step 1: 写失败测试：生成 6 个 sheet**

创建 `src/domain/orderExport.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { buildOrderExportSheets } from "./orderExport";
import type { InventoryLog, Order, OrderItem, OrderRefund, Product } from "./types";

const exportedAt = "2026-06-18T12:00:00.000Z";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order_1",
    orderNo: "ECRM-001",
    status: "paid",
    paymentMethod: "wechat",
    subtotalBeforeDiscount: 40,
    discountAmount: 0,
    payableAmount: 40,
    promotionSnapshot: { enabled: true, addonDiscount: { enabled: false, discountSpu: "", discountPrice: 0, maxDiscountQty: 0 }, giftTiers: [] },
    giftStockWarning: false,
    createdAt: "2026-06-18T10:00:00.000Z",
    paidAt: "2026-06-18T10:00:00.000Z",
    ...overrides
  };
}

function makeOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "line_1",
    orderId: "order_1",
    productId: "product_1",
    productNameSnapshot: "徽章 A",
    spuSnapshot: "徽章",
    productCodeSnapshot: "BADGE-A",
    quantity: 2,
    originalUnitPrice: 20,
    finalUnitPrice: 20,
    lineType: "normal",
    lineTotal: 40,
    unitCostSnapshot: 8,
    costTotal: 16,
    grossProfit: 24,
    ...overrides
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product_1",
    name: "徽章 A",
    spu: "徽章",
    spuCode: "BADGE",
    skuCode: "A",
    productCode: "BADGE-A",
    costPrice: 8,
    salePrice: 20,
    stockQty: 8,
    isSellable: true,
    isGiftEligible: true,
    status: "active",
    createdAt: "2026-06-18T09:00:00.000Z",
    updatedAt: "2026-06-18T09:00:00.000Z",
    ...overrides
  };
}

describe("buildOrderExportSheets", () => {
  it("生成订单导出所需的 6 个中文 sheet", () => {
    const sheets = buildOrderExportSheets({
      orders: [makeOrder()],
      orderItems: [makeOrderItem()],
      refunds: [],
      inventoryLogs: [],
      products: [makeProduct()],
      exportedAt,
      appVersion: "0.1.0"
    });

    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "订单汇总",
      "订单明细",
      "退款记录",
      "库存流水",
      "商品当前数据",
      "导出说明"
    ]);
    expect(sheets[0].rows[0]).toMatchObject({
      订单编号: "ECRM-001",
      订单状态: "已支付",
      支付方式: "微信",
      应收金额: 40,
      实收估算: 40
    });
  });
});
```

- [ ] **Step 2: 写失败测试：订单明细缺少成本快照导出为空值和“是”**

继续新增：

```ts
it("订单明细缺少成本快照时导出空成本字段和缺失标记", () => {
  const sheets = buildOrderExportSheets({
    orders: [makeOrder()],
    orderItems: [
      makeOrderItem({
        unitCostSnapshot: undefined,
        costTotal: undefined,
        grossProfit: undefined
      })
    ],
    refunds: [],
    inventoryLogs: [],
    products: [makeProduct()],
    exportedAt,
    appVersion: "0.1.0"
  });

  expect(sheets[1].rows[0]).toMatchObject({
    单位成本快照: "",
    成本小计: "",
    毛利: "",
    毛利率: "",
    是否缺少成本快照: "是"
  });
});
```

- [ ] **Step 3: 写失败测试：退款、库存流水、商品当前数据**

继续新增：

```ts
it("导出退款记录、库存流水和商品当前数据", () => {
  const refund: OrderRefund = {
    id: "refund_1",
    orderId: "order_1",
    amount: 5,
    method: "cash",
    reason: "customer_return",
    note: "顾客退差价",
    createdAt: "2026-06-18T11:00:00.000Z"
  };
  const inventoryLog: InventoryLog = {
    id: "log_1",
    productId: "product_1",
    orderId: "order_1",
    changeQty: -2,
    reason: "order_paid",
    beforeQty: 10,
    afterQty: 8,
    createdAt: "2026-06-18T10:00:00.000Z"
  };

  const sheets = buildOrderExportSheets({
    orders: [makeOrder()],
    orderItems: [makeOrderItem()],
    refunds: [refund],
    inventoryLogs: [inventoryLog],
    products: [makeProduct()],
    exportedAt,
    appVersion: "0.1.0"
  });

  expect(sheets[2].rows[0]).toMatchObject({
    订单编号: "ECRM-001",
    退款金额: 5,
    退款方式: "现金",
    退款原因: "顾客退货"
  });
  expect(sheets[3].rows[0]).toMatchObject({
    商品名称: "徽章 A",
    商品编码: "BADGE-A",
    变动数量: -2,
    变动原因: "订单扣减"
  });
  expect(sheets[4].rows[0]).toMatchObject({
    商品ID: "product_1",
    商品名称: "徽章 A",
    完整商品编码: "BADGE-A",
    当前库存: 8,
    是否可售: "是"
  });
});
```

- [ ] **Step 4: 运行失败测试**

Run:

```powershell
npm test -- src/domain/orderExport.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 5: 实现 `orderExport.ts`**

创建 `src/domain/orderExport.ts`，导出：

```ts
import type { InventoryLog, Order, OrderItem, OrderRefund, PaymentMethod, Product } from "./types";

export type OrderExportSheet = {
  name: string;
  rows: Record<string, string | number>[];
};

export type BuildOrderExportSheetsInput = {
  orders: Order[];
  orderItems: OrderItem[];
  refunds: OrderRefund[];
  inventoryLogs: InventoryLog[];
  products: Product[];
  exportedAt: string;
  appVersion: string;
};

export function buildOrderExportSheets(input: BuildOrderExportSheetsInput): OrderExportSheet[] {
  const ordersById = new Map(input.orders.map((order) => [order.id, order]));
  const productsById = new Map(input.products.map((product) => [product.id, product]));
  const refundTotalByOrder = sumRefundsByOrder(input.refunds);

  return [
    { name: "订单汇总", rows: buildOrderSummaryRows(input.orders, refundTotalByOrder) },
    { name: "订单明细", rows: buildOrderItemRows(input.orderItems, ordersById) },
    { name: "退款记录", rows: buildRefundRows(input.refunds, ordersById) },
    { name: "库存流水", rows: buildInventoryRows(input.inventoryLogs, ordersById, productsById) },
    { name: "商品当前数据", rows: buildProductRows(input.products) },
    { name: "导出说明", rows: buildExportNotes(input.exportedAt, input.appVersion) }
  ];
}
```

实现以下中文 label：

```ts
const paymentMethodLabels: Record<PaymentMethod, string> = {
  wechat: "微信",
  alipay: "支付宝",
  cash: "现金",
  other: "其他"
};

const orderStatusLabels = {
  pending_payment: "待支付",
  paid: "已支付",
  cancelled: "已作废"
} as const;

const lineTypeLabels = {
  normal: "普通",
  discount_addon: "优惠加购",
  gift: "赠品"
} as const;

const refundReasonLabels = {
  customer_return: "顾客退货",
  overcharge: "多收退款",
  product_issue: "商品问题",
  manual_adjustment: "人工调整",
  other: "其他"
} as const;

const inventoryReasonLabels = {
  order_paid: "订单扣减",
  gift_order_paid: "赠品扣减",
  order_cancelled_rollback: "作废回滚",
  manual_adjust: "人工调整"
} as const;
```

关键规则：

- `实收估算 = order.payableAmount - refundTotal`。
- 明细毛利率 = `grossProfit / lineTotal * 100`，`lineTotal` 为 0 时为 0。
- 缺少成本快照时成本字段为空字符串，`是否缺少成本快照 = "是"`。
- 库存流水商品缺失时 `商品名称 = "商品不存在"`。
- 导出说明 rows 至少包含：
  - `导出时间`
  - `系统版本`
  - `文件用途`
  - `恢复说明`
  - `成本快照说明`
  - `人工退款说明`

- [ ] **Step 6: 运行聚焦测试**

Run:

```powershell
npm test -- src/domain/orderExport.test.ts
```

Expected: PASS。

- [ ] **Step 7: 提交**

Run:

```powershell
git add src/domain/orderExport.ts src/domain/orderExport.test.ts
git commit -m "feat: build order export sheets"
```

## 12. V1.5c Task 2：Excel 文件生成工具

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/utils/orderExcelExport.ts`
- Test: `src/utils/orderExcelExport.test.ts`

- [ ] **Step 1: 安装依赖**

Run:

```powershell
npm install xlsx
```

Expected: `package.json` 和 `package-lock.json` 更新。

- [ ] **Step 2: 写失败测试：生成 workbook 并保存文件**

创建 `src/utils/orderExcelExport.test.ts`：

```ts
import { describe, expect, it, vi } from "vitest";
import { exportOrderExcel } from "./orderExcelExport";

const bookNew = vi.fn(() => ({ SheetNames: [], Sheets: {} }));
const jsonToSheet = vi.fn((rows) => ({ rows }));
const bookAppendSheet = vi.fn();
const write = vi.fn(() => new ArrayBuffer(8));
const saveAs = vi.fn();

vi.mock("xlsx", () => ({
  utils: {
    book_new: bookNew,
    json_to_sheet: jsonToSheet,
    book_append_sheet: bookAppendSheet
  },
  write
}));

vi.mock("file-saver", () => ({
  saveAs
}));

describe("exportOrderExcel", () => {
  it("把订单导出 sheet 写入 xlsx 并保存文件", () => {
    exportOrderExcel({
      sheets: [
        { name: "订单汇总", rows: [{ 订单编号: "ECRM-001" }] },
        { name: "订单明细", rows: [{ 商品名称: "徽章 A" }] }
      ],
      exportedAt: "2026-06-18T12:00:00.000Z"
    });

    expect(bookNew).toHaveBeenCalled();
    expect(jsonToSheet).toHaveBeenCalledTimes(2);
    expect(bookAppendSheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), "订单汇总");
    expect(bookAppendSheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), "订单明细");
    expect(write).toHaveBeenCalledWith(expect.anything(), { bookType: "xlsx", type: "array" });
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "ecrm-orders-2026-06-18.xlsx");
  });
});
```

- [ ] **Step 3: 运行失败测试**

Run:

```powershell
npm test -- src/utils/orderExcelExport.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 4: 实现 `orderExcelExport.ts`**

创建：

```ts
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import type { OrderExportSheet } from "../domain/orderExport";

export type ExportOrderExcelInput = {
  sheets: OrderExportSheet[];
  exportedAt: string;
};

export function exportOrderExcel(input: ExportOrderExcelInput): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of input.sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const workbookArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([workbookArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  saveAs(blob, `ecrm-orders-${formatDateForFilename(input.exportedAt)}.xlsx`);
}

function formatDateForFilename(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 5: 运行聚焦测试**

Run:

```powershell
npm test -- src/utils/orderExcelExport.test.ts
```

Expected: PASS。

- [ ] **Step 6: 提交**

Run:

```powershell
git add package.json package-lock.json src/utils/orderExcelExport.ts src/utils/orderExcelExport.test.ts
git commit -m "feat: export order workbook"
```

## 13. V1.5c Task 3：设置页增加订单 Excel 导出入口

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Test: `src/pages/SettingsPage.test.tsx`

- [ ] **Step 1: 写失败测试：显示表格导出区块**

在 `src/pages/SettingsPage.test.tsx` 新增：

```ts
it("显示订单 Excel 表格导出入口和用途说明", async () => {
  render(<SettingsPage />);

  expect(await screen.findByText("表格导出")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导出订单 Excel" })).toBeInTheDocument();
  expect(screen.getByText(/Excel 用于统计、盘点和复盘，不能用于恢复系统数据/)).toBeInTheDocument();
});
```

- [ ] **Step 2: 写失败测试：点击按钮调用导出**

新增 mock 和测试：

```ts
const exportOrderExcel = vi.fn();

vi.mock("../utils/orderExcelExport", () => ({
  exportOrderExcel
}));

it("点击导出订单 Excel 时生成并下载订单工作簿", async () => {
  seedSettingsPageData({
    orders: [makeOrder({ id: "order_1", orderNo: "ECRM-001" })],
    orderItems: [makeOrderItem({ orderId: "order_1" })],
    refunds: [],
    inventoryLogs: [],
    products: [makeProduct({ id: "product_1" })]
  });

  render(<SettingsPage />);

  await userEvent.click(await screen.findByRole("button", { name: "导出订单 Excel" }));

  expect(exportOrderExcel).toHaveBeenCalledWith(
    expect.objectContaining({
      sheets: expect.arrayContaining([expect.objectContaining({ name: "订单汇总" })]),
      exportedAt: expect.any(String)
    })
  );
  expect(screen.getByText("订单 Excel 已导出。")).toBeInTheDocument();
});
```

实际 mock 位置必须放在文件顶部，helper 名称按当前测试文件已有模式调整。

- [ ] **Step 3: 写失败测试：导出失败显示中文错误**

新增：

```ts
it("订单 Excel 导出失败时显示中文错误", async () => {
  exportOrderExcel.mockImplementationOnce(() => {
    throw new Error("raw stack should not be shown");
  });

  render(<SettingsPage />);

  await userEvent.click(await screen.findByRole("button", { name: "导出订单 Excel" }));

  expect(screen.getByText("订单 Excel 导出失败，请稍后重试。")).toBeInTheDocument();
  expect(screen.queryByText(/raw stack/)).not.toBeInTheDocument();
});
```

- [ ] **Step 4: 运行失败测试**

Run:

```powershell
npm test -- src/pages/SettingsPage.test.tsx
```

Expected: FAIL，按钮和导出逻辑尚不存在。

- [ ] **Step 5: 实现页面入口**

在 `SettingsPage.tsx`：

```ts
import { buildOrderExportSheets } from "../domain/orderExport";
import { exportOrderExcel } from "../utils/orderExcelExport";
```

新增状态：

```ts
const [excelExportMessage, setExcelExportMessage] = useState<string | null>(null);
const [excelExportError, setExcelExportError] = useState<string | null>(null);
```

新增 handler：

```ts
async function handleExportOrderExcel(): Promise<void> {
  setExcelExportMessage(null);
  setExcelExportError(null);

  try {
    const exportedAt = new Date().toISOString();
    const sheets = buildOrderExportSheets({
      orders,
      orderItems,
      refunds: orderRefunds,
      inventoryLogs,
      products,
      exportedAt,
      appVersion: "0.1.0"
    });

    exportOrderExcel({ sheets, exportedAt });
    setExcelExportMessage("订单 Excel 已导出。");
  } catch {
    setExcelExportError("订单 Excel 导出失败，请稍后重试。");
  }
}
```

其中 `orders`、`orderItems`、`orderRefunds`、`inventoryLogs`、`products` 应使用设置页当前 store selector 或已有加载数据；如果设置页尚未取全量订单数据，按现有 Zustand/Dexie 模式增加 selector 或加载调用。

新增区块文案：

```tsx
<section className="settings-section">
  <div className="settings-section__header">
    <h2>表格导出</h2>
    <p>Excel 用于统计、盘点和复盘，不能用于恢复系统数据。恢复数据请使用 JSON 备份。</p>
  </div>
  <button type="button" className="button button--secondary" onClick={handleExportOrderExcel}>
    导出订单 Excel
  </button>
  {excelExportMessage ? <p className="settings-page__success">{excelExportMessage}</p> : null}
  {excelExportError ? <p className="settings-page__error">{excelExportError}</p> : null}
</section>
```

样式复用现有设置页区块，不新增大面积 UI。

- [ ] **Step 6: 运行聚焦测试**

Run:

```powershell
npm test -- src/pages/SettingsPage.test.tsx
```

Expected: PASS。

- [ ] **Step 7: 提交**

Run:

```powershell
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.test.tsx
git commit -m "feat: add order excel export action"
```

## 14. V1.5c Task 4：V1.5c 中文交付记录

**Files:**
- Create: `docs/releases/2026-06-18-ecrm-v1-5c-order-excel-export-delivery-record.md`

- [ ] **Step 1: 创建交付记录**

写入内容：

```md
# ECRM V1.5c 订单 Excel 导出交付记录

## 交付范围

- 设置页新增“表格导出”区块。
- 新增“导出订单 Excel”按钮。
- 导出 `.xlsx` 文件，文件名格式为 `ecrm-orders-YYYY-MM-DD.xlsx`。
- 工作簿包含 6 个 sheet：订单汇总、订单明细、退款记录、库存流水、商品当前数据、导出说明。
- Excel 导出用于统计、盘点和复盘，不能用于恢复系统数据。

## 成本与退款口径

- 订单明细导出成本快照、成本小计、毛利和毛利率。
- 旧订单缺少成本快照时，成本与毛利字段留空，并标记“是否缺少成本快照=是”。
- 人工退款按订单级记录导出，不拆分到 SKU/SPU。

## 验证记录

- `npm test -- src/domain/orderExport.test.ts`
- `npm test -- src/utils/orderExcelExport.test.ts`
- `npm test -- src/pages/SettingsPage.test.tsx`
```

- [ ] **Step 2: 提交**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-5c-order-excel-export-delivery-record.md
git commit -m "docs: record v1.5c order excel export delivery"
```

## 15. V1.5 Final：总体验证与交付记录

**Files:**
- Create: `docs/releases/2026-06-18-ecrm-v1-5-final-delivery-record.md`

- [ ] **Step 1: 全量测试**

Run:

```powershell
npm test
```

Expected: PASS。

- [ ] **Step 2: 生产构建**

Run:

```powershell
npm run build
```

Expected: PASS。

- [ ] **Step 3: 空白检查**

Run:

```powershell
git diff --check
```

Expected: no output，exit code 0。

- [ ] **Step 4: 检查工作区**

Run:

```powershell
git status --short
```

Expected: 只有未提交的 final 交付记录，或完全干净。

- [ ] **Step 5: 创建 V1.5 final 交付记录**

写入 `docs/releases/2026-06-18-ecrm-v1-5-final-delivery-record.md`：

```md
# ECRM V1.5 Final 交付记录

## 版本范围

- V1.5a：订单成本快照。
- V1.5b：毛利与成本仪表盘。
- V1.5c：订单 Excel 导出。

## 已完成能力

- 新订单下单时写入单位成本快照、成本小计和明细毛利。
- 订单详情可查看明细成本和毛利，旧订单提示缺少成本快照。
- 仪表盘可按日期范围查看成本、毛利、毛利率、赠品成本、SKU/SPU 毛利排行和低毛利 SKU。
- 设置页可导出订单 Excel，支持订单汇总、订单明细、退款记录、库存流水、商品当前数据和导出说明。
- JSON 备份升级到 version 4，继续兼容旧版本导入。

## 验证记录

- `npm test`
- `npm run build`
- `git diff --check`

## 仍不包含

- 商品级退款、退货入库、换货、补差价。
- 退款按 SKU/SPU 精确拆分毛利。
- GitHub/跨设备方案文档。
- 真实设备验收。

## 下一步建议

1. 用户验收 V1.5a/b/c 核心流程。
2. 合并 `feature/ecrm-mvp` 到基线分支。
3. 创建正式版本 tag：`v1.5.0`。
4. 开始 GitHub/跨设备方案中文文档。
5. 进行 Windows、Mac、iPad 真实设备验收。
```

- [ ] **Step 6: 提交 final 记录**

Run:

```powershell
git add docs/releases/2026-06-18-ecrm-v1-5-final-delivery-record.md
git commit -m "docs: record v1.5 final delivery"
```

## 16. 自审清单

- [ ] 计划覆盖 V1.5a 成本快照、备份兼容、订单详情展示。
- [ ] 计划覆盖 V1.5b 毛利概览、排行、低毛利和缺少快照提示。
- [ ] 计划覆盖 V1.5c Excel 导出数据整理、文件生成和设置页入口。
- [ ] 所有用户可见文案为中文。
- [ ] 旧订单缺少成本快照不会被当前成本伪造。
- [ ] 人工退款不拆分到商品级毛利。
- [ ] Excel 明确不是备份恢复文件。
- [ ] 每个开发 Task 有失败测试、实现、验证和提交步骤。
- [ ] 最终验证包含 `npm test`、`npm run build`、`git diff --check`。
