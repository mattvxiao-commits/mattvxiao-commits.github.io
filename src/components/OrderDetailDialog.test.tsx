import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { InventoryLog, Order, OrderItem, OrderRefund } from "../domain/types";
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
const refunds: OrderRefund[] = [
  {
    id: "refund-1",
    orderId: "order-1",
    amount: 25,
    method: "wechat",
    reason: "customer_return",
    note: "客户退回。",
    createdAt: "2026-06-17T11:00:00.000Z"
  }
];
const rollbackLog: InventoryLog = {
  id: "log-rollback",
  productId: "sku-normal",
  orderId: "order-1",
  changeQty: 1,
  reason: "order_cancelled_rollback",
  beforeQty: 9,
  afterQty: 10,
  createdAt: "2026-06-17T10:00:00.000Z"
};

function expectedDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

test("shows a read-only order detail dialog with order, item snapshot, and inventory summary", () => {
  const onClose = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={onClose}
    />
  );

  const dialog = screen.getByRole("dialog", { name: "订单详情 ECRM-20260617-001" });

  expect(within(dialog).getByText("已支付")).toBeVisible();
  expect(within(dialog).getByText("微信")).toBeVisible();
  expect(within(dialog).getByText("创建时间")).toBeVisible();
  expect(within(dialog).getByText("支付时间")).toBeVisible();
  expect(within(dialog).getByText(expectedDateTime(order.createdAt))).toBeVisible();
  expect(within(dialog).getByText(expectedDateTime(order.paidAt ?? ""))).toBeVisible();
  expect(within(dialog).getByText("¥100.00")).toBeVisible();
  expect(within(dialog).getByText("¥120.00")).toBeVisible();
  expect(within(dialog).getByText("¥20.00")).toBeVisible();
  expect(within(dialog).getByText("满 100")).toBeVisible();

  const itemList = within(dialog).getByRole("list", { name: "订单商品明细" });
  expect(within(itemList).getByText("玫瑰香氛蜡烛")).toBeVisible();
  expect(within(itemList).getByText("香氛系列")).toBeVisible();
  expect(within(itemList).getByText("CANDLE-ROSE")).toBeVisible();
  expect(within(itemList).getByText("单价 ¥100.00")).toBeVisible();
  expect(within(itemList).getByText("原价 ¥120.00")).toBeVisible();
  expect(within(itemList).getByText("小计 ¥100.00")).toBeVisible();
  expect(within(itemList).getAllByText("x1")).toHaveLength(2);
  expect(within(itemList).getByText("迷你香片赠品")).toBeVisible();
  expect(within(itemList).getByText("赠品")).toBeVisible();
  expect(within(itemList).getByText("普通商品")).toBeVisible();

  expect(within(dialog).getByText("库存摘要")).toBeVisible();
  const inventorySummary = within(dialog).getByLabelText("库存摘要指标");
  expect(within(inventorySummary).getByText("售卖扣减")).toBeVisible();
  expect(within(inventorySummary).getByText("赠品扣减")).toBeVisible();
  expect(within(inventorySummary).getByText("作废回滚")).toBeVisible();
  expect(within(inventorySummary).getAllByText("1 个SKU / 1 件")).toHaveLength(2);
  expect(within(inventorySummary).getByText("0 个SKU / 0 件")).toBeVisible();

  const inventoryDisclosure = within(dialog).getByText("完整库存流水（2 条）").closest("details");
  expect(inventoryDisclosure).toHaveAttribute("open");

  const inventoryList = within(dialog).getByRole("list", { name: "完整库存流水" });
  const [normalInventoryRow, giftInventoryRow] = within(inventoryList).getAllByRole("listitem");
  expect(within(normalInventoryRow).getByText("玫瑰香氛蜡烛")).toBeVisible();
  expect(within(normalInventoryRow).getByText("CANDLE-ROSE / 香氛系列")).toBeVisible();
  expect(within(normalInventoryRow).getByText("订单扣减")).toBeVisible();
  expect(within(normalInventoryRow).getByText("库存 10 -> 9")).toBeVisible();
  expect(within(normalInventoryRow).getByText("扣减 1")).toBeVisible();
  expect(within(giftInventoryRow).getByText("迷你香片赠品")).toBeVisible();
  expect(within(giftInventoryRow).getByText("赠品扣减")).toBeVisible();

  expect(within(dialog).queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("button", { name: "退款" })).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole("button", { name: "关闭订单详情" }));

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("shows cost and gross profit for order item snapshots", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={[
        {
          ...orderItems[0],
          id: "item-cost-snapshot",
          quantity: 2,
          lineTotal: 40,
          unitCostSnapshot: 8,
          costTotal: 16,
          grossProfit: 24
        }
      ]}
      inventoryLogs={[]}
      orderRefunds={[]}
      onClose={() => undefined}
    />
  );

  const itemList = screen.getByRole("list", { name: "订单商品明细" });
  expect(within(itemList).getByText("成本 ¥16.00")).toBeVisible();
  expect(within(itemList).getByText("毛利 ¥24.00")).toBeVisible();
});

