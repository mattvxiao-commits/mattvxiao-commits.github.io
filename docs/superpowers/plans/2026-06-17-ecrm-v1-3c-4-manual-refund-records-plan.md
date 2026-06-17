# ECRM V1.3c-4 人工退款记录实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务执行。步骤使用 checkbox（`- [ ]`）语法跟踪。

**目标：** 新增线下人工退款记录能力，让已支付/已作废订单可以记录退款金额、方式、原因、备注，并在订单详情、订单列表和备份中完整保留。

**架构：** 新增 `OrderRefund` 独立表，不改变订单主状态，不改变库存流水，不新增订单调整表。数据层负责校验累计退款金额；备份层升级到版本 3 并兼容版本 1/2；UI 层只负责展示、录入和刷新退款记录。

**技术栈：** React 19、TypeScript、Dexie、Vitest、Testing Library、Vite。

---

## 文件结构

- 修改 `src/domain/types.ts`
  - 新增 `RefundReason`。
  - 新增 `OrderRefund`。
- 修改 `src/db/db.ts`
  - 新增 `orderRefunds!: Table<OrderRefund, string>`。
  - 新增 Dexie `version(2)`，保留旧表并加入 `orderRefunds`。
- 修改 `src/db/repositories.ts`
  - 新增 `SaveOrderRefundInput`。
  - 新增 `saveOrderRefund`、`listOrderRefunds`、`listRefunds`。
  - `clearAllData` 覆盖 `orderRefunds`。
- 修改 `src/db/repositories.test.ts`
  - 增加人工退款 repository 测试。
  - 清库逻辑加入 `db.orderRefunds`。
- 修改 `src/utils/backup.ts`
  - 备份版本升级到 3。
  - `BackupData` 增加 `orderRefunds`。
  - 导出/导入/替换事务覆盖 `orderRefunds`。
  - 版本 1/2 导入时 `orderRefunds` 默认空数组。
- 修改 `src/utils/backup.test.ts`
  - 增加版本 3 导入导出退款记录测试。
  - 更新旧的“不支持版本 3”测试。
- 修改 `src/domain/orderHistory.ts`
  - 新增退款标识输入和退款标签规则。
- 修改 `src/domain/orderHistory.test.ts`
  - 覆盖部分退款/已退款标识。
- 修改 `src/components/OrderDetailDialog.tsx`
  - 新增退款记录展示。
  - 新增记录退款弹窗。
- 修改 `src/components/OrderDetailDialog.test.tsx`
  - 覆盖退款记录展示、按钮显示、表单校验和提交。
- 修改 `src/pages/SalesPage.tsx`
  - 加载全部退款记录。
  - 打开订单详情时加载当前订单退款记录。
  - 保存退款后刷新详情、订单列表和退款列表。
- 修改 `src/pages/SalesPage.test.tsx`
  - mock 新 repository 函数。
  - 覆盖页面保存退款、错误提示和订单列表退款标识。
- 修改 `src/styles.css`
  - 增加退款记录列表和弹窗的紧凑样式。

---

## Task 1：数据模型、Dexie 表与 Repository

**文件：**

- 修改：`src/domain/types.ts`
- 修改：`src/db/db.ts`
- 修改：`src/db/repositories.ts`
- 修改：`src/db/repositories.test.ts`

- [ ] **Step 1：先写 failing repository tests**

在 `src/db/repositories.test.ts` 的 import 中加入新函数和类型：

```ts
import {
  listInventoryLogsForOrder,
  listOrderRefunds,
  listRefunds,
  saveOrderRefund,
  savePaidOrder,
  voidPaidOrder
} from "./repositories";
import type { InventoryLog, Order, OrderItem, OrderRefund, Product } from "../domain/types";
```

把 `clearDb` 的事务表和清理列表加入 `db.orderRefunds`。

新增测试：

