import { describe, expect, test, vi } from "vitest";
import { defaultPromotion } from "../test/fixtures";
import type { Order } from "./types";
import {
  dateRangeLabels,
  filterAndSortOrders,
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

const emptyFilters: OrderHistoryFilters = {
  query: "",
  dateRange: "all",
  status: "all",
  paymentMethod: "all"
};

describe("order history filters", () => {
  test("filters by order number query case-insensitively", () => {
    const result = filterAndSortOrders(
      [
        order({ id: "match", orderNo: "ECRM-20260617-ABC" }),
        order({ id: "miss", orderNo: "SHOP-20260617-002" })
      ],
      { ...emptyFilters, query: "abc" },
      new Date("2026-06-17T12:00:00.000Z")
    );

    expect(result.map((item) => item.id)).toEqual(["match"]);
  });

  test.each([
    ["today", ["today"]],
    ["yesterday", ["yesterday"]],
    ["last7", ["today", "yesterday", "last7"]],
    ["last30", ["today", "yesterday", "last7", "last30"]],
    ["all", ["today", "yesterday", "last7", "last30", "old"]]
  ] satisfies Array<[OrderDateRange, string[]]>)("filters date range %s", (dateRange, expectedIds) => {
    const result = filterAndSortOrders(
      [
        order({ id: "today", paidAt: "2026-06-17T08:00:00.000Z", createdAt: "2026-06-16T20:00:00.000Z" }),
        order({ id: "yesterday", paidAt: undefined, createdAt: "2026-06-16T09:00:00.000Z" }),
        order({ id: "last7", paidAt: "2026-06-12T09:00:00.000Z" }),
        order({ id: "last30", paidAt: "2026-05-25T09:00:00.000Z" }),
        order({ id: "old", paidAt: "2026-05-01T09:00:00.000Z" })
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

  test("exports Chinese labels used by the sales page", () => {
    expect(dateRangeLabels.today).toBe("今日");
    expect(orderStatusLabels.paid).toBe("已支付");
    expect(paymentMethodLabels.alipay).toBe("支付宝");
  });
});