test("shows missing cost snapshot for legacy order items", () => {
  render(
    <OrderDetailDialog
      order={{ ...order, id: "order-legacy", orderNo: "ECRM-OLD" }}
      orderItems={[
        {
          ...orderItems[0],
          id: "item-legacy",
          orderId: "order-legacy",
          productNameSnapshot: "旧商品",
          unitCostSnapshot: undefined,
          costTotal: undefined,
          grossProfit: undefined
        }
      ]}
      inventoryLogs={[]}
      orderRefunds={[]}
      onClose={() => undefined}
    />
  );

  expect(screen.getByText("缺少成本快照")).toBeVisible();
});

test("shows void action for paid orders and confirms before calling handler", () => {
  const onVoidOrder = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={[...inventoryLogs, rollbackLog]}
      orderRefunds={[]}
      onClose={() => undefined}
      onVoidOrder={onVoidOrder}
    />
  );

  const dialog = screen.getByRole("dialog", { name: "订单详情 ECRM-20260617-001" });
  expect(within(dialog).getAllByText("作废回滚").length).toBeGreaterThan(0);

  fireEvent.click(within(dialog).getByRole("button", { name: "作废订单" }));

  const confirmDialog = screen.getByRole("dialog", { name: "确认作废订单" });
  expect(within(confirmDialog).getByText("ECRM-20260617-001")).toBeVisible();
  expect(within(confirmDialog).getByText("作废后订单会标记为已取消，并自动回滚本订单扣减的库存。此操作不可撤销。")).toBeVisible();
  fireEvent.change(within(confirmDialog).getByLabelText("作废原因"), {
    target: { value: "customer_cancelled" }
  });
  fireEvent.change(within(confirmDialog).getByLabelText("作废备注"), {
    target: { value: "客户临时取消。" }
  });

  fireEvent.click(within(confirmDialog).getByRole("button", { name: "确认作废" }));

  expect(onVoidOrder).toHaveBeenCalledWith({
    cancelReason: "customer_cancelled",
    cancelNote: "客户临时取消。"
  });
});

test("shows cancel reason and note for cancelled orders", () => {
  render(
    <OrderDetailDialog
      order={{
        ...order,
        status: "cancelled",
        cancelledAt: "2026-06-17T10:00:00.000Z",
        cancelReason: "duplicate_order",
        cancelNote: "重复保存了一次订单。"
      }}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
    />
  );

  expect(screen.getByText("售后记录")).toBeVisible();
  expect(screen.getByText("作废原因")).toBeVisible();
  expect(screen.getByText("重复下单")).toBeVisible();
  expect(screen.getByText("作废备注")).toBeVisible();
  expect(screen.getByText("重复保存了一次订单。")).toBeVisible();
});