```ts
describe("order refunds", () => {
  test("saves a manual refund for a paid order", async () => {
    const refundedAt = "2026-06-17T12:00:00.000Z";
    await db.orders.put(paidOrder());

    await expect(
      saveOrderRefund(
        {
          orderId: "order-1",
          amount: 8.235,
          method: "wechat",
          reason: "customer_return",
          note: " 客户退回。 "
        },
        new Date(refundedAt)
      )
    ).resolves.toEqual(
      expect.objectContaining({
        orderId: "order-1",
        amount: 8.24,
        method: "wechat",
        reason: "customer_return",
        note: "客户退回。",
        createdAt: refundedAt
      })
    );

    await expect(db.orderRefunds.toArray()).resolves.toEqual([
      expect.objectContaining({ orderId: "order-1", amount: 8.24 })
    ]);
  });

  test("saves a manual refund for a cancelled order", async () => {
    await db.orders.put({ ...paidOrder(), status: "cancelled", cancelledAt: "2026-06-17T10:00:00.000Z" });

    await expect(
      saveOrderRefund({
        orderId: "order-1",
        amount: 20,
        method: "cash",
        reason: "manual_adjustment"
      })
    ).resolves.toEqual(expect.objectContaining({ orderId: "order-1", amount: 20 }));
  });

  test("rejects refunding a pending payment order", async () => {
    await db.orders.put({ ...paidOrder(), status: "pending_payment", paidAt: undefined, paymentMethod: undefined });

    await expect(
      saveOrderRefund({
        orderId: "order-1",
        amount: 1,
        method: "cash",
        reason: "customer_return"
      })
    ).rejects.toThrow("待支付订单不能记录退款。");
  });

  test("rejects refunding a missing order", async () => {
    await expect(
      saveOrderRefund({
        orderId: "missing-order",
        amount: 1,
        method: "cash",
        reason: "customer_return"
      })
    ).rejects.toThrow("订单不存在，无法记录退款。");
  });

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid refund amount %s", async (amount) => {
    await db.orders.put(paidOrder());

    await expect(
      saveOrderRefund({
        orderId: "order-1",
        amount,
        method: "cash",
        reason: "customer_return"
      })
    ).rejects.toThrow("退款金额必须大于 0。");
  });

  test("rejects refunds above remaining refundable amount", async () => {
    await db.orders.put(paidOrder());
    await db.orderRefunds.put({
      id: "refund-existing",
      orderId: "order-1",
      amount: 15,
      method: "cash",
      reason: "customer_return",
      createdAt: "2026-06-17T11:00:00.000Z"
    });

    await expect(
      saveOrderRefund({
        orderId: "order-1",
        amount: 5.01,
        method: "cash",
        reason: "customer_return"
      })
    ).rejects.toThrow("退款金额不能超过订单剩余可退金额。");
  });

  test("lists refunds sorted by created time", async () => {
    const refunds: OrderRefund[] = [
      {
        id: "refund-late",
        orderId: "order-1",
        amount: 2,
        method: "cash",
        reason: "other",
        createdAt: "2026-06-17T12:00:00.000Z"
      },
      {
        id: "refund-other",
        orderId: "order-2",
        amount: 3,
        method: "cash",
        reason: "other",
        createdAt: "2026-06-17T10:00:00.000Z"
      },
      {
        id: "refund-early",
        orderId: "order-1",
        amount: 1,
        method: "wechat",
        reason: "customer_return",
        createdAt: "2026-06-17T09:00:00.000Z"
      }
    ];
    await db.orderRefunds.bulkPut(refunds);

    await expect(listOrderRefunds("order-1")).resolves.toEqual([
      expect.objectContaining({ id: "refund-early" }),
      expect.objectContaining({ id: "refund-late" })
    ]);
    await expect(listRefunds()).resolves.toEqual([
      expect.objectContaining({ id: "refund-early" }),
      expect.objectContaining({ id: "refund-other" }),
      expect.objectContaining({ id: "refund-late" })
    ]);
  });
});
```

- [ ] **Step 2：运行测试确认 RED**

```powershell
npm test -- src/db/repositories.test.ts
```

预期：失败，原因是 `db.orderRefunds`、`saveOrderRefund`、`listOrderRefunds`、`listRefunds`、`OrderRefund` 尚不存在。

- [ ] **Step 3：实现类型**

在 `src/domain/types.ts` 中 `PaymentMethod` 后新增：

```ts
export type RefundReason =
  | "customer_return"
  | "overcharge"
  | "product_issue"
  | "manual_adjustment"
  | "other";
```

在 `Order` 后新增：

```ts
export type OrderRefund = {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reason: RefundReason;
  note?: string;
  createdAt: string;
};
```

- [ ] **Step 4：实现 Dexie 表**

