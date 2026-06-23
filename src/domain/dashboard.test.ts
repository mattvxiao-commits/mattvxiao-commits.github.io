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

  test("统计当前范围售出件数、赠品件数、总出库件数和客单价", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "paid-a", payableAmount: 50 }),
        order({ id: "paid-b", payableAmount: 30, paidAt: "2026-06-15T10:00:00.000Z" }),
        order({ id: "outside", payableAmount: 99, paidAt: "2026-06-14T10:00:00.000Z" })
      ],
      orderItems: [
        item({ id: "normal-a", orderId: "paid-a", productId: "sku-a", quantity: 2, lineType: "normal", lineTotal: 40 }),
        item({
          id: "addon-a",
          orderId: "paid-a",
          productId: "sku-addon",
          quantity: 1,
          originalUnitPrice: 5,
          finalUnitPrice: 3,
          lineType: "discount_addon",
          lineTotal: 3
        }),
        item({ id: "gift-a", orderId: "paid-a", productId: "gift-a", quantity: 2, lineType: "gift", lineTotal: 0 }),
        item({ id: "normal-b", orderId: "paid-b", productId: "sku-b", quantity: 3, lineType: "normal", lineTotal: 30 }),
        item({ id: "outside-normal", orderId: "outside", productId: "sku-old", quantity: 9, lineType: "normal", lineTotal: 99 })
      ],
      refunds: [refund({ orderId: "paid-a", amount: 10, createdAt: "2026-06-15T11:00:00.000Z" })],
      products: []
    });

    expect(model.operationsSummary).toEqual({
      soldQuantity: 6,
      giftQuantity: 0,
      outboundQuantity: 6,
      averageOrderValue: 35
    });
  });

  test("无已支付订单时出库与客单指标为 0", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [],
      orderItems: [],
      refunds: [],
      products: []
    });

    expect(model.operationsSummary).toEqual({
      soldQuantity: 0,
      giftQuantity: 0,
      outboundQuantity: 0,
      averageOrderValue: 0
    });
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

  test("正常销售口径排除运营赠礼、人工赠送和其他出库", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "mixed-order", payableAmount: 30 })],
      orderItems: [
        item({
          id: "sale-item",
          orderId: "mixed-order",
          productId: "sale-sku",
          productNameSnapshot: "正常销售商品",
          quantity: 1,
          originalUnitPrice: 30,
          finalUnitPrice: 30,
          lineTotal: 30,
          unitCostSnapshot: 10,
          costTotal: 10,
          grossProfit: 20
        }),
        item({
          id: "campaign-gift",
          orderId: "mixed-order",
          productId: "campaign-gift",
          productNameSnapshot: "运营赠礼商品",
          quantity: 2,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "campaign_gift",
          costTotal: 4,
          grossProfit: -4
        }),
        item({
          id: "manual-gift",
          orderId: "mixed-order",
          productId: "manual-gift",
          productNameSnapshot: "人工赠送商品",
          quantity: 1,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "manual_gift",
          costTotal: 3,
          grossProfit: -3
        })
      ],
      refunds: [],
      products: [],
      accountingScope: "sales"
    });

    expect(model.accountingScope).toBe("sales");
    expect(model.summary.paidAmount).toBe(30);
    expect(model.operationsSummary.soldQuantity).toBe(1);
    expect(model.operationsSummary.giftQuantity).toBe(0);
    expect(model.operationsSummary.outboundQuantity).toBe(1);
    expect(model.profitSummary.costAmount).toBe(10);
    expect(model.profitSummary.grossProfit).toBe(20);
    expect(model.profitSummary.giftCostAmount).toBe(0);
    expect(model.topSellingSkuRows.map((row) => row.productName)).toEqual(["正常销售商品"]);
    expect(model.activityCostSummary).toMatchObject({
      salesCost: 10,
      campaignGiftCost: 0,
      manualGiftCost: 0,
      operatingActivityCost: 0,
      nonOperatingOutboundCost: 0,
      fullOutboundCost: 10
    });
  });

  test("正常销售口径的订单数和客单价只统计含销售明细订单", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "sale-order", payableAmount: 30 }),
        order({ id: "manual-gift-order", payableAmount: 0, paidAt: "2026-06-15T10:00:00.000Z" })
      ],
      orderItems: [
        item({
          id: "sale-item",
          orderId: "sale-order",
          productId: "sale-sku",
          quantity: 1,
          lineTotal: 30,
          unitCostSnapshot: 10,
          costTotal: 10
        }),
        item({
          id: "manual-gift-item",
          orderId: "manual-gift-order",
          productId: "gift-sku",
          productNameSnapshot: "人工赠送商品",
          quantity: 2,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "manual_gift",
          unitCostSnapshot: 3,
          costTotal: 6
        })
      ],
      refunds: [],
      products: [],
      accountingScope: "sales"
    });

    expect(model.summary.paidAmount).toBe(30);
    expect(model.summary.paidOrderCount).toBe(1);
    expect(model.operationsSummary.averageOrderValue).toBe(30);
    expect(model.operationsSummary.outboundQuantity).toBe(1);
  });

  test("全部活动口径展示运营活动成本和非经营出库成本", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "mixed-order", payableAmount: 30 })],
      orderItems: [
        item({
          id: "sale-item",
          orderId: "mixed-order",
          productId: "sale-sku",
          productNameSnapshot: "正常销售商品",
          quantity: 1,
          originalUnitPrice: 30,
          finalUnitPrice: 30,
          lineTotal: 30,
          unitCostSnapshot: 10,
          costTotal: 10,
          grossProfit: 20
        }),
        item({
          id: "tier-gift",
          orderId: "mixed-order",
          productId: "tier-gift",
          productNameSnapshot: "满赠商品",
          quantity: 1,
          lineType: "gift",
          lineTotal: 0,
          costTotal: 2,
          grossProfit: -2
        }),
        item({
          id: "campaign-gift",
          orderId: "mixed-order",
          productId: "campaign-gift",
          productNameSnapshot: "运营赠礼商品",
          quantity: 2,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "campaign_gift",
          costTotal: 4,
          grossProfit: -4
        }),
        item({
          id: "manual-gift",
          orderId: "mixed-order",
          productId: "manual-gift",
          productNameSnapshot: "人工赠送商品",
          quantity: 1,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "manual_gift",
          costTotal: 3,
          grossProfit: -3
        }),
        item({
          id: "other-outbound",
          orderId: "mixed-order",
          productId: "other-outbound",
          productNameSnapshot: "其他出库商品",
          quantity: 1,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "other_non_sales",
          costTotal: 5,
          grossProfit: -5
        })
      ],
      refunds: [],
      products: [],
      accountingScope: "all"
    });

    expect(model.accountingScope).toBe("all");
    expect(model.operationsSummary).toMatchObject({
      soldQuantity: 1,
      giftQuantity: 5,
      outboundQuantity: 6
    });
    expect(model.activityCostSummary).toMatchObject({
      discountGiveawayAmount: 0,
      salesCost: 10,
      basicGrossProfit: 20,
      tierGiftCost: 2,
      campaignGiftCost: 4,
      operatingActivityCost: 6,
      activityAdjustedGrossProfit: 14,
      manualGiftCost: 3,
      otherNonSalesCost: 5,
      nonOperatingOutboundCost: 8,
      fullOutboundCost: 24
    });
    expect(model.nonSalesReasonRows.map((row) => [row.productName, row.quantity])).toEqual([
      ["运营赠礼商品", 2],
      ["人工赠送商品", 1],
      ["满赠商品", 1],
      ["其他出库商品", 1]
    ]);
  });

  test("全部活动口径提供订单性质和非销售出库数量成本拆分", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "mixed-order", payableAmount: 30 }),
        order({ id: "manual-only", payableAmount: 0, paidAt: "2026-06-15T10:00:00.000Z" })
      ],
      orderItems: [
        item({
          id: "sale-item",
          orderId: "mixed-order",
          productId: "sale-sku",
          productNameSnapshot: "正常销售商品",
          quantity: 1,
          lineTotal: 30,
          unitCostSnapshot: 10,
          costTotal: 10
        }),
        item({
          id: "tier-gift",
          orderId: "mixed-order",
          productId: "tier-gift",
          productNameSnapshot: "满赠商品",
          quantity: 1,
          lineType: "gift",
          lineTotal: 0,
          unitCostSnapshot: 2,
          costTotal: 2
        }),
        item({
          id: "campaign-gift",
          orderId: "mixed-order",
          productId: "campaign-gift",
          productNameSnapshot: "运营赠礼商品",
          quantity: 2,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "campaign_gift",
          unitCostSnapshot: 2,
          costTotal: 4
        }),
        item({
          id: "manual-gift",
          orderId: "manual-only",
          productId: "manual-gift",
          productNameSnapshot: "人工赠送商品",
          quantity: 3,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "manual_gift",
          unitCostSnapshot: 3,
          costTotal: 9
        }),
        item({
          id: "other-outbound",
          orderId: "manual-only",
          productId: "other-outbound",
          productNameSnapshot: "其他出库商品",
          quantity: 1,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "other_non_sales",
          unitCostSnapshot: 5,
          costTotal: 5
        })
      ],
      refunds: [],
      products: [],
      accountingScope: "all"
    });

    expect(model.orderNatureSummary).toEqual({
      saleOrderCount: 0,
      mixedOrderCount: 1,
      nonSalesOrderCount: 1,
      campaignGiftOrderCount: 1,
      manualGiftOrderCount: 1,
      otherNonSalesOrderCount: 1
    });
    expect(model.nonSalesBreakdown).toEqual({
      tierGiftQuantity: 1,
      campaignGiftQuantity: 2,
      manualGiftQuantity: 3,
      otherNonSalesQuantity: 1,
      tierGiftCost: 2,
      campaignGiftCost: 4,
      manualGiftCost: 9,
      otherNonSalesCost: 5
    });
  });

  test("指定非销售口径只展示对应原因的明细分布", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "mixed-order", payableAmount: 30 })],
      orderItems: [
        item({
          id: "sale-item",
          orderId: "mixed-order",
          productId: "sale-sku",
          productNameSnapshot: "正常销售商品",
          quantity: 1,
          originalUnitPrice: 30,
          finalUnitPrice: 30,
          lineTotal: 30,
          costTotal: 10
        }),
        item({
          id: "campaign-gift",
          orderId: "mixed-order",
          productId: "campaign-gift",
          productNameSnapshot: "运营赠礼商品",
          quantity: 2,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "campaign_gift",
          costTotal: 4
        }),
        item({
          id: "manual-gift",
          orderId: "mixed-order",
          productId: "manual-gift",
          productNameSnapshot: "人工赠送商品",
          quantity: 1,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "manual_gift",
          costTotal: 3
        })
      ],
      refunds: [],
      products: [],
      accountingScope: "campaign_gift"
    });

    expect(model.operationsSummary).toMatchObject({
      soldQuantity: 0,
      giftQuantity: 2,
      outboundQuantity: 2
    });
    expect(model.activityCostSummary).toMatchObject({
      campaignGiftCost: 4,
      operatingActivityCost: 4,
      fullOutboundCost: 4
    });
    expect(model.nonSalesReasonRows.map((row) => row.productName)).toEqual(["运营赠礼商品"]);
    expect(model.topSellingSkuRows).toEqual([]);
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

  test("按 SPU 聚合当前范围热销数量和销售额排行", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "paid-a" }),
        order({ id: "paid-b", paidAt: "2026-06-15T10:00:00.000Z" }),
        order({ id: "outside", paidAt: "2026-06-14T10:00:00.000Z" })
      ],
      orderItems: [
        item({ id: "a-1", orderId: "paid-a", productId: "sku-a1", spuSnapshot: "挂件", quantity: 2, lineTotal: 40 }),
        item({ id: "a-2", orderId: "paid-a", productId: "sku-a2", spuSnapshot: "挂件", quantity: 1, lineTotal: 20 }),
        item({ id: "b-1", orderId: "paid-b", productId: "sku-b1", spuSnapshot: "贴纸", quantity: 4, lineTotal: 16 }),
        item({
          id: "addon",
          orderId: "paid-b",
          productId: "sku-addon",
          spuSnapshot: "加购",
          quantity: 3,
          lineType: "discount_addon",
          lineTotal: 9
        }),
        item({ id: "gift", orderId: "paid-a", productId: "gift-a", spuSnapshot: "赠品", quantity: 9, lineType: "gift", lineTotal: 0 }),
        item({ id: "outside", orderId: "outside", productId: "sku-old", spuSnapshot: "旧品", quantity: 99, lineTotal: 99 })
      ],
      refunds: [],
      products: []
    });

    expect(model.topSellingSpuRows).toEqual([
      { spu: "贴纸", quantity: 4, amount: 16 },
      { spu: "挂件", quantity: 3, amount: 60 },
      { spu: "加购", quantity: 3, amount: 9 }
    ]);
    expect(model.topRevenueSpuRows).toEqual([
      { spu: "挂件", quantity: 3, amount: 60 },
      { spu: "贴纸", quantity: 4, amount: 16 },
      { spu: "加购", quantity: 3, amount: 9 }
    ]);
  });

  test("SPU 排行最多返回 5 条并在数值相同时按 SPU 名称排序", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "order-1" })],
      orderItems: ["A", "B", "C", "D", "E", "F"].map((spu, index) =>
        item({
          id: `spu-${spu}`,
          orderId: "order-1",
          productId: `sku-${spu}`,
          spuSnapshot: spu,
          quantity: index === 0 || index === 1 ? 10 : 6 - index,
          lineTotal: index === 0 || index === 1 ? 100 : (6 - index) * 10
        })
      ),
      refunds: [],
      products: []
    });

    expect(model.topSellingSpuRows).toHaveLength(5);
    expect(model.topSellingSpuRows.map((row) => row.spu)).toEqual(["A", "B", "C", "D", "E"]);
    expect(model.topRevenueSpuRows).toHaveLength(5);
    expect(model.topRevenueSpuRows.map((row) => row.spu)).toEqual(["A", "B", "C", "D", "E"]);
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
      products: [],
      accountingScope: "all"
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
      products: [],
      accountingScope: "all"
    });

    expect(model.giftConsumptionRows.map((row) => row.productId)).toEqual(["gift-1", "gift-2", "gift-3", "gift-4", "gift-5"]);
  });

  test("低库存按 stockQty 从低到高排序，包含仅赠品商品，排除售罄、inactive 和安全库存", () => {
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

    expect(model.lowStockRows.map((row) => row.productId)).toEqual(["gift-only"]);
    expect(model.soldOutRows.map((row) => row.productId)).toEqual(["sold-out"]);
  });

  test("库存风险支持当前范围估算剩余 20% 预警", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "paid-a" })],
      orderItems: [
        item({
          id: "ratio-low-item",
          orderId: "paid-a",
          productId: "ratio-low",
          productNameSnapshot: "百分比低库存",
          quantity: 81,
          lineType: "normal"
        }),
        item({
          id: "ratio-safe-item",
          orderId: "paid-a",
          productId: "ratio-safe",
          productNameSnapshot: "百分比安全库存",
          quantity: 80,
          lineType: "normal"
        })
      ],
      refunds: [],
      products: [
        product({ id: "ratio-low", name: "百分比低库存", stockQty: 9, isSellable: true, status: "active" }),
        product({ id: "ratio-safe", name: "百分比安全库存", stockQty: 21, isSellable: true, status: "active" })
      ]
    });

    expect(model.lowStockRows.map((row) => row.productId)).toEqual(["ratio-low"]);
    expect(model.lowStockRows[0]).toMatchObject({ productId: "ratio-low", stockQty: 9, soldQuantity: 81, stockRemainingPercent: 10 });
    expect(model.highRiskRows.map((row) => row.productId)).toEqual(["ratio-low"]);
    expect(model.highRiskRows[0]).toMatchObject({ productId: "ratio-low", stockQty: 9, soldQuantity: 81, stockRemainingPercent: 10 });
  });

  test("库存风险在估算剩余 20% 时触发预警", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "paid-a" })],
      orderItems: [
        item({
          id: "ratio-threshold-item",
          orderId: "paid-a",
          productId: "ratio-threshold",
          productNameSnapshot: "二成库存",
          quantity: 80,
          lineType: "normal"
        })
      ],
      refunds: [],
      products: [product({ id: "ratio-threshold", name: "二成库存", stockQty: 20, isSellable: true, status: "active" })]
    });

    expect(model.lowStockRows.map((row) => row.productId)).toEqual(["ratio-threshold"]);
    expect(model.highRiskRows.map((row) => row.productId)).toEqual(["ratio-threshold"]);
    expect(model.restockSuggestionRows.map((row) => row.productId)).toEqual(["ratio-threshold"]);
    expect(model.highRiskRows[0]).toMatchObject({
      productId: "ratio-threshold",
      stockQty: 20,
      soldQuantity: 80,
      stockRemainingPercent: 20
    });
  });

  test("统计售罄、高风险、滞销和补货建议 SKU", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "paid-a" }),
        order({ id: "paid-b", paidAt: "2026-06-15T10:00:00.000Z" }),
        order({ id: "outside", paidAt: "2026-06-14T10:00:00.000Z" })
      ],
      orderItems: [
        item({
          id: "risk-a-normal",
          orderId: "paid-a",
          productId: "risk-a",
          productNameSnapshot: "热卖低库存 A",
          quantity: 2,
          lineType: "normal"
        }),
        item({
          id: "risk-b-addon",
          orderId: "paid-b",
          productId: "risk-b",
          productNameSnapshot: "热卖低库存 B",
          quantity: 3,
          lineType: "discount_addon"
        }),
        item({ id: "gift-only", orderId: "paid-a", productId: "gift-only", quantity: 9, lineType: "gift" }),
        item({ id: "outside-risk", orderId: "outside", productId: "outside-risk", quantity: 9, lineType: "normal" })
      ],
      refunds: [],
      products: [
        product({ id: "sold-out", name: "售罄商品", stockQty: 0, isSellable: true, status: "active" }),
        product({ id: "risk-a", name: "热卖低库存 A", stockQty: 2, isSellable: true, status: "active" }),
        product({ id: "risk-b", name: "热卖低库存 B", stockQty: 1, isSellable: true, status: "active" }),
        product({ id: "stale-a", name: "滞销 A", stockQty: 8, isSellable: true, status: "active" }),
        product({ id: "stale-b", name: "滞销 B", stockQty: 3, isSellable: true, status: "active" }),
        product({ id: "gift-only", name: "仅赠品", stockQty: 1, isSellable: false, isGiftEligible: true, status: "active" }),
        product({ id: "inactive", name: "停用商品", stockQty: 0, status: "inactive" }),
        product({ id: "outside-risk", name: "范围外商品", stockQty: 1, isSellable: true, status: "active" })
      ]
    });

    expect(model.soldOutRows.map((row) => row.productId)).toEqual(["sold-out"]);
    expect(model.soldOutRows[0]).toMatchObject({ productId: "sold-out", stockQty: 0, soldQuantity: 0 });
    expect(model.highRiskRows.map((row) => row.productId)).toEqual(["risk-b", "risk-a"]);
    expect(model.highRiskRows[0]).toMatchObject({ productId: "risk-b", stockQty: 1, soldQuantity: 3 });
    expect(model.highRiskRows[1]).toMatchObject({ productId: "risk-a", stockQty: 2, soldQuantity: 2 });
    expect(model.restockSuggestionRows.map((row) => row.productId)).toEqual(["sold-out", "risk-b", "risk-a"]);
    expect(model.slowMovingRows.map((row) => row.productId)).toEqual(["stale-a", "stale-b", "outside-risk"]);
    expect(model.slowMovingRows[0]).toMatchObject({ productId: "stale-a", stockQty: 8, soldQuantity: 0 });
    expect(model.slowMovingRows[2]).toMatchObject({ productId: "outside-risk", stockQty: 1, soldQuantity: 0 });
  });

  test("库存风险排行最多 5 条并按库存、销量和商品名排序", () => {
    const products = [
      product({ id: "risk-1", name: "风险 1", stockQty: 0 }),
      product({ id: "risk-2", name: "风险 2", stockQty: 1 }),
      product({ id: "risk-3", name: "风险 3", stockQty: 1 }),
      product({ id: "risk-4", name: "风险 4", stockQty: 2 }),
      product({ id: "risk-5", name: "风险 5", stockQty: 2 }),
      product({ id: "risk-6", name: "风险 6", stockQty: 2 }),
      product({ id: "stale-1", name: "滞销 1", stockQty: 9 }),
      product({ id: "stale-2", name: "滞销 2", stockQty: 8 }),
      product({ id: "stale-3", name: "滞销 3", stockQty: 7 }),
      product({ id: "stale-4", name: "滞销 4", stockQty: 6 }),
      product({ id: "stale-5", name: "滞销 5", stockQty: 5 }),
      product({ id: "stale-6", name: "滞销 6", stockQty: 4 }),
      product({ id: "sold-out-a", name: "售罄 A", stockQty: 0 }),
      product({ id: "sold-out-b", name: "售罄 B", stockQty: 0 }),
      product({ id: "sold-out-c", name: "售罄 C", stockQty: 0 }),
      product({ id: "sold-out-d", name: "售罄 D", stockQty: 0 }),
      product({ id: "sold-out-e", name: "售罄 E", stockQty: 0 }),
      product({ id: "sold-out-f", name: "售罄 F", stockQty: 0 })
    ];

    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "paid-a" })],
      orderItems: [
        item({ id: "risk-1-item", orderId: "paid-a", productId: "risk-1", quantity: 2 }),
        item({ id: "risk-2-item", orderId: "paid-a", productId: "risk-2", quantity: 4 }),
        item({ id: "risk-3-item", orderId: "paid-a", productId: "risk-3", quantity: 2 }),
        item({ id: "risk-4-item", orderId: "paid-a", productId: "risk-4", quantity: 5 }),
        item({ id: "risk-5-item", orderId: "paid-a", productId: "risk-5", quantity: 3 }),
        item({ id: "risk-6-item", orderId: "paid-a", productId: "risk-6", quantity: 2 })
      ],
      refunds: [],
      products
    });

    expect(model.soldOutRows.map((row) => row.productId)).toEqual(["risk-1", "sold-out-a", "sold-out-b", "sold-out-c", "sold-out-d"]);
    expect(model.soldOutRows).toHaveLength(5);
    expect(model.highRiskRows.map((row) => row.productId)).toEqual(["risk-1", "risk-2", "risk-3", "risk-4", "risk-5"]);
    expect(model.highRiskRows).toHaveLength(5);
    expect(model.slowMovingRows.map((row) => row.productId)).toEqual(["stale-1", "stale-2", "stale-3", "stale-4", "stale-5"]);
    expect(model.slowMovingRows).toHaveLength(5);
    expect(model.restockSuggestionRows.map((row) => row.productId)).toEqual([
      "risk-1",
      "sold-out-a",
      "sold-out-b",
      "sold-out-c",
      "sold-out-d"
    ]);
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

  test("按支付方式统计当前范围已支付订单数和收款金额", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "wechat-1", paymentMethod: "wechat", payableAmount: 40 }),
        order({ id: "wechat-2", paymentMethod: "wechat", payableAmount: 10, paidAt: "2026-06-15T10:00:00.000Z" }),
        order({ id: "alipay-1", paymentMethod: "alipay", payableAmount: 30 }),
        order({ id: "cash-1", paymentMethod: "cash", payableAmount: 20 }),
        order({ id: "other-1", paymentMethod: "other", payableAmount: 8 }),
        order({ id: "unrecorded-1", paymentMethod: undefined, payableAmount: 6 }),
        order({ id: "outside", paymentMethod: "wechat", payableAmount: 99, paidAt: "2026-06-14T10:00:00.000Z" }),
        order({
          id: "cancelled",
          status: "cancelled",
          paymentMethod: "alipay",
          payableAmount: 70,
          paidAt: undefined,
          cancelledAt: "2026-06-15T11:00:00.000Z"
        })
      ],
      orderItems: [],
      refunds: [refund({ orderId: "wechat-1", amount: 5 })],
      products: []
    });

    expect(model.paymentMethodRows).toEqual([
      { method: "wechat", label: "微信", orderCount: 2, amount: 50 },
      { method: "alipay", label: "支付宝", orderCount: 1, amount: 30 },
      { method: "cash", label: "现金", orderCount: 1, amount: 20 },
      { method: "other", label: "其他", orderCount: 1, amount: 8 },
      { method: "unrecorded", label: "未记录", orderCount: 1, amount: 6 }
    ]);
  });

  test("统计当前范围优惠加购与满赠触发效果", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "addon-a", triggeredGiftTier: 35 }),
        order({ id: "addon-b", triggeredGiftTier: 68, paidAt: "2026-06-15T10:00:00.000Z" }),
        order({ id: "gift-only", triggeredGiftTier: 68, paidAt: "2026-06-15T10:30:00.000Z" }),
        order({ id: "outside", triggeredGiftTier: 148, paidAt: "2026-06-14T10:00:00.000Z" })
      ],
      orderItems: [
        item({
          id: "addon-a-1",
          orderId: "addon-a",
          productId: "sku-addon-a",
          quantity: 2,
          originalUnitPrice: 5,
          finalUnitPrice: 3,
          lineType: "discount_addon",
          lineTotal: 6
        }),
        item({
          id: "addon-b-1",
          orderId: "addon-b",
          productId: "sku-addon-b",
          quantity: 1,
          originalUnitPrice: 5,
          finalUnitPrice: 3,
          lineType: "discount_addon",
          lineTotal: 3
        }),
        item({ id: "normal", orderId: "addon-b", productId: "sku-normal", quantity: 4, lineType: "normal", lineTotal: 40 }),
        item({ id: "gift", orderId: "gift-only", productId: "gift-a", quantity: 2, lineType: "gift", lineTotal: 0 }),
        item({
          id: "outside-addon",
          orderId: "outside",
          productId: "sku-outside-addon",
          quantity: 9,
          originalUnitPrice: 5,
          finalUnitPrice: 3,
          lineType: "discount_addon",
          lineTotal: 27
        })
      ],
      refunds: [],
      products: []
    });

    expect(model.promotionSummary).toEqual({
      addonQuantity: 3,
      addonDiscountAmount: 6,
      addonOrderCount: 2,
      giftTriggeredOrderCount: 3
    });
    expect(model.giftTierRows).toEqual([
      { threshold: 35, orderCount: 1 },
      { threshold: 68, orderCount: 2 }
    ]);
  });

  test("无已支付订单时支付方式与活动效果指标为空或为 0", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "cancelled", status: "cancelled", paidAt: undefined, cancelledAt: "2026-06-15T10:00:00.000Z" })],
      orderItems: [item({ orderId: "cancelled", lineType: "discount_addon", quantity: 3 })],
      refunds: [],
      products: []
    });

    expect(model.paymentMethodRows).toEqual([
      { method: "wechat", label: "微信", orderCount: 0, amount: 0 },
      { method: "alipay", label: "支付宝", orderCount: 0, amount: 0 },
      { method: "cash", label: "现金", orderCount: 0, amount: 0 },
      { method: "other", label: "其他", orderCount: 0, amount: 0 },
      { method: "unrecorded", label: "未记录", orderCount: 0, amount: 0 }
    ]);
    expect(model.promotionSummary).toEqual({
      addonQuantity: 0,
      addonDiscountAmount: 0,
      addonOrderCount: 0,
      giftTriggeredOrderCount: 0
    });
    expect(model.giftTierRows).toEqual([]);
  });

  test("基于有成本快照的已支付订单明细计算毛利概览", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "paid-a", payableAmount: 40 })],
      orderItems: [
        item({
          id: "paid-a-item",
          orderId: "paid-a",
          productId: "sku-a",
          lineTotal: 40,
          quantity: 2,
          unitCostSnapshot: 8,
          costTotal: 16,
          grossProfit: 24
        })
      ],
      refunds: [],
      products: []
    });

    expect(model.profitSummary).toEqual({
      revenueWithCostSnapshot: 40,
      costAmount: 16,
      grossProfit: 24,
      grossMargin: 60,
      giftCostAmount: 0,
      missingCostItemCount: 0,
      missingCostOrderCount: 0
    });
  });

  test("赠品成本降低毛利，并统计缺少成本快照的旧订单明细", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "paid-a", payableAmount: 40 }),
        order({ id: "legacy-a", payableAmount: 12, paidAt: "2026-06-15T10:00:00.000Z" })
      ],
      orderItems: [
        item({
          id: "paid-a-normal",
          orderId: "paid-a",
          productId: "sku-a",
          lineType: "normal",
          lineTotal: 40,
          quantity: 2,
          unitCostSnapshot: 8,
          costTotal: 16,
          grossProfit: 24
        }),
        item({
          id: "paid-a-gift",
          orderId: "paid-a",
          productId: "gift-a",
          lineType: "gift",
          lineTotal: 0,
          quantity: 1,
          unitCostSnapshot: 2,
          costTotal: 2,
          grossProfit: -2
        }),
        item({ id: "legacy-a-normal", orderId: "legacy-a", productId: "sku-old", lineType: "normal", lineTotal: 12, quantity: 1 }),
        item({
          id: "legacy-a-addon",
          orderId: "legacy-a",
          productId: "sku-old-addon",
          lineType: "discount_addon",
          lineTotal: 3,
          quantity: 1,
          unitCostSnapshot: 1,
          costTotal: undefined,
          grossProfit: 2
        })
      ],
      refunds: [],
      products: []
    });

    expect(model.profitSummary).toEqual({
      revenueWithCostSnapshot: 40,
      costAmount: 16,
      grossProfit: 24,
      grossMargin: 60,
      giftCostAmount: 0,
      missingCostItemCount: 2,
      missingCostOrderCount: 1
    });
  });

  test("NaN 和 Infinity 成本字段视为缺少成本快照，不污染毛利统计", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "paid-valid", payableAmount: 40 }),
        order({ id: "paid-invalid-a", payableAmount: 10, paidAt: "2026-06-15T10:00:00.000Z" }),
        order({ id: "paid-invalid-b", payableAmount: 12, paidAt: "2026-06-15T11:00:00.000Z" })
      ],
      orderItems: [
        item({
          id: "valid-cost",
          orderId: "paid-valid",
          productId: "sku-valid",
          productNameSnapshot: "有效成本商品",
          lineTotal: 40,
          quantity: 2,
          unitCostSnapshot: 8,
          costTotal: 16,
          grossProfit: 24
        }),
        item({
          id: "nan-unit-cost",
          orderId: "paid-invalid-a",
          productId: "sku-nan",
          productNameSnapshot: "无效成本商品 A",
          lineTotal: 10,
          quantity: 1,
          unitCostSnapshot: Number.NaN,
          costTotal: 4,
          grossProfit: 6
        }),
        item({
          id: "infinite-cost",
          orderId: "paid-invalid-a",
          productId: "sku-infinity",
          productNameSnapshot: "无效成本商品 B",
          lineTotal: 8,
          quantity: 1,
          unitCostSnapshot: 2,
          costTotal: Infinity,
          grossProfit: 6
        }),
        item({
          id: "negative-cost",
          orderId: "paid-invalid-b",
          productId: "sku-negative",
          productNameSnapshot: "无效成本商品 C",
          lineTotal: 12,
          quantity: 1,
          unitCostSnapshot: 2,
          costTotal: -1,
          grossProfit: 13
        }),
        item({
          id: "negative-profit",
          orderId: "paid-valid",
          productId: "sku-negative-profit",
          productNameSnapshot: "负毛利商品",
          lineTotal: 5,
          quantity: 1,
          unitCostSnapshot: 6,
          costTotal: 6,
          grossProfit: -1
        })
      ],
      refunds: [],
      products: []
    });

    expect(model.profitSummary).toEqual({
      revenueWithCostSnapshot: 45,
      costAmount: 22,
      grossProfit: 23,
      grossMargin: 51.11,
      giftCostAmount: 0,
      missingCostItemCount: 3,
      missingCostOrderCount: 2
    });
    expect(model.profitSkuRows.map((row) => row.productId)).toEqual(["sku-valid", "sku-negative-profit"]);
    expect(model.profitSkuRows.every((row) => Number.isFinite(row.costAmount) && Number.isFinite(row.grossProfit))).toBe(true);
  });

  test("生成 SKU 毛利排行、SPU 毛利排行和低毛利 SKU", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "paid-a", payableAmount: 152 })],
      orderItems: [
        item({
          id: "sku-high-normal",
          orderId: "paid-a",
          productId: "sku-high",
          productNameSnapshot: "高毛利徽章",
          spuSnapshot: "徽章",
          productCodeSnapshot: "BADGE-H",
          lineType: "normal",
          quantity: 5,
          lineTotal: 100,
          unitCostSnapshot: 6,
          costTotal: 30,
          grossProfit: 70
        }),
        item({
          id: "sku-low-normal",
          orderId: "paid-a",
          productId: "sku-low",
          productNameSnapshot: "低毛利贴纸",
          spuSnapshot: "贴纸",
          productCodeSnapshot: "STICKER-L",
          lineType: "normal",
          quantity: 5,
          lineTotal: 25,
          unitCostSnapshot: 4.5,
          costTotal: 22.5,
          grossProfit: 2.5
        }),
        item({
          id: "sku-zero-normal",
          orderId: "paid-a",
          productId: "sku-zero",
          productNameSnapshot: "零毛利卡片",
          spuSnapshot: "卡片",
          productCodeSnapshot: "CARD-Z",
          lineType: "normal",
          quantity: 2,
          lineTotal: 12,
          unitCostSnapshot: 6,
          costTotal: 12,
          grossProfit: 0
        }),
        item({
          id: "sku-gift",
          orderId: "paid-a",
          productId: "sku-high",
          productNameSnapshot: "高毛利徽章",
          spuSnapshot: "徽章",
          productCodeSnapshot: "BADGE-H",
          lineType: "gift",
          quantity: 3,
          lineTotal: 0,
          unitCostSnapshot: 5,
          costTotal: 15,
          grossProfit: -15
        }),
        item({
          id: "sku-addon",
          orderId: "paid-a",
          productId: "sku-addon",
          productNameSnapshot: "加购钥匙扣",
          spuSnapshot: "钥匙扣",
          productCodeSnapshot: "KEY-A",
          lineType: "discount_addon",
          quantity: 1,
          lineTotal: 15,
          unitCostSnapshot: 5,
          costTotal: 5,
          grossProfit: 10
        })
      ],
      refunds: [],
      products: []
    });

    expect(model.profitSkuRows.map((row) => row.productId)).toEqual(["sku-high", "sku-addon", "sku-low", "sku-zero"]);
    expect(model.profitSkuRows[0]).toEqual({
      productId: "sku-high",
      productName: "高毛利徽章",
      spu: "徽章",
      productCode: "BADGE-H",
      quantity: 5,
      revenue: 100,
      costAmount: 30,
      grossProfit: 70,
      grossMargin: 70
    });
    expect(model.profitSpuRows.map((row) => row.spu)).toEqual(["徽章", "钥匙扣", "贴纸", "卡片"]);
    expect(model.profitSpuRows[0]).toEqual({
      spu: "徽章",
      quantity: 5,
      revenue: 100,
      costAmount: 30,
      grossProfit: 70,
      grossMargin: 70
    });
    expect(model.lowProfitSkuRows.map((row) => row.productId)).toEqual(["sku-zero", "sku-low"]);
    expect(model.lowProfitSkuRows[0]).toMatchObject({ productId: "sku-zero", quantity: 2, grossMargin: 0, grossProfit: 0 });
  });

  test("低毛利 SKU 完全并列时按商品名中文排序，再按 productId 兜底", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [order({ id: "paid-a", payableAmount: 30 })],
      orderItems: [
        item({
          id: "tie-b",
          orderId: "paid-a",
          productId: "sku-b",
          productNameSnapshot: "乙商品",
          lineTotal: 10,
          quantity: 1,
          unitCostSnapshot: 9,
          costTotal: 9,
          grossProfit: 1
        }),
        item({
          id: "tie-a",
          orderId: "paid-a",
          productId: "sku-a",
          productNameSnapshot: "甲商品",
          lineTotal: 10,
          quantity: 1,
          unitCostSnapshot: 9,
          costTotal: 9,
          grossProfit: 1
        }),
        item({
          id: "tie-same-name-b",
          orderId: "paid-a",
          productId: "sku-same-b",
          productNameSnapshot: "同名商品",
          lineTotal: 10,
          quantity: 1,
          unitCostSnapshot: 9,
          costTotal: 9,
          grossProfit: 1
        }),
        item({
          id: "tie-same-name-a",
          orderId: "paid-a",
          productId: "sku-same-a",
          productNameSnapshot: "同名商品",
          lineTotal: 10,
          quantity: 1,
          unitCostSnapshot: 9,
          costTotal: 9,
          grossProfit: 1
        })
      ],
      refunds: [],
      products: []
    });

    expect(model.lowProfitSkuRows.map((row) => row.productId)).toEqual(["sku-a", "sku-same-a", "sku-same-b", "sku-b"]);
  });

  test("日期范围外订单的成本明细不影响毛利概览和毛利排行", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "today-paid", payableAmount: 30 }),
        order({ id: "outside-paid", payableAmount: 999, paidAt: "2026-06-14T09:00:00.000Z" })
      ],
      orderItems: [
        item({
          id: "today-cost",
          orderId: "today-paid",
          productId: "sku-today",
          productNameSnapshot: "今日商品",
          spuSnapshot: "今日 SPU",
          lineTotal: 30,
          quantity: 1,
          unitCostSnapshot: 10,
          costTotal: 10,
          grossProfit: 20
        }),
        item({
          id: "outside-cost",
          orderId: "outside-paid",
          productId: "sku-outside",
          productNameSnapshot: "范围外商品",
          spuSnapshot: "范围外 SPU",
          lineTotal: 999,
          quantity: 9,
          unitCostSnapshot: 1,
          costTotal: 9,
          grossProfit: 990
        })
      ],
      refunds: [],
      products: []
    });

    expect(model.profitSummary).toMatchObject({ revenueWithCostSnapshot: 30, costAmount: 10, grossProfit: 20 });
    expect(model.profitSkuRows.map((row) => row.productId)).toEqual(["sku-today"]);
    expect(model.profitSpuRows.map((row) => row.spu)).toEqual(["今日 SPU"]);
    expect(model.lowProfitSkuRows).toEqual([]);
  });

  test("作废订单不纳入毛利", () => {
    const model = buildDashboardModel({
      dateRange: todayRange,
      orders: [
        order({ id: "paid-a", payableAmount: 30 }),
        order({ id: "cancelled-a", status: "cancelled", paidAt: undefined, cancelledAt: "2026-06-15T10:00:00.000Z" })
      ],
      orderItems: [
        item({
          id: "paid-a-cost",
          orderId: "paid-a",
          productId: "sku-paid",
          lineTotal: 30,
          quantity: 1,
          unitCostSnapshot: 10,
          costTotal: 10,
          grossProfit: 20
        }),
        item({
          id: "cancelled-a-cost",
          orderId: "cancelled-a",
          productId: "sku-cancelled",
          lineTotal: 80,
          quantity: 1,
          unitCostSnapshot: 20,
          costTotal: 20,
          grossProfit: 60
        }),
        item({ id: "cancelled-a-missing", orderId: "cancelled-a", productId: "sku-cancelled-missing", lineTotal: 10, quantity: 1 })
      ],
      refunds: [],
      products: []
    });

    expect(model.profitSummary).toMatchObject({
      revenueWithCostSnapshot: 30,
      costAmount: 10,
      grossProfit: 20,
      missingCostItemCount: 0,
      missingCostOrderCount: 0
    });
    expect(model.profitSkuRows.map((row) => row.productId)).toEqual(["sku-paid"]);
  });
});
