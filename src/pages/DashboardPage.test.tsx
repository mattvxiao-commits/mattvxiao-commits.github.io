import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { Order } from "../domain/types";
import { defaultPromotion, product } from "../test/fixtures";
import DashboardPage from "./DashboardPage";

const repositories = vi.hoisted(() => ({
  listOrders: vi.fn(),
  listProducts: vi.fn()
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

beforeEach(() => {
  vi.clearAllMocks();
  repositories.listOrders.mockResolvedValue([]);
  repositories.listProducts.mockResolvedValue([]);
});

test("shows today's paid sales amount and order count using paidAt with createdAt fallback", async () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  repositories.listOrders.mockResolvedValue([
    paidOrder({ id: "today-paid-at", orderNo: "ECRM-001", payableAmount: 28.5, paidAt: today.toISOString(), createdAt: yesterday.toISOString() }),
    paidOrder({ id: "today-created-at", orderNo: "ECRM-002", payableAmount: 12, paidAt: undefined, createdAt: today.toISOString() }),
    paidOrder({ id: "old-paid", orderNo: "ECRM-003", payableAmount: 99, paidAt: yesterday.toISOString(), createdAt: today.toISOString() }),
    paidOrder({ id: "pending", orderNo: "ECRM-004", status: "pending_payment", payableAmount: 70, paidAt: today.toISOString(), createdAt: today.toISOString() })
  ]);

  render(<DashboardPage />);

  const overview = await screen.findByLabelText("今日经营概览");

  expect(within(overview).getByText("¥40.50")).toBeVisible();
  expect(within(overview).getByText("2")).toBeVisible();
});

test("lists active products with stock below three", async () => {
  repositories.listProducts.mockResolvedValue([
    product({ id: "low-1", name: "低库存商品", spu: "挂件", stockQty: 2, status: "active" }),
    product({ id: "zero", name: "售罄商品", spu: "贴纸", stockQty: 0, status: "active" }),
    product({ id: "safe", name: "库存充足商品", spu: "卡片", stockQty: 3, status: "active" }),
    product({ id: "inactive", name: "停用低库存", spu: "旧货", stockQty: 1, status: "inactive" })
  ]);

  render(<DashboardPage />);

  const lowStock = await screen.findByRole("region", { name: "低库存商品" });

  expect(within(lowStock).getByRole("heading", { level: 3, name: "低库存商品" })).toBeVisible();
  expect(within(lowStock).getByRole("heading", { level: 3, name: "售罄商品" })).toBeVisible();
  expect(within(lowStock).queryByText("库存充足商品")).not.toBeInTheDocument();
  expect(within(lowStock).queryByText("停用低库存")).not.toBeInTheDocument();
});
