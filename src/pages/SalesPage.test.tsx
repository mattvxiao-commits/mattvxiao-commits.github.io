import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AppSettings } from "../domain/types";
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
  repositories.listProducts.mockResolvedValue([sellableProduct]);
  repositories.savePaidOrder.mockResolvedValue(undefined);
  useCartStore.getState().replace([]);
});

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
