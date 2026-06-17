import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AppSettings, InventoryLog, Order, OrderItem } from "../domain/types";
import { useCartStore } from "../state/cartStore";
import { defaultPromotion, product } from "../test/fixtures";
import SalesPage from "./SalesPage";

const sellableProduct = product({
  id: "normal",
  name: "普通商品",
  spu: "普通SPU",
  productCode: "NORMAL-BASE",
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
  listInventoryLogsForOrder: vi.fn(),
  listOrderItems: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  savePaidOrder: vi.fn(),
  voidPaidOrder: vi.fn()
}));

vi.mock("../db/repositories", () => repositories);

vi.mock("../utils/image", () => ({
  getImageUrl: vi.fn(() => Promise.resolve(undefined))
}));

function localIsoDateTime(dayOffset: number, hours: number, minutes: number): string {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString();
}

beforeEach(() => {
  vi.resetAllMocks();
  repositories.getSettings.mockResolvedValue(settings);
  repositories.listInventoryLogsForOrder.mockResolvedValue([]);
  repositories.listOrderItems.mockResolvedValue([]);
  repositories.listOrders.mockResolvedValue([]);
  repositories.listProducts.mockResolvedValue([sellableProduct]);
  repositories.savePaidOrder.mockResolvedValue(undefined);
  repositories.voidPaidOrder.mockResolvedValue(undefined);
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

function orderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    productId: "normal",
    productNameSnapshot: "普通商品",
    spuSnapshot: "普通SPU",
    productCodeSnapshot: "NORMAL-BASE",
    quantity: 1,
    originalUnitPrice: 20,
    finalUnitPrice: 20,
    lineType: "normal",
    lineTotal: 20,
    ...overrides
  };
}

function inventoryLog(overrides: Partial<InventoryLog> = {}): InventoryLog {
  return {
    id: "log-1",
    productId: "normal",
    orderId: "order-1",
    changeQty: -1,
    reason: "order_paid",
    beforeQty: 10,
    afterQty: 9,
    createdAt: "2026-06-15T09:25:01.000Z",
    ...overrides
  };
}

test("checkout back button returns to the cart panel without clearing items", async () => {
  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));

  expect(await screen.findByRole("heading", { level: 2, name: "收款确认" })).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "返回" }));

  const cartPanel = await screen.findByRole("complementary", { name: "购物车" });

  expect(within(cartPanel).getByRole("heading", { level: 2, name: "购物车" })).toBeVisible();
  expect(within(cartPanel).getByRole("heading", { level: 3, name: "普通商品" })).toBeVisible();
});

test("shows order review instead of sellable products while checking out", async () => {
  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));

  const review = await screen.findByRole("region", { name: "本单商品" });

  expect(within(review).getByRole("heading", { level: 2, name: "本单商品" })).toBeVisible();
  expect(within(review).getByRole("heading", { level: 3, name: "普通商品" })).toBeVisible();
  expect(within(review).queryByText("NORMAL-BASE")).not.toBeInTheDocument();
  expect(within(review).getByText("正常")).toBeVisible();
  expect(within(review).getByText("单价 ¥20.00")).toBeVisible();
  const payableRow = within(review).getByText("应收").closest("div");
  expect(payableRow).not.toBeNull();
  expect(within(payableRow as HTMLElement).getByText("¥20.00")).toBeVisible();
  expect(screen.queryByRole("list", { name: "售卖商品紧凑列表" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "按 SPU 筛选商品" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "切换商品展示方式" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" })).not.toBeInTheDocument();
});

test("shows compact sales list by default and can switch to image grid", async () => {
  render(<SalesPage />);

  const list = await screen.findByRole("list", { name: "售卖商品紧凑列表" });
  expect(within(list).getByRole("heading", { level: 2, name: "普通商品" })).toBeVisible();
  expect(within(list).queryByText("NORMAL-BASE")).not.toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "售卖商品图片网格" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "图片网格" }));

  const grid = await screen.findByRole("list", { name: "售卖商品图片网格" });
  expect(within(grid).getByRole("heading", { level: 2, name: "普通商品" })).toBeVisible();
  expect(within(grid).queryByText("NORMAL-BASE")).not.toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "售卖商品紧凑列表" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "紧凑列表" }));

  expect(await screen.findByRole("list", { name: "售卖商品紧凑列表" })).toBeVisible();
});

