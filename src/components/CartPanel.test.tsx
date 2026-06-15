import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { defaultPromotion, product } from "../test/fixtures";
import { calculateCart } from "../domain/promotions";
import type { CartItem } from "../domain/types";
import CartPanel from "./CartPanel";

const normal = product({
  id: "normal",
  name: "普通商品",
  spu: "普通SPU",
  salePrice: 35
});

const addon = product({
  id: "addon",
  name: "优惠商品A",
  spu: "优惠SPU",
  salePrice: 5
});

const giftA = product({
  id: "gift-a",
  name: "商品A赠品",
  spu: "赠品SPU-A",
  salePrice: 0,
  stockQty: 0,
  isSellable: false,
  isGiftEligible: true
});

const stockedGiftA = {
  ...giftA,
  stockQty: 3
};

test("shows normal, discount, gift tier, gift stock warning, and payable total", () => {
  const items: CartItem[] = [
    { productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" },
    { productId: "addon", quantity: 3, addedAt: "2026-06-15T00:01:00.000Z" }
  ];
  const products = [normal, addon, giftA];
  const calculated = calculateCart({
    items,
    products,
    promotion: {
      ...defaultPromotion(),
      giftTiers: [{ threshold: 35, gifts: [{ productId: "gift-a", quantity: 1 }] }]
    }
  });
  const onIncrement = vi.fn();
  const onDecrement = vi.fn();
  const onClear = vi.fn();
  const onCheckout = vi.fn();
  const onHold = vi.fn();

  render(
    <CartPanel
      products={products}
      calculated={calculated}
      cartItems={items}
      increment={onIncrement}
      decrement={onDecrement}
      clear={onClear}
      checkout={onCheckout}
      hold={onHold}
    />
  );

  expect(screen.getByText("普通商品")).toBeVisible();
  expect(screen.getByText("优惠商品A")).toBeVisible();
  expect(screen.getByText("加购优惠")).toBeVisible();
  expect(screen.getByText("已享加购优惠 3/3 个")).toBeVisible();
  expect(screen.getByText("已触发满 35 赠品")).toBeVisible();
  expect(screen.getByText("商品A赠品 x1")).toBeVisible();
  expect(screen.getByText("赠品库存不足：商品A赠品 需要 1，当前 0")).toBeVisible();
  expect(screen.getByText("¥44.00")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "增加 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "减少 优惠商品A" }));
  fireEvent.click(screen.getByRole("button", { name: "清空购物车" }));
  fireEvent.click(screen.getByRole("button", { name: "暂存购物车" }));
  fireEvent.click(screen.getByRole("button", { name: "赠品库存不足，无法去收款" }));

  expect(onIncrement).toHaveBeenCalledWith("normal");
  expect(onDecrement).toHaveBeenCalledWith("addon");
  expect(onClear).toHaveBeenCalledTimes(1);
  expect(onCheckout).not.toHaveBeenCalled();
  expect(onHold).toHaveBeenCalledTimes(1);
});

test("allows checkout when gift inventory is available", () => {
  const items: CartItem[] = [{ productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" }];
  const products = [normal, stockedGiftA];
  const calculated = calculateCart({
    items,
    products,
    promotion: {
      ...defaultPromotion(),
      giftTiers: [{ threshold: 35, gifts: [{ productId: "gift-a", quantity: 1 }] }]
    }
  });
  const onCheckout = vi.fn();

  render(
    <CartPanel
      products={products}
      calculated={calculated}
      cartItems={items}
      increment={() => undefined}
      decrement={() => undefined}
      clear={() => undefined}
      checkout={onCheckout}
      hold={() => undefined}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "去收款" }));

  expect(onCheckout).toHaveBeenCalledTimes(1);
});

test("blocks checkout when triggered gifts do not have enough stock", () => {
  const items: CartItem[] = [{ productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" }];
  const products = [normal, giftA];
  const calculated = calculateCart({
    items,
    products,
    promotion: {
      ...defaultPromotion(),
      giftTiers: [{ threshold: 35, gifts: [{ productId: "gift-a", quantity: 1 }] }]
    }
  });
  const onCheckout = vi.fn();

  render(
    <CartPanel
      products={products}
      calculated={calculated}
      cartItems={items}
      increment={() => undefined}
      decrement={() => undefined}
      clear={() => undefined}
      checkout={onCheckout}
      hold={() => undefined}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "赠品库存不足，无法去收款" }));

  expect(onCheckout).not.toHaveBeenCalled();
});
