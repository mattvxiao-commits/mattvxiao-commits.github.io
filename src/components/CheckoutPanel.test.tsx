import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import CheckoutPanel from "./CheckoutPanel";
import { defaultPromotion, product } from "../test/fixtures";
import type { AppSettings, CalculatedCart, Product } from "../domain/types";

const calculated: CalculatedCart = {
  lines: [
    {
      productId: "normal",
      productName: "普通商品",
      spu: "普通SPU",
      quantity: 1,
      originalUnitPrice: 20,
      finalUnitPrice: 20,
      lineType: "normal",
      lineTotal: 20
    }
  ],
  giftLines: [],
  giftEntitlements: [],
  subtotalBeforeDiscount: 20,
  discountAmount: 0,
  payableAmount: 20,
  appliedDiscountQty: 0,
  maxDiscountQty: 3,
  giftStockWarnings: []
};

const settings: AppSettings = {
  id: "settings",
  shopName: "ECRM 摊位",
  orderPrefix: "ECRM",
  promotion: defaultPromotion()
};

test("shows QR missing states and ignores duplicate paid confirmation while saving", async () => {
  let resolveConfirm: () => void = () => undefined;
  const confirmPaid = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveConfirm = resolve;
      })
  );

  render(
    <CheckoutPanel
      calculated={calculated}
      settings={settings}
      qrImageUrls={{ wechat: "wechat-url" }}
      paymentMethod="wechat"
      setPaymentMethod={() => undefined}
      confirmPaid={confirmPaid}
      back={() => undefined}
    />
  );

  expect(screen.getByText("订单金额")).toBeVisible();
  expect(screen.getByText("¥20.00")).toBeVisible();
  expect(screen.getByAltText("微信收款码")).toHaveAttribute("src", "wechat-url");
  expect(screen.getByText("支付宝收款码未设置")).toBeVisible();

  const confirmButton = screen.getByRole("button", { name: "确认已收款并保存订单" });
  fireEvent.click(confirmButton);
  fireEvent.click(confirmButton);

  expect(confirmPaid).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole("button", { name: "保存中..." })).toBeDisabled();

  resolveConfirm();
});

test("does not allow confirming an empty cart", () => {
  const confirmPaid = vi.fn();

  render(
    <CheckoutPanel
      calculated={{ ...calculated, lines: [], payableAmount: 0, subtotalBeforeDiscount: 0 }}
      settings={settings}
      qrImageUrls={{}}
      paymentMethod="cash"
      setPaymentMethod={() => undefined}
      confirmPaid={confirmPaid}
      back={() => undefined}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "购物车为空，无法确认" }));

  expect(confirmPaid).not.toHaveBeenCalled();
});

test("requires SPU gift SKU selection before confirming paid order", () => {
  const confirmPaid = vi.fn();
  const giftProducts: Product[] = [
    product({
      id: "gift-a-1",
      name: "赠品A黑色",
      spu: "赠品A",
      productCode: "GFTA-BLK",
      stockQty: 2,
      isGiftEligible: true
    })
  ];

  render(
    <CheckoutPanel
      calculated={{
        ...calculated,
        payableAmount: 68,
        giftEntitlements: [{ targetType: "spu", spu: "赠品A", label: "赠品A", quantity: 1 }]
      }}
      settings={settings}
      products={giftProducts}
      giftSelections={{}}
      setGiftSelection={() => undefined}
      qrImageUrls={{}}
      paymentMethod="cash"
      setPaymentMethod={() => undefined}
      confirmPaid={confirmPaid}
      back={() => undefined}
    />
  );

  expect(screen.getByText("赠品A 还需要选择 1 个赠品。")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "赠品未选择完整，无法确认" }));
  expect(confirmPaid).not.toHaveBeenCalled();
});

test("enables paid confirmation when required SPU gifts are selected", () => {
  const confirmPaid = vi.fn();
  const giftProducts: Product[] = [
    product({
      id: "gift-a-1",
      name: "赠品A黑色",
      spu: "赠品A",
      productCode: "GFTA-BLK",
      stockQty: 2,
      isGiftEligible: true
    })
  ];

  render(
    <CheckoutPanel
      calculated={{
        ...calculated,
        payableAmount: 68,
        giftEntitlements: [{ targetType: "spu", spu: "赠品A", label: "赠品A", quantity: 1 }]
      }}
      settings={settings}
      products={giftProducts}
      giftSelections={{ "spu:赠品A": { "gift-a-1": 1 } }}
      setGiftSelection={() => undefined}
      qrImageUrls={{}}
      paymentMethod="cash"
      setPaymentMethod={() => undefined}
      confirmPaid={confirmPaid}
      back={() => undefined}
    />
  );

  expect(screen.getByText("GFTA-BLK / 赠品A黑色，库存 2")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "确认已收款并保存订单" }));
  expect(confirmPaid).toHaveBeenCalledTimes(1);
});