在 `src/db/db.ts` 的类型 import 中加入 `OrderRefund`。

在 `EcrmDatabase` class 中加入：

```ts
orderRefunds!: Table<OrderRefund, string>;
```

保留现有 `version(1)`，再追加：

```ts
this.version(2).stores({
  products:
    "id, spu, name, status, salePrice, stockQty, isSellable, isGiftEligible, createdAt, [status+isSellable], [status+isGiftEligible]",
  images: "id, createdAt",
  settings: "id",
  orders: "id, &orderNo, status, createdAt, paidAt, [status+paidAt]",
  orderItems: "id, orderId, productId, lineType",
  inventoryLogs: "id, productId, orderId, createdAt",
  orderRefunds: "id, orderId, createdAt"
});
```

- [ ] **Step 5：实现 repository 函数**

在 `src/db/repositories.ts` 的类型 import 中加入 `OrderRefund`、`PaymentMethod`、`RefundReason`。

在 `VoidPaidOrderOptions` 前新增：

```ts
export type SaveOrderRefundInput = {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reason: RefundReason;
  note?: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function listOrderRefunds(orderId: string): Promise<OrderRefund[]> {
  return db.orderRefunds.where("orderId").equals(orderId).sortBy("createdAt");
}

export async function listRefunds(): Promise<OrderRefund[]> {
  return db.orderRefunds.orderBy("createdAt").toArray();
}

export async function saveOrderRefund(input: SaveOrderRefundInput, now = new Date()): Promise<OrderRefund> {
  const amount = roundMoney(input.amount);

  if (!Number.isFinite(input.amount) || amount <= 0) {
    throw new Error("退款金额必须大于 0。");
  }

  return db.transaction("rw", db.orders, db.orderRefunds, async () => {
    const order = await db.orders.get(input.orderId);

    if (!order) {
      throw new Error("订单不存在，无法记录退款。");
    }

    if (order.status === "pending_payment") {
      throw new Error("待支付订单不能记录退款。");
    }

    const existingRefunds = await db.orderRefunds.where("orderId").equals(input.orderId).toArray();
    const refundedAmount = roundMoney(existingRefunds.reduce((sum, refund) => sum + refund.amount, 0));
    const remainingAmount = roundMoney(order.payableAmount - refundedAmount);

    if (amount > remainingAmount) {
      throw new Error("退款金额不能超过订单剩余可退金额。");
    }

    const refund: OrderRefund = {
      id: makeId("refund"),
      orderId: input.orderId,
      amount,
      method: input.method,
      reason: input.reason,
      note: input.note?.trim() || undefined,
      createdAt: now.toISOString()
    };

    await db.orderRefunds.put(refund);
    return refund;
  });
}
```

更新 `clearAllData`：

```ts
await db.transaction(
  "rw",
  [db.products, db.images, db.settings, db.orders, db.orderItems, db.inventoryLogs, db.orderRefunds],
  async () => {
    await Promise.all([
      db.products.clear(),
      db.images.clear(),
      db.settings.clear(),
      db.orders.clear(),
      db.orderItems.clear(),
      db.inventoryLogs.clear(),
      db.orderRefunds.clear()
    ]);
  }
);
```

- [ ] **Step 6：运行数据层测试确认 GREEN**

```powershell
npm test -- src/db/repositories.test.ts
```

预期：通过。

- [ ] **Step 7：提交**

```powershell
git add src/domain/types.ts src/db/db.ts src/db/repositories.ts src/db/repositories.test.ts
git commit -m "feat: add manual order refund repository"
```

---

## Task 2：备份版本 3 与退款记录导入导出

**文件：**

- 修改：`src/utils/backup.ts`
- 修改：`src/utils/backup.test.ts`

- [ ] **Step 1：先写 failing backup tests**

在 `src/utils/backup.test.ts` 中把原测试名 `"exports images in version 2 JSON backup"` 改为 `"exports images and refunds in version 3 JSON backup"`。

在该测试的 `tableSpies` 中加入：

```ts
vi.spyOn(db.orderRefunds, "toArray").mockResolvedValue([
  {
    id: "refund-1",
    orderId: "order-1",
    amount: 5,
    method: "wechat",
    reason: "customer_return",
    note: "客户退单。",
    createdAt: "2026-06-17T10:00:00.000Z"
  }
])
```

把断言改为：

