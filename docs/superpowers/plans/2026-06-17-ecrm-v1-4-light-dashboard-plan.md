# ECRM V1.4 轻量实用仪表盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不新增数据库 schema、不引入复杂可配置图表的前提下，把现有极简仪表盘升级为线下摆摊可用的今日经营、售后、热销、赠品和低库存固定统计面板。

**Architecture:** 新增 `src/domain/dashboard.ts` 承载所有统计口径，保持纯函数、无 Dexie、无 React 依赖。`DashboardPage.tsx` 只负责加载 `orders/products/refunds/orderItems`、调用领域函数并渲染高密度固定模块；样式继续集中在 `src/styles.css`。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、Dexie repository、现有 CSS。

---

## 0. 执行边界

本计划只实现 V1.4 轻量固定仪表盘。

明确不做：

- 飞书式拖拽仪表盘。
- 自定义图表配置器。
- 新增 Dexie schema 或迁移。
- 云同步、多设备并发同步。
- CSV 导出。
- 自定义日期范围。
- 从仪表盘直接打开订单详情。
- 复合二维码。

## 1. 文件结构

- Create: `src/domain/dashboard.ts`
  - 负责仪表盘统计纯函数。
  - 输入为 `orders/products/refunds/orderItems/day`。
  - 输出为页面可以直接渲染的 summary、排行、赠品、低库存、异常订单行。

- Create: `src/domain/dashboard.test.ts`
  - 覆盖销售、退款、实收、售后计数、SKU 排名、赠品消耗、异常订单、低库存排序。

- Modify: `src/pages/DashboardPage.tsx`
  - 从 repository 加载 `listOrders/listProducts/listRefunds/listOrderItems`。
  - 使用 `buildDashboardModel()` 计算页面模型。
  - 渲染固定统计模块。
  - 保持加载失败中文脱敏错误。

- Modify: `src/pages/DashboardPage.test.tsx`
  - 扩展 repository mock。
  - 覆盖页面加载退款和订单明细、核心指标、热销 SKU、赠品消耗、异常订单、失败提示。

- Modify: `src/styles.css`
  - 增加 V1.4 仪表盘高密度两列布局和表格/排行样式。
  - 保持 8px 圆角、浅色背景、低噪音样式。

## 2. 数据口径

- 今日销售额：今日 `status = "paid"` 订单 `payableAmount` 合计。
- 今日订单：今日 `status = "paid"` 订单数量。
- 今日退款：今日 `orderRefunds.createdAt` 落在当天的退款金额合计。
- 今日实收：今日销售额 - 今日退款。
- 今日统计订单归属日期：优先 `paidAt`，缺失时使用 `createdAt`。
- 今日作废订单：`status = "cancelled"` 且 `cancelledAt` 落在当天。
- 部分退款订单：订单累计退款金额 > 0 且 < `order.payableAmount`。
- 已退款订单：订单累计退款金额 >= `order.payableAmount`。
- 热销 SKU：只统计今日已支付订单的 `normal` 和 `discount_addon` 明细，不统计 `gift`。
- 赠品消耗：只统计今日已支付订单的 `gift` 明细。
- 低库存：启用商品 `status = "active"` 且 `stockQty < 3`，售卖商品和仅赠品库存都显示。
- 异常订单：今日已作废、有退款、有作废备注、`giftStockWarning = true` 的订单，最多 8 条。

## 3. 任务拆分

### Task 1: 新增仪表盘领域统计模型

**Files:**
- Create: `src/domain/dashboard.ts`
- Create: `src/domain/dashboard.test.ts`

- [ ] **Step 1: 写失败测试**

Create `src/domain/dashboard.test.ts` with focused cases:

```ts
import { describe, expect, test } from "vitest";
import { buildDashboardModel } from "./dashboard";
import type { Order, OrderItem, OrderRefund } from "./types";
import { defaultPromotion, product } from "../test/fixtures";

const day = new Date("2026-06-15T12:00:00.000Z");

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNo: "ECRM-001",
    status: "paid",
    paymentMethod: "wechat",
    subtotalBeforeDiscount: 40,
    discountAmount: 0,
    payableAmount: 40,
    promotionSnapshot: defaultPromotion(),
    giftStockWarning: false,
    createdAt: "2026-06-15T09:00:00.000Z",
    paidAt: "2026-06-15T09:01:00.000Z",
    ...overrides
  };
}

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    productId: "product-1",
    productNameSnapshot: "亚克力挂件",
    spuSnapshot: "挂件",
    productCodeSnapshot: "CHARM-BLK",
    quantity: 2,
    originalUnitPrice: 10,
    finalUnitPrice: 10,
    lineType: "normal",
    lineTotal: 20,
    ...overrides
  };
}

function refund(overrides: Partial<OrderRefund> = {}): OrderRefund {
  return {
    id: "refund-1",
    orderId: "order-1",
    amount: 5,
    method: "wechat",
    reason: "customer_return",
    createdAt: "2026-06-15T11:00:00.000Z",
    ...overrides
  };
}

describe("buildDashboardModel", () => {
  test("统计今日销售额、退款额、实收额和已支付订单数", () => {
    const model = buildDashboardModel({
      day,
      orders: [
        order({ id: "today-paid", payableAmount: 40 }),
        order({
          id: "yesterday-paid",
          payableAmount: 99,
          paidAt: "2026-06-14T09:00:00.000Z",
          createdAt: "2026-06-14T09:00:00.000Z"
        }),
        order({ id: "cancelled", status: "cancelled", payableAmount: 70, cancelledAt: "2026-06-15T10:00:00.000Z" })
      ],
      orderItems: [],
      refunds: [refund({ amount: 8 })],
      products: []
    });

    expect(model.summary.paidAmount).toBe(40);
    expect(model.summary.refundAmount).toBe(8);
    expect(model.summary.netAmount).toBe(32);
    expect(model.summary.paidOrderCount).toBe(1);
    expect(model.summary.cancelledOrderCount).toBe(1);
  });

  test("按订单累计退款区分部分退款和已退款", () => {
    const model = buildDashboardModel({
      day,
      orders: [
        order({ id: "partial", orderNo: "ECRM-001", payableAmount: 40 }),
        order({ id: "full", orderNo: "ECRM-002", payableAmount: 30 })
      ],
      orderItems: [],
      refunds: [
        refund({ id: "refund-partial", orderId: "partial", amount: 10 }),
        refund({ id: "refund-full", orderId: "full", amount: 30 })
      ],
      products: []
    });

    expect(model.summary.partialRefundOrderCount).toBe(1);
    expect(model.summary.fullyRefundedOrderCount).toBe(1);
  });

  test("生成热销 SKU 和赠品消耗排行", () => {
    const model = buildDashboardModel({
      day,
      orders: [order({ id: "order-1" })],
      orderItems: [
        item({ id: "normal-1", productId: "sku-a", quantity: 2, lineTotal: 20, lineType: "normal" }),
        item({ id: "discount-1", productId: "sku-a", quantity: 1, lineTotal: 3, lineType: "discount_addon" }),
        item({ id: "normal-2", productId: "sku-b", quantity: 1, lineTotal: 12, productNameSnapshot: "明信片" }),
        item({ id: "gift-1", productId: "gift-a", quantity: 3, lineTotal: 0, lineType: "gift", productNameSnapshot: "赠品贴纸" })
      ],
      refunds: [],
      products: []
    });

    expect(model.topSellingSkuRows[0]).toMatchObject({ productId: "sku-a", quantity: 3, amount: 23 });
    expect(model.topSellingSkuRows).toHaveLength(2);
    expect(model.giftConsumptionRows[0]).toMatchObject({ productId: "gift-a", quantity: 3 });
  });

  test("低库存商品按库存从低到高排序并包含仅赠品商品", () => {
    const model = buildDashboardModel({
      day,
      orders: [],
      orderItems: [],
      refunds: [],
      products: [
        product({ id: "gift-only", name: "赠品 B", stockQty: 1, isSellable: false, isGiftEligible: true }),
        product({ id: "sold-out", name: "售罄 SKU", stockQty: 0 }),
        product({ id: "safe", name: "安全库存", stockQty: 3 }),
        product({ id: "inactive", name: "停用 SKU", stockQty: 1, status: "inactive" })
      ]
    });

    expect(model.lowStockRows.map((row) => row.productId)).toEqual(["sold-out", "gift-only"]);
  });

  test("生成今日异常订单清单", () => {
    const model = buildDashboardModel({
      day,
      orders: [
        order({ id: "voided", orderNo: "ECRM-VOID", status: "cancelled", cancelledAt: "2026-06-15T10:00:00.000Z", cancelNote: "客户改买" }),
        order({ id: "refund-order", orderNo: "ECRM-REFUND", payableAmount: 20, paidAt: "2026-06-15T11:00:00.000Z" }),
        order({ id: "gift-warning", orderNo: "ECRM-GIFT", giftStockWarning: true, paidAt: "2026-06-15T12:00:00.000Z" })
      ],
      orderItems: [],
      refunds: [refund({ orderId: "refund-order", amount: 5 })],
      products: []
    });

    expect(model.exceptionRows.map((row) => row.orderNo)).toEqual(["ECRM-GIFT", "ECRM-REFUND", "ECRM-VOID"]);
    expect(model.exceptionRows[1].badges).toContain("部分退款");
    expect(model.exceptionRows[2].badges).toContain("有备注");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- FAIL。
- 失败原因包含 `Cannot find module './dashboard'` 或 `buildDashboardModel` 未定义。

- [ ] **Step 3: 实现领域函数**

Create `src/domain/dashboard.ts`:

```ts
import type { Order, OrderItem, OrderRefund, PaymentMethod, Product } from "./types";

