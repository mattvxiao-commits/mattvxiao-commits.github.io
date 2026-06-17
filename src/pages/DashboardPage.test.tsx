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

function expectMetricValue(region: HTMLElement, label: string, value: string) {
  expect(within(region).getByText(label).previousElementSibling).toHaveTextContent(value);
}

function paidOrder(overrides: Partial<Order> = {}): Order {
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

function orderItem(overrides: Partial<OrderItem> = {}): OrderItem {
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-06-15T10:00:00.000Z"));
  repositories.listOrders.mockResolvedValue([]);
  repositories.listOrderItems.mockResolvedValue([]);
  repositories.listProducts.mockResolvedValue([]);
  repositories.listRefunds.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

test("loads full dashboard data and renders core sections", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "paid-main", orderNo: "ECRM-001", payableAmount: 80 }),
    paidOrder({ id: "paid-partial", orderNo: "ECRM-002", payableAmount: 30, paidAt: "2026-06-15T09:10:00.000Z" }),
    paidOrder({ id: "paid-full", orderNo: "ECRM-003", payableAmount: 20, paidAt: "2026-06-15T09:20:00.000Z" }),
    paidOrder({
      id: "voided",
      orderNo: "ECRM-004",
      status: "cancelled",
      payableAmount: 50,
      paidAt: undefined,
      cancelledAt: "2026-06-15T09:30:00.000Z",
      cancelNote: "客户改买"
    })
  ]);
  repositories.listOrderItems.mockImplementation((orderId: string) =>
    Promise.resolve(
      ({
        "paid-main": [
          orderItem({
            id: "normal-main",
            orderId,
            productId: "sku-a",
            productNameSnapshot: "热销挂件",
            spuSnapshot: "挂件",
            quantity: 3,
            lineTotal: 60
          }),
          orderItem({
            id: "gift-main",
            orderId,
            productId: "gift-a",
            productNameSnapshot: "赠品贴纸",
            spuSnapshot: "贴纸",
            quantity: 2,
            lineType: "gift",
            lineTotal: 0
          })
        ],
        "paid-partial": [
          orderItem({
            id: "normal-partial",
            orderId,
            productId: "sku-b",
            productNameSnapshot: "明信片",
            spuSnapshot: "纸品",
            quantity: 1,
            lineTotal: 30
          })
        ],
        "paid-full": [],
        voided: []
      })[orderId] ?? []
    )
  );
  repositories.listRefunds.mockResolvedValue([
    refund({ id: "partial-refund", orderId: "paid-partial", amount: 10 }),
    refund({ id: "full-refund", orderId: "paid-full", amount: 20 })
  ]);
  repositories.listProducts.mockResolvedValue([
    product({ id: "low-1", name: "低库存商品", spu: "挂件", stockQty: 2, status: "active" }),
    product({ id: "safe", name: "库存充足商品", spu: "卡片", stockQty: 3, status: "active" })
  ]);

  render(<DashboardPage />);

  expect(await screen.findByText("热销挂件")).toBeVisible();

  const businessOverview = screen.getByLabelText("今日经营概览");
  expect(businessOverview).toHaveClass("dashboardMetricStrip");
  expectMetricValue(businessOverview, "今日销售额", "¥130.00");
  expect(within(businessOverview).getByText("今日销售额")).toBeVisible();
  expectMetricValue(businessOverview, "今日退款", "¥30.00");
  expect(within(businessOverview).getByText("今日退款")).toBeVisible();
  expectMetricValue(businessOverview, "今日实收", "¥100.00");
  expect(within(businessOverview).getByText("今日实收")).toBeVisible();
  expectMetricValue(businessOverview, "今日订单", "3");
  expect(within(businessOverview).getByText("今日订单")).toBeVisible();

  const afterSalesOverview = screen.getByLabelText("今日售后概览");
  expect(afterSalesOverview).toHaveClass("dashboardAfterSalesStrip");
  expectMetricValue(afterSalesOverview, "作废订单", "1");
  expect(within(afterSalesOverview).getByText("作废订单")).toBeVisible();
  expectMetricValue(afterSalesOverview, "部分退款", "1");
  expect(within(afterSalesOverview).getByText("部分退款")).toBeVisible();
  expectMetricValue(afterSalesOverview, "已退款", "1");
  expect(within(afterSalesOverview).getByText("已退款")).toBeVisible();
  expectMetricValue(afterSalesOverview, "作废备注", "1");
  expect(within(afterSalesOverview).getByText("作废备注")).toBeVisible();

  const topSellingSku = screen.getByRole("region", { name: "热销 SKU" });
  expect(topSellingSku.querySelector(".dashboardRankList")).not.toBeNull();
  const topSellingRow = within(topSellingSku).getByText("热销挂件").closest(".dashboardRankRow");
  expect(topSellingRow).not.toBeNull();
  expect(within(topSellingRow as HTMLElement).getByText("CHARM-BLK")).toBeVisible();
  expect(within(topSellingRow as HTMLElement).getByText("3 件")).toBeVisible();
  expect(within(topSellingRow as HTMLElement).getByText("¥60.00")).toBeVisible();

  const giftConsumption = screen.getByRole("region", { name: "赠品消耗" });
  expect(giftConsumption.querySelector(".dashboardRankList")).not.toBeNull();
  const giftRow = within(giftConsumption).getByText("赠品贴纸").closest(".dashboardRankRow");
  expect(giftRow).not.toBeNull();
  expect(within(giftRow as HTMLElement).getByText("CHARM-BLK")).toBeVisible();
  expect(within(giftRow as HTMLElement).getByText("2 件")).toBeVisible();

  const lowStock = screen.getByRole("region", { name: "低库存 SKU" });
  expect(lowStock.querySelector(".dashboardRankList")).not.toBeNull();
  const lowStockRow = within(lowStock).getByText("低库存商品").closest(".dashboardRankRow");
  expect(lowStockRow).not.toBeNull();
  expect(within(lowStockRow as HTMLElement).getByText("NORMAL-BASE")).toBeVisible();
  expect(within(lowStockRow as HTMLElement).getByText("库存 2")).toBeVisible();

  const exceptions = screen.getByRole("region", { name: "今日异常订单" });
  expect(exceptions.querySelector(".dashboardExceptionList")).not.toBeNull();
  expect(exceptions.querySelector(".dashboardExceptionRow")).not.toBeNull();
  expect(within(exceptions).getByText("ECRM-002")).toBeVisible();
  expect(within(exceptions).getByText("¥30.00")).toBeVisible();
  expect(within(exceptions).getByText("部分退款")).toBeVisible();
  expect(within(exceptions).getByText("部分退款")).toHaveClass("dashboardBadge");
  expect(within(exceptions).getByText("ECRM-003")).toBeVisible();
  expect(within(exceptions).getByText("已退款")).toBeVisible();
  expect(within(exceptions).getByText("ECRM-004")).toBeVisible();
  expect(within(exceptions).getByText("已作废")).toBeVisible();
  expect(within(exceptions).getByText("有备注")).toBeVisible();

  expect(repositories.listOrderItems).toHaveBeenCalledWith("paid-main");
  expect(repositories.listOrderItems).toHaveBeenCalledWith("paid-partial");
  expect(repositories.listOrderItems).toHaveBeenCalledWith("paid-full");
  expect(repositories.listOrderItems).toHaveBeenCalledWith("voided");
  expect(repositories.listOrderItems).toHaveBeenCalledTimes(4);
});

test("shows dashboard empty states after successful empty load", async () => {
  render(<DashboardPage />);

  expect(await screen.findByText("今日暂无已支付订单。")).toBeVisible();
  expect(screen.getByText("今日暂无赠品消耗。")).toBeVisible();
  expect(screen.getByText("暂无低库存商品。")).toBeVisible();
  expect(screen.getByText("今日暂无异常订单。")).toBeVisible();

  expect(screen.getByLabelText("今日经营概览")).toBeVisible();
  expect(screen.getByLabelText("今日售后概览")).toBeVisible();
});

test("shows sanitized error when dashboard loading fails", async () => {
  repositories.listRefunds.mockRejectedValue(new Error("raw refund database failure"));

  render(<DashboardPage />);

  expect(await screen.findByText("仪表盘数据加载失败，请刷新后重试。")).toBeVisible();
  expect(screen.queryByText(/raw refund database failure/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("今日经营概览")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("今日售后概览")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "热销 SKU" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "赠品消耗" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "低库存 SKU" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "今日异常订单" })).not.toBeInTheDocument();
  expect(screen.queryByText(/^暂无/)).not.toBeInTheDocument();
});