```ts
expect(payload.version).toBe(3);
expect(payload.data.orderRefunds).toEqual([
  expect.objectContaining({
    id: "refund-1",
    orderId: "order-1",
    amount: 5,
    method: "wechat",
    reason: "customer_return",
    note: "客户退单。"
  })
]);
```

在 `imports version 2 images into the image table` 测试传入 `replaceAllDataInTransaction` 的对象里加入 `orderRefunds: []`。

把 `"rejects unsupported backup versions before clearing existing data"` 中的 `version: 3` 改为 `version: 4`。

新增测试：

```ts
test("imports version 3 order refunds into the refund table", async () => {
  const refundBulkPut = vi.spyOn(db.orderRefunds, "bulkPut").mockResolvedValue(["refund-1"] as never);

  await replaceAllDataInTransaction({
    products: [],
    settings: [
      {
        id: "settings",
        shopName: "ECRM 摊位",
        orderPrefix: "ECRM",
        promotion: {
          enabled: false,
          addonDiscount: {
            enabled: false,
            discountSpu: "",
            discountPrice: 3,
            maxDiscountQty: 3
          },
          giftTiers: []
        }
      }
    ],
    orders: [],
    orderItems: [],
    inventoryLogs: [],
    images: [],
    orderRefunds: [
      {
        id: "refund-1",
        orderId: "order-1",
        amount: 5,
        method: "cash",
        reason: "customer_return",
        createdAt: "2026-06-17T10:00:00.000Z"
      }
    ]
  });

  expect(refundBulkPut).toHaveBeenCalledWith([
    expect.objectContaining({ id: "refund-1", amount: 5 })
  ]);
  refundBulkPut.mockRestore();
});

test("imports old backups without order refunds", async () => {
  const importData = vi.fn();

  await importJsonBackupFromText(JSON.stringify(validPayload()), { importData });

  expect(importData).toHaveBeenCalledWith(expect.objectContaining({ orderRefunds: [] }));
});

test("rejects malformed order refund amount before replacing data", async () => {
  const importData = vi.fn();

  await expect(
    importJsonBackupFromText(
      JSON.stringify({
        version: 3,
        exportedAt: "2026-06-17T10:00:00.000Z",
        note: "图片已包含在 JSON 备份中",
        data: {
          products: [],
          settings: validPayload().data.settings,
          orders: [],
          orderItems: [],
          inventoryLogs: [],
          images: [],
          orderRefunds: [
            {
              id: "refund-1",
              orderId: "order-1",
              amount: 0,
              method: "cash",
              reason: "customer_return",
              createdAt: "2026-06-17T10:00:00.000Z"
            }
          ]
        }
      }),
      { importData }
    )
  ).rejects.toThrow("备份文件格式不正确");

  expect(importData).not.toHaveBeenCalled();
});
```

更新 `default import replacement keeps old data when transaction fails` 的入参，增加 `orderRefunds: []`，并把 `tableStubs` 加入 `db.orderRefunds`。

- [ ] **Step 2：运行备份测试确认 RED**

```powershell
npm test -- src/utils/backup.test.ts
```

预期：失败，原因是 `orderRefunds` 未进入备份结构、版本 3 未支持。

- [ ] **Step 3：实现备份版本 3**

在 `src/utils/backup.ts` 的类型 import 中加入 `OrderRefund`。

把：

```ts
const BACKUP_VERSION = 2;
```

改为：

```ts
const BACKUP_VERSION = 3;
```

把 `BackupData` 增加：

```ts
orderRefunds: OrderRefund[];
```

把 `BackupPayloadV2` 改名为 `BackupPayloadV3`，`version` 改为 `3`。

把 `ParsedBackupPayload` 的版本改为：

```ts
version: 1 | 2 | 3;
```

新增：

```ts
const REFUND_REASONS = new Set(["customer_return", "overcharge", "product_issue", "manual_adjustment", "other"]);
```

新增校验函数：

```ts
function validateOrderRefunds(orderRefunds: unknown[]): asserts orderRefunds is OrderRefund[] {
  for (const refund of orderRefunds) {
    assertRecord(refund, "备份文件格式不正确。");
    assertString(refund, "id");
    assertString(refund, "orderId");
    assertFiniteNumber(refund, "amount");
    if (refund.amount <= 0) {
      throw new Error("备份文件格式不正确。");
    }
    assertEnum(refund, "method", PAYMENT_METHODS);
    assertEnum(refund, "reason", REFUND_REASONS);
    assertOptionalString(refund, "note");
    assertString(refund, "createdAt");
  }
}
```