test("shows readable inventory product snapshots and rollback summary", () => {
  render(
    <OrderDetailDialog
      order={{ ...order, status: "cancelled", cancelledAt: "2026-06-17T10:00:00.000Z" }}
      orderItems={orderItems}
      inventoryLogs={[...inventoryLogs, rollbackLog]}
      orderRefunds={[]}
      onClose={() => undefined}
    />
  );

  expect(screen.getByText("库存摘要")).toBeVisible();
  const inventorySummary = screen.getByLabelText("库存摘要指标");
  expect(within(inventorySummary).getByText("售卖扣减")).toBeVisible();
  expect(within(inventorySummary).getByText("赠品扣减")).toBeVisible();
  expect(within(inventorySummary).getByText("作废回滚")).toBeVisible();
  expect(within(inventorySummary).getAllByText("1 个SKU / 1 件")).toHaveLength(3);

  const inventoryDisclosure = screen.getByText("完整库存流水（3 条）").closest("details");
  expect(inventoryDisclosure).not.toHaveAttribute("open");

  fireEvent.click(screen.getByText("完整库存流水（3 条）"));

  const inventoryList = screen.getByRole("list", { name: "完整库存流水" });
  const [normalInventoryRow, , rollbackInventoryRow] = within(inventoryList).getAllByRole("listitem");

  expect(within(normalInventoryRow).getByText("玫瑰香氛蜡烛")).toBeVisible();
  expect(within(normalInventoryRow).getByText("CANDLE-ROSE / 香氛系列")).toBeVisible();
  expect(within(rollbackInventoryRow).getByText("玫瑰香氛蜡烛")).toBeVisible();
  expect(within(rollbackInventoryRow).getByText("作废回滚")).toBeVisible();
  expect(within(rollbackInventoryRow).getByText("增加 1")).toBeVisible();
  expect(within(rollbackInventoryRow).getByText("库存 9 -> 10")).toBeVisible();
  expect(within(inventoryList).queryByText("sku-normal")).not.toBeInTheDocument();
});

test("shows an empty inventory state when an order has no inventory logs", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={[]}
      orderRefunds={[]}
      onClose={() => undefined}
    />
  );

  const inventorySummary = screen.getByLabelText("库存摘要指标");
  expect(within(inventorySummary).getByText("售卖扣减")).toBeVisible();
  expect(within(inventorySummary).getAllByText("0 个SKU / 0 件")).toHaveLength(3);
  expect(screen.getByText("暂无库存流水。")).toBeVisible();
});

test("does not show void action for cancelled orders", () => {
  render(
    <OrderDetailDialog
      order={{ ...order, status: "cancelled", cancelledAt: "2026-06-17T10:00:00.000Z" }}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onVoidOrder={() => undefined}
    />
  );

  expect(screen.queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "退款" })).not.toBeInTheDocument();
});

test("does not show void action for pending payment orders", () => {
  render(
    <OrderDetailDialog
      order={{ ...order, status: "pending_payment", paidAt: undefined, paymentMethod: undefined }}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onVoidOrder={() => undefined}
    />
  );

  expect(screen.queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "退款" })).not.toBeInTheDocument();
});

test("shows refund records and totals in the after-sales section", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={refunds}
      onClose={() => undefined}
      onSaveRefund={() => undefined}
    />
  );

  expect(screen.getByText("售后记录")).toBeVisible();
  expect(screen.getByText("累计退款")).toBeVisible();
  expect(screen.getAllByText("¥25.00").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText("剩余可退")).toBeVisible();
  expect(screen.getByText("¥75.00")).toBeVisible();

  expect(screen.getByLabelText("售后摘要指标")).toHaveClass("afterSalesMetrics");
  const refundList = screen.getByRole("list", { name: "人工退款记录" });
  expect(refundList).toHaveClass("refundRecordList");
  expect(within(refundList).getAllByRole("listitem")[0]).toHaveClass("refundRecordRow");
  expect(within(refundList).getByText("客户退单")).toBeVisible();
  expect(within(refundList).getByText("微信")).toBeVisible();
  expect(within(refundList).getByText(expectedDateTime("2026-06-17T11:00:00.000Z"))).toBeVisible();
  expect(within(refundList).getByText("客户退回。")).toBeVisible();
});

