import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import CheckoutPanel from "./CheckoutPanel";
import { defaultPromotion, product } from "../test/fixtures";
import type { AppSettings, CalculatedCart, Product } from "../domain/types";
import type { GiftSelections } from "../domain/giftSelection";

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

test("uses compact dropdown rows for SPU gift SKU selection", () => {
  const confirmPaid = vi.fn();
  const setGiftSelection = vi.fn();
  const giftProducts: Product[] = [
    product({
      id: "gift-a-1",
      name: "赠品A黑色",
      spu: "赠品A",
      productCode: "GFTA-BLK",
      stockQty: 2,
      isGiftEligible: true
    }),
    product({
      id: "gift-a-2",
      name: "赠品A蓝色",
      spu: "赠品A",
      productCode: undefined,
      stockQty: 5,
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
      setGiftSelection={setGiftSelection}
      qrImageUrls={{}}
      paymentMethod="cash"
      setPaymentMethod={() => undefined}
      confirmPaid={confirmPaid}
      back={() => undefined}
    />
  );

  expect(screen.getByText("需选 1 个，已选 1 个")).toBeVisible();
  expect(screen.getByLabelText("赠品A 第 1 行 SKU")).toHaveValue("gift-a-1");
  expect(screen.getByRole("option", { name: "GFTA-BLK / 赠品A黑色 / 库存 2" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "赠品A蓝色 / 库存 5" })).toBeInTheDocument();
  expect(screen.queryByText(/未设置编码/)).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("赠品A 第 1 行 SKU"), { target: { value: "gift-a-2" } });

  expect(setGiftSelection).toHaveBeenCalledWith("spu:赠品A", "gift-a-1", 0);
  expect(setGiftSelection).toHaveBeenCalledWith("spu:赠品A", "gift-a-2", 1);
  fireEvent.click(screen.getByRole("button", { name: "确认已收款并保存订单" }));
  expect(confirmPaid).toHaveBeenCalledTimes(1);
});

test("adds compact SPU gift selection rows with steppers", () => {
  const setGiftSelection = vi.fn();
  const giftProducts: Product[] = [
    product({
      id: "gift-a-1",
      name: "赠品A黑色",
      spu: "赠品A",
      productCode: "GFTA-BLK",
      stockQty: 5,
      isGiftEligible: true
    })
  ];

  function Harness() {
    const [giftSelections, setSelections] = useState<GiftSelections>({});

    return (
      <CheckoutPanel
        calculated={{
          ...calculated,
          payableAmount: 68,
          giftEntitlements: [{ targetType: "spu", spu: "赠品A", label: "赠品A", quantity: 2 }]
        }}
        settings={settings}
        products={giftProducts}
        giftSelections={giftSelections}
        setGiftSelection={(requirementKey, productId, quantity) => {
          setGiftSelection(requirementKey, productId, quantity);
          setSelections((current) => ({
            ...current,
            [requirementKey]: {
              ...(current[requirementKey] ?? {}),
              [productId]: quantity
            }
          }));
        }}
        qrImageUrls={{}}
        paymentMethod="cash"
        setPaymentMethod={() => undefined}
        confirmPaid={() => Promise.resolve()}
        back={() => undefined}
      />
    );
  }

  render(<Harness />);

  fireEvent.click(screen.getByRole("button", { name: "添加 赠品A 选择行" }));
  fireEvent.click(screen.getByRole("button", { name: "增加 赠品A黑色 赠品数量" }));

  expect(setGiftSelection).toHaveBeenCalledWith("spu:赠品A", "gift-a-1", 1);
  expect(setGiftSelection).toHaveBeenCalledWith("spu:赠品A", "gift-a-1", 2);
});
