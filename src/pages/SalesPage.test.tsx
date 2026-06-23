import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { setFieldLockPin } from "../domain/fieldLock";
import type { AppSettings, InventoryLog, Order, OrderItem } from "../domain/types";
import { useCartStore } from "../state/cartStore";
import { appSettings, defaultPromotion, product } from "../test/fixtures";
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
  ...appSettings()
};

const repositories = vi.hoisted(() => ({
  adjustOrderAccounting: vi.fn(),
  adjustOrderItemAccounting: vi.fn(),
  getSettings: vi.fn(),
  listInventoryLogsForOrder: vi.fn(),
  listOrderItems: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  listOrderRefunds: vi.fn(),
  listRefunds: vi.fn(),
  savePaidOrder: vi.fn(),
  saveSettings: vi.fn(),
  saveOrderRefund: vi.fn(),
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
  repositories.adjustOrderAccounting.mockResolvedValue([]);
  repositories.adjustOrderItemAccounting.mockResolvedValue(undefined);
  repositories.listInventoryLogsForOrder.mockResolvedValue([]);
  repositories.listOrderItems.mockResolvedValue([]);
  repositories.listOrders.mockResolvedValue([]);
  repositories.listProducts.mockResolvedValue([sellableProduct]);
  repositories.listOrderRefunds.mockResolvedValue([]);
  repositories.listRefunds.mockResolvedValue([]);
  repositories.savePaidOrder.mockResolvedValue(undefined);
  repositories.saveSettings.mockResolvedValue(undefined);
  repositories.saveOrderRefund.mockResolvedValue({
    id: "refund-1",
    orderId: "order-detail",
    amount: 10,
    method: "cash",
    reason: "customer_return",
    createdAt: localIsoDateTime(0, 10, 0)
  });
  repositories.voidPaidOrder.mockResolvedValue(undefined);
  useCartStore.getState().replace([]);
});

test("shows field mode status without blocking sales", async () => {
  repositories.getSettings.mockResolvedValue({
    ...settings,
    fieldLock: {
      ...settings.fieldLock,
      enabled: true,
      pinHash: "secret-hash",
      pinSalt: "secret-salt"
    }
  });

  render(<SalesPage />);

  expect(await screen.findByText("现场模式已开启")).toBeVisible();
  expect(await screen.findByRole("button", { name: "加入 普通商品" })).toBeVisible();
});

test("relocks field mode from sales page", async () => {
  repositories.getSettings.mockResolvedValue({
    ...settings,
    fieldLock: {
      ...settings.fieldLock,
      enabled: true,
      pinHash: "secret-hash",
      pinSalt: "secret-salt",
      unlockExpiresAt: "2099-06-19T09:05:00.000Z"
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "重新锁定" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalled());
  const savedSettings = repositories.saveSettings.mock.calls.at(-1)?.[0] as AppSettings;
  expect(savedSettings.fieldLock.unlockExpiresAt).toBeUndefined();
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
  expect(within(review).queryByText("ORDER")).not.toBeInTheDocument();
  const checkoutScrollArea = within(review).getByLabelText("本单商品与促销");
  expect(checkoutScrollArea).toHaveClass("checkoutScrollArea");
  expect(within(checkoutScrollArea).queryByLabelText("本单促销信息")).not.toBeInTheDocument();
  expect(within(review).getByLabelText("本单结算")).toHaveClass("checkoutReviewFooter");
  expect(within(review).getByLabelText("本单促销信息")).toHaveClass("promotionSummary");
  expect(within(review).getByRole("heading", { level: 3, name: "普通商品" })).toBeVisible();
  expect(within(review).queryByText("NORMAL-BASE")).not.toBeInTheDocument();
  expect(within(review).getByText("正常")).toBeVisible();
  expect(within(review).getByText("单价 ¥20.00")).toBeVisible();
  expect(screen.getByRole("heading", { level: 1, name: "收款" }).closest(".salesHeader")).toHaveClass("isCheckout");
  expect(screen.queryByText("Checkout")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "刷新" })).toHaveClass("checkoutRefreshButton");
  const payableRow = within(review).getByText("应收").closest("div");
  expect(payableRow).not.toBeNull();
  expect(within(payableRow as HTMLElement).getByText("¥20.00")).toBeVisible();
  expect(screen.queryByRole("list", { name: "售卖商品紧凑列表" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "按 SPU 筛选商品" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "切换商品展示方式" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" })).not.toBeInTheDocument();
});

test("checkout review uses cart line ordering and keeps totals outside the scroll list", async () => {
  repositories.listProducts.mockResolvedValue([
    sellableProduct,
    product({ id: "addon", name: "加购商品", spu: "加购SPU", salePrice: 5, stockQty: 10 }),
    product({
      id: "campaign-gift",
      name: "运营赠品",
      spu: "赠品SPU",
      salePrice: 6,
      stockQty: 10,
      isSellable: false,
      isGiftEligible: true
    }),
    product({
      id: "manual-gift",
      name: "人工赠品",
      spu: "赠品SPU",
      salePrice: 9,
      stockQty: 10,
      isSellable: false,
      isGiftEligible: true
    })
  ]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    promotion: {
      ...settings.promotion,
      addonDiscount: {
        enabled: true,
        discountSpu: "加购SPU",
        discountPrice: 3,
        maxDiscountQty: 3
      },
      giftTiers: []
    },
    campaignGift: {
      enabled: true,
      activityName: "关注社媒赠礼",
      targetType: "sku",
      defaultProductId: "campaign-gift",
      defaultSpu: "",
      requireSaleLine: true
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(await screen.findByRole("button", { name: "加入 加购商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 2 件，应收 ¥23.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 运营赠礼" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 人工赠送" }));

  const picker = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  fireEvent.click(within(picker).getByRole("button", { name: "选择 人工赠品，库存 10" }));
  fireEvent.change(within(picker).getByLabelText("备注"), { target: { value: "好友赠送" } });
  fireEvent.click(within(picker).getByRole("button", { name: "确认添加" }));

  fireEvent.click(await screen.findByRole("button", { name: "去收款" }));

  const review = await screen.findByRole("region", { name: "本单商品" });
  const lineNames = within(within(review).getByLabelText("本单商品明细"))
    .getAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

  expect(lineNames).toEqual(["运营赠品", "人工赠品", "加购商品", "普通商品"]);
  expect(within(review).getByLabelText("本单结算")).toHaveClass("checkoutReviewFooter");
  expect(within(within(review).getByLabelText("本单商品与促销")).queryByLabelText("本单结算")).not.toBeInTheDocument();
  expect(within(review).getAllByText("运营赠礼").length).toBeGreaterThanOrEqual(1);
  expect(within(review).getAllByText("人工赠送").length).toBeGreaterThanOrEqual(1);
  const firstLine = within(review).getByText("运营赠品").closest(".cartLine");
  expect(firstLine?.querySelector(".lineTitleRow .cartLineBadge")).toBeNull();
  expect(firstLine?.querySelector(":scope > .cartLineBadge")).not.toBeNull();
  expect(firstLine?.querySelector(".cartLineAmountColumn")).toHaveClass("isBottomAligned");
});

test("shows compact sales list by default without exposing image grid mode", async () => {
  render(<SalesPage />);

  const list = await screen.findByRole("list", { name: "售卖商品紧凑列表" });
  expect(within(list).getByRole("heading", { level: 2, name: "普通商品" })).toBeVisible();
  expect(within(list).queryByText("NORMAL-BASE")).not.toBeInTheDocument();
  expect(screen.queryByRole("list", { name: "售卖商品图片网格" })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "切换商品展示方式" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "图片网格" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "紧凑列表" })).not.toBeInTheDocument();
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

test("购物车没有销售商品时不能添加运营赠礼", async () => {
  const campaignGift = product({
    id: "campaign-gift",
    name: "运营赠品",
    spu: "赠品SPU",
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, campaignGift]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    campaignGift: {
      enabled: true,
      activityName: "关注小红书赠礼",
      targetType: "sku",
      defaultProductId: "campaign-gift",
      defaultSpu: "",
      requireSaleLine: true
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "打开购物车，当前 0 件，应收 ¥0.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 运营赠礼" }));

  expect(await screen.findByText("运营赠礼需要本单存在正常消费商品。")).toBeVisible();
  expect(useCartStore.getState().items).toEqual([]);
});

test("未启用运营赠礼时不显示快捷入口且不会添加运营赠礼", async () => {
  const campaignGift = product({
    id: "campaign-gift",
    name: "运营赠品",
    spu: "赠品SPU",
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, campaignGift]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    campaignGift: {
      enabled: false,
      activityName: "关注小红书赠礼",
      defaultProductId: "campaign-gift",
      requireSaleLine: true
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));

  expect(screen.queryByRole("button", { name: "+ 运营赠礼" })).not.toBeInTheDocument();
  expect(useCartStore.getState().items).toEqual([
    expect.objectContaining({ productId: "normal", revenueType: "sale", quantity: 1 })
  ]);
});

test("有销售行和默认运营赠礼 SKU 时点击运营赠礼会添加 0 元运营赠礼行", async () => {
  const campaignGift = product({
    id: "campaign-gift",
    name: "运营赠品",
    spu: "赠品SPU",
    salePrice: 6,
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, campaignGift]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    campaignGift: {
      enabled: true,
      activityName: "关注小红书赠礼",
      defaultProductId: "campaign-gift",
      requireSaleLine: true
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 运营赠礼" }));

  expect(await screen.findByText("运营赠品")).toBeVisible();
  expect(screen.getByRole("button", { name: "打开购物车，当前 2 件，应收 ¥20.00" })).toBeVisible();
  expect(useCartStore.getState().items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ productId: "normal", revenueType: "sale", quantity: 1 }),
      expect.objectContaining({
        productId: "campaign-gift",
        revenueType: "non_sales",
        nonSalesReason: "campaign_gift",
        campaignNameSnapshot: "关注小红书赠礼",
        quantity: 1
      })
    ])
  );
});

test("运营赠礼配置为 SPU 时只显示该 SPU 下可赠礼 SKU", async () => {
  repositories.listProducts.mockResolvedValue([
    sellableProduct,
    product({
      id: "gift-a",
      name: "赠礼 A",
      spu: "赠礼SPU",
      stockQty: 5,
      isGiftEligible: true,
      isSellable: false
    }),
    product({
      id: "gift-b",
      name: "赠礼 B",
      spu: "赠礼SPU",
      stockQty: 5,
      isGiftEligible: true,
      isSellable: false
    }),
    product({
      id: "gift-other",
      name: "其他赠礼",
      spu: "其他SPU",
      stockQty: 5,
      isGiftEligible: true,
      isSellable: false
    })
  ]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    campaignGift: {
      enabled: true,
      activityName: "关注社媒赠礼",
      targetType: "spu",
      defaultProductId: "",
      defaultSpu: "赠礼SPU",
      requireSaleLine: true
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 运营赠礼" }));

  const dialog = await screen.findByRole("dialog", { name: "选择运营赠礼商品" });
  expect(within(dialog).getByText("赠礼 A")).toBeVisible();
  expect(within(dialog).getByText("赠礼 B")).toBeVisible();
  expect(within(dialog).queryByText("其他赠礼")).not.toBeInTheDocument();
});

test("默认运营赠礼按当前购物车同 SKU 总数量校验库存", async () => {
  const campaignGift = product({
    id: "campaign-gift",
    name: "运营赠品",
    spu: "赠品SPU",
    salePrice: 6,
    stockQty: 1,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, campaignGift]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    campaignGift: {
      enabled: true,
      activityName: "关注小红书赠礼",
      defaultProductId: "campaign-gift",
      requireSaleLine: true
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 运营赠礼" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 运营赠礼" }));

  expect(await screen.findByText("该商品库存不足，无法继续添加。")).toBeVisible();
  expect(useCartStore.getState().items.filter((item) => item.productId === "campaign-gift")).toHaveLength(1);
});

test("人工赠送备注为空不能确认，填写备注后可添加人工赠送行", async () => {
  const manualGift = product({
    id: "manual-gift",
    name: "人工赠品",
    spu: "赠品SPU",
    salePrice: 9,
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, manualGift]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "打开购物车，当前 0 件，应收 ¥0.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 人工赠送" }));

  const dialog = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  fireEvent.click(within(dialog).getByRole("button", { name: "选择 人工赠品，库存 5" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "确认添加" }));

  expect(await within(dialog).findByText("请填写备注后再添加。")).toBeVisible();
  expect(useCartStore.getState().items).toEqual([]);

  fireEvent.change(within(dialog).getByLabelText("备注"), { target: { value: "好友赠送" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "确认添加" }));

  await waitFor(() =>
    expect(useCartStore.getState().items).toEqual([
      expect.objectContaining({
        productId: "manual-gift",
        revenueType: "non_sales",
        nonSalesReason: "manual_gift",
        nonSalesNote: "好友赠送",
        quantity: 1
      })
    ])
  );
  expect(await screen.findByText("人工赠品")).toBeVisible();
  expect(screen.getAllByText("人工赠送").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥0.00" })).toBeVisible();
});

test("非销售选择器显示库存并禁用已达购物车库存的商品", async () => {
  const manualGift = product({
    id: "manual-gift",
    name: "人工赠品",
    spu: "赠品SPU",
    salePrice: 9,
    stockQty: 1,
    isSellable: false,
    isGiftEligible: true
  });
  const zeroStockGift = product({
    id: "zero-gift",
    name: "零库存赠品",
    spu: "赠品SPU",
    salePrice: 9,
    stockQty: 0,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, manualGift, zeroStockGift]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "打开购物车，当前 0 件，应收 ¥0.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 人工赠送" }));

  const firstDialog = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  expect(within(firstDialog).getByText("库存 1")).toBeVisible();
  expect(within(firstDialog).getByRole("button", { name: "选择 零库存赠品，库存 0，已达库存" })).toBeDisabled();
  fireEvent.click(within(firstDialog).getByRole("button", { name: "选择 人工赠品，库存 1" }));
  fireEvent.change(within(firstDialog).getByLabelText("备注"), { target: { value: "好友赠送" } });
  fireEvent.click(within(firstDialog).getByRole("button", { name: "确认添加" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "选择人工赠送商品" })).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "+ 人工赠送" }));
  const secondDialog = await screen.findByRole("dialog", { name: "选择人工赠送商品" });

  const exhaustedOption = within(secondDialog).getByRole("button", { name: "选择 人工赠品，库存 1，已达库存" });
  expect(exhaustedOption).toBeDisabled();
  expect(exhaustedOption).not.toHaveClass("isSelected");
  fireEvent.change(within(secondDialog).getByLabelText("备注"), { target: { value: "再次赠送" } });
  fireEvent.click(within(secondDialog).getByRole("button", { name: "确认添加" }));

  expect(await within(secondDialog).findByText("请选择有效商品后再添加。")).toBeVisible();
  expect(useCartStore.getState().items.filter((item) => item.productId === "manual-gift")).toHaveLength(1);
});

test("非销售选择器切换显示全部商品时会替换不可选的旧选择", async () => {
  const exhaustedGift = product({
    id: "exhausted-gift",
    name: "已用完赠品",
    spu: "赠品SPU",
    stockQty: 1,
    isSellable: false,
    isGiftEligible: true
  });
  const activeProduct = product({
    id: "active-product",
    name: "可选商品",
    spu: "普通SPU",
    stockQty: 2,
    isSellable: true,
    isGiftEligible: false
  });
  repositories.listProducts.mockResolvedValue([exhaustedGift, activeProduct]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "打开购物车，当前 0 件，应收 ¥0.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 人工赠送" }));
  const firstDialog = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  fireEvent.click(within(firstDialog).getByRole("button", { name: "选择 已用完赠品，库存 1" }));
  fireEvent.change(within(firstDialog).getByLabelText("备注"), { target: { value: "样品赠送" } });
  fireEvent.click(within(firstDialog).getByRole("button", { name: "确认添加" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "选择人工赠送商品" })).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: "+ 人工赠送" }));
  const secondDialog = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  expect(within(secondDialog).getByRole("button", { name: "选择 已用完赠品，库存 1，已达库存" })).not.toHaveClass("isSelected");

  fireEvent.click(within(secondDialog).getByRole("checkbox", { name: "显示全部在售商品" }));

  expect(within(secondDialog).getByRole("button", { name: "选择 可选商品，库存 2" })).toHaveClass("isSelected");
});