test("shows refund action for paid orders", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onVoidOrder={() => undefined}
      onSaveRefund={() => undefined}
    />
  );

  const actions = screen.getByRole("group", { name: "订单操作按钮" });
  expect(actions).toHaveClass("orderDetailActionButtons");
  expect(within(actions).getByRole("button", { name: "记录退款" })).toBeVisible();
  expect(within(actions).getByRole("button", { name: "作废订单" })).toBeVisible();
});

test("shows refund action for cancelled orders without void action", () => {
  render(
    <OrderDetailDialog
      order={{ ...order, status: "cancelled", cancelledAt: "2026-06-17T10:00:00.000Z" }}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onVoidOrder={() => undefined}
      onSaveRefund={() => undefined}
    />
  );

  expect(screen.getByRole("button", { name: "记录退款" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
});

test("does not show refund action for pending payment orders", () => {
  render(
    <OrderDetailDialog
      order={{ ...order, status: "pending_payment", paidAt: undefined, paymentMethod: undefined }}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onSaveRefund={() => undefined}
    />
  );

  expect(screen.queryByRole("button", { name: "记录退款" })).not.toBeInTheDocument();
});

test("does not show refund action after the order is fully refunded", () => {
  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[{ ...refunds[0], amount: 100 }]}
      onClose={() => undefined}
      onSaveRefund={() => undefined}
    />
  );

  expect(screen.queryByRole("button", { name: "记录退款" })).not.toBeInTheDocument();
});

test("submits a manual refund from the refund dialog", () => {
  const onSaveRefund = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onSaveRefund={onSaveRefund}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "记录退款" }));

  const refundDialog = screen.getByRole("dialog", { name: "记录人工退款" });
  expect(within(refundDialog).getByLabelText("退款方式")).toHaveValue("wechat");
  expect(within(refundDialog).getByLabelText("退款原因")).toHaveValue("customer_return");
  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "12.5" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款方式"), { target: { value: "cash" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款原因"), { target: { value: "product_issue" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款备注"), { target: { value: " 商品问题。 " } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));

  expect(onSaveRefund).toHaveBeenCalledWith({
    amount: 12.5,
    method: "cash",
    reason: "product_issue",
    note: "商品问题。"
  });
});

test("keeps refund dialog open with a sanitized error when save handler rejects", async () => {
  const onSaveRefund = vi.fn().mockRejectedValue(new Error("raw refund save failure"));

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onSaveRefund={onSaveRefund}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "记录退款" }));

  const refundDialog = screen.getByRole("dialog", { name: "记录人工退款" });
  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "12" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款备注"), { target: { value: "保留输入" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));

  expect(await screen.findByText("退款记录保存失败，请刷新后重试。")).toBeVisible();
  expect(screen.queryByText("raw refund save failure")).not.toBeInTheDocument();
  expect(screen.getByRole("dialog", { name: "记录人工退款" })).toBeVisible();
  expect(screen.getByLabelText("退款金额")).toHaveValue(12);
  expect(screen.getByLabelText("退款备注")).toHaveValue("保留输入");
});

test("defaults refund method to cash when order has no payment method", () => {
  render(
    <OrderDetailDialog
      order={{ ...order, status: "cancelled", paymentMethod: undefined }}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={[]}
      onClose={() => undefined}
      onSaveRefund={() => undefined}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "记录退款" }));

  expect(screen.getByLabelText("退款方式")).toHaveValue("cash");
});

test("validates refund amount before submitting", () => {
  const onSaveRefund = vi.fn();

  render(
    <OrderDetailDialog
      order={order}
      orderItems={orderItems}
      inventoryLogs={inventoryLogs}
      orderRefunds={refunds}
      onClose={() => undefined}
      onSaveRefund={onSaveRefund}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "记录退款" }));
  const refundDialog = screen.getByRole("dialog", { name: "记录人工退款" });

  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));
  expect(screen.getByText("请填写退款金额。")).toBeVisible();

  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "0" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));
  expect(screen.getByText("退款金额必须大于 0。")).toBeVisible();

  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "100" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));
  expect(screen.getByText("退款金额不能超过剩余可退金额。")).toBeVisible();
  expect(onSaveRefund).not.toHaveBeenCalled();
});