export type DashboardInput = {
  day: Date;
  orders: Order[];
  orderItems: OrderItem[];
  refunds: OrderRefund[];
  products: Product[];
};

export type DashboardSummary = {
  paidAmount: number;
  refundAmount: number;
  netAmount: number;
  paidOrderCount: number;
  cancelledOrderCount: number;
  partialRefundOrderCount: number;
  fullyRefundedOrderCount: number;
  notedCancelledOrderCount: number;
};

export type DashboardSkuRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  quantity: number;
  amount: number;
};

export type DashboardGiftRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  quantity: number;
};

export type DashboardLowStockRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  stockQty: number;
  isSellable: boolean;
  isGiftEligible: boolean;
};

export type DashboardExceptionBadge = "已作废" | "部分退款" | "已退款" | "有备注" | "赠品异常";

export type DashboardExceptionRow = {
  orderId: string;
  orderNo: string;
  time: string;
  paymentMethod?: PaymentMethod;
  payableAmount: number;
  badges: DashboardExceptionBadge[];
};

export type DashboardModel = {
  summary: DashboardSummary;
  topSellingSkuRows: DashboardSkuRow[];
  giftConsumptionRows: DashboardGiftRow[];
  lowStockRows: DashboardLowStockRow[];
  exceptionRows: DashboardExceptionRow[];
};

function isSameLocalDay(value: string | undefined, day: Date): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function orderBusinessTime(order: Order): string {
  return order.paidAt ?? order.createdAt;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumRefundsByOrder(refunds: OrderRefund[]): Map<string, number> {
  return refunds.reduce((totals, refund) => {
    totals.set(refund.orderId, roundMoney((totals.get(refund.orderId) ?? 0) + refund.amount));
    return totals;
  }, new Map<string, number>());
}

function sortByQuantityThenName<T extends { quantity: number; productName: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName, "zh-Hans-CN"));
}

function buildTopSellingSkuRows(todayPaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardSkuRow[] {
  const rowsByProduct = new Map<string, DashboardSkuRow>();

  for (const item of orderItems) {
    if (!todayPaidOrderIds.has(item.orderId) || item.lineType === "gift") {
      continue;
    }

    const existing = rowsByProduct.get(item.productId);
    rowsByProduct.set(item.productId, {
      productId: item.productId,
      productName: item.productNameSnapshot,
      spu: item.spuSnapshot,
      productCode: item.productCodeSnapshot,
      quantity: (existing?.quantity ?? 0) + item.quantity,
      amount: roundMoney((existing?.amount ?? 0) + item.lineTotal)
    });
  }

  return sortByQuantityThenName([...rowsByProduct.values()]).slice(0, 5);
}

function buildGiftConsumptionRows(todayPaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardGiftRow[] {
  const rowsByProduct = new Map<string, DashboardGiftRow>();

  for (const item of orderItems) {
    if (!todayPaidOrderIds.has(item.orderId) || item.lineType !== "gift") {
      continue;
    }

    const existing = rowsByProduct.get(item.productId);
    rowsByProduct.set(item.productId, {
      productId: item.productId,
      productName: item.productNameSnapshot,
      spu: item.spuSnapshot,
      productCode: item.productCodeSnapshot,
      quantity: (existing?.quantity ?? 0) + item.quantity
    });
  }

  return sortByQuantityThenName([...rowsByProduct.values()]).slice(0, 5);
}

function buildLowStockRows(products: Product[]): DashboardLowStockRow[] {
  return products
    .filter((product) => product.status === "active" && product.stockQty < 3)
    .sort((a, b) => a.stockQty - b.stockQty || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      spu: product.spu,
      productCode: product.productCode,
      stockQty: product.stockQty,
      isSellable: product.isSellable,
      isGiftEligible: product.isGiftEligible
    }));
}