test("renders multiple products in the compact list without switching to image grid", async () => {
  repositories.listProducts.mockResolvedValue([
    sellableProduct,
    product({ id: "pin", name: "徽章商品", spu: "徽章SPU", salePrice: 15, stockQty: 8 }),
    product({ id: "stand", name: "立牌商品", spu: "立牌SPU", salePrice: 30, stockQty: 5 })
  ]);

  render(<SalesPage />);

  const list = await screen.findByRole("list", { name: "售卖商品紧凑列表" });

  expect(within(list).getByRole("heading", { level: 2, name: "普通商品" })).toBeVisible();
  expect(within(list).getByRole("heading", { level: 2, name: "徽章商品" })).toBeVisible();
  expect(within(list).getByRole("heading", { level: 2, name: "立牌商品" })).toBeVisible();
  expect(screen.queryByRole("list", { name: "售卖商品图片网格" })).not.toBeInTheDocument();
});

test("opens and closes the cart drawer from the floating cart button", async () => {
  render(<SalesPage />);

  expect(screen.queryByRole("complementary", { name: "购物车" })).not.toBeInTheDocument();

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));

  const cartPanel = await screen.findByRole("complementary", { name: "购物车" });
  expect(within(cartPanel).getByRole("heading", { level: 2, name: "购物车" })).toBeVisible();

  fireEvent.click(within(cartPanel).getByRole("button", { name: "关闭购物车" }));

  expect(screen.queryByRole("complementary", { name: "购物车" })).not.toBeInTheDocument();
});

test("holding the cart closes the cart drawer and keeps cart items", async () => {
  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));

  const cartPanel = await screen.findByRole("complementary", { name: "购物车" });
  fireEvent.click(within(cartPanel).getByRole("button", { name: "暂存购物车" }));

  expect(screen.queryByRole("complementary", { name: "购物车" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" })).toBeVisible();
  expect(await screen.findByText("购物车已暂存，可继续选择商品。")).toBeVisible();
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
    .mockResolvedValueOnce([
      order({
        orderNo: "ECRM-SAVED",
        payableAmount: 20,
        paymentMethod: "cash",
        createdAt: localIsoDateTime(0, 9, 20),
        paidAt: localIsoDateTime(0, 9, 25)
      })
    ]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    promotion: {
      ...settings.promotion,
      giftTiers: [{ threshold: 20, gifts: [{ productId: "gift-a", quantity: 1 }] }]
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
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
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 0 件，应收 ¥0.00" }));
  expect(await screen.findByText("还没有选择商品。")).toBeVisible();
  expect(repositories.listProducts.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(repositories.listOrders.mock.calls.length).toBeGreaterThanOrEqual(2);

  fireEvent.click(screen.getByRole("button", { name: /订单记录/ }));

  expect(await screen.findByText("ECRM-SAVED")).toBeVisible();
});

test("requires selecting actual SKU before saving an SPU gift order", async () => {
  const giftProduct = product({
    id: "gift-a-1",
    name: "赠品A黑色",
    spu: "赠品SPU",
    productCode: "GFTA-BLK",
    salePrice: 0,
    stockQty: 2,
    isSellable: false,
    isGiftEligible: true
  });

  repositories.listProducts.mockResolvedValue([sellableProduct, giftProduct]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    promotion: {
      ...settings.promotion,
      giftTiers: [{ threshold: 20, gifts: [{ targetType: "spu", spu: "赠品SPU", quantity: 1 }] }]
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));

  expect(await screen.findByText("赠品SPU 还需要选择 1 个赠品。")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "赠品未选择完整，无法确认" }));
  expect(repositories.savePaidOrder).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("赠品A：赠品SPU 第 1 行 SKU"), { target: { value: "gift-a-1" } });
  fireEvent.click(screen.getByRole("button", { name: "确认已收款并保存订单" }));

  await waitFor(() => expect(repositories.savePaidOrder).toHaveBeenCalledTimes(1));
  expect(repositories.savePaidOrder.mock.calls[0][0].orderItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ productId: "gift-a-1", lineType: "gift", quantity: 1 })
    ])
  );
});

test("keeps cart items when paid order save fails", async () => {
  repositories.savePaidOrder.mockRejectedValue(new Error("商品 普通商品 库存不足，无法完成订单扣减"));

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认已收款并保存订单" }));

  expect(await screen.findByText("商品 普通商品 库存不足，无法完成订单扣减")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "返回" }));

  const cartPanel = await screen.findByRole("complementary", { name: "购物车" });
  expect(within(cartPanel).getByRole("heading", { level: 3, name: "普通商品" })).toBeVisible();
});

