import { fireEvent, render, screen, within } from "@testing-library/react";
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
