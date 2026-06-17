import { describe, expect, test } from "vitest";
import { defaultPromotion, product } from "../test/fixtures";
import { buildDashboardModel } from "./dashboard";
import type { Order, OrderItem, OrderRefund } from "./types";

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
  test("统计今日销售额、退款额、实收额和已支付订单数，作废订单不计销售", () => {
    const model = buildDashboardModel({
      day,
      orders: [
        order({ id: "today-paid", payableAmount: 40 }),
        order({
          id: "yesterday-paid",
          payableAmount: 99,
          createdAt: "2026-06-14T09:00:00.000Z",
          paidAt: "2026-06-14T09:01:00.000Z"
        }),
        order({
          id: "cancelled",
          status: "cancelled",
          payableAmount: 70,
          paidAt: undefined,
          cancelledAt: "2026-06-15T10:00:00.000Z"
        })
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

  test("今日统计订单归属日期优先 paidAt，缺失时使用 createdAt", () => {
    const model = buildDashboardModel({
      day,
      orders: [
        order({
          id: "paid-at-today",
          payableAmount: 20,
          createdAt: "2026-06-14T09:00:00.000Z",
          paidAt: "2026-06-15T09:00:00.000Z"
        }),
        order({
          id: "created-at-today",
          payableAmount: 30,
          paidAt: undefined,
          createdAt: "2026-06-15T10:00:00.000Z"
        }),
        order({
          id: "paid-at-yesterday",
          payableAmount: 40,
          createdAt: "2026-06-15T11:00:00.000Z",
          paidAt: "2026-06-14T11:00:00.000Z"
        })
      ],
      orderItems: [
        item({ id: "paid-at-today-item", orderId: "paid-at-today", productId: "sku-a", quantity: 2 }),
        item({ id: "created-at-today-item", orderId: "created-at-today", productId: "sku-b", quantity: 3 }),
        item({ id: "paid-at-yesterday-item", orderId: "paid-at-yesterday", productId: "sku-c", quantity: 4 })
      ],
      refunds: [],
      products: []
    });

    expect(model.summary.paidAmount).toBe(50);
    expect(model.summary.paidOrderCount).toBe(2);
    expect(model.topSellingSkuRows.map((row) => row.productId)).toEqual(["sku-b", "sku-a"]);
  });

  test("今日退款按退款 createdAt 归属日期，非当天退款不计入今日退款", () => {
    const model = buildDashboardModel({
      day,
      orders: [order({ id: "today-paid", payableAmount: 40 })],
      orderItems: [],
      refunds: [
        refund({ id: "today-refund", orderId: "today-paid", amount: 8, createdAt: "2026-06-15T11:00:00.000Z" }),
        refund({ id: "yesterday-refund", orderId: "today-paid", amount: 5, createdAt: "2026-06-14T11:00:00.000Z" })
      ],
      products: []
    });

    expect(model.summary.refundAmount).toBe(8);
    expect(model.summary.netAmount).toBe(32);
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
        refund({ id: "refund-full-a", orderId: "full", amount: 20 }),
        refund({ id: "refund-full-b", orderId: "full", amount: 10 })
      ],
      products: []
    });

    expect(model.summary.partialRefundOrderCount).toBe(1);
    expect(model.summary.fullyRefundedOrderCount).toBe(1);
  });

  test("热销 SKU 排名合并同 productId 的 normal 和 discount_addon，不含 gift", () => {
    const model = buildDashboardModel({
      day,
      orders: [order({ id: "order-1" })],
      orderItems: [
        item({ id: "normal-1", productId: "sku-a", quantity: 2, lineTotal: 20, lineType: "normal" }),
        item({ id: "discount-1", productId: "sku-a", quantity: 1, lineTotal: 3, lineType: "discount_addon" }),
        item({ id: "normal-2", productId: "sku-b", quantity: 1, lineTotal: 12, productNameSnapshot: "明信片" }),
        item({
          id: "gift-1",
          productId: "gift-a",
          quantity: 3,
          lineTotal: 0,
          lineType: "gift",
          productNameSnapshot: "赠品贴纸"
        })
      ],
      refunds: [],
      products: []
    });

    expect(model.topSellingSkuRows[0]).toMatchObject({ productId: "sku-a", quantity: 3, amount: 23 });
    expect(model.topSellingSkuRows.map((row) => row.productId)).toEqual(["sku-a", "sku-b"]);
  });

  test("赠品消耗只统计今日已支付订单的 gift 明细", () => {
    const model = buildDashboardModel({
      day,
      orders: [
        order({ id: "today-paid" }),
        order({ id: "cancelled", status: "cancelled", paidAt: undefined, cancelledAt: "2026-06-15T10:00:00.000Z" })
      ],
      orderItems: [
        item({ id: "gift-today", orderId: "today-paid", productId: "gift-a", quantity: 3, lineType: "gift", lineTotal: 0 }),
        item({ id: "normal-today", orderId: "today-paid", productId: "sku-a", quantity: 2, lineType: "normal" }),
        item({ id: "gift-cancelled", orderId: "cancelled", productId: "gift-a", quantity: 5, lineType: "gift", lineTotal: 0 })
      ],
      refunds: [],
      products: []
    });

    expect(model.giftConsumptionRows).toEqual([
      {
        productId: "gift-a",
        productName: "亚克力挂件",
        spu: "挂件",
        productCode: "CHARM-BLK",
        quantity: 3
      }
    ]);
  });

  test("低库存按 stockQty 从低到高排序，包含仅赠品商品，排除 inactive 和安全库存", () => {
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

  test("今日异常订单清单包含作废、部分退款、已退款、备注和赠品异常标签", () => {
    const model = buildDashboardModel({
      day,
      orders: [
        order({
          id: "voided",
          orderNo: "ECRM-VOID",
          status: "cancelled",
          paidAt: undefined,
          cancelledAt: "2026-06-15T10:00:00.000Z",
          cancelNote: "客户改买"
        }),
        order({ id: "partial", orderNo: "ECRM-PARTIAL", payableAmount: 20, paidAt: "2026-06-15T11:00:00.000Z" }),
        order({ id: "full", orderNo: "ECRM-FULL", payableAmount: 15, paidAt: "2026-06-15T12:00:00.000Z" }),
        order({ id: "gift-warning", orderNo: "ECRM-GIFT", giftStockWarning: true, paidAt: "2026-06-15T13:00:00.000Z" })
      ],
      orderItems: [],
      refunds: [
        refund({ id: "refund-partial", orderId: "partial", amount: 5 }),
        refund({ id: "refund-full", orderId: "full", amount: 15 })
      ],
      products: []
    });

    expect(model.exceptionRows.map((row) => row.orderNo)).toEqual(["ECRM-GIFT", "ECRM-FULL", "ECRM-PARTIAL", "ECRM-VOID"]);
    expect(model.exceptionRows[0].badges).toContain("赠品异常");
    expect(model.exceptionRows[1].badges).toContain("已退款");
    expect(model.exceptionRows[2].badges).toContain("部分退款");
    expect(model.exceptionRows[3].badges).toEqual(["已作废", "有备注"]);
  });

  test("今日异常订单最多返回 8 条并按时间倒序保留最新记录", () => {
    const exceptionOrders = Array.from({ length: 9 }, (_, index) => {
      const orderNumber = String(index + 1).padStart(3, "0");
      return order({
        id: `gift-warning-${orderNumber}`,
        orderNo: `ECRM-${orderNumber}`,
        giftStockWarning: true,
        paidAt: `2026-06-15T${String(index + 1).padStart(2, "0")}:00:00.000Z`
      });
    });

    const model = buildDashboardModel({
      day,
      orders: exceptionOrders,
      orderItems: [],
      refunds: [],
      products: []
    });

    expect(model.exceptionRows).toHaveLength(8);
    expect(model.exceptionRows.map((row) => row.orderNo)).toEqual([
      "ECRM-009",
      "ECRM-008",
      "ECRM-007",
      "ECRM-006",
      "ECRM-005",
      "ECRM-004",
      "ECRM-003",
      "ECRM-002"
    ]);
  });
});