test("does not let product quantity exceed available stock before checkout", async () => {
  repositories.listProducts.mockResolvedValue([{ ...sellableProduct, stockQty: 1 }]);

  render(<SalesPage />);

  const addButton = await screen.findByRole("button", { name: "加入 普通商品" });
  fireEvent.click(addButton);

  await waitFor(() => expect(addButton).toBeDisabled());
  expect(await screen.findByText("已达库存")).toBeVisible();
});

test("加入销售商品和运营赠礼后删除销售商品会阻止去收款", async () => {
  const campaignGift = product({
    id: "campaign-gift",
    name: "运营赠品",
    spu: "赠品SPU",
    salePrice: 6,
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, campaignGift]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    campaignGift: {
      enabled: true,
      activityName: "关注小红书赠礼",
      defaultProductId: "campaign-gift",
      requireSaleLine: true
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 运营赠礼" }));
  fireEvent.click(screen.getByRole("button", { name: "减少 普通商品" }));

  fireEvent.click(await screen.findByRole("button", { name: "运营赠礼需要正常消费商品" }));

  expect(screen.queryByRole("heading", { level: 2, name: "收款确认" })).not.toBeInTheDocument();
  expect(await screen.findByText("运营赠礼需要正常消费商品")).toBeVisible();
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

test("含人工赠送时确认保存会保存混合订单 V1.6a 字段", async () => {
  const manualGift = product({
    id: "manual-gift",
    name: "人工赠品",
    spu: "赠品SPU",
    salePrice: 9,
    costPrice: 2,
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, manualGift]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 人工赠送" }));
  const dialog = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  fireEvent.click(within(dialog).getByRole("button", { name: "选择 人工赠品，库存 5" }));
  fireEvent.change(within(dialog).getByLabelText("备注"), { target: { value: "好友赠送" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "确认添加" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "选择人工赠送商品" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认已收款并保存订单" }));

  await waitFor(() => expect(repositories.savePaidOrder).toHaveBeenCalledTimes(1));
  const saved = repositories.savePaidOrder.mock.calls[0][0];
  expect(saved.order).toEqual(
    expect.objectContaining({
      payableAmount: 20,
      paymentMethod: "wechat",
      orderNature: "mixed",
      salesAmount: 20,
      nonSalesQuantity: 1,
      nonSalesCost: 2,
      nonOperatingOutboundCost: 2
    })
  );
  expect(saved.orderItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        productId: "manual-gift",
        revenueType: "non_sales",
        nonSalesReason: "manual_gift",
        nonSalesNote: "好友赠送",
        finalUnitPrice: 0,
        lineTotal: 0,
        statisticalSubtotal: 0,
        discountGiveawayAmount: 0,
        costTotal: 2,
        grossProfit: -2
      })
    ])
  );
  expect(saved.inventoryLogs).toEqual(
    expect.arrayContaining([expect.objectContaining({ productId: "manual-gift", reason: "non_sales_outbound" })])
  );
  expect(screen.queryByText("非销售出库订单保存将在下一步启用，请先完成当前开发版本更新。")).not.toBeInTheDocument();
});

test("非销售商品选择弹窗显示必填备注、快速选项和固定错误区域", async () => {
  const manualGift = product({
    id: "manual-gift",
    name: "人工赠品",
    spu: "赠品SPU",
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, manualGift]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "打开购物车，当前 0 件，应收 ¥0.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 人工赠送" }));

  const dialog = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  expect(within(dialog).getByText("备注（必填）")).toBeVisible();
  expect(within(dialog).getByLabelText("非销售出库错误提示")).toHaveClass("dialogErrorSlot");

  fireEvent.click(within(dialog).getByRole("button", { name: "好友赠送" }));
  expect(within(dialog).getByLabelText("备注")).toHaveValue("好友赠送");
});

test("含运营赠礼时确认保存会保存运营赠礼字段", async () => {
  const campaignGift = product({
    id: "campaign-gift",
    name: "运营赠品",
    spu: "赠品SPU",
    salePrice: 6,
    costPrice: 1.5,
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, campaignGift]);
  repositories.getSettings.mockResolvedValue({
    ...settings,
    campaignGift: {
      enabled: true,
      activityName: "关注小红书赠礼",
      defaultProductId: "campaign-gift",
      requireSaleLine: true
    }
  });

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 普通商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥20.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 运营赠礼" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认已收款并保存订单" }));

  await waitFor(() => expect(repositories.savePaidOrder).toHaveBeenCalledTimes(1));
  const saved = repositories.savePaidOrder.mock.calls[0][0];
  expect(saved.order).toEqual(
    expect.objectContaining({
      orderNature: "mixed",
      salesAmount: 20,
      nonSalesQuantity: 1,
      nonSalesCost: 1.5,
      operatingActivityCost: 1.5
    })
  );
  expect(saved.orderItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        productId: "campaign-gift",
        revenueType: "non_sales",
        nonSalesReason: "campaign_gift",
        campaignNameSnapshot: "关注小红书赠礼",
        statisticalSubtotal: 0,
        costTotal: 1.5,
        grossProfit: -1.5
      })
    ])
  );
  expect(saved.inventoryLogs).toEqual(
    expect.arrayContaining([expect.objectContaining({ productId: "campaign-gift", reason: "non_sales_outbound" })])
  );
  expect(screen.queryByText("非销售出库订单保存将在下一步启用，请先完成当前开发版本更新。")).not.toBeInTheDocument();
});