更新 `validateBackupData` 参数和内容，加入 `orderRefunds` 并调用 `validateOrderRefunds(data.orderRefunds)`。

更新 `parseBackupPayload`：

```ts
if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== BACKUP_VERSION) {
  throw new Error("不支持的备份版本。");
}
```

构造 `data` 时加入：

```ts
orderRefunds: parsed.version === 3 ? readArray(parsed.data, "orderRefunds") : []
```

更新 `replaceAllDataInTransaction`，事务表、清理列表和 bulkPut 均加入 `db.orderRefunds`。

更新 `exportJsonBackup` payload：

```ts
orderRefunds: await db.orderRefunds.toArray(),
```

- [ ] **Step 4：运行备份测试确认 GREEN**

```powershell
npm test -- src/utils/backup.test.ts
```

预期：通过。

- [ ] **Step 5：提交**

```powershell
git add src/utils/backup.ts src/utils/backup.test.ts
git commit -m "feat: include refunds in backups"
```

---

## Task 3：订单列表退款标识领域函数

**文件：**

- 修改：`src/domain/orderHistory.ts`
- 修改：`src/domain/orderHistory.test.ts`

- [ ] **Step 1：先写 failing domain tests**

在 `src/domain/orderHistory.test.ts` 的类型 import 中加入 `OrderRefund`。

增加 helper：

```ts
function refund(overrides: Partial<OrderRefund> = {}): OrderRefund {
  return {
    id: "refund-1",
    orderId: "order-1",
    amount: 5,
    method: "cash",
    reason: "customer_return",
    createdAt: "2026-06-17T10:00:00.000Z",
    ...overrides
  };
}
```

更新现有 `getOrderAfterSalesBadges` 测试，调用时第二参数传空数组：

```ts
getOrderAfterSalesBadges(order({ status: "paid" }), [])
```

新增测试：

```ts
test("returns partial refund badge when refunds are below payable amount", () => {
  expect(getOrderAfterSalesBadges(order({ id: "order-1", payableAmount: 20 }), [refund({ amount: 5 })])).toEqual([
    { label: "部分退款", tone: "neutral" }
  ]);
});

test("returns refunded badge when refunds reach payable amount", () => {
  expect(getOrderAfterSalesBadges(order({ id: "order-1", payableAmount: 20 }), [refund({ amount: 10 }), refund({ id: "refund-2", amount: 10 })])).toEqual([
    { label: "已退款", tone: "danger" }
  ]);
});

test("combines void and refund badges for cancelled refunded orders", () => {
  expect(
    getOrderAfterSalesBadges(order({ id: "order-1", status: "cancelled", payableAmount: 20, cancelReason: "other" }), [
      refund({ amount: 20 })
    ])
  ).toEqual([
    { label: "已作废", tone: "danger" },
    { label: "其他", tone: "neutral" },
    { label: "已退款", tone: "danger" }
  ]);
});
```

- [ ] **Step 2：运行 domain 测试确认 RED**

```powershell
npm test -- src/domain/orderHistory.test.ts
```

预期：失败，原因是函数还不接收退款记录。

- [ ] **Step 3：实现退款标识**

在 `src/domain/orderHistory.ts` 的类型 import 中加入 `OrderRefund`。

把签名改为：

```ts
export function getOrderAfterSalesBadges(order: Order, refunds: OrderRefund[] = []): OrderAfterSalesBadge[] {
```

函数内先保留作废逻辑，再追加退款逻辑：

```ts
  const refundedAmount = refunds
    .filter((refund) => refund.orderId === order.id)
    .reduce((sum, refund) => sum + refund.amount, 0);

  if (refundedAmount > 0) {
    badges.push({
      label: refundedAmount >= order.payableAmount ? "已退款" : "部分退款",
      tone: refundedAmount >= order.payableAmount ? "danger" : "neutral"
    });
  }
```

注意：如果订单不是 `cancelled`，初始 `badges` 应为空数组，不能提前 `return []`。

- [ ] **Step 4：运行 domain 测试确认 GREEN**