function buildExceptionRows(orders: Order[], refundTotalsByOrder: Map<string, number>, day: Date): DashboardExceptionRow[] {
  return orders
    .filter((order) => {
      const hasRefund = (refundTotalsByOrder.get(order.id) ?? 0) > 0;
      const isVoidedToday = order.status === "cancelled" && isSameLocalDay(order.cancelledAt, day);
      const isPaidToday = order.status === "paid" && isSameLocalDay(orderBusinessTime(order), day);
      return isVoidedToday || (isPaidToday && (hasRefund || order.giftStockWarning));
    })
    .map((order) => {
      const refundedAmount = refundTotalsByOrder.get(order.id) ?? 0;
      const badges: DashboardExceptionBadge[] = [];

      if (order.status === "cancelled") {
        badges.push("已作废");
      }
      if (refundedAmount > 0 && refundedAmount < order.payableAmount) {
        badges.push("部分退款");
      }
      if (refundedAmount >= order.payableAmount && order.payableAmount > 0) {
        badges.push("已退款");
      }
      if (order.cancelNote) {
        badges.push("有备注");
      }
      if (order.giftStockWarning) {
        badges.push("赠品异常");
      }

      return {
        orderId: order.id,
        orderNo: order.orderNo,
        time: order.cancelledAt ?? order.paidAt ?? order.createdAt,
        paymentMethod: order.paymentMethod,
        payableAmount: order.payableAmount,
        badges
      };
    })
    .filter((row) => row.badges.length > 0)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 8);
}

export function buildDashboardModel(input: DashboardInput): DashboardModel {
  const todayPaidOrders = input.orders.filter(
    (order) => order.status === "paid" && isSameLocalDay(orderBusinessTime(order), input.day)
  );
  const todayPaidOrderIds = new Set(todayPaidOrders.map((order) => order.id));
  const refundTotalsByOrder = sumRefundsByOrder(input.refunds);
  const todayRefundAmount = input.refunds
    .filter((refund) => isSameLocalDay(refund.createdAt, input.day))
    .reduce((sum, refund) => roundMoney(sum + refund.amount), 0);

  const paidAmount = todayPaidOrders.reduce((sum, order) => roundMoney(sum + order.payableAmount), 0);
  const cancelledOrderCount = input.orders.filter(
    (order) => order.status === "cancelled" && isSameLocalDay(order.cancelledAt, input.day)
  ).length;
  const notedCancelledOrderCount = input.orders.filter(
    (order) => order.status === "cancelled" && isSameLocalDay(order.cancelledAt, input.day) && Boolean(order.cancelNote)
  ).length;
  const paidOrdersWithRefunds = todayPaidOrders.map((order) => ({
    order,
    refundedAmount: refundTotalsByOrder.get(order.id) ?? 0
  }));

  return {
    summary: {
      paidAmount,
      refundAmount: todayRefundAmount,
      netAmount: roundMoney(paidAmount - todayRefundAmount),
      paidOrderCount: todayPaidOrders.length,
      cancelledOrderCount,
      partialRefundOrderCount: paidOrdersWithRefunds.filter(
        ({ order, refundedAmount }) => refundedAmount > 0 && refundedAmount < order.payableAmount
      ).length,
      fullyRefundedOrderCount: paidOrdersWithRefunds.filter(
        ({ order, refundedAmount }) => refundedAmount >= order.payableAmount && order.payableAmount > 0
      ).length,
      notedCancelledOrderCount
    },
    topSellingSkuRows: buildTopSellingSkuRows(todayPaidOrderIds, input.orderItems),
    giftConsumptionRows: buildGiftConsumptionRows(todayPaidOrderIds, input.orderItems),
    lowStockRows: buildLowStockRows(input.products),
    exceptionRows: buildExceptionRows(input.orders, refundTotalsByOrder, input.day)
  };
}
```

- [ ] **Step 4: 运行领域测试确认通过**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts
```

Expected:

- PASS。
- `src/domain/dashboard.test.ts` 全部用例通过。

- [ ] **Step 5: 提交 Task 1**

Run:

```powershell
git add src/domain/dashboard.ts src/domain/dashboard.test.ts
git commit -m "feat: add dashboard domain model"
```

### Task 2: 仪表盘页面加载完整数据并渲染核心模块

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 写页面失败测试**

Update `src/pages/DashboardPage.test.tsx`:

```ts
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Order, OrderItem, OrderRefund } from "../domain/types";
import { defaultPromotion, product } from "../test/fixtures";
import DashboardPage from "./DashboardPage";

const repositories = vi.hoisted(() => ({
  listOrderItems: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  listRefunds: vi.fn()
}));

vi.mock("../db/repositories", () => repositories);

function paidOrder(overrides: Partial<Order> = {}): Order {
  const now = new Date();

  return {
    id: "order-1",
    orderNo: "ECRM-001",
    status: "paid",
    paymentMethod: "wechat",
    subtotalBeforeDiscount: 40,
    discountAmount: 0,
    payableAmount: 40,
    promotionSnapshot: defaultPromotion(),
    giftStockWarning: false,
    createdAt: now.toISOString(),
    paidAt: now.toISOString(),
    ...overrides
  };
}

function orderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    productId: "sku-a",
    productNameSnapshot: "亚克力挂件",
    spuSnapshot: "挂件",
    productCodeSnapshot: "CHARM-A",
    quantity: 2,
    originalUnitPrice: 10,
    finalUnitPrice: 10,
    lineType: "normal",
    lineTotal: 20,
    ...overrides
  };
}

function refund(overrides: Partial<OrderRefund> = {}): OrderRefund {
  return {
    id: "refund-1",
    orderId: "order-1",
    amount: 5,
    method: "wechat",
    reason: "customer_return",
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-06-15T10:00:00.000Z"));
  repositories.listOrders.mockResolvedValue([]);
  repositories.listProducts.mockResolvedValue([]);
  repositories.listRefunds.mockResolvedValue([]);
  repositories.listOrderItems.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

test("shows today's paid sales, refund, net amount and paid order count", async () => {
  repositories.listOrders.mockResolvedValue([paidOrder({ payableAmount: 40 })]);
  repositories.listRefunds.mockResolvedValue([refund({ amount: 8 })]);

  render(<DashboardPage />);

  const overview = await screen.findByLabelText("今日经营概览");

  expect(within(overview).getByText("¥40.00")).toBeVisible();
  expect(within(overview).getByText("¥8.00")).toBeVisible();
  expect(within(overview).getByText("¥32.00")).toBeVisible();
  expect(within(overview).getByText("1")).toBeVisible();
});

test("shows top selling SKU, gift consumption and low stock rows", async () => {
  repositories.listOrders.mockResolvedValue([paidOrder({ id: "order-1" })]);
  repositories.listOrderItems.mockResolvedValue([
    orderItem({ id: "sale", productId: "sku-a", quantity: 2, lineTotal: 20 }),
    orderItem({ id: "gift", productId: "gift-a", quantity: 1, lineTotal: 0, lineType: "gift", productNameSnapshot: "赠品贴纸" })
  ]);
  repositories.listProducts.mockResolvedValue([
    product({ id: "low", name: "低库存挂件", spu: "挂件", productCode: "CHARM-LOW", stockQty: 1 })
  ]);

  render(<DashboardPage />);

  const topSelling = await screen.findByRole("region", { name: "热销 SKU" });
  const giftSection = screen.getByRole("region", { name: "赠品消耗" });
  const lowStock = screen.getByRole("region", { name: "低库存 SKU" });

  expect(within(topSelling).getByText("亚克力挂件")).toBeVisible();
  expect(within(topSelling).getByText("2 件")).toBeVisible();
  expect(within(giftSection).getByText("赠品贴纸")).toBeVisible();
  expect(within(lowStock).getByText("低库存挂件")).toBeVisible();
  expect(within(lowStock).getByText("CHARM-LOW")).toBeVisible();
});

test("shows after-sales overview and exception order rows", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "order-1", orderNo: "ECRM-001", payableAmount: 40, giftStockWarning: true }),
    paidOrder({
      id: "voided",
      orderNo: "ECRM-VOID",
      status: "cancelled",
      payableAmount: 20,
      cancelledAt: "2026-06-15T09:00:00.000Z",
      cancelNote: "客户取消"
    })
  ]);
  repositories.listRefunds.mockResolvedValue([refund({ orderId: "order-1", amount: 10 })]);

  render(<DashboardPage />);

  const afterSales = await screen.findByLabelText("今日售后概览");
  const exceptions = screen.getByRole("region", { name: "今日异常订单" });

  expect(within(afterSales).getByText("作废订单")).toBeVisible();
  expect(within(afterSales).getByText("部分退款")).toBeVisible();
  expect(within(exceptions).getByText("ECRM-001")).toBeVisible();
  expect(within(exceptions).getByText("赠品异常")).toBeVisible();
  expect(within(exceptions).getByText("ECRM-VOID")).toBeVisible();
  expect(within(exceptions).getByText("有备注")).toBeVisible();
});

test("loads order items for every order", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "order-1" }),
    paidOrder({ id: "order-2", orderNo: "ECRM-002" })
  ]);

  render(<DashboardPage />);

  await screen.findByLabelText("今日经营概览");

  expect(repositories.listOrderItems).toHaveBeenCalledWith("order-1");
  expect(repositories.listOrderItems).toHaveBeenCalledWith("order-2");
});

test("shows sanitized error when dashboard data loading fails", async () => {
  repositories.listRefunds.mockRejectedValue(new Error("raw dexie failure"));

  render(<DashboardPage />);

  expect(await screen.findByText("仪表盘数据加载失败，请刷新后重试。")).toBeVisible();
  expect(screen.queryByText(/raw dexie failure/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 运行页面测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- FAIL。
- 失败点应集中在 `listRefunds/listOrderItems` 未使用、页面没有新模块或新文案。

- [ ] **Step 3: 接入 repository 和领域模型**

Modify `src/pages/DashboardPage.tsx`:

- Import:

```ts
import { AlertTriangle, BarChart3, Gift, PackageX, RefreshCw, ReceiptText, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listOrderItems, listOrders, listProducts, listRefunds } from "../db/repositories";
import { buildDashboardModel } from "../domain/dashboard";
import { formatMoney } from "../domain/money";
import type { Order, OrderItem, OrderRefund, Product } from "../domain/types";
```

- Replace `DashboardState`:

```ts
type DashboardState = {
  orders: Order[];
  orderItems: OrderItem[];
  products: Product[];
  refunds: OrderRefund[];
};
```

- Replace initial state:

```ts
const [data, setData] = useState<DashboardState>({ orders: [], orderItems: [], products: [], refunds: [] });
```

- Replace `refreshDashboard` data load:

```ts
const [orders, products, refunds] = await Promise.all([listOrders(), listProducts(), listRefunds()]);
const orderItemsByOrder = await Promise.all(orders.map((order) => listOrderItems(order.id)));
setData({ orders, orderItems: orderItemsByOrder.flat(), products, refunds });
```

- Replace old `todayPaidOrders/todayPaidAmount/lowStockProducts` memo with:

```ts
const dashboard = useMemo(
  () => buildDashboardModel({ day: new Date(), orders: data.orders, orderItems: data.orderItems, refunds: data.refunds, products: data.products }),
  [data]
);
```

- Render fixed modules using existing `formatMoney`.
- Keep exact error text:

```ts
setError("仪表盘数据加载失败，请刷新后重试。");
```

- [ ] **Step 4: 页面渲染结构要求**

`DashboardPage.tsx` should include these accessible areas:

```tsx
<div className="dashboardMetricStrip" aria-label="今日经营概览">
  <div>
    <span>{formatMoney(dashboard.summary.paidAmount)}</span>
    <p>今日销售额</p>
  </div>
  <div>
    <span>{formatMoney(dashboard.summary.refundAmount)}</span>
    <p>今日退款</p>
  </div>
  <div>
    <span>{formatMoney(dashboard.summary.netAmount)}</span>
    <p>今日实收</p>
  </div>
  <div>
    <span>{dashboard.summary.paidOrderCount}</span>
    <p>今日订单</p>
  </div>
