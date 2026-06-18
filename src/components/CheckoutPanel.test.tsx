import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import CheckoutPanel from "./CheckoutPanel";
import { appSettings, product } from "../test/fixtures";
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
  ...appSettings()
};

test("shows only the selected QR payment code without a duplicate amount card and ignores duplicate paid confirmation while saving", async () => {
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

  expect(screen.queryByText("订单金额")).not.toBeInTheDocument();
  expect(screen.queryByText("¥20.00")).not.toBeInTheDocument();
  expect(screen.queryByText("ECRM 摊位 / ECRM")).not.toBeInTheDocument();
  expect(screen.queryByText("微信收款码")).not.toBeInTheDocument();
  expect(screen.getByAltText("微信收款码")).toHaveAttribute("src", "wechat-url");
  expect(screen.queryByText("支付宝收款码未设置")).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "支付宝收款码" })).not.toBeInTheDocument();

  const confirmButton = screen.getByRole("button", { name: "确认已收款并保存订单" });
  fireEvent.click(confirmButton);
  fireEvent.click(confirmButton);

  expect(confirmPaid).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole("button", { name: "保存中..." })).toBeDisabled();

  resolveConfirm();
});

test("switches the visible QR code when payment method changes", () => {
  function Harness() {
    const [paymentMethod, setPaymentMethod] = useState<"wechat" | "alipay" | "cash" | "other">("wechat");

    return (
      <CheckoutPanel
        calculated={calculated}
        settings={settings}
        qrImageUrls={{ wechat: "wechat-url", alipay: "alipay-url" }}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        confirmPaid={() => Promise.resolve()}
        back={() => undefined}
      />
    );
  }

  render(<Harness />);

  expect(screen.getByAltText("微信收款码")).toHaveAttribute("src", "wechat-url");
  expect(screen.queryByAltText("支付宝收款码")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "支付宝" }));

  expect(screen.getByAltText("支付宝收款码")).toHaveAttribute("src", "alipay-url");
  expect(screen.queryByAltText("微信收款码")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "现金" }));

  expect(screen.getByText("当前选择现金收款，无需展示收款码。")).toBeVisible();
  expect(screen.queryByAltText("支付宝收款码")).not.toBeInTheDocument();
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
  expect(screen.getByLabelText("赠品A：赠品A 第 1 行 SKU")).toHaveValue("gift-a-1");
  expect(screen.getByRole("option", { name: "GFTA-BLK / 赠品A黑色 / 库存 2" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "赠品A蓝色 / 库存 5" })).toBeInTheDocument();
  expect(screen.queryByText(/未设置编码/)).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("赠品A：赠品A 第 1 行 SKU"), { target: { value: "gift-a-2" } });

  expect(setGiftSelection).toHaveBeenCalledWith("spu:赠品A", "gift-a-1", 0);
  expect(setGiftSelection).toHaveBeenCalledWith("spu:赠品A", "gift-a-2", 1);
  fireEvent.click(screen.getByRole("button", { name: "确认已收款并保存订单" }));
  expect(confirmPaid).toHaveBeenCalledTimes(1);
});

test("labels gift selection groups as gift A and gift B", () => {
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
      id: "gift-b-1",
      name: "赠品B基础",
      spu: "赠品B",
      productCode: "GFTB-BASE",
      stockQty: 2,
      isGiftEligible: true
    })
  ];

  render(
    <CheckoutPanel
      calculated={{
        ...calculated,
        payableAmount: 68,
        giftEntitlements: [
          { targetType: "spu", spu: "赠品A", label: "赠品A", quantity: 2 },
          { targetType: "spu", spu: "赠品B", label: "赠品B", quantity: 1 }
        ]
      }}
      settings={settings}
      products={giftProducts}
      giftSelections={{}}
      setGiftSelection={() => undefined}
      qrImageUrls={{}}
      paymentMethod="cash"
      setPaymentMethod={() => undefined}
      confirmPaid={() => Promise.resolve()}
      back={() => undefined}
    />
  );

  expect(screen.getByRole("heading", { level: 3, name: "赠品A：赠品A" })).toBeVisible();
  expect(screen.getByRole("heading", { level: 3, name: "赠品B：赠品B" })).toBeVisible();
  expect(screen.getByLabelText("赠品A：赠品A 第 1 行 SKU")).toBeInTheDocument();
  expect(screen.getByLabelText("赠品B：赠品B 第 1 行 SKU")).toBeInTheDocument();
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

  fireEvent.click(screen.getByRole("button", { name: "添加 赠品A：赠品A 选择行" }));
  fireEvent.click(screen.getByRole("button", { name: "增加 赠品A黑色 赠品数量" }));

  expect(setGiftSelection).toHaveBeenCalledWith("spu:赠品A", "gift-a-1", 1);
  expect(setGiftSelection).toHaveBeenCalledWith("spu:赠品A", "gift-a-1", 2);
});