test("纯人工赠送 0 元订单确认保存不要求支付方式", async () => {
  const manualGift = product({
    id: "manual-gift",
    name: "人工赠品",
    spu: "赠品SPU",
    salePrice: 9,
    costPrice: 2,
    stockQty: 5,
    isSellable: false,
    isGiftEligible: true
  });
  repositories.listProducts.mockResolvedValue([sellableProduct, manualGift]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "打开购物车，当前 0 件，应收 ¥0.00" }));
  fireEvent.click(await screen.findByRole("button", { name: "+ 人工赠送" }));
  const dialog = await screen.findByRole("dialog", { name: "选择人工赠送商品" });
  fireEvent.click(within(dialog).getByRole("button", { name: "选择 人工赠品，库存 5" }));
  fireEvent.change(within(dialog).getByLabelText("备注"), { target: { value: "好友赠送" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "确认添加" }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "选择人工赠送商品" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认保存非销售出库" }));

  await waitFor(() => expect(repositories.savePaidOrder).toHaveBeenCalledTimes(1));
  const saved = repositories.savePaidOrder.mock.calls[0][0];
  expect(saved.order).toEqual(
    expect.objectContaining({
      payableAmount: 0,
      paymentMethod: undefined,
      orderNature: "non_sales",
      salesAmount: 0,
      nonSalesQuantity: 1,
      nonSalesCost: 2,
      nonOperatingOutboundCost: 2
    })
  );
  expect(saved.inventoryLogs).toEqual(
    expect.arrayContaining([expect.objectContaining({ productId: "manual-gift", reason: "non_sales_outbound" })])
  );
});