```powershell
npm test -- src/domain/orderHistory.test.ts
```

预期：通过。

- [ ] **Step 5：提交**

```powershell
git add src/domain/orderHistory.ts src/domain/orderHistory.test.ts
git commit -m "feat: derive order refund badges"
```

---

## Task 4：订单详情退款 UI 与售卖页集成

**文件：**

- 修改：`src/components/OrderDetailDialog.tsx`
- 修改：`src/components/OrderDetailDialog.test.tsx`
- 修改：`src/pages/SalesPage.tsx`
- 修改：`src/pages/SalesPage.test.tsx`
- 修改：`src/styles.css`

- [ ] **Step 1：先写 OrderDetailDialog failing tests**

在 `src/components/OrderDetailDialog.test.tsx` 的类型 import 中加入 `OrderRefund`、`RefundReason`、`PaymentMethod`。

新增 helper：

```ts
const refunds: OrderRefund[] = [
  {
    id: "refund-1",
    orderId: "order-1",
    amount: 25,
    method: "wechat",
    reason: "customer_return",
    note: "客户退回。",
    createdAt: "2026-06-17T11:00:00.000Z"
  }
];
```

更新所有 `<OrderDetailDialog />` 调用，传入 `orderRefunds={[]}`，需要退款记录的测试传 `orderRefunds={refunds}`。

新增测试：

```ts
test("shows refund records and totals in the after-sales section", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={refunds}
      onClose={() => undefined}
      onSaveRefund={() => undefined}
    />
  );

  expect(screen.getByText("售后记录")).toBeVisible();
  expect(screen.getByText("累计退款")).toBeVisible();
  expect(screen.getByText("¥25.00")).toBeVisible();
  expect(screen.getByText("剩余可退")).toBeVisible();
  expect(screen.getByText("¥75.00")).toBeVisible();

  const refundList = screen.getByRole("list", { name: "人工退款记录" });
  expect(within(refundList).getByText("客户退单")).toBeVisible();
  expect(within(refundList).getByText("微信")).toBeVisible();
  expect(within(refundList).getByText("客户退回。")).toBeVisible();
});

test("submits a manual refund from the refund dialog", () => {
  const onSaveRefund = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onSaveRefund={onSaveRefund}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "记录退款" }));

  const refundDialog = screen.getByRole("dialog", { name: "记录人工退款" });
  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "12.5" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款方式"), { target: { value: "cash" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款原因"), { target: { value: "product_issue" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款备注"), { target: { value: " 商品问题。 " } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));

  expect(onSaveRefund).toHaveBeenCalledWith({
    amount: 12.5,
    method: "cash",
    reason: "product_issue",
    note: "商品问题。"
  });
});

test("validates refund amount before submitting", () => {
  const onSaveRefund = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={refunds}
      onClose={() => undefined}
      onSaveRefund={onSaveRefund}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "记录退款" }));
  const refundDialog = screen.getByRole("dialog", { name: "记录人工退款" });

  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));
  expect(screen.getByText("请填写退款金额。")).toBeVisible();

  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "100" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));
  expect(screen.getByText("退款金额不能超过剩余可退金额。")).toBeVisible();
  expect(onSaveRefund).not.toHaveBeenCalled();
});
```

- [ ] **Step 2：先写 SalesPage failing tests**

在 `src/pages/SalesPage.test.tsx` 的 repositories mock 加入：

```ts
listOrderRefunds: vi.fn(),
listRefunds: vi.fn(),
saveOrderRefund: vi.fn(),
```

`beforeEach` 默认：

```ts
repositories.listOrderRefunds.mockResolvedValue([]);
repositories.listRefunds.mockResolvedValue([]);
repositories.saveOrderRefund.mockResolvedValue({
  id: "refund-1",
  orderId: "order-detail",
  amount: 10,
  method: "cash",
  reason: "customer_return",
  createdAt: localIsoDateTime(0, 10, 0)
});
```

新增测试：

