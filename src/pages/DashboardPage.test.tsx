import { fireEvent, render, screen, within } from "@testing-library/react";
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
    refund({ id: "partial-refund", orderId: "paid-partial", amount: 10, createdAt: "2026-06-15T09:40:00.000Z" }),
    refund({ id: "full-refund", orderId: "paid-full", amount: 20, createdAt: "2026-06-15T09:50:00.000Z" })
  ]);
  repositories.listProducts.mockResolvedValue([
    product({ id: "low-1", name: "低库存商品", spu: "挂件", stockQty: 2, status: "active" }),
    product({ id: "safe", name: "库存充足商品", spu: "卡片", stockQty: 3, status: "active" })
  ]);

  render(<DashboardPage />);

  expect(await screen.findByText("热销挂件")).toBeVisible();

  expect(screen.getByText("统计范围：今日")).toBeVisible();

  const businessOverview = screen.getByLabelText("经营概览");
  expect(businessOverview).toHaveClass("dashboardMetricStrip");
  expectMetricValue(businessOverview, "销售额", "¥130.00");
  expect(within(businessOverview).getByText("销售额")).toBeVisible();
  expectMetricValue(businessOverview, "退款", "¥30.00");
  expect(within(businessOverview).getByText("退款")).toBeVisible();
  expectMetricValue(businessOverview, "实收", "¥100.00");
  expect(within(businessOverview).getByText("实收")).toBeVisible();
  expectMetricValue(businessOverview, "订单", "3");
  expect(within(businessOverview).getByText("订单")).toBeVisible();

  const afterSalesOverview = screen.getByLabelText("售后概览");
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

  const exceptions = screen.getByRole("region", { name: "异常订单" });
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

  expect(await screen.findByText("当前范围暂无已支付订单。")).toBeVisible();
  expect(screen.getByText("当前范围暂无赠品消耗。")).toBeVisible();
  expect(screen.getByText("暂无低库存商品。")).toBeVisible();
  expect(screen.getByText("当前范围暂无异常订单。")).toBeVisible();

  expect(screen.getByLabelText("经营概览")).toBeVisible();
  expect(screen.getByLabelText("售后概览")).toBeVisible();
});

test("uses compact dashboard time range control structure", async () => {
  render(<DashboardPage />);

  expect(await screen.findByText("统计范围：今日")).toBeVisible();

  expect(screen.getByLabelText("仪表盘时间范围")).toHaveClass("dashboardHeaderControls");
  expect(screen.getByRole("group", { name: "时间范围" })).toHaveClass("dashboardRangeSwitch");

  fireEvent.click(screen.getByRole("button", { name: "自定义" }));

  const customRange = screen.getByLabelText("开始日期").closest(".dashboardCustomRange");
  expect(customRange).not.toBeNull();
  expect(customRange).toHaveClass("dashboardCustomRange");

  const startDate = screen.getByLabelText("开始日期");
  const endDate = screen.getByLabelText("结束日期");
  expect(startDate).toHaveValue("2026-06-15");
  expect(endDate).toHaveValue("2026-06-15");

  fireEvent.change(startDate, { target: { value: "2026-06-12" } });
  fireEvent.change(endDate, { target: { value: "2026-06-12" } });

  expect(startDate).toHaveValue("2026-06-12");
  expect(endDate).toHaveValue("2026-06-12");
  expect(screen.getByText("统计范围：2026-06-12 至 2026-06-12")).toBeVisible();
});

