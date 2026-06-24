import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { setFieldLockPin } from "../domain/fieldLock";
import type { AppSettings, Order, OrderItem } from "../domain/types";
import { appSettings, defaultPromotion, product } from "../test/fixtures";
import OrdersPage from "./OrdersPage";

const settings: AppSettings = appSettings();
const normalProduct = product({ id: "normal", name: "普通商品" });

const repositories = vi.hoisted(() => ({
  adjustOrderAccounting: vi.fn(),
  adjustOrderItemAccounting: vi.fn(),
  getSettings: vi.fn(),
  listInventoryLogsForOrder: vi.fn(),
  listOrderItems: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  listOrderRefunds: vi.fn(),
  listRefunds: vi.fn(),
  saveOrderRefund: vi.fn(),
  saveSettings: vi.fn(),
  voidPaidOrder: vi.fn()
}));

vi.mock("../db/repositories", () => repositories);

function localIsoDateTime(dayOffset: number, hours: number, minutes: number): string {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString();
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNo: "ECRM-001",
    status: "paid",
    paymentMethod: "wechat",
    subtotalBeforeDiscount: 20,
    discountAmount: 0,
    payableAmount: 20,
    promotionSnapshot: defaultPromotion(),
    giftStockWarning: false,
    orderNature: "sale",
    createdAt: localIsoDateTime(0, 9, 0),
    paidAt: localIsoDateTime(0, 9, 5),
    ...overrides
  };
}

function orderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    productId: "normal",
    productNameSnapshot: "普通商品",
    spuSnapshot: "普通SPU",
    productCodeSnapshot: "NORMAL-BASE",
    quantity: 1,
    originalUnitPrice: 20,
    finalUnitPrice: 20,
    lineType: "normal",
    lineTotal: 20,
    ...overrides
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  repositories.adjustOrderAccounting.mockResolvedValue([]);
  repositories.adjustOrderItemAccounting.mockResolvedValue(undefined);
  repositories.getSettings.mockResolvedValue(settings);
  repositories.listInventoryLogsForOrder.mockResolvedValue([]);
  repositories.listOrderItems.mockResolvedValue([]);
  repositories.listOrders.mockResolvedValue([]);
  repositories.listProducts.mockResolvedValue([normalProduct]);
  repositories.listOrderRefunds.mockResolvedValue([]);
  repositories.listRefunds.mockResolvedValue([]);
  repositories.saveOrderRefund.mockResolvedValue(undefined);
  repositories.saveSettings.mockResolvedValue(undefined);
  repositories.voidPaidOrder.mockResolvedValue(undefined);
});

test("renders independent order page filters and order records", async () => {
  repositories.listOrders.mockResolvedValue([
    order({ id: "order-1", orderNo: "ECRM-001", paymentMethod: "wechat" })
  ]);

  render(<OrdersPage />);

  expect(await screen.findByRole("heading", { level: 1, name: "订单" })).toBeVisible();
  expect(screen.getByLabelText("搜索订单号")).toBeVisible();
  expect(screen.getByLabelText("订单日期范围")).toBeVisible();
  expect(screen.getByLabelText("订单状态")).toBeVisible();
  expect(screen.getByLabelText("支付方式")).toBeVisible();

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  expect(within(history).getByText("ECRM-001")).toBeVisible();
  expect(within(history).getByText("微信")).toHaveClass("isPayment-wechat");
  expect(within(history).getByText("正常销售")).toBeVisible();
});

test("orders desktop list uses paired chronology with newest pair first", async () => {
  repositories.listOrders.mockResolvedValue(
    Array.from({ length: 8 }, (_, index) => {
      const sequence = index + 1;
      const code = String(sequence).padStart(3, "0");
      return order({
        id: code,
        orderNo: `ECRM-${code}`,
        paymentMethod: sequence % 2 === 0 ? "alipay" : "cash",
        paidAt: localIsoDateTime(0, 9, sequence)
      });
    })
  );

  render(<OrdersPage />);

  const orderNumbers = within(await screen.findByRole("region", { name: "订单记录列表" }))
    .getAllByText(/ECRM-/)
    .map((item) => item.textContent);

  expect(orderNumbers).toEqual([
    "ECRM-007",
    "ECRM-008",
    "ECRM-005",
    "ECRM-006",
    "ECRM-003",
    "ECRM-004",
    "ECRM-001",
    "ECRM-002"
  ]);
});

test("opens order detail from the independent order page", async () => {
  repositories.listOrders.mockResolvedValue([order({ id: "order-detail", orderNo: "ECRM-DETAIL" })]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);

  render(<OrdersPage />);

  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));

  expect(await screen.findByRole("dialog", { name: /订单详情/ })).toBeVisible();
  expect(repositories.listOrderItems).toHaveBeenCalledWith("order-detail");
  expect(repositories.listInventoryLogsForOrder).toHaveBeenCalledWith("order-detail");
  expect(repositories.listOrderRefunds).toHaveBeenCalledWith("order-detail");
});

test("requires field mode PIN before opening order detail", async () => {
  repositories.getSettings.mockResolvedValue({
    ...settings,
    fieldLock: await setFieldLockPin(settings.fieldLock, "2580", "2580")
  });
  repositories.listOrders.mockResolvedValue([order({ id: "locked-order", orderNo: "ECRM-LOCKED" })]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "locked-order" })]);

  render(<OrdersPage />);

  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-LOCKED" }));

  expect(await screen.findByRole("dialog", { name: "管理页面已锁定" })).toBeVisible();
  expect(repositories.listOrderItems).not.toHaveBeenCalled();

  fireEvent.change(await screen.findByLabelText("4 位数字密码"), { target: { value: "2580" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁" }));

  await waitFor(() => expect(repositories.listOrderItems).toHaveBeenCalledWith("locked-order"));
});