test("0 元可售商品订单仍按销售订单保存支付方式", async () => {
  const zeroSaleProduct = product({
    id: "zero-sale",
    name: "0元可售商品",
    spu: "普通SPU",
    salePrice: 0,
    costPrice: 0,
    stockQty: 5,
    isSellable: true,
    isGiftEligible: false
  });
  repositories.listProducts.mockResolvedValue([zeroSaleProduct]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: "加入 0元可售商品" }));
  fireEvent.click(screen.getByRole("button", { name: "打开购物车，当前 1 件，应收 ¥0.00" }));
  fireEvent.click(screen.getByRole("button", { name: "去收款" }));

  expect(await screen.findByRole("group", { name: "收款方式" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "确认已收款并保存订单" }));

  await waitFor(() => expect(repositories.savePaidOrder).toHaveBeenCalledTimes(1));
  const saved = repositories.savePaidOrder.mock.calls[0][0];
  expect(saved.order).toEqual(
    expect.objectContaining({
      payableAmount: 0,
      paymentMethod: "wechat",
      orderNature: "sale",
      salesAmount: 0,
      nonSalesQuantity: 0,
      nonSalesCost: 0
    })
  );
  expect(saved.orderItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        productId: "zero-sale",
        revenueType: "sale",
        finalUnitPrice: 0,
        lineTotal: 0
      })
    ])
  );
  expect(saved.inventoryLogs).toEqual(
    expect.arrayContaining([expect.objectContaining({ productId: "zero-sale", reason: "order_paid" })])
  );
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
  const itemList = within(dialog).getByRole("list", { name: "订单商品明细" });
  const inventoryList = within(dialog).getByRole("list", { name: "完整库存流水" });
  expect(repositories.listOrderItems).toHaveBeenCalledWith("order-detail");
  expect(repositories.listInventoryLogsForOrder).toHaveBeenCalledWith("order-detail");
  expect(repositories.listOrderRefunds).toHaveBeenCalledWith("order-detail");
  expect(within(itemList).getByText("历史普通商品")).toBeVisible();
  expect(within(itemList).getByText("HIS-BASE")).toBeVisible();
  expect(within(itemList).getByText("加购优惠")).toBeVisible();
  expect(within(inventoryList).getByText("历史普通商品")).toBeVisible();
  expect(within(inventoryList).getByText("HIS-BASE / 历史SPU")).toBeVisible();
  expect(within(inventoryList).getByText("库存 10 -> 8")).toBeVisible();
  expect(within(dialog).queryByRole("button", { name: "退款" })).not.toBeInTheDocument();
});