```ts
test("records a manual refund from the order detail dialog", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "order-detail",
      orderNo: "ECRM-DETAIL",
      payableAmount: 20,
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([inventoryLog({ orderId: "order-detail" })]);
  repositories.listOrderRefunds
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: "refund-1",
        orderId: "order-detail",
        amount: 10,
        method: "cash",
        reason: "customer_return",
        createdAt: localIsoDateTime(0, 10, 0)
      }
    ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "记录退款" }));

  const refundDialog = await screen.findByRole("dialog", { name: "记录人工退款" });
  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "10" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款方式"), { target: { value: "cash" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));

  await waitFor(() =>
    expect(repositories.saveOrderRefund).toHaveBeenCalledWith({
      orderId: "order-detail",
      amount: 10,
      method: "cash",
      reason: "customer_return",
      note: undefined
    })
  );
  expect(await screen.findByText("订单 ECRM-DETAIL 已记录退款 ¥10.00。")).toBeVisible();
  expect(await screen.findByText("累计退款")).toBeVisible();
});

test("shows sanitized error when refund save fails", async () => {
  repositories.saveOrderRefund.mockRejectedValue(new Error("raw refund failure"));
  repositories.listOrders.mockResolvedValue([
    order({ id: "order-detail", orderNo: "ECRM-DETAIL", createdAt: localIsoDateTime(0, 9, 20), paidAt: localIsoDateTime(0, 9, 25) })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "记录退款" }));
  fireEvent.change(await screen.findByLabelText("退款金额"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "保存退款记录" }));

  expect(await screen.findByText("退款记录保存失败，请刷新后重试。")).toBeVisible();
  expect(screen.queryByText("raw refund failure")).not.toBeInTheDocument();
});
```

- [ ] **Step 3：运行 UI 测试确认 RED**

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx
```

预期：失败，原因是组件 props、repository mock 和退款 UI 尚未实现。

- [ ] **Step 4：实现 OrderDetailDialog**

在 `src/components/OrderDetailDialog.tsx`：

- 类型 import 加入 `OrderRefund`、`PaymentMethod`、`RefundReason`。
- props 加入：

```ts
orderRefunds: OrderRefund[];
onSaveRefund?: (input: SaveRefundInput) => Promise<void> | void;
isSavingRefund?: boolean;
```

- 新增：

```ts
type SaveRefundInput = {
  amount: number;
  method: PaymentMethod;
  reason: RefundReason;
  note?: string;
};
```

- 增加退款原因中文：

```ts
const refundReasonLabels: Record<RefundReason, string> = {
  customer_return: "客户退单",
  overcharge: "多收款",
  product_issue: "商品问题",
  manual_adjustment: "人工调整",
  other: "其他"
};
```

- 用 `useMemo` 计算：

```ts
const refundedAmount = useMemo(
  () => orderRefunds.reduce((sum, refund) => sum + refund.amount, 0),
  [orderRefunds]
);
const remainingRefundAmount = Math.max(0, order.payableAmount - refundedAmount);
const canSaveRefund = (order.status === "paid" || order.status === "cancelled") && onSaveRefund && remainingRefundAmount > 0;
```

- 售后记录区条件改为：

```tsx
const shouldShowAfterSalesSection = order.status === "cancelled" || orderRefunds.length > 0 || Boolean(canSaveRefund);
```

- 使用 `shouldShowAfterSalesSection` 控制售后记录区是否渲染。
- 在售后记录区保留现有作废信息展示。
- 在同一个售后记录区新增累计退款、剩余可退和 `role="list" aria-label="人工退款记录"`。
- 在 `orderDetailActions` 里对可退款订单显示 `记录退款` 按钮。
- 增加嵌套弹窗 `aria-label="记录人工退款"`。
- 表单校验中文：
  - `请填写退款金额。`
  - `退款金额必须大于 0。`
  - `退款金额不能超过剩余可退金额。`

- [ ] **Step 5：实现 SalesPage 集成**

在 `src/pages/SalesPage.tsx`：

- repository import 加入 `listOrderRefunds`、`listRefunds`、`saveOrderRefund`。
- 类型 import 加入 `OrderRefund`、`RefundReason`。
- 新增 state：

```ts
const [refunds, setRefunds] = useState<OrderRefund[]>([]);
const [selectedOrderRefunds, setSelectedOrderRefunds] = useState<OrderRefund[]>([]);
const [isSavingRefund, setIsSavingRefund] = useState(false);
```

- `refreshSalesData` 的 Promise 加载加入 `listRefunds()`。
- `openOrderDetail` 并发加载加入 `listOrderRefunds(order.id)`。
- `closeOrderDetail` 清空 `selectedOrderRefunds`。
- 新增：

```ts
async function handleSaveSelectedRefund(input: { amount: number; method: PaymentMethod; reason: RefundReason; note?: string }) {
  if (!selectedOrder) {
    return;
  }

  setIsSavingRefund(true);
  setStatus(undefined);

  try {
    await saveOrderRefund({
      orderId: selectedOrder.id,
      amount: input.amount,
      method: input.method,
      reason: input.reason,
      note: input.note
    });
    const updatedRefunds = await listOrderRefunds(selectedOrder.id);
    setSelectedOrderRefunds(updatedRefunds);
    setStatus({ kind: "success", text: `订单 ${selectedOrder.orderNo} 已记录退款 ${formatMoney(input.amount)}。` });
    await refreshSalesData({ preserveStatus: true });
  } catch {
    setStatus({ kind: "error", text: "退款记录保存失败，请刷新后重试。" });
  } finally {
    setIsSavingRefund(false);
  }
}
```

- 订单列表 `getOrderAfterSalesBadges(order)` 改为：

```ts
getOrderAfterSalesBadges(order, refunds)
```

- 传给 `OrderDetailDialog`：

```tsx
orderRefunds={selectedOrderRefunds}
onSaveRefund={handleSaveSelectedRefund}
isSavingRefund={isSavingRefund}
```

- [ ] **Step 6：增加样式**

在 `src/styles.css` 增加紧凑样式：

```css
.refundRecordList {
  display: grid;
  gap: 8px;
}