test("defaults to today and switches to yesterday using already loaded data", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "today", orderNo: "ECRM-TODAY", payableAmount: 80, paidAt: "2026-06-15T09:00:00.000Z" }),
    paidOrder({ id: "yesterday", orderNo: "ECRM-YESTERDAY", payableAmount: 30, paidAt: "2026-06-14T09:00:00.000Z" })
  ]);
  repositories.listOrderItems.mockImplementation((orderId: string) =>
    Promise.resolve([
      orderItem({
        id: `${orderId}-item`,
        orderId,
        productId: `${orderId}-sku`,
        productNameSnapshot: orderId === "today" ? "今日商品" : "昨天商品",
        quantity: 1,
        lineTotal: orderId === "today" ? 80 : 30
      })
    ])
  );

  render(<DashboardPage />);

  expect(await screen.findByText("今日商品")).toBeVisible();
  expect(screen.getByText("统计范围：今日")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥80.00");
  expect(screen.queryByText("昨天商品")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "昨天" }));

  expect(screen.getByText("统计范围：昨天")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥30.00");
  expect(screen.getByText("昨天商品")).toBeVisible();
  expect(screen.queryByText("今日商品")).not.toBeInTheDocument();
  expect(repositories.listOrders).toHaveBeenCalledTimes(1);
  expect(repositories.listProducts).toHaveBeenCalledTimes(1);
  expect(repositories.listRefunds).toHaveBeenCalledTimes(1);
  expect(repositories.listOrderItems).toHaveBeenCalledTimes(2);
});

test("supports last 3 days and last 7 days ranges", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "today", orderNo: "ECRM-TODAY", payableAmount: 10, paidAt: "2026-06-15T09:00:00.000Z" }),
    paidOrder({ id: "three-days", orderNo: "ECRM-3D", payableAmount: 20, paidAt: "2026-06-13T12:00:00.000Z" }),
    paidOrder({ id: "seven-days", orderNo: "ECRM-7D", payableAmount: 30, paidAt: "2026-06-09T12:00:00.000Z" }),
    paidOrder({ id: "outside", orderNo: "ECRM-OLD", payableAmount: 40, paidAt: "2026-06-08T12:00:00.000Z" })
  ]);
  repositories.listOrderItems.mockResolvedValue([]);

  render(<DashboardPage />);

  expect(await screen.findByText("统计范围：今日")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥10.00");

  fireEvent.click(screen.getByRole("button", { name: "近 3 天" }));

  expect(screen.getByText("统计范围：近 3 天")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥30.00");

  fireEvent.click(screen.getByRole("button", { name: "近 7 天" }));

  expect(screen.getByText("统计范围：近 7 天")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥60.00");
  expect(repositories.listOrders).toHaveBeenCalledTimes(1);
});

test("supports custom date range and shows an error when end date is before start date", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "custom-in", orderNo: "ECRM-CUSTOM-IN", payableAmount: 25, paidAt: "2026-06-12T12:00:00.000Z" }),
    paidOrder({ id: "custom-out", orderNo: "ECRM-CUSTOM-OUT", payableAmount: 60, paidAt: "2026-06-14T12:00:00.000Z" })
  ]);
  repositories.listOrderItems.mockResolvedValue([]);

  render(<DashboardPage />);

  expect(await screen.findByText("统计范围：今日")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "自定义" }));

  const startDate = screen.getByLabelText("开始日期");
  const endDate = screen.getByLabelText("结束日期");
  expect(startDate).toHaveAttribute("type", "date");
  expect(endDate).toHaveAttribute("type", "date");

  fireEvent.change(startDate, { target: { value: "2026-06-12" } });
  fireEvent.change(endDate, { target: { value: "2026-06-12" } });

  expect(screen.getByText("统计范围：2026-06-12 至 2026-06-12")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥25.00");

  fireEvent.change(endDate, { target: { value: "2026-06-11" } });

  expect(screen.getByText("结束日期不能早于开始日期。")).toBeVisible();
  expect(screen.getByText("统计范围：自定义日期无效")).toBeVisible();
  expect(screen.queryByLabelText("经营概览")).not.toBeInTheDocument();
  expect(repositories.listOrders).toHaveBeenCalledTimes(1);
});