test("requires field lock PIN before opening order detail when field mode is locked", async () => {
  repositories.getSettings.mockResolvedValue({
    ...settings,
    fieldLock: await setFieldLockPin(settings.fieldLock, "2580", "2580")
  });
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
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));

  expect(await screen.findByRole("dialog", { name: "管理页面已锁定" })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "订单详情 ECRM-DETAIL" })).not.toBeInTheDocument();
  expect(repositories.listOrderItems).not.toHaveBeenCalledWith("order-detail");
  expect(repositories.listInventoryLogsForOrder).not.toHaveBeenCalledWith("order-detail");
  expect(repositories.listOrderRefunds).not.toHaveBeenCalledWith("order-detail");

  fireEvent.change(screen.getByLabelText("4 位数字密码"), { target: { value: "2580" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁" }));

  expect(await screen.findByRole("dialog", { name: "订单详情 ECRM-DETAIL" })).toBeVisible();
  expect(repositories.listOrderItems).toHaveBeenCalledWith("order-detail");
  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalled());
  const savedSettings = repositories.saveSettings.mock.calls.at(-1)?.[0] as AppSettings;
  expect(savedSettings.fieldLock.unlockExpiresAt).toBeDefined();
});

test("opens order detail dialog with refund records", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "order-detail",
      orderNo: "ECRM-DETAIL",
      payableAmount: 20,
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([inventoryLog({ orderId: "order-detail" })]);
  repositories.listOrderRefunds.mockResolvedValue([
    {
      id: "refund-1",
      orderId: "order-detail",
      amount: 8,
      method: "wechat",
      reason: "customer_return",
      note: "客户退回。",
      createdAt: localIsoDateTime(0, 10, 0)
    }
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));

  expect(await screen.findByText("累计退款")).toBeVisible();
  expect(screen.getAllByText("¥8.00").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText("¥12.00")).toBeVisible();
  expect(repositories.listOrderRefunds).toHaveBeenCalledWith("order-detail");
});