.refundRecordRow {
  display: grid;
  grid-template-columns: minmax(96px, 0.6fr) minmax(120px, 1fr) minmax(120px, 1fr);
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid rgba(222, 214, 201, 0.92);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}
```

移动端把 `.refundRecordRow` 加入已有一列布局区域。

- [ ] **Step 7：运行 UI 测试确认 GREEN**

```powershell
npm test -- src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx src/domain/orderHistory.test.ts
```

预期：通过。

- [ ] **Step 8：提交**

```powershell
git add src/components/OrderDetailDialog.tsx src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.tsx src/pages/SalesPage.test.tsx src/domain/orderHistory.ts src/domain/orderHistory.test.ts src/styles.css
git commit -m "feat: record manual refunds from order detail"
```

---

## Task 5：最终验证

**文件：**

- 不应再修改业务代码。

- [ ] **Step 1：运行聚焦测试**

```powershell
npm test -- src/db/repositories.test.ts src/utils/backup.test.ts src/domain/orderHistory.test.ts src/components/OrderDetailDialog.test.tsx src/pages/SalesPage.test.tsx
```

预期：通过。

- [ ] **Step 2：运行全量测试**

```powershell
npm test
```

预期：通过。

- [ ] **Step 3：运行生产构建**

```powershell
npm run build
```

预期：通过。

- [ ] **Step 4：检查 diff 和工作区**

```powershell
git diff --check
git status --short --branch
```

预期：无空白错误；所有计划内变更已提交。

- [ ] **Step 5：检查本地服务**

```powershell
try { (Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 3).StatusCode } catch { "DOWN" }
```

预期：`200`。如果返回 `DOWN`，启动：

```powershell
Start-Process -FilePath npm -ArgumentList @('run','dev','--','--port','5173') -WorkingDirectory 'D:\Projects\ECRM\.worktrees\ecrm-mvp' -WindowStyle Hidden
```

---

## 范围保护

本计划不得做以下改动：

- 不接入微信/支付宝退款 API。
- 不做真实自动退款。
- 不做商品级退款选择。
- 不做退款退货入库。
- 不新增订单调整表。
- 不新增订单主状态。
- 不改变作废库存回滚规则。
- 不重构购物车、促销或商品管理。
- 不实现 V1.4 仪表盘。

如果执行过程中发现必须突破以上范围，停止实现并回报主控。

---

## 自查结果

- 方案覆盖：数据层、备份层、领域标识、订单详情 UI、售卖页集成、最终验证均有任务。
- 范围一致：只做人工退款记录，不做商品级退款、退款入库、订单调整表或真实支付平台退款。
- 类型一致：`RefundReason`、`OrderRefund`、`SaveOrderRefundInput` 在任务间命名一致。
- 兼容性：备份版本 1/2 导入时补 `orderRefunds: []`，版本 3 导出退款记录。
