import { describe, expect, test } from "vitest";
import { defaultPromotion, product } from "../test/fixtures";
import { buildDashboardDateRange, buildDashboardModel } from "./dashboard";
import type { Order, OrderItem, OrderRefund } from "./types";

const now = new Date("2026-06-15T12:00:00.000Z");
const todayRange = buildDashboardDateRange("today", now);

function localBoundaryIso(base: Date, dayOffset: number, endOfDay = false): string {
  const boundary = new Date(base);
  boundary.setDate(boundary.getDate() + dayOffset);
  boundary.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return boundary.toISOString();
}

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
  test("构建今日日期范围，从本地当天零点到当前时间", () => {
    expect(buildDashboardDateRange("today", now)).toEqual({
      preset: "today",
      startAt: localBoundaryIso(now, 0),
      endAt: now.toISOString(),
      label: "今日",
      isCurrentRange: true
    });
  });

  test("构建昨天日期范围，覆盖本地昨天完整自然日", () => {
    expect(buildDashboardDateRange("yesterday", now)).toEqual({
      preset: "yesterday",
      startAt: localBoundaryIso(now, -1),
      endAt: localBoundaryIso(now, -1, true),
      label: "昨天",
      isCurrentRange: false
    });
  });

  test("构建近 3 天日期范围，包含今天在内的 3 个自然日", () => {
    expect(buildDashboardDateRange("last3days", now)).toEqual({
      preset: "last3days",
      startAt: localBoundaryIso(now, -2),
      endAt: now.toISOString(),
      label: "近 3 天",
      isCurrentRange: true
    });
  });

  test("构建近 7 天日期范围，包含今天在内的 7 个自然日", () => {
    expect(buildDashboardDateRange("last7days", now)).toEqual({
      preset: "last7days",
      startAt: localBoundaryIso(now, -6),
      endAt: now.toISOString(),
      label: "近 7 天",
      isCurrentRange: true
    });
  });

  test("构建自定义日期范围，覆盖开始到结束的完整自然日", () => {
    expect(buildDashboardDateRange("custom", now, { startDate: "2026-06-13", endDate: "2026-06-15" })).toEqual({
      preset: "custom",
      startAt: new Date(2026, 5, 13, 0, 0, 0, 0).toISOString(),
      endAt: new Date(2026, 5, 15, 23, 59, 59, 999).toISOString(),
      label: "2026-06-13 至 2026-06-15",
      isCurrentRange: false
    });
  });

  test("自定义结束日期早于开始日期时抛中文错误", () => {
    expect(() => buildDashboardDateRange("custom", now, { startDate: "2026-06-16", endDate: "2026-06-15" })).toThrow(
      "结束日期不能早于开始日期。"
    );
  });

  test("自定义日期范围缺少开始或结束日期时抛中文错误", () => {
    expect(() => buildDashboardDateRange("custom", now, { startDate: "2026-06-15", endDate: "" })).toThrow(
      "自定义日期范围不完整。"
    );
  });

  test("统计今日销售额、退款额、实收额和已支付订单数，作废订单不计销售", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
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

  test("昨天范围能统计昨天订单并排除今天订单", () => {
    const model = buildDashboardModel({
      dateRange: buildDashboardDateRange("yesterday", now),
      orders: [
        order({
          id: "yesterday-paid",
          payableAmount: 40,
          paidAt: "2026-06-14T09:00:00.000Z"
        }),
        order({
          id: "today-paid",
          payableAmount: 99,
          paidAt: "2026-06-15T09:00:00.000Z"
        }),
        order({
          id: "yesterday-cancelled",
          status: "cancelled",
          paidAt: undefined,
          cancelledAt: "2026-06-14T10:00:00.000Z"
        })
      ],
      orderItems: [
        item({ id: "yesterday-item", orderId: "yesterday-paid", productId: "sku-yesterday", quantity: 2 }),
        item({ id: "today-item", orderId: "today-paid", productId: "sku-today", quantity: 5 })
      ],
      refunds: [],
      products: []
    });

    expect(model.summary.paidAmount).toBe(40);
    expect(model.summary.paidOrderCount).toBe(1);
    expect(model.summary.cancelledOrderCount).toBe(1);
    expect(model.topSellingSkuRows.map((row) => row.productId)).toEqual(["sku-yesterday"]);
  });

  test("近 3 天范围包含今天在内的 3 个自然日", () => {
    const model = buildDashboardModel({
      dateRange: buildDashboardDateRange("last3days", now),
      orders: [
        order({ id: "day-1", payableAmount: 10, paidAt: "2026-06-15T08:00:00.000Z" }),
        order({ id: "day-2", payableAmount: 20, paidAt: "2026-06-14T08:00:00.000Z" }),
        order({ id: "day-3", payableAmount: 30, paidAt: "2026-06-12T17:00:00.000Z" }),
        order({ id: "outside", payableAmount: 40, paidAt: "2026-06-12T15:59:59.999Z" })
      ],
      orderItems: [
        item({ id: "day-1-item", orderId: "day-1", productId: "sku-1", quantity: 1 }),
        item({ id: "day-2-item", orderId: "day-2", productId: "sku-2", quantity: 2 }),
        item({ id: "day-3-item", orderId: "day-3", productId: "sku-3", quantity: 3 }),
        item({ id: "outside-item", orderId: "outside", productId: "sku-outside", quantity: 9 })
      ],
      refunds: [],
      products: []
    });

    expect(model.summary.paidAmount).toBe(60);
    expect(model.summary.paidOrderCount).toBe(3);
    expect(model.topSellingSkuRows.map((row) => row.productId)).toEqual(["sku-3", "sku-2", "sku-1"]);
  });

  test("自定义范围统计范围内订单、退款、作废并排除范围外", () => {
    const model = buildDashboardModel({
      dateRange: buildDashboardDateRange("custom", now, { startDate: "2026-06-13", endDate: "2026-06-14" }),
      orders: [
        order({ id: "range-paid", orderNo: "ECRM-RANGE-PAID", payableAmount: 50, paidAt: "2026-06-13T08:00:00.000Z" }),
        order({ id: "outside-paid", orderNo: "ECRM-OUTSIDE-PAID", payableAmount: 80, paidAt: "2026-06-15T08:00:00.000Z" }),
        order({
          id: "range-cancelled",
          orderNo: "ECRM-RANGE-CANCELLED",
          status: "cancelled",
          payableAmount: 30,
          paidAt: undefined,
          cancelledAt: "2026-06-14T08:00:00.000Z"
        }),
        order({
          id: "outside-cancelled",
          orderNo: "ECRM-OUTSIDE-CANCELLED",
          status: "cancelled",
          paidAt: undefined,
          cancelledAt: "2026-06-15T08:00:00.000Z"
        })
      ],
      orderItems: [item({ id: "range-item", orderId: "range-paid", productId: "sku-range", quantity: 4 })],
      refunds: [
        refund({ id: "range-refund", orderId: "range-paid", amount: 12, createdAt: "2026-06-14T08:00:00.000Z" }),
        refund({ id: "outside-refund", orderId: "range-paid", amount: 7, createdAt: "2026-06-15T08:00:00.000Z" }),
        refund({ id: "cancelled-refund", orderId: "range-cancelled", amount: 10, createdAt: "2026-06-14T09:00:00.000Z" })
      ],
      products: []
    });

    expect(model.summary.paidAmount).toBe(50);
    expect(model.summary.refundAmount).toBe(22);
    expect(model.summary.netAmount).toBe(28);
    expect(model.summary.paidOrderCount).toBe(1);
    expect(model.summary.cancelledOrderCount).toBe(1);
    expect(model.topSellingSkuRows.map((row) => row.productId)).toEqual(["sku-range"]);
    expect(model.exceptionRows.map((row) => row.orderNo)).toEqual(["ECRM-RANGE-CANCELLED", "ECRM-RANGE-PAID"]);
  });

  test("今日统计订单归属日期优先 paidAt，缺失时使用 createdAt", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
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
      dateRange: todayRange,
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

  test("昨天订单今天补录退款时，金额按退款日期统计，状态按订单累计退款统计", () => {
    const yesterdayOrder = order({
      id: "yesterday-paid",
      orderNo: "ECRM-YESTERDAY-PAID",
      payableAmount: 40,
      createdAt: "2026-06-14T08:00:00.000Z",
      paidAt: "2026-06-14T09:00:00.000Z"
    });
    const todayRefund = refund({
      id: "today-refund-for-yesterday-order",
      orderId: "yesterday-paid",
      amount: 10,
      createdAt: "2026-06-15T10:00:00.000Z"
    });

    const yesterdayModel = buildDashboardModel({
      dateRange: buildDashboardDateRange("yesterday", now),
      orders: [yesterdayOrder],
      orderItems: [],
      refunds: [todayRefund],
      products: []
    });
    const todayModel = buildDashboardModel({
      dateRange: todayRange,
      orders: [yesterdayOrder],
      orderItems: [],
      refunds: [todayRefund],
      products: []
    });

    expect(yesterdayModel.summary.refundAmount).toBe(0);
    expect(yesterdayModel.summary.partialRefundOrderCount).toBe(1);
    expect(yesterdayModel.exceptionRows.map((row) => row.orderNo)).toEqual(["ECRM-YESTERDAY-PAID"]);
    expect(yesterdayModel.exceptionRows[0].badges).toContain("部分退款");
    expect(todayModel.summary.refundAmount).toBe(10);
    expect(todayModel.summary.partialRefundOrderCount).toBe(0);
    expect(todayModel.exceptionRows).toEqual([]);
  });

  test("近 7 天范围按模型口径过滤订单、排行和退款", () => {
    const model = buildDashboardModel({
      dateRange: buildDashboardDateRange("last7days", now),
      orders: [
        order({ id: "range-a", payableAmount: 30, paidAt: "2026-06-15T08:00:00.000Z" }),
        order({ id: "range-b", payableAmount: 20, paidAt: "2026-06-09T16:00:00.000Z" }),
        order({ id: "outside", payableAmount: 99, paidAt: "2026-06-08T15:59:59.999Z" })
      ],
      orderItems: [
        item({ id: "range-a-item", orderId: "range-a", productId: "sku-a", quantity: 2, lineTotal: 30 }),
        item({ id: "range-b-item", orderId: "range-b", productId: "sku-b", quantity: 4, lineTotal: 20 }),
        item({ id: "outside-item", orderId: "outside", productId: "sku-outside", quantity: 9, lineTotal: 99 })
      ],
      refunds: [
        refund({ id: "range-refund", orderId: "range-a", amount: 6, createdAt: "2026-06-10T08:00:00.000Z" }),
        refund({ id: "outside-refund", orderId: "range-b", amount: 5, createdAt: "2026-06-08T15:59:59.999Z" })
      ],
      products: []
    });

    expect(model.summary.paidAmount).toBe(50);
    expect(model.summary.refundAmount).toBe(6);
    expect(model.summary.netAmount).toBe(44);
    expect(model.summary.paidOrderCount).toBe(2);
    expect(model.topSellingSkuRows.map((row) => row.productId)).toEqual(["sku-b", "sku-a"]);
  });

  test("按订单累计退款区分部分退款和已退款", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
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

  test("今日作废订单存在退款时售后概览与异常订单退款标签保持一致", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({
          id: "voided-partial",
          orderNo: "ECRM-VOID-PARTIAL",
          status: "cancelled",
          payableAmount: 60,
          paidAt: undefined,
          cancelledAt: "2026-06-15T10:00:00.000Z"
        })
      ],
      orderItems: [],
      refunds: [refund({ orderId: "voided-partial", amount: 20 })],
      products: []
    });

    expect(model.summary.partialRefundOrderCount).toBe(1);
    expect(model.summary.fullyRefundedOrderCount).toBe(0);
    expect(model.exceptionRows[0].badges).toContain("部分退款");
  });

  test("热销 SKU 排名合并同 productId 的 normal 和 discount_addon，不含 gift", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
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

  test("热销 SKU 超过 5 个时只返回前 5 个", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "order-1" })],
      orderItems: Array.from({ length: 6 }, (_, index) => {
        const rank = index + 1;
        return item({
          id: `normal-${rank}`,
          productId: `sku-${rank}`,
          productNameSnapshot: `商品 ${rank}`,
          quantity: 7 - rank,
          lineTotal: (7 - rank) * 10
        });
      }),
      refunds: [],
      products: []
    });

    expect(model.topSellingSkuRows.map((row) => row.productId)).toEqual(["sku-1", "sku-2", "sku-3", "sku-4", "sku-5"]);
  });

  test("赠品消耗只统计今日已支付订单的 gift 明细", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
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

  test("赠品消耗超过 5 个时只返回前 5 个", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "order-1" })],
      orderItems: Array.from({ length: 6 }, (_, index) => {
        const rank = index + 1;
        return item({
          id: `gift-${rank}`,
          productId: `gift-${rank}`,
          productNameSnapshot: `赠品 ${rank}`,
          quantity: 7 - rank,
          lineType: "gift",
          lineTotal: 0
        });
      }),
      refunds: [],
      products: []
    });

    expect(model.giftConsumptionRows.map((row) => row.productId)).toEqual(["gift-1", "gift-2", "gift-3", "gift-4", "gift-5"]);
  });

  test("低库存按 stockQty 从低到高排序，包含仅赠品商品，排除 inactive 和安全库存", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
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
      dateRange: todayRange,
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
        order({ id: "full", orderNo: "ECRM-FULL", payableAmount: 15, paidAt: "2026-06-15T11:30:00.000Z" }),
        order({ id: "gift-warning", orderNo: "ECRM-GIFT", giftStockWarning: true, paidAt: "2026-06-15T11:45:00.000Z" })
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
      dateRange: todayRange,
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