test("records a manual refund from the order detail dialog", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "order-detail",
      orderNo: "ECRM-DETAIL",
      payableAmount: 20,
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([inventoryLog({ orderId: "order-detail" })]);
  repositories.listOrderRefunds
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: "refund-1",
        orderId: "order-detail",
        amount: 10,
        method: "cash",
        reason: "customer_return",
        createdAt: localIsoDateTime(0, 10, 0)
      }
    ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "记录退款" }));

  const refundDialog = await screen.findByRole("dialog", { name: "记录人工退款" });
  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "10" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款方式"), { target: { value: "cash" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));

  await waitFor(() =>
    expect(repositories.saveOrderRefund).toHaveBeenCalledWith({
      orderId: "order-detail",
      amount: 10,
      method: "cash",
      reason: "customer_return",
      note: undefined
    })
  );
  expect(await screen.findByText("订单 ECRM-DETAIL 已记录退款 ¥10.00。")).toBeVisible();
  expect(await screen.findByText("累计退款")).toBeVisible();
  expect(repositories.listOrderRefunds).toHaveBeenLastCalledWith("order-detail");
  expect(repositories.listOrders.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test("shows sanitized error when refund save fails", async () => {
  repositories.saveOrderRefund.mockRejectedValue(new Error("raw refund failure"));
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

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "记录退款" }));
  const refundDialog = await screen.findByRole("dialog", { name: "记录人工退款" });
  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "1" } });
  fireEvent.change(within(refundDialog).getByLabelText("退款备注"), { target: { value: "保留输入" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));

  const saveErrorMessages = await screen.findAllByText("退款记录保存失败，请刷新后重试。");
  expect(saveErrorMessages.length).toBeGreaterThan(0);
  expect(screen.queryByText("raw refund failure")).not.toBeInTheDocument();
  const stillOpenRefundDialog = screen.getByRole("dialog", { name: "记录人工退款" });
  expect(stillOpenRefundDialog).toBeVisible();
  expect(screen.getByLabelText("退款金额")).toHaveValue(1);
  expect(screen.getByLabelText("退款备注")).toHaveValue("保留输入");
  expect(within(stillOpenRefundDialog).getByRole("button", { name: "保存退款记录" })).toBeEnabled();
});

test("keeps refund save success when refund detail refresh fails", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "order-detail",
      orderNo: "ECRM-DETAIL",
      payableAmount: 20,
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([inventoryLog({ orderId: "order-detail" })]);
  repositories.listOrderRefunds
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("raw refund refresh failure"));

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "记录退款" }));

  const refundDialog = await screen.findByRole("dialog", { name: "记录人工退款" });
  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "10" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));

  await waitFor(() => expect(repositories.saveOrderRefund).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("订单 ECRM-DETAIL 已记录退款，但退款记录刷新失败，请刷新页面查看最新退款记录。")).toBeVisible();
  expect(screen.queryByText("退款记录保存失败，请刷新后重试。")).not.toBeInTheDocument();
  expect(screen.queryByText("raw refund refresh failure")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "记录人工退款" })).not.toBeInTheDocument();
});