</div>

<div className="dashboardAfterSalesStrip" aria-label="今日售后概览">
  <div><span>{dashboard.summary.cancelledOrderCount}</span><p>作废订单</p></div>
  <div><span>{dashboard.summary.partialRefundOrderCount}</span><p>部分退款</p></div>
  <div><span>{dashboard.summary.fullyRefundedOrderCount}</span><p>已退款</p></div>
  <div><span>{dashboard.summary.notedCancelledOrderCount}</span><p>作废备注</p></div>
</div>
```

Sections must use:

```tsx
<section className="dashboardSection" aria-labelledby="top-selling-title">...</section>
<section className="dashboardSection" aria-labelledby="gift-consumption-title">...</section>
<section className="dashboardSection" aria-labelledby="low-stock-title">...</section>
<section className="dashboardSection" aria-labelledby="exception-orders-title">...</section>
```

The headings must be:

- `热销 SKU`
- `赠品消耗`
- `低库存 SKU`
- `今日异常订单`

- [ ] **Step 5: 运行页面测试确认通过**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- PASS。

- [ ] **Step 6: 提交 Task 2**

Run:

```powershell
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m "feat: show light dashboard sections"
```

### Task 3: 仪表盘 UI 密度和空态收口

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/styles.css`
- Modify: `src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 补充空态测试**

Add to `src/pages/DashboardPage.test.tsx`:

```ts
test("shows concise empty states for empty dashboard sections", async () => {
  render(<DashboardPage />);

  expect(await screen.findByText("今日暂无已支付订单。")).toBeVisible();
  expect(screen.getByText("今日暂无赠品消耗。")).toBeVisible();
  expect(screen.getByText("暂无低库存商品。")).toBeVisible();
  expect(screen.getByText("今日暂无异常订单。")).toBeVisible();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- FAIL，因为页面尚未完整展示这些空态。

- [ ] **Step 3: 页面空态和行组件收口**

In `DashboardPage.tsx`, ensure empty states are exactly:

- `今日暂无已支付订单。`
- `今日暂无赠品消耗。`
- `暂无低库存商品。`
- `今日暂无异常订单。`

Suggested row markup:

```tsx
<article className="dashboardRankRow" key={row.productId}>
  <div>
    <h3>{row.productName}</h3>
    <p>{row.productCode ?? row.spu}</p>
  </div>
  <div className="dashboardRowMetric">
    <strong>{row.quantity} 件</strong>
    <span>{formatMoney(row.amount)}</span>
  </div>
</article>
```

Low stock row should show product code when available:

```tsx
<p>{row.productCode ?? row.spu}</p>
```

- [ ] **Step 4: 增加 CSS**

Append or update dashboard CSS in `src/styles.css`:

```css
.dashboardHeader {
  align-items: flex-end;
}

.dashboardMetricStrip {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dashboardAfterSalesStrip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  margin-top: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--line);
}

.dashboardAfterSalesStrip div {
  min-height: 58px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.78);
}

.dashboardAfterSalesStrip span {
  display: block;
  color: var(--ink);
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}

.dashboardAfterSalesStrip p {
  margin-top: 6px;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 800;
}

.dashboardGrid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.dashboardSection {
  margin-top: 0;
  padding: 14px;
}

.dashboardRankList,
.dashboardExceptionList {
  display: grid;
  gap: 7px;
}

.dashboardRankRow,
.dashboardExceptionRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
}

.dashboardRankRow h3,
.dashboardExceptionRow h3 {
  margin: 0;
  color: var(--ink);
  font-size: 14px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.dashboardRankRow p,
.dashboardExceptionRow p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.dashboardRowMetric {
  display: grid;
  gap: 3px;
  justify-items: end;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 800;
}

.dashboardRowMetric strong {
  color: var(--ink);
  font-size: 15px;
  line-height: 1;
}

.dashboardBadgeList {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.dashboardBadge {
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border-radius: 8px;
  background: #f3ebe3;
  color: var(--muted-strong);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.dashboardBadge.isWarning {
  background: #fff0ed;
  color: #8f2f22;
}

@media (max-width: 820px) {
  .dashboardMetricStrip,
  .dashboardAfterSalesStrip,
  .dashboardGrid {
    grid-template-columns: 1fr;
  }
}
```

If existing mobile CSS conflicts in a lower section of the file, update that lower mobile block instead of duplicating contradictory rules.

- [ ] **Step 5: 运行页面测试**

Run:

```powershell
npm test -- src/pages/DashboardPage.test.tsx
```

Expected:

- PASS。

- [ ] **Step 6: 提交 Task 3**

Run:

```powershell
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx src/styles.css
git commit -m "style: tighten light dashboard layout"
```

### Task 4: 集成验证和类型构建

**Files:**
- No planned source changes unless checks expose defects.

- [ ] **Step 1: 运行聚焦测试**

Run:

```powershell
npm test -- src/domain/dashboard.test.ts src/pages/DashboardPage.test.tsx
```

Expected:

- PASS。

- [ ] **Step 2: 运行全量测试**

Run:

```powershell
npm test
```

Expected:

- PASS。
- 现有商品、售卖、订单、退款、备份测试不回归。

- [ ] **Step 3: 运行生产构建**

Run:

```powershell
npm run build
```

Expected:

- PASS。
- `tsc --noEmit && vite build` 成功。

- [ ] **Step 4: 运行空白检查**

Run:

```powershell
git diff --check
```

Expected:

- 无实际空白错误。
- 如仅出现 Windows LF/CRLF 提示，记录在汇报中。

- [ ] **Step 5: 修复检查发现的问题**

If any command fails, inspect the exact failure, make the smallest scoped change, and rerun the failing command before continuing. Do not change V1.4 scope while fixing.

- [ ] **Step 6: 提交验证修复**

If Step 5 changed files:

```powershell
git add <changed-files>
git commit -m "fix: stabilize light dashboard"
```

If Step 5 did not change files, do not create an empty commit.

### Task 5: V1.4 交付记录

**Files:**
- Create: `docs/releases/2026-06-17-ecrm-v1-4-light-dashboard-record.md`

- [ ] **Step 1: 创建交付记录**

Create `docs/releases/2026-06-17-ecrm-v1-4-light-dashboard-record.md`:

```md
# ECRM V1.4 轻量实用仪表盘交付记录

## 1. 版本定位

V1.4 在 V1.3 订单、售后、退款和备份能力稳定后，新增固定轻量仪表盘，用于线下摆摊现场快速查看今日经营、售后异常、热销 SKU、赠品消耗和低库存情况。

本版本不做飞书式可配置仪表盘，不做拖拽图表，不做云同步，不新增数据库 schema。

## 2. 已完成内容

- 今日经营概览：销售额、退款、实收、订单数。
- 今日售后概览：作废订单、部分退款、已退款、作废备注。
- 热销 SKU 排名。
- 赠品消耗统计。
- 低库存 SKU。
- 今日异常订单清单。

## 3. 统计口径

- 今日销售额只统计已支付订单。
- 作废订单不计入销售额。
- 人工退款不改变订单主状态，但会计入今日退款。
- 今日实收 = 今日销售额 - 今日退款。
- 热销 SKU 不包含赠品。
- 赠品消耗只统计订单明细中的赠品行。
- 低库存阈值固定为库存小于 3。

## 4. 验证记录

```powershell
npm test -- src/domain/dashboard.test.ts src/pages/DashboardPage.test.tsx
npm test
npm run build
git diff --check
```

验证结果：

- 聚焦测试通过。
- 全量测试通过。
- 生产构建通过。
- 空白检查无实际错误。

## 5. 已知限制

- 不支持自定义日期范围。
- 不支持自定义图表。
- 不支持从仪表盘直接打开订单详情。
- 不支持多设备实时同步。

## 6. 后续建议

- 用户验收 V1.4 后，再处理 GitHub 上传、跨设备访问和离线安装说明。
- V1.5 可评估订单调整、补差价、换货记录或更细的活动复盘统计。
```

After creating the file, replace the verification result bullets with the actual command outcomes from Task 4.

- [ ] **Step 2: 文档检查**

Run:

```powershell
git diff --check
```

Expected:

- 无实际空白错误。

- [ ] **Step 3: 提交交付记录**

Run:

```powershell
git add docs/releases/2026-06-17-ecrm-v1-4-light-dashboard-record.md
git commit -m "docs: record v1.4 light dashboard delivery"
```

## 4. 最终验收清单

实施完成后，主控 agent 必须逐项核对：

- [ ] 顶部显示今日销售额、今日退款、今日实收、今日订单。
- [ ] 作废订单不计入今日销售额。
- [ ] 今日人工退款减少今日实收。
- [ ] 售后概览显示作废、部分退款、已退款、作废备注。
- [ ] 热销 SKU 排行不包含赠品。
- [ ] 赠品消耗排行只包含赠品行。
- [ ] 低库存列表包含启用的售卖 SKU 和仅赠品 SKU。
- [ ] 异常订单清单显示作废、退款、备注、赠品异常标签。
- [ ] 数据加载失败只显示中文脱敏错误。
- [ ] 不新增 Dexie schema。
- [ ] 不引入复杂配置式仪表盘。
- [ ] 聚焦测试通过。
- [ ] 全量测试通过。
- [ ] 生产构建通过。
- [ ] `git diff --check` 无实际空白错误。
