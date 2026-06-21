import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { defaultPromotion, product } from "../test/fixtures";
import { calculateCart } from "../domain/promotions";
import type { CartItem } from "../domain/types";
import CartPanel from "./CartPanel";

const imageUtils = vi.hoisted(() => ({
  getImageUrl: vi.fn()
}));

vi.mock("../utils/image", () => imageUtils);

const normal = product({
  id: "normal",
  name: "普通商品",
  spu: "普通SPU",
  productCode: "NORMAL-BASE",
  salePrice: 35
});

const addon = product({
  id: "addon",
  name: "优惠商品A",
  spu: "优惠SPU",
  productCode: "ADDON-A",
  salePrice: 5
});

const giftA = product({
  id: "gift-a",
  name: "商品A赠品",
  spu: "赠品SPU-A",
  productCode: "GIFT-A",
  salePrice: 0,
  stockQty: 0,
  isSellable: false,
  isGiftEligible: true
});

const stockedGiftA = {
  ...giftA,
  stockQty: 3
};

test("shows product thumbnails and calls close when close button is clicked", async () => {
  imageUtils.getImageUrl.mockImplementation((imageId?: string) =>
    Promise.resolve(imageId === "image-normal" ? "blob:normal" : undefined)
  );
  const normalWithImage = { ...normal, imageId: "image-normal" };
  const items: CartItem[] = [{ productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" }];
  const calculated = calculateCart({
    items,
    products: [normalWithImage],
    promotion: { ...defaultPromotion(), giftTiers: [] }
  });
  const onClose = vi.fn();

  render(
    <CartPanel
      products={[normalWithImage]}
      calculated={calculated}
      cartItems={items}
      increment={() => undefined}
      decrement={() => undefined}
      clear={() => undefined}
      checkout={() => undefined}
      hold={() => undefined}
      close={onClose}
    />
  );

  expect(await screen.findByRole("img", { name: "普通商品" })).toHaveAttribute("src", "blob:normal");

  fireEvent.click(screen.getByRole("button", { name: "关闭购物车" }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

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
  expect(screen.queryByText("NORMAL-BASE")).not.toBeInTheDocument();
  expect(screen.getByText("优惠商品A")).toBeVisible();
  expect(screen.queryByText("ADDON-A")).not.toBeInTheDocument();
  expect(screen.getByText("加购优惠")).toBeVisible();
  expect(screen.getByText("已享加购优惠 3/3 个")).toBeVisible();
  expect(screen.getByText("已触发满 35：商品A赠品 x1")).toBeVisible();
  expect(screen.getAllByText("¥44.00")).toHaveLength(1);
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

test("shows compact gift entitlement summary for spu gifts before sku selection", () => {
  const items: CartItem[] = [{ productId: "normal", quantity: 2, addedAt: "2026-06-15T00:00:00.000Z" }];
  const products = [normal];
  const calculated = calculateCart({
    items,
    products,
    promotion: {
      ...defaultPromotion(),
      giftTiers: [{ threshold: 35, gifts: [{ targetType: "spu", spu: "赠品SPU-A", quantity: 2 }] }]
    }
  });

  render(
    <CartPanel
      products={products}
      calculated={calculated}
      cartItems={items}
      increment={() => undefined}
      decrement={() => undefined}
      clear={() => undefined}
      checkout={() => undefined}
      hold={() => undefined}
    />
  );

  expect(screen.getByText("已触发满 35：赠品SPU-A x2")).toBeVisible();
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

test("hides campaign gift quick action when campaign gift is disabled", () => {
  const calculated = calculateCart({
    items: [],
    products: [normal],
    promotion: { ...defaultPromotion(), giftTiers: [] }
  });

  render(
    <CartPanel
      products={[normal]}
      calculated={calculated}
      cartItems={[]}
      increment={() => undefined}
      decrement={() => undefined}
      clear={() => undefined}
      checkout={() => undefined}
      hold={() => undefined}
      campaignGiftEnabled={false}
    />
  );

  const actions = screen.getByRole("group", { name: "非销售出库" });
  expect(actions).toHaveClass("nonSalesActionBar");
  expect(within(actions).queryByRole("button", { name: "+ 运营赠礼" })).not.toBeInTheDocument();
  expect(within(actions).getByRole("button", { name: "+ 人工赠送" })).toBeVisible();
  expect(within(actions).getByRole("button", { name: "+ 其他出库" })).toBeVisible();
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

test("blocks checkout when campaign gift has no sale line", () => {
  const campaignGift = product({
    id: "campaign-gift",
    name: "运营赠品",
    spu: "运营SPU",
    salePrice: 6,
    isGiftEligible: true
  });
  const items: CartItem[] = [
    {
      id: "campaign-line",
      productId: "campaign-gift",
      quantity: 1,
      addedAt: "2026-06-21T10:01:00.000Z",
      revenueType: "non_sales",
      nonSalesReason: "campaign_gift",
      campaignNameSnapshot: "关注小红书赠礼"
    }
  ];
  const calculated = calculateCart({
    items,
    products: [campaignGift],
    promotion: { ...defaultPromotion(), giftTiers: [] }
  });
  const onCheckout = vi.fn();

  render(
    <CartPanel
      products={[campaignGift]}
      calculated={calculated}
      cartItems={items}
      increment={() => undefined}
      decrement={() => undefined}
      clear={() => undefined}
      checkout={onCheckout}
      hold={() => undefined}
      campaignGiftEnabled
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "运营赠礼需要正常消费商品" }));

  expect(onCheckout).not.toHaveBeenCalled();
});

test("shows non-sales line labels, zero price, and quick actions", () => {
  const manualGift = product({
    id: "manual-gift",
    name: "人工赠品",
    spu: "赠品SPU",
    salePrice: 9,
    isGiftEligible: true
  });
  const campaignGift = product({
    id: "campaign-gift",
    name: "运营赠品",
    spu: "运营SPU",
    salePrice: 6,
    isGiftEligible: true
  });
  const items: CartItem[] = [
    {
      id: "manual-line",
      productId: "manual-gift",
      quantity: 1,
      addedAt: "2026-06-21T10:00:00.000Z",
      revenueType: "non_sales",
      nonSalesReason: "manual_gift",
      nonSalesNote: "好友赠送"
    },
    {
      id: "campaign-line",
      productId: "campaign-gift",
      quantity: 1,
      addedAt: "2026-06-21T10:01:00.000Z",
      revenueType: "non_sales",
      nonSalesReason: "campaign_gift",
      campaignNameSnapshot: "关注小红书赠礼"
    }
  ];
  const calculated = calculateCart({
    items,
    products: [manualGift, campaignGift],
    promotion: { ...defaultPromotion(), giftTiers: [] }
  });
  const onCampaignGift = vi.fn();
  const onManualGift = vi.fn();
  const onOtherOutbound = vi.fn();

  render(
    <CartPanel
      products={[manualGift, campaignGift]}
      calculated={calculated}
      cartItems={items}
      increment={() => undefined}
      decrement={() => undefined}
      clear={() => undefined}
      checkout={() => undefined}
      hold={() => undefined}
      addCampaignGift={onCampaignGift}
      addManualGift={onManualGift}
      addOtherOutbound={onOtherOutbound}
    />
  );

  const actions = screen.getByRole("group", { name: "非销售出库" });
  expect(actions).toHaveClass("nonSalesActionBar");
  expect(screen.getAllByText("人工赠送").length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText("运营赠礼").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("好友赠送")).toBeVisible();
  expect(screen.getAllByText("¥0.00").length).toBeGreaterThan(0);

  fireEvent.click(within(actions).getByRole("button", { name: "+ 运营赠礼" }));
  fireEvent.click(within(actions).getByRole("button", { name: "+ 人工赠送" }));
  fireEvent.click(within(actions).getByRole("button", { name: "+ 其他出库" }));

  expect(onCampaignGift).toHaveBeenCalledTimes(1);
  expect(onManualGift).toHaveBeenCalledTimes(1);
  expect(onOtherOutbound).toHaveBeenCalledTimes(1);
});
