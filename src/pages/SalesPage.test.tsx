import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AppSettings, Order } from "../domain/types";
import { useCartStore } from "../state/cartStore";
import { defaultPromotion, product } from "../test/fixtures";
import SalesPage from "./SalesPage";

const sellableProduct = product({
  id: "normal",
  name: "普通商品",
  spu: "普通SPU",
  salePrice: 20,
  stockQty: 10
});

const settings: AppSettings = {
  id: "settings",
  shopName: "ECRM 摊位",
  orderPrefix: "ECRM",
  promotion: defaultPromotion()
};

const repositories = vi.hoisted(() => ({
  getSettings: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  savePaidOrder: vi.fn()
}));

vi.mock("../db/repositories", () => repositories);

vi.mock("../utils/image", () => ({
  getImageUrl: vi.fn(() => Promise.resolve(undefined))
}));

beforeEach(() => {
  vi.clearAllMocks();
  repositories.getSettings.mockResolvedValue(settings);
  repositories.listOrders.mockResolvedValue([]);
  repositories.listProducts.mockResolvedValue([sellableProduct]);
  repositories.savePaidOrder.mockResolvedValue(undefined);
  useCartStore.getState().replace([]);
});

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
    createdAt: "2026-06-15T09:20:00.000Z",
    paidAt: "2026-06-15T09:25:00.000Z",
    ...overrides
  };
}

test("floating cart button returns from checkout to the cart panel without clearing items", async () => {
  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));

  expect(await screen.findByRole("heading", { level: 2, name: "收款确认" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));

  const cartPanel = await screen.findByRole("complementary", { name: "购物车" });

  expect(within(cartPanel).getByRole("heading", { level: 2, name: "购物车" })).toBeVisible();
  expect(within(cartPanel).getByRole("heading", { level: 3, name: "普通商品" })).toBeVisible();
});

test("does not let product quantity exceed available stock before checkout", async () => {
  repositories.listProducts.mockResolvedValue([{ ...sellableProduct, stockQty: 1 }]);

  render(<SalesPage />);

  const addButton = await screen.findByRole("button", { name: "加入 普通商品" });
  fireEvent.click(addButton);

  await waitFor(() => expect(addButton).toBeDisabled());
  expect(await screen.findByText("已达库存")).toBeVisible();
});

test("saves paid order, clears cart, refreshes products, and includes gift inventory products", async () => {
  const giftProduct = product({
    id: "gift-a",
    name: "赠品A",
    spu: "赠品SPU",
    salePrice: 0,
    stockQty: 3,
    isSellable: false,
    isGiftEligible: true
  });

  repositories.listProducts
    .mockResolvedValueOnce([sellableProduct, giftProduct])
    .mockResolvedValueOnce([{ ...sellableProduct, stockQty: 9 }, { ...giftProduct, stockQty: 2 }]);
  repositories.listOrders
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([order({ orderNo: "ECRM-SAVED", payableAmount: 20, paymentMethod: "cash" })]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    promotion: {
      ...settings.promotion,
      giftTiers: [{ threshold: 20, gifts: [{ productId: "gift-a", quantity: 1 }] }]
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认已收款并保存订单" }));

  await waitFor(() => expect(repositories.savePaidOrder).toHaveBeenCalledTimes(1));

  const saved = repositories.savePaidOrder.mock.calls[0][0];
  expect(saved.orderItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ productId: "normal", lineType: "normal", quantity: 1 }),
      expect.objectContaining({ productId: "gift-a", lineType: "gift", quantity: 1 })
    ])
  );
  expect(await screen.findByText(/订单 .* 已保存，库存已扣减。/)).toBeVisible();
  expect(await screen.findByText("还没有选择商品。")).toBeVisible();
  expect(repositories.listProducts.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(repositories.listOrders.mock.calls.length).toBeGreaterThanOrEqual(2);

  fireEvent.click(screen.getByRole("button", { name: /订单记录/ }));

  expect(await screen.findByText("ECRM-SAVED")).toBeVisible();
});

test("keeps cart items when paid order save fails", async () => {
  repositories.savePaidOrder.mockRejectedValue(new Error("商品 普通商品 库存不足，无法完成订单扣减"));

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认已收款并保存订单" }));

  expect(await screen.findByText("商品 普通商品 库存不足，无法完成订单扣减")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));

  const cartPanel = await screen.findByRole("complementary", { name: "购物车" });
  expect(within(cartPanel).getByRole("heading", { level: 3, name: "普通商品" })).toBeVisible();
});

test("shows recent paid order history behind a toggle", async () => {
  repositories.listOrders.mockResolvedValue([
    order({ orderNo: "ECRM-PAID", paymentMethod: "alipay", payableAmount: 42.5 }),
    order({ id: "pending", orderNo: "ECRM-PENDING", status: "pending_payment", paymentMethod: "cash", payableAmount: 18 })
  ]);

  render(<SalesPage />);

  const toggle = await screen.findByRole("button", { name: /订单记录/ });

  expect(screen.queryByText("ECRM-PAID")).not.toBeInTheDocument();

  fireEvent.click(toggle);

  const history = await screen.findByRole("region", { name: "最近订单记录" });

  expect(within(history).getByText("ECRM-PAID")).toBeVisible();
  expect(within(history).getByText("支付宝")).toBeVisible();
  expect(within(history).getByText("¥42.50")).toBeVisible();
  expect(within(history).queryByText("ECRM-PENDING")).not.toBeInTheDocument();
});

test("sorts recent paid order history by paid time with created time fallback", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "created-newer",
      orderNo: "ECRM-CREATED-NEWER",
      createdAt: "2026-06-15T12:00:00.000Z",
      paidAt: "2026-06-15T12:05:00.000Z"
    }),
    order({
      id: "paid-newest",
      orderNo: "ECRM-PAID-NEWEST",
      createdAt: "2026-06-15T08:00:00.000Z",
      paidAt: "2026-06-15T12:30:00.000Z"
    }),
    order({
      id: "fallback-middle",
      orderNo: "ECRM-FALLBACK-MIDDLE",
      createdAt: "2026-06-15T12:10:00.000Z",
      paidAt: undefined
    })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));

  const orderNumbers = within(await screen.findByRole("region", { name: "最近订单记录" }))
    .getAllByText(/ECRM-/)
    .map((item) => item.textContent);

  expect(orderNumbers).toEqual([
    "ECRM-PAID-NEWEST",
    "ECRM-FALLBACK-MIDDLE",
    "ECRM-CREATED-NEWER"
  ]);
});