test("keeps refund save success when main sales refresh fails after refund", async () => {
  repositories.listProducts
    .mockResolvedValueOnce([sellableProduct])
    .mockRejectedValueOnce(new Error("raw main refresh failure"));
  repositories.listOrders.mockResolvedValue([
    order({
      id: "order-detail",
      orderNo: "ECRM-DETAIL",
      payableAmount: 20,
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValue([orderItem({ orderId: "order-detail" })]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([inventoryLog({ orderId: "order-detail" })]);
  repositories.listOrderRefunds
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: "refund-1",
        orderId: "order-detail",
        amount: 10,
        method: "cash",
        reason: "customer_return",
        createdAt: localIsoDateTime(0, 10, 0)
      }
    ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  fireEvent.click(await screen.findByRole("button", { name: "记录退款" }));

  const refundDialog = await screen.findByRole("dialog", { name: "记录人工退款" });
  fireEvent.change(within(refundDialog).getByLabelText("退款金额"), { target: { value: "10" } });
  fireEvent.click(within(refundDialog).getByRole("button", { name: "保存退款记录" }));

  await waitFor(() => expect(repositories.saveOrderRefund).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("订单 ECRM-DETAIL 已记录退款，但售卖数据刷新失败，请刷新页面查看最新订单列表。")).toBeVisible();
  expect(screen.queryByText("售卖数据加载失败，请刷新后重试。")).not.toBeInTheDocument();
  expect(screen.queryByText("退款记录保存失败，请刷新后重试。")).not.toBeInTheDocument();
  expect(screen.queryByText("raw main refresh failure")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "记录人工退款" })).not.toBeInTheDocument();
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
    cancelledAt: localIsoDateTime(0, 10, 0),
    cancelReason: "customer_cancelled" as const,
    cancelNote: "客户取消。"
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
  const confirmDialog = await screen.findByRole("dialog", { name: "确认作废订单" });
  fireEvent.change(within(confirmDialog).getByLabelText("作废原因"), {
    target: { value: "customer_cancelled" }
  });
  fireEvent.change(within(confirmDialog).getByLabelText("作废备注"), {
    target: { value: "客户取消。" }
  });
  fireEvent.click(within(confirmDialog).getByRole("button", { name: "确认作废" }));

  await waitFor(() =>
    expect(repositories.voidPaidOrder).toHaveBeenCalledWith("order-detail", {
      cancelReason: "customer_cancelled",
      cancelNote: "客户取消。"
    })
  );
  expect(await screen.findByText("订单 ECRM-DETAIL 已作废，库存已回滚。")).toBeVisible();

  const dialog = await screen.findByRole("dialog", { name: "订单详情 ECRM-DETAIL" });
  expect(within(dialog).getByText("已取消")).toBeVisible();
  expect(within(dialog).getByText("客户取消")).toBeVisible();
  expect(within(dialog).getByText("客户取消。")).toBeVisible();
  expect(within(dialog).getAllByText("作废回滚").length).toBeGreaterThan(0);
  expect(within(dialog).queryByRole("button", { name: "作废订单" })).not.toBeInTheDocument();
  expect(repositories.listProducts.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(repositories.listOrders.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test("adjusts order item accounting from the detail dialog and refreshes selected order items and logs", async () => {
  const paidOrder = order({
    id: "order-detail",
    orderNo: "ECRM-DETAIL",
    createdAt: localIsoDateTime(0, 9, 20),
    paidAt: localIsoDateTime(0, 9, 25)
  });
  const originalItem = orderItem({ id: "item-detail", orderId: "order-detail" });
  const adjustedItem = {
    ...originalItem,
    revenueType: "non_sales" as const,
    nonSalesReason: "manual_gift" as const,
    nonSalesNote: "老客赠送",
    statisticalSubtotal: 0,
    discountGiveawayAmount: 0,
    adjustedAt: localIsoDateTime(0, 10, 0)
  };
  const originalLog = inventoryLog({ orderId: "order-detail" });

  repositories.listOrders.mockResolvedValue([paidOrder]);
  repositories.listOrderItems
    .mockResolvedValueOnce([originalItem])
    .mockResolvedValueOnce([adjustedItem]);
  repositories.listInventoryLogsForOrder
    .mockResolvedValueOnce([originalLog])
    .mockResolvedValueOnce([originalLog]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  const itemList = await screen.findByRole("list", { name: "订单商品明细" });
  fireEvent.click(within(within(itemList).getAllByRole("listitem")[0]).getByRole("button", { name: "修正统计口径" }));

  const adjustDialog = await screen.findByRole("dialog", { name: "修正单行统计口径" });
  fireEvent.change(within(adjustDialog).getByLabelText("修正为"), { target: { value: "manual_gift" } });
  fireEvent.change(within(adjustDialog).getByLabelText("非销售备注"), { target: { value: "老客赠送" } });
  fireEvent.click(within(adjustDialog).getByRole("button", { name: "确认修正" }));

  await waitFor(() =>
    expect(repositories.adjustOrderItemAccounting).toHaveBeenCalledWith({
      orderId: "order-detail",
      itemId: "item-detail",
      revenueType: "non_sales",
      nonSalesReason: "manual_gift",
      nonSalesNote: "老客赠送",
      campaignNameSnapshot: undefined,
      adjustmentNote: undefined
    })
  );
  expect(repositories.listOrderItems).toHaveBeenLastCalledWith("order-detail");
  expect(repositories.listInventoryLogsForOrder).toHaveBeenLastCalledWith("order-detail");
  expect(await screen.findByText("订单统计口径已修正，原始支付、退款和库存流水未改动。")).toBeVisible();
  expect((await screen.findAllByText("非销售出库")).length).toBeGreaterThan(0);
  expect(await screen.findByText("老客赠送")).toBeVisible();
});

test("keeps accounting adjustment success when detail refresh fails after the write", async () => {
  const paidOrder = order({
    id: "order-detail",
    orderNo: "ECRM-DETAIL",
    createdAt: localIsoDateTime(0, 9, 20),
    paidAt: localIsoDateTime(0, 9, 25)
  });
  const originalItem = orderItem({ id: "item-detail", orderId: "order-detail" });
  const adjustedItem = {
    ...originalItem,
    revenueType: "non_sales" as const,
    nonSalesReason: "manual_gift" as const,
    nonSalesNote: "老客赠送",
    statisticalSubtotal: 0,
    discountGiveawayAmount: 0,
    adjustedAt: localIsoDateTime(0, 10, 0)
  };

  repositories.adjustOrderItemAccounting.mockResolvedValue(adjustedItem);
  repositories.listOrders.mockResolvedValue([paidOrder]);
  repositories.listOrderItems
    .mockResolvedValueOnce([originalItem])
    .mockRejectedValueOnce(new Error("raw detail refresh failure"));
  repositories.listInventoryLogsForOrder.mockResolvedValue([inventoryLog({ orderId: "order-detail" })]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  const itemList = await screen.findByRole("list", { name: "订单商品明细" });
  fireEvent.click(within(within(itemList).getAllByRole("listitem")[0]).getByRole("button", { name: "修正统计口径" }));

  const adjustDialog = await screen.findByRole("dialog", { name: "修正单行统计口径" });
  fireEvent.change(within(adjustDialog).getByLabelText("修正为"), { target: { value: "manual_gift" } });
  fireEvent.change(within(adjustDialog).getByLabelText("非销售备注"), { target: { value: "老客赠送" } });
  fireEvent.click(within(adjustDialog).getByRole("button", { name: "确认修正" }));

  await waitFor(() => expect(repositories.adjustOrderItemAccounting).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("订单统计口径已修正，但详情刷新失败，请刷新页面查看最新数据。")).toBeVisible();
  expect(screen.queryByText("订单统计口径修正失败，请刷新后重试。")).not.toBeInTheDocument();
  expect(screen.queryByText("raw detail refresh failure")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "修正单行统计口径" })).not.toBeInTheDocument();
  expect((await screen.findAllByText("非销售出库")).length).toBeGreaterThan(0);
  expect(await screen.findByText("老客赠送")).toBeVisible();
});

test("treats missing products as not eligible for campaign gift accounting adjustment", async () => {
  repositories.listProducts.mockResolvedValue([sellableProduct]);
  repositories.listOrders.mockResolvedValue([
    order({
      id: "order-detail",
      orderNo: "ECRM-DETAIL",
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listOrderItems.mockResolvedValue([
    orderItem({
      id: "missing-gift-item",
      orderId: "order-detail",
      productId: "missing-gift",
      productNameSnapshot: "旧赠品"
    })
  ]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([inventoryLog({ orderId: "order-detail", productId: "missing-gift" })]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.click(await screen.findByRole("button", { name: "查看订单 ECRM-DETAIL" }));
  const itemList = await screen.findByRole("list", { name: "订单商品明细" });
  fireEvent.click(within(within(itemList).getAllByRole("listitem")[0]).getByRole("button", { name: "修正统计口径" }));

  const adjustDialog = await screen.findByRole("dialog", { name: "修正单行统计口径" });
  fireEvent.change(within(adjustDialog).getByLabelText("修正为"), { target: { value: "campaign_gift" } });
  fireEvent.click(within(adjustDialog).getByRole("button", { name: "确认修正" }));

  expect(await within(adjustDialog).findByText("该商品不是赠品商品，不能修正为运营赠礼。")).toBeVisible();
  expect(repositories.adjustOrderItemAccounting).not.toHaveBeenCalled();
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

  await waitFor(() =>
    expect(repositories.voidPaidOrder).toHaveBeenCalledWith("order-detail", {
      cancelReason: "mistake",
      cancelNote: undefined
    })
  );
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
  expect(within(paidOrderButton).getByText("支付宝")).toHaveClass("orderHistoryChip", "isPayment");
  expect(within(paidOrderButton).getByText("已支付")).toHaveClass("orderHistoryChip", "isStatus");
  expect(within(paidOrderButton).getByText("¥42.50")).toBeVisible();
  expect(within(history).queryByText("ECRM-PENDING")).not.toBeInTheDocument();
});

test("shows accounting nature badges in order history", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "normal-order",
      orderNo: "ECRM-NORMAL",
      orderNature: "sale",
      paymentMethod: "alipay",
      paidAt: localIsoDateTime(0, 9, 25)
    }),
    order({
      id: "mixed-order",
      orderNo: "ECRM-MIXED",
      orderNature: "mixed",
      paymentMethod: "cash",
      paidAt: localIsoDateTime(0, 10, 25)
    }),
    order({
      id: "non-sales-order",
      orderNo: "ECRM-NON-SALES",
      orderNature: "non_sales",
      paymentMethod: undefined,
      payableAmount: 0,
      paidAt: localIsoDateTime(0, 11, 25)
    })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  const normalOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-NORMAL" });
  const mixedOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-MIXED" });
  const nonSalesOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-NON-SALES" });

  expect(within(normalOrderButton).getByText("正常销售")).toHaveClass("orderHistoryChip", "isAccounting");
  expect(within(mixedOrderButton).getByText("销售 + 赠送")).toHaveClass("orderHistoryChip", "isAccounting");
  expect(within(nonSalesOrderButton).getByText("非销售出库")).toHaveClass("orderHistoryChip", "isAccounting");
  expect(within(normalOrderButton).getByText("¥20.00")).toHaveAttribute("translate", "no");
});

test("shows after-sales badges for cancelled orders in order history", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "paid-order",
      orderNo: "ECRM-PAID",
      status: "paid",
      paidAt: localIsoDateTime(0, 9, 25)
    }),
    order({
      id: "cancelled-order",
      orderNo: "ECRM-CANCELLED",
      status: "cancelled",
      paymentMethod: "cash",
      createdAt: localIsoDateTime(0, 9, 20),
      paidAt: localIsoDateTime(0, 9, 25),
      cancelledAt: localIsoDateTime(0, 10, 0),
      cancelReason: "customer_cancelled",
      cancelNote: "客户取消。"
    })
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));
  fireEvent.change(await screen.findByLabelText("订单状态"), { target: { value: "all" } });

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  const paidOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-PAID" });
  const cancelledOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-CANCELLED" });

  expect(within(cancelledOrderButton).getByText("已作废")).toHaveClass("orderHistoryChip", "isAfterSales", "isDanger");
  expect(within(cancelledOrderButton).getByText("客户取消")).toHaveClass("orderHistoryChip", "isAfterSales");
  expect(within(cancelledOrderButton).getByText("有备注")).toHaveClass("orderHistoryChip", "isAfterSales");
  expect(within(paidOrderButton).queryByText("已作废")).not.toBeInTheDocument();
});

test("shows refund badges in order history", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "partial-order",
      orderNo: "ECRM-PARTIAL",
      payableAmount: 20,
      paidAt: localIsoDateTime(0, 9, 25)
    }),
    order({
      id: "refunded-order",
      orderNo: "ECRM-REFUNDED",
      payableAmount: 20,
      paidAt: localIsoDateTime(0, 10, 25)
    })
  ]);
  repositories.listRefunds.mockResolvedValue([
    {
      id: "refund-partial",
      orderId: "partial-order",
      amount: 5,
      method: "cash",
      reason: "customer_return",
      createdAt: localIsoDateTime(0, 11, 0)
    },
    {
      id: "refund-full",
      orderId: "refunded-order",
      amount: 20,
      method: "wechat",
      reason: "customer_return",
      createdAt: localIsoDateTime(0, 11, 10)
    }
  ]);

  render(<SalesPage />);

  fireEvent.click(await screen.findByRole("button", { name: /订单记录/ }));

  const history = await screen.findByRole("region", { name: "订单记录列表" });
  const partialOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-PARTIAL" });
  const refundedOrderButton = within(history).getByRole("button", { name: "查看订单 ECRM-REFUNDED" });

  expect(within(partialOrderButton).getByText("部分退款")).toHaveClass("orderHistoryChip", "isAfterSales");
  expect(within(refundedOrderButton).getByText("已退款")).toHaveClass("orderHistoryChip", "isAfterSales");
});

test("keeps core sales data visible when refund badge loading fails", async () => {
  repositories.listOrders.mockResolvedValue([
    order({
      id: "paid-order",
      orderNo: "ECRM-PAID",
      paidAt: localIsoDateTime(0, 9, 25)
    })
  ]);
  repositories.listRefunds.mockRejectedValue(new Error("raw refund badge failure"));

  render(<SalesPage />);

  expect(await screen.findByRole("button", { name: "加入 普通商品" })).toBeVisible();
  expect(await screen.findByText("退款记录加载失败，订单售后标识可能不完整。")).toBeVisible();
  expect(screen.queryByText("售卖数据加载失败，请刷新后重试。")).not.toBeInTheDocument();
  expect(screen.queryByText("raw refund badge failure")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /订单记录/ }));

  expect(await screen.findByText("ECRM-PAID")).toBeVisible();
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
