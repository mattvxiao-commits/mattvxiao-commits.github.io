import { describe, expect, test } from "vitest";
import { defaultPromotion } from "../test/fixtures";
import type { Order, OrderRefund } from "./types";
import {
  dateRangeLabels,
  deriveOrderNature,
  filterAndSortOrders,
  getOrderAfterSalesBadges,
  getNormalizedOrderLine,
  orderCancelReasonLabels,
  orderNatureLabels,
  orderStatusLabels,
  paymentMethodLabels,
  type OrderDateRange,
  type OrderHistoryFilters
} from "./orderHistory";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNo: "ECRM-20260617-001",
    status: "paid",
    paymentMethod: "wechat",
    subtotalBeforeDiscount: 20,
    discountAmount: 0,
    payableAmount: 20,
    promotionSnapshot: defaultPromotion(),
    giftStockWarning: false,
    createdAt: "2026-06-17T09:00:00.000Z",
    paidAt: "2026-06-17T09:05:00.000Z",
    ...overrides
  };
}

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

const emptyFilters: OrderHistoryFilters = {
  query: "",
  dateRange: "all",
  status: "all",
  paymentMethod: "all"
};

describe("order history filters", () => {
  test("filters by trimmed order number query case-insensitively", () => {
    const result = filterAndSortOrders(
      [
        order({ id: "match", orderNo: "ECRM-20260617-ABC" }),
        order({ id: "miss", orderNo: "SHOP-20260617-002" })
      ],
      { ...emptyFilters, query: "  abc  " },
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(["match"]);
  });

  test.each([
    ["today", ["today"]],
    ["yesterday", ["yesterday"]],
    ["last7", ["today", "yesterday", "last7-boundary"]],
    ["last30", ["today", "yesterday", "last7-boundary", "last7-excluded", "last30-boundary"]],
    ["all", ["today", "yesterday", "last7-boundary", "last7-excluded", "last30-boundary", "last30-excluded"]]
  ] satisfies Array<[OrderDateRange, string[]]>)("filters date range %s", (dateRange, expectedIds) => {
    const result = filterAndSortOrders(
      [
        order({ id: "today", paidAt: "2026-06-17T08:00:00.000Z", createdAt: "2026-06-16T20:00:00.000Z" }),
        order({ id: "yesterday", paidAt: undefined, createdAt: "2026-06-16T09:00:00.000Z" }),
        order({ id: "last7-boundary", paidAt: "2026-06-11T09:00:00.000Z" }),
        order({ id: "last7-excluded", paidAt: "2026-06-10T09:00:00.000Z" }),
        order({ id: "last30-boundary", paidAt: "2026-05-19T09:00:00.000Z" }),
        order({ id: "last30-excluded", paidAt: "2026-05-18T09:00:00.000Z" })
      ],
      { ...emptyFilters, dateRange },
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(expectedIds);
  });

  test("filters by status and payment method", () => {
    const result = filterAndSortOrders(
      [
        order({ id: "wechat-paid", status: "paid", paymentMethod: "wechat" }),
        order({ id: "cash-paid", status: "paid", paymentMethod: "cash" }),
        order({ id: "pending", status: "pending_payment", paymentMethod: "wechat" })
      ],
      { ...emptyFilters, status: "paid", paymentMethod: "cash" },
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(["cash-paid"]);
  });

  test("does not filter by status or payment method when both filters are all", () => {
    const result = filterAndSortOrders(
      [
        order({ id: "wechat-paid", status: "paid", paymentMethod: "wechat", paidAt: "2026-06-17T11:00:00.000Z" }),
        order({
          id: "cash-cancelled",
          status: "cancelled",
          paymentMethod: "cash",
          paidAt: undefined,
          createdAt: "2026-06-17T10:00:00.000Z"
        }),
        order({
          id: "alipay-pending",
          status: "pending_payment",
          paymentMethod: "alipay",
          paidAt: undefined,
          createdAt: "2026-06-17T09:00:00.000Z"
        })
      ],
      { ...emptyFilters, status: "all", paymentMethod: "all" },
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(["wechat-paid", "cash-cancelled", "alipay-pending"]);
  });

  test("sorts by paid time with created time fallback descending", () => {
    const result = filterAndSortOrders(
      [
        order({ id: "created-middle", paidAt: undefined, createdAt: "2026-06-17T10:00:00.000Z" }),
        order({ id: "paid-newest", paidAt: "2026-06-17T11:00:00.000Z", createdAt: "2026-06-17T08:00:00.000Z" }),
        order({ id: "paid-oldest", paidAt: "2026-06-17T09:00:00.000Z" })
      ],
      emptyFilters,
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(["paid-newest", "created-middle", "paid-oldest"]);
  });

  test("returns no after-sales badges for paid orders", () => {
    expect(getOrderAfterSalesBadges(order({ status: "paid" }), [])).toEqual([]);
  });

  test("returns default void badges for cancelled orders without a reason", () => {
    expect(getOrderAfterSalesBadges(order({ status: "cancelled", cancelledAt: "2026-06-17T10:00:00.000Z" }), [])).toEqual([
      { label: "已作废", tone: "danger" },
      { label: "误操作", tone: "neutral" }
    ]);
  });

  test("returns reason and note badges for cancelled orders", () => {
    expect(
      getOrderAfterSalesBadges(
        order({
          status: "cancelled",
          cancelledAt: "2026-06-17T10:00:00.000Z",
          cancelReason: "customer_cancelled",
          cancelNote: " 客户临时取消。 "
        }),
        []
      )
    ).toEqual([
      { label: "已作废", tone: "danger" },
      { label: "客户取消", tone: "neutral" },
      { label: "有备注", tone: "neutral" }
    ]);
  });

  test("returns partial refund badge when refunds are below payable amount", () => {
    expect(getOrderAfterSalesBadges(order({ id: "order-1", payableAmount: 20 }), [refund({ amount: 5 })])).toEqual([
      { label: "部分退款", tone: "neutral" }
    ]);
  });

  test("returns refunded badge when refunds reach payable amount", () => {
    expect(
      getOrderAfterSalesBadges(order({ id: "order-1", payableAmount: 20 }), [
        refund({ amount: 10 }),
        refund({ id: "refund-2", amount: 10 })
      ])
    ).toEqual([{ label: "已退款", tone: "danger" }]);
  });

  test("combines void and refund badges for cancelled refunded orders", () => {
    expect(
      getOrderAfterSalesBadges(
        order({
          id: "order-1",
          status: "cancelled",
          payableAmount: 20,
          cancelReason: "other"
        }),
        [refund({ amount: 20 })]
      )
    ).toEqual([
      { label: "已作废", tone: "danger" },
      { label: "其他", tone: "neutral" },
      { label: "已退款", tone: "danger" }
    ]);
  });

  test("exports Chinese labels used by the sales page", () => {
    expect(dateRangeLabels).toEqual({
      today: "今日",
      yesterday: "昨日",
      last7: "近 7 天",
      last30: "近 30 天",
      all: "全部"
    });
    expect(orderStatusLabels).toEqual({
      pending_payment: "待支付",
      paid: "已支付",
      cancelled: "已取消"
    });
    expect(paymentMethodLabels).toEqual({
      wechat: "微信",
      alipay: "支付宝",
      cash: "现金",
      other: "其他"
    });
    expect(orderCancelReasonLabels).toEqual({
      mistake: "误操作",
      customer_cancelled: "客户取消",
      duplicate_order: "重复下单",
      inventory_issue: "库存/赠品异常",
      payment_issue: "收款异常",
      other: "其他"
    });
    expect(orderNatureLabels).toEqual({
      sale: "正常销售",
      mixed: "销售 + 赠送",
      non_sales: "非销售出库"
    });
  });

  test("derives order nature from normalized order lines", () => {
    expect(
      deriveOrderNature([
        getNormalizedOrderLine({
          id: "sale-line",
          orderId: "order-1",
          productId: "product-1",
          productNameSnapshot: "销售商品",
          spuSnapshot: "SPU",
          quantity: 1,
          originalUnitPrice: 20,
          finalUnitPrice: 20,
          lineType: "normal",
          lineTotal: 20
        }),
        getNormalizedOrderLine({
          id: "gift-line",
          orderId: "order-1",
          productId: "gift-1",
          productNameSnapshot: "运营赠品",
          spuSnapshot: "赠品SPU",
          quantity: 1,
          originalUnitPrice: 0,
          finalUnitPrice: 0,
          lineType: "gift",
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "campaign_gift"
        })
      ])
    ).toBe("mixed");

    expect(
      deriveOrderNature([
        getNormalizedOrderLine({
          id: "gift-line",
          orderId: "order-1",
          productId: "gift-1",
          productNameSnapshot: "人工赠品",
          spuSnapshot: "赠品SPU",
          quantity: 1,
          originalUnitPrice: 9,
          finalUnitPrice: 0,
          lineType: "gift",
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "manual_gift"
        })
      ])
    ).toBe("non_sales");
  });

  test("normalizes legacy gift lines as non-sales tier gifts", () => {
    expect(
      getNormalizedOrderLine({
        id: "legacy-gift",
        orderId: "order-1",
        productId: "gift-1",
        productNameSnapshot: "满赠赠品",
        spuSnapshot: "赠品SPU",
        quantity: 1,
        originalUnitPrice: 0,
        finalUnitPrice: 0,
        lineType: "gift",
        lineTotal: 0
      })
    ).toEqual(
      expect.objectContaining({
        revenueType: "non_sales",
        nonSalesReason: "tier_gift",
        statisticalUnitPrice: 0,
        statisticalSubtotal: 0,
        discountGiveawayAmount: 0
      })
    );
  });
});