test("initializes custom range to today instead of keeping the previous range", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "today", orderNo: "ECRM-TODAY", payableAmount: 10, paidAt: "2026-06-15T09:00:00.000Z" }),
    paidOrder({ id: "yesterday", orderNo: "ECRM-YESTERDAY", payableAmount: 20, paidAt: "2026-06-14T09:00:00.000Z" })
  ]);
  repositories.listOrderItems.mockResolvedValue([]);

  render(<DashboardPage />);

  expect(await screen.findByText("统计范围：今日")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "昨天" }));

  expect(screen.getByText("统计范围：昨天")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥20.00");

  fireEvent.click(screen.getByRole("button", { name: "自定义" }));

  const startDate = screen.getByLabelText("开始日期");
  const endDate = screen.getByLabelText("结束日期");
  expect(startDate).toHaveValue("2026-06-15");
  expect(endDate).toHaveValue("2026-06-15");
  expect(screen.getByText("统计范围：2026-06-15 至 2026-06-15")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥10.00");
  expect(repositories.listOrders).toHaveBeenCalledTimes(1);
});

test("resets custom range to today every time custom is selected", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "today", orderNo: "ECRM-TODAY", payableAmount: 10, paidAt: "2026-06-15T09:00:00.000Z" }),
    paidOrder({ id: "yesterday", orderNo: "ECRM-YESTERDAY", payableAmount: 20, paidAt: "2026-06-14T09:00:00.000Z" }),
    paidOrder({ id: "old-custom", orderNo: "ECRM-OLD-CUSTOM", payableAmount: 30, paidAt: "2026-06-12T12:00:00.000Z" })
  ]);
  repositories.listOrderItems.mockResolvedValue([]);

  render(<DashboardPage />);

  expect(await screen.findByText("统计范围：今日")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "自定义" }));
  fireEvent.change(screen.getByLabelText("开始日期"), { target: { value: "2026-06-12" } });
  fireEvent.change(screen.getByLabelText("结束日期"), { target: { value: "2026-06-12" } });

  expect(screen.getByText("统计范围：2026-06-12 至 2026-06-12")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥30.00");

  fireEvent.click(screen.getByRole("button", { name: "昨天" }));

  expect(screen.getByText("统计范围：昨天")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥20.00");

  fireEvent.click(screen.getByRole("button", { name: "自定义" }));

  expect(screen.getByLabelText("开始日期")).toHaveValue("2026-06-15");
  expect(screen.getByLabelText("结束日期")).toHaveValue("2026-06-15");
  expect(screen.getByText("统计范围：2026-06-15 至 2026-06-15")).toBeVisible();
  expectMetricValue(screen.getByLabelText("经营概览"), "销售额", "¥10.00");
  expect(repositories.listOrders).toHaveBeenCalledTimes(1);
});

test("refresh reloads repositories while range switching does not", async () => {
  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "today", payableAmount: 10, paidAt: "2026-06-15T09:00:00.000Z" }),
    paidOrder({ id: "yesterday", payableAmount: 20, paidAt: "2026-06-14T09:00:00.000Z" })
  ]);
  repositories.listOrderItems.mockResolvedValue([]);

  render(<DashboardPage />);

  expect(await screen.findByText("统计范围：今日")).toBeVisible();
  expect(repositories.listOrders).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "昨天" }));

  expect(screen.getByText("统计范围：昨天")).toBeVisible();
  expect(repositories.listOrders).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "刷新" }));

  expect(await screen.findByText("统计范围：昨天")).toBeVisible();
  expect(repositories.listOrders).toHaveBeenCalledTimes(2);
  expect(repositories.listProducts).toHaveBeenCalledTimes(2);
  expect(repositories.listRefunds).toHaveBeenCalledTimes(2);
  expect(repositories.listOrderItems).toHaveBeenCalledTimes(4);
});

test("shows sanitized error when dashboard loading fails", async () => {
  repositories.listRefunds.mockRejectedValue(new Error("raw refund database failure"));

  render(<DashboardPage />);

  expect(await screen.findByText("仪表盘数据加载失败，请刷新后重试。")).toBeVisible();
  expect(screen.queryByText(/raw refund database failure/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("经营概览")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("售后概览")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "热销 SKU" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "赠品消耗" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "低库存 SKU" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "异常订单" })).not.toBeInTheDocument();
  expect(screen.queryByText(/^暂无/)).not.toBeInTheDocument();
});
