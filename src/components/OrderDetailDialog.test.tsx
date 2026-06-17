import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { InventoryLog, Order, OrderItem } from "../domain/types";
import OrderDetailDialog from "./OrderDetailDialog";

const order: Order = {
  id: "order-1",
  orderNo: "ECRM-20260617-001",
  status: "paid",
  paymentMethod: "wechat",
  subtotalBeforeDiscount: 120,
  discountAmount: 20,
  payableAmount: 100,
  triggeredGiftTier: 100,
  promotionSnapshot: {
    enabled: true,
    addonDiscount: {
      enabled: true,
      discountSpu: "优惠SPU",
      discountPrice: 5,
      maxDiscountQty: 3
    },
    giftTiers: []
  },
  giftStockWarning: false,
  createdAt: "2026-06-17T09:30:00.000Z",
  paidAt: "2026-06-17T09:35:00.000Z"
};

const orderItems: OrderItem[] = [
  {
    id: "item-1",
    orderId: "order-1",
    productId: "sku-normal",
    productNameSnapshot: "玫瑰香氛蜡烛",
    spuSnapshot: "香氛系列",
    productCodeSnapshot: "CANDLE-ROSE",
    quantity: 1,
    originalUnitPrice: 120,
    finalUnitPrice: 100,
    lineType: "normal",
    lineTotal: 100
  },
  {
    id: "item-2",
    orderId: "order-1",
    productId: "sku-gift",
    productNameSnapshot: "迷你香片赠品",
    spuSnapshot: "香片系列",
    productCodeSnapshot: "GIFT-SACHET",
    quantity: 1,
    originalUnitPrice: 0,
    finalUnitPrice: 0,
    lineType: "gift",
    lineTotal: 0
  }
];

const inventoryLogs: InventoryLog[] = [
  {
    id: "log-1",
    productId: "sku-normal",
    orderId: "order-1",
    changeQty: -1,
    reason: "order_paid",
    beforeQty: 10,
    afterQty: 9,
    createdAt: "2026-06-17T09:35:01.000Z"
  },
  {
    id: "log-2",
    productId: "sku-gift",
    orderId: "order-1",
    changeQty: -1,
    reason: "gift_order_paid",
    beforeQty: 5,
    afterQty: 4,
    createdAt: "2026-06-17T09:35:02.000Z"
  }
];

test("shows a read-only order detail dialog with order, item snapshot, and inventory summary", () => {
  const onClose = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      onClose={onClose}
    />
  );

  const dialog = screen.getByRole("dialog", { name: "订单详情 ECRM-20260617-001" });

  expect(within(dialog).getByText("已支付")).toBeVisible();
  expect(within(dialog).getByText("微信")).toBeVisible();
  expect(within(dialog).getByText("¥100.00")).toBeVisible();
  expect(within(dialog).getByText("¥20.00")).toBeVisible();
  expect(within(dialog).getByText("满 100")).toBeVisible();

  const itemList = within(dialog).getByRole("list", { name: "订单商品明细" });
  expect(within(itemList).getByText("玫瑰香氛蜡烛")).toBeVisible();
  expect(within(itemList).getByText("香氛系列")).toBeVisible();
  expect(within(itemList).getByText("CANDLE-ROSE")).toBeVisible();
  expect(within(itemList).getByText("迷你香片赠品")).toBeVisible();
  expect(within(itemList).getByText("赠品")).toBeVisible();
  expect(within(itemList).getByText("普通商品")).toBeVisible();

  const inventoryList = within(dialog).getByRole("list", { name: "库存流水摘要" });
  const [normalInventoryRow, giftInventoryRow] = within(inventoryList).getAllByRole("listitem");
  expect(within(normalInventoryRow).getByText("sku-normal")).toBeVisible();
  expect(within(normalInventoryRow).getByText("库存 10 -> 9")).toBeVisible();
  expect(within(normalInventoryRow).getByText("扣减 1")).toBeVisible();
  expect(within(giftInventoryRow).getByText("赠品扣减")).toBeVisible();

  expect(within(dialog).queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "退款" })).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole("button", { name: "关闭订单详情" }));

  expect(onClose).toHaveBeenCalledTimes(1);
});