test("filters order history by order number, status, date range, and payment method", async () => {
  repositories.listOrders.mockResolvedValue([
    order({ id: "wechat-today", orderNo: "ECRM-TODAY-WECHAT", paymentMethod: "wechat", paidAt: localIsoDateTime(0, 9, 25) }),
    order({ id: "cash-today", orderNo: "ECRM-TODAY-CASH", paymentMethod: "cash", paidAt: localIsoDateTime(0, 10, 25) }),
    order({ id: "pending", orderNo: "ECRM-PENDING", status: "pending_payment", paymentMethod: "cash", paidAt: undefined, createdAt: localIsoDateTime(0, 11, 20) }),
    order({ id: "old", orderNo: "ECRM-OLD-WECHAT", paymentMethod: "wechat", paidAt: "2026-06-01T09:25:00.000Z", createdAt: "2026-06-01T09:20:00.000Z" })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  expect(within(history).getByText("ECRM-TODAY-WECHAT")).toBeVisible();
  expect(within(history).getByText("ECRM-TODAY-CASH")).toBeVisible();
  expect(within(history).queryByText("ECRM-PENDING")).not.toBeInTheDocument();
  expect(within(history).queryByText("ECRM-OLD-WECHAT")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("搜索订单号"), { target: { value: "cash" } });
  expect(within(history).queryByText("ECRM-TODAY-WECHAT")).not.toBeInTheDocument();
  expect(within(history).getByText("ECRM-TODAY-CASH")).toBeVisible();

  fireEvent.change(screen.getByLabelText("搜索订单号"), { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("订单状态"), { target: { value: "pending_payment" } });
  expect(within(history).getByText("ECRM-PENDING")).toBeVisible();
  expect(within(history).queryByText("ECRM-TODAY-CASH")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("订单状态"), { target: { value: "all" } });
  fireEvent.change(screen.getByLabelText("支付方式"), { target: { value: "wechat" } });
  expect(within(history).getByText("ECRM-TODAY-WECHAT")).toBeVisible();
  expect(within(history).queryByText("ECRM-OLD-WECHAT")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("订单日期范围"), { target: { value: "all" } });
  expect(within(history).getByText("ECRM-OLD-WECHAT")).toBeVisible();
});

test("opens order detail dialog with order items and inventory logs", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "order-detail",
      orderNo: "ECRM-DETAIL",
      paymentMethod: "alipay",
      payableAmount: 42.5,
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValue([
    orderItem({
      id: "item-detail",
      orderId: "order-detail",
      productNameSnapshot: "历史普通商品",
      spuSnapshot: "历史SPU",
      productCodeSnapshot: "HIS-BASE",
      quantity: 2,
      originalUnitPrice: 25,
      finalUnitPrice: 20,
      lineType: "discount_addon",
      lineTotal: 40
    })
  ]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([
    inventoryLog({
      id: "log-detail",
      orderId: "order-detail",
      changeQty: -2,
      beforeQty: 10,
      afterQty: 8
    })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));

  const dialog = await screen.findByRole("dialog", { name: "订单详情 ECRM-DETAIL" });
  expect(repositories.listOrderItems).toHaveBeenCalledWith("order-detail");
  expect(repositories.listInventoryLogsForOrder).toHaveBeenCalledWith("order-detail");
  expect(within(dialog).getByText("历史普通商品")).toBeVisible();
  expect(within(dialog).getByText("HIS-BASE")).toBeVisible();
  expect(within(dialog).getByText("加购优惠")).toBeVisible();
  expect(within(dialog).getByText("库存 10 -> 8")).toBeVisible();
  expect(within(dialog).queryByRole("button", { name: "退款" })).not.toBeInTheDocument();
});

test("voids an order from the detail dialog and refreshes the order detail", async () => {
  const paidOrder = order({
    id: "order-detail",
    orderNo: "ECRM-DETAIL",
    paymentMethod: "alipay",
    payableAmount: 42.5,
    createdAt: localIsoDateTime(0, 9, 20),
    paidAt: localIsoDateTime(0, 9, 25)
  });
  const cancelledOrder = {
    ...paidOrder,
    status: "cancelled" as const,
    cancelledAt: localIsoDateTime(0, 10, 0)
  };

  repositories.listOrders
    .mockResolvedValueOnce([paidOrder])
    .mockResolvedValueOnce([cancelledOrder]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);
  repositories.listInventoryLogsForOrder
    .mockResolvedValueOnce([inventoryLog({ orderId: "order-detail", beforeQty: 10, afterQty: 9 })])
    .mockResolvedValueOnce([
      inventoryLog({ orderId: "order-detail", beforeQty: 10, afterQty: 9 }),
      inventoryLog({
        id: "rollback-log",
        orderId: "order-detail",
        changeQty: 1,
        reason: "order_cancelled_rollback",
        beforeQty: 9,
        afterQty: 10
      })
    ]);
  repositories.voidPaidOrder.mockResolvedValue(cancelledOrder);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "作废订单" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认作废" }));

  await waitFor(() => expect(repositories.voidPaidOrder).toHaveBeenCalledWith("order-detail"));
  expect(await screen.findByText("订单 ECRM-DETAIL 已作废，库存已回滚。")).toBeVisible();

  const dialog = await screen.findByRole("dialog", { name: "订单详情 ECRM-DETAIL" });
  expect(within(dialog).getByText("已取消")).toBeVisible();
  expect(within(dialog).getByText("作废回滚")).toBeVisible();
  expect(within(dialog).queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
  expect(repositories.listProducts.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(repositories.listOrders.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test("shows sanitized error when order void fails", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "order-detail",
      orderNo: "ECRM-DETAIL",
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([inventoryLog({ orderId: "order-detail" })]);
  repositories.voidPaidOrder.mockRejectedValue(new Error("raw internal rollback failure"));

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "作废订单" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认作废" }));

  expect(await screen.findByText("订单作废失败，请刷新后重试。")).toBeVisible();
  expect(screen.queryByText("raw internal rollback failure")).not.toBeInTheDocument();
});

test("keeps a voided order visible when detail refresh fails after voiding", async () => {
  const paidOrder = order({
    id: "order-detail",
    orderNo: "ECRM-DETAIL",
    createdAt: localIsoDateTime(0, 9, 20),
    paidAt: localIsoDateTime(0, 9, 25)
  });
  const cancelledOrder = {
    ...paidOrder,
    status: "cancelled" as const,
    cancelledAt: localIsoDateTime(0, 10, 0)
  };

  repositories.listOrders
    .mockResolvedValueOnce([paidOrder])
    .mockResolvedValueOnce([cancelledOrder]);
  repositories.listOrderItems
    .mockResolvedValueOnce([orderItem({ orderId: "order-detail" })])
    .mockResolvedValueOnce([orderItem({ orderId: "order-detail" })]);
  repositories.listInventoryLogsForOrder
    .mockResolvedValueOnce([inventoryLog({ orderId: "order-detail" })])
    .mockRejectedValueOnce(new Error("raw detail refresh failure"));
  repositories.voidPaidOrder.mockResolvedValue(cancelledOrder);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "作废订单" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认作废" }));

  await waitFor(() => expect(repositories.voidPaidOrder).toHaveBeenCalledWith("order-detail"));
  expect(await screen.findByText("订单 ECRM-DETAIL 已作废，但详情刷新失败，请刷新页面查看最新库存流水。")).toBeVisible();
  expect(screen.queryByText("订单作废失败，请刷新后重试。")).not.toBeInTheDocument();
  expect(screen.queryByText("raw detail refresh failure")).not.toBeInTheDocument();

  const dialog = await screen.findByRole("dialog", { name: "订单详情 ECRM-DETAIL" });
  expect(within(dialog).getByText("已取消")).toBeVisible();
  expect(within(dialog).queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
});

test("shows recent paid order history behind a toggle", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      orderNo: "ECRM-PAID",
      paymentMethod: "alipay",
      payableAmount: 42.5,
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    }),
    order({
      id: "pending",
      orderNo: "ECRM-PENDING",
      status: "pending_payment",
      paymentMethod: "cash",
      payableAmount: 18,
      createdAt: localIsoDateTime(0, 10, 20),
      paidAt: undefined
    })
  ]);

  render(<SalesPage />);

  const toggle = await screen.findByRole("button", { name: /订单记录/ });

  expect(screen.queryByText("ECRM-PAID")).not.toBeInTheDocument();

  fireEvent.click(toggle);

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  const paidOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-PAID" });

  expect(within(paidOrderButton).getByText("ECRM-PAID")).toBeVisible();
  expect(within(paidOrderButton).getByText("支付宝")).toBeVisible();
  expect(within(paidOrderButton).getByText("已支付")).toBeVisible();
  expect(within(paidOrderButton).getByText("¥42.50")).toBeVisible();
  expect(within(history).queryByText("ECRM-PENDING")).not.toBeInTheDocument();
});

test("sorts recent paid order history by paid time with created time fallback", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "created-newer",
      orderNo: "ECRM-CREATED-NEWER",
      createdAt: localIsoDateTime(0, 12, 0),
      paidAt: localIsoDateTime(0, 12, 5)
    }),
    order({
      id: "paid-newest",
      orderNo: "ECRM-PAID-NEWEST",
      createdAt: localIsoDateTime(0, 8, 0),
      paidAt: localIsoDateTime(0, 12, 30)
    }),
    order({
      id: "fallback-middle",
      orderNo: "ECRM-FALLBACK-MIDDLE",
      createdAt: localIsoDateTime(0, 12, 10),
      paidAt: undefined
    })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));

  const orderNumbers = within(await screen.findByRole("region", { name: "订单记录列表" }))
    .getAllByText(/ECRM-/)
    .map((item) => item.textContent);

  expect(orderNumbers).toEqual([
    "ECRM-PAID-NEWEST",
    "ECRM-FALLBACK-MIDDLE",
    "ECRM-CREATED-NEWER"
  ]);
});
