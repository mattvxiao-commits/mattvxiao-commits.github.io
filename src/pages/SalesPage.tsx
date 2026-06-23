import {
  ChevronDown,
  ChevronUp,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBasket
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import CartPanel from "../components/CartPanel";
import CheckoutPanel from "../components/CheckoutPanel";
import FieldLockDialog from "../components/FieldLockDialog";
import FieldLockStatus from "../components/FieldLockStatus";
import OrderDetailDialog from "../components/OrderDetailDialog";
import {
  adjustOrderAccounting,
  adjustOrderItemAccounting,
  getSettings,
  listInventoryLogsForOrder,
  listOrderItems,
  listOrderRefunds,
  listOrders,
  listProducts,
  listRefunds,
  savePaidOrder,
  saveSettings,
  saveOrderRefund,
  voidPaidOrder
} from "../db/repositories";
import { sortCartLinesForReview } from "../domain/cartLinePresentation";
import { resolveGiftLines, type GiftSelections } from "../domain/giftSelection";
import { requiresFieldLockUnlock, verifyFieldLockPin } from "../domain/fieldLock";
import { formatMoney } from "../domain/money";
import { buildPaidOrder } from "../domain/order";
import {
  dateRangeLabels,
  filterAndSortOrders,
  getOrderHistoryAccountingBadges,
  getOrderAfterSalesBadges,
  orderBusinessTime,
  orderStatusLabels,
  paymentMethodLabels,
  type OrderDateRange,
  type OrderHistoryPaymentFilter,
  type OrderHistoryStatusFilter
} from "../domain/orderHistory";
import { calculateCart } from "../domain/promotions";
import { createDefaultCampaignGiftConfig, normalizeCampaignGiftConfig } from "../domain/settings";
import type {
  AppSettings,
  CartItem,
  InventoryLog,
  NonSalesReason,
  Order,
  OrderCancelReason,
  OrderItem,
  OrderLineRevenueType,
  OrderRefund,
  PaymentMethod,
  Product,
  RefundReason
} from "../domain/types";
import { useCartStore } from "../state/cartStore";
import { getImageUrl } from "../utils/image";
import { notifySettingsUpdated } from "../utils/settingsEvents";

type SalesMode = "cart" | "checkout";
type NonSalesPickerMode = Exclude<NonSalesReason, "tier_gift">;
type VoidOrderInput = {
  cancelReason: OrderCancelReason;
  cancelNote?: string;
};
type SaveRefundInput = {
  amount: number;
  method: PaymentMethod;
  reason: RefundReason;
  note?: string;
};
type AdjustOrderAccountingInput = {
  orderId: string;
  revenueType: OrderLineRevenueType;
  nonSalesReason?: NonSalesReason;
  nonSalesNote?: string;
  campaignNameSnapshot?: string;
  adjustmentNote?: string;
};
type AdjustOrderItemAccountingInput = AdjustOrderAccountingInput & {
  itemId: string;
};
type StatusMessage = {
  kind: "success" | "error";
  text: string;
};

const lineTypeLabels = {
  normal: "正常",
  discount_addon: "加购优惠",
  gift: "赠品"
} as const;

const nonSalesReasonLabels: Record<NonSalesPickerMode, string> = {
  campaign_gift: "运营赠礼",
  manual_gift: "人工赠送",
  other_non_sales: "其他出库"
};

const manualGiftNoteOptions = ["好友赠送", "摊主赠送", "合作赠送", "老客赠送"];
const otherNonSalesNoteOptions = ["样品出库", "问题补偿", "陈列损耗", "盘点修正"];

function QuickOptionGroup({
  label,
  options,
  onPick
}: {
  label: string;
  options: string[];
  onPick: (value: string) => void;
}) {
  return (
    <div className="quickOptionGroup" aria-label={label}>
      {options.map((option) => (
        <button type="button" className="quickOptionButton" key={option} onClick={() => onPick(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function formatPaidTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getProductRemainingStock(product: Product, quantityByProduct: Map<string, number>): number {
  return product.stockQty - (quantityByProduct.get(product.id) ?? 0);
}

function isNonSalesProductSelectable(product: Product, quantityByProduct: Map<string, number>): boolean {
  return product.status === "active" && getProductRemainingStock(product, quantityByProduct) > 0;
}

function hasSaleCalculatedLine(calculated: ReturnType<typeof calculateCart>): boolean {
  return calculated.lines.some((line) => (line.revenueType ?? (line.lineType === "gift" ? "non_sales" : "sale")) === "sale");
}

function SalesProductImage({ product }: { product: Product }) {
  const [imageUrl, setImageUrl] = useState<string>();

  useEffect(() => {
    let isCurrent = true;

    getImageUrl(product.imageId)
      .then((url) => {
        if (isCurrent) {
          setImageUrl(url);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setImageUrl(undefined);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [product.imageId]);

  return (
    <div className="salesProductImage">
      {imageUrl ? <img src={imageUrl} alt={product.name} /> : <span aria-hidden="true">{product.name.slice(0, 1) || "商"}</span>}
    </div>
  );
}

function NonSalesProductPicker({
  mode,
  products,
  cartQuantityByProduct,
  selectedProductId,
  note,
  showAllActive,
  error,
  setSelectedProductId,
  setNote,
  setShowAllActive,
  onConfirm,
  onCancel
}: {
  mode: NonSalesPickerMode;
  products: Product[];
  cartQuantityByProduct: Map<string, number>;
  selectedProductId: string;
  note: string;
  showAllActive: boolean;
  error?: string;
  setSelectedProductId: (productId: string) => void;
  setNote: (note: string) => void;
  setShowAllActive: (showAllActive: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const requiresNote = mode === "manual_gift" || mode === "other_non_sales";
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const noteOptions = mode === "manual_gift" ? manualGiftNoteOptions : otherNonSalesNoteOptions;

  return (
    <div className="modalBackdrop">
      <section
        className="fieldLockDialog nonSalesPickerDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="non-sales-picker-title"
      >
        <div className="dialogHeader">
          <div>
            <p className="eyebrow">Outbound</p>
            <h2 id="non-sales-picker-title">选择{nonSalesReasonLabels[mode]}商品</h2>
          </div>
        </div>

        {mode !== "campaign_gift" ? (
          <label className="checkControl">
            <input
              type="checkbox"
              checked={showAllActive}
              onChange={(event) => setShowAllActive(event.target.checked)}
            />
            <span>显示全部在售商品</span>
          </label>
        ) : null}

        <div className="nonSalesProductList" role="list" aria-label={`${nonSalesReasonLabels[mode]}商品列表`}>
          {products.length > 0 ? (
            products.map((product) => {
              const remainingStock = getProductRemainingStock(product, cartQuantityByProduct);
              const hasReachedStock = remainingStock <= 0;

              return (
                <button
                  type="button"
                  className={selectedProductId === product.id ? "nonSalesProductOption isSelected" : "nonSalesProductOption"}
                  aria-label={`选择 ${product.name}，库存 ${product.stockQty}${hasReachedStock ? "，已达库存" : ""}`}
                  disabled={hasReachedStock}
                  key={product.id}
                  onClick={() => setSelectedProductId(product.id)}
                >
                  <span>
                    <strong>{product.name}</strong>
                    <em>{product.spu}</em>
                  </span>
                  <span>
                    库存 {product.stockQty}
                    {hasReachedStock ? " / 已达库存" : ""}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="emptyState">当前没有可选择的商品。</p>
          )}
        </div>

        {selectedProduct && !selectedProduct.isGiftEligible && mode !== "campaign_gift" ? (
          <p className="cartWarning" role="status">
            当前商品不是赠品商品，将按 0 元非销售出库并扣减库存。
          </p>
        ) : null}

        {requiresNote ? (
          <div className="dialogField">
            <label>
              <span>备注（必填）</span>
              <textarea
                aria-label="备注"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="例如：好友赠送 / 问题补偿 / 样品出库"
              />
            </label>
            <QuickOptionGroup label={`${nonSalesReasonLabels[mode]}备注快速选项`} options={noteOptions} onPick={setNote} />
          </div>
        ) : null}

        <p className="dialogErrorSlot" role={error ? "alert" : undefined} aria-label="非销售出库错误提示">
          {error}
        </p>

        <div className="dialogActions">
          <button type="button" className="secondaryButton" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="primaryButton" onClick={onConfirm}>
            确认添加
          </button>
        </div>
      </section>
    </div>
  );
}

function CheckoutOrderReview({
  calculated,
  products,
  cartItems
}: {
  calculated: ReturnType<typeof calculateCart>;
  products: Product[];
  cartItems: CartItem[];
}) {
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const imageProductIds = useMemo(
    () => Array.from(new Set(calculated.lines.map((line) => line.productId))).filter((productId) => productById.get(productId)?.imageId),
    [calculated.lines, productById]
  );
  const [imageUrlsByProductId, setImageUrlsByProductId] = useState<Record<string, string | undefined>>({});

  useEffect(() => {
    let isCurrent = true;

    async function loadLineImages() {
      const entries = await Promise.all(
        imageProductIds.map(async (productId) => {
          const imageId = productById.get(productId)?.imageId;
          const imageUrl = await getImageUrl(imageId);
          return [productId, imageUrl] as const;
        })
      );

      if (isCurrent) {
        setImageUrlsByProductId(Object.fromEntries(entries));
      }
    }

    void loadLineImages().catch(() => {
      if (isCurrent) {
        setImageUrlsByProductId({});
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [imageProductIds, productById]);

  const itemCount = calculated.lines.reduce((sum, line) => sum + line.quantity, 0);
  const displayLines = useMemo(() => sortCartLinesForReview(calculated.lines, cartItems), [calculated.lines, cartItems]);

  return (
    <section className="checkoutOrderReview" aria-labelledby="checkout-order-review-title">
      <div className="panelHeading cartPanelHeader">
        <div>
          <h2 id="checkout-order-review-title">本单商品</h2>
        </div>
        <span className="cartCount">{itemCount} 件</span>
      </div>

      <div className="checkoutScrollArea" aria-label="本单商品与促销">
        {displayLines.length > 0 ? (
          <div className="cartLineList checkoutReviewLines" aria-label="本单商品明细">
            {displayLines.map((line, index) => (
              <div
                className={`cartLine cartLineDense checkoutReviewLine cartLine-${line.lineType}`}
                key={`${line.productId}-${line.lineType}-${line.finalUnitPrice}-${index}`}
              >
                <span className="cartLineBadge">
                  {line.revenueType === "non_sales" && line.nonSalesReason && line.nonSalesReason !== "tier_gift"
                    ? nonSalesReasonLabels[line.nonSalesReason]
                    : lineTypeLabels[line.lineType]}
                </span>
                <div className="cartLineThumb cartLineThumbLarge">
                  {imageUrlsByProductId[line.productId] ? (
                    <img src={imageUrlsByProductId[line.productId]} alt={line.productName} />
                  ) : (
                    <span aria-hidden="true">{line.productName.slice(0, 1) || "商"}</span>
                  )}
                </div>
                <div className="cartLineBody">
                  <div className="lineMain cartLineInfoStack">
                    <div className="lineTitleRow">
                      <h3>{line.productName}</h3>
                    </div>
                    <p className="lineSpu">{line.spu}</p>
                    <div className="linePriceRow">
                      <div className="linePriceStack">
                        <span className="unitPrice">单价 {formatMoney(line.finalUnitPrice)}</span>
                        {line.originalUnitPrice !== line.finalUnitPrice ? (
                          <span className="strikePrice">{formatMoney(line.originalUnitPrice)}</span>
                        ) : null}
                        <span>数量 x{line.quantity}</span>
                      </div>
                    </div>
                  </div>
                  <div className="cartLineAmountColumn isBottomAligned">
                    <strong className="lineTotal">{formatMoney(line.lineTotal)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="cartEmpty">还没有选择商品。</p>
        )}
      </div>

      <div className="checkoutReviewFooter" aria-label="本单结算">
        <div className="promotionSummary" aria-label="本单促销信息">
          <p>已享加购优惠 {calculated.appliedDiscountQty}/{calculated.maxDiscountQty} 个</p>
          <p>
            {calculated.triggeredGiftTier && calculated.giftEntitlements.length > 0
              ? `已触发满 ${calculated.triggeredGiftTier.threshold}：${calculated.giftEntitlements
                  .map((gift) => `${gift.label} x${gift.quantity}`)
                  .join("、")}`
              : "暂未触发满额赠品"}
          </p>
        </div>

        <div className="cartTotals">
          <div>
            <span>原价小计</span>
            <strong>{formatMoney(calculated.subtotalBeforeDiscount)}</strong>
          </div>
          <div>
            <span>优惠</span>
            <strong>-{formatMoney(calculated.discountAmount)}</strong>
          </div>
          <div className="payableRow">
            <span>应收</span>
            <strong>{formatMoney(calculated.payableAmount)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [settings, setSettings] = useState<AppSettings>();
  const [selectedSpu, setSelectedSpu] = useState("全部");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wechat");
  const [mode, setMode] = useState<SalesMode>("cart");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderDateRange, setOrderDateRange] = useState<OrderDateRange>("today");
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderHistoryStatusFilter>("paid");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<OrderHistoryPaymentFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [selectedOrderInventoryLogs, setSelectedOrderInventoryLogs] = useState<InventoryLog[]>([]);
  const [selectedOrderRefunds, setSelectedOrderRefunds] = useState<OrderRefund[]>([]);
  const [isOrderDetailLoading, setIsOrderDetailLoading] = useState(false);
  const [orderPendingUnlock, setOrderPendingUnlock] = useState<Order>();
  const [isOrderUnlockOpen, setIsOrderUnlockOpen] = useState(false);
  const [isVoidingOrder, setIsVoidingOrder] = useState(false);
  const [isSavingRefund, setIsSavingRefund] = useState(false);
  const [isAdjustingAccounting, setIsAdjustingAccounting] = useState(false);
  const [giftSelections, setGiftSelections] = useState<GiftSelections>({});
  const [nonSalesPickerMode, setNonSalesPickerMode] = useState<NonSalesPickerMode>();
  const [nonSalesProductId, setNonSalesProductId] = useState("");
  const [nonSalesNote, setNonSalesNote] = useState("");
  const [campaignGiftPickerSpu, setCampaignGiftPickerSpu] = useState<string>();
  const [showAllNonSalesProducts, setShowAllNonSalesProducts] = useState(false);
  const [nonSalesPickerError, setNonSalesPickerError] = useState<string>();
  const [qrImageUrls, setQrImageUrls] = useState<{ wechat?: string; alipay?: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>();
  const cartItems = useCartStore((state) => state.items);
  const addProduct = useCartStore((state) => state.addProduct);
  const addNonSalesProduct = useCartStore((state) => state.addNonSalesProduct);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const clearCart = useCartStore((state) => state.clear);

  async function refreshSalesData(options: { failureStatus?: StatusMessage; preserveStatus?: boolean } = {}) {
    setIsLoading(true);
    if (!options.preserveStatus) {
      setStatus(undefined);
    }

    try {
      const [loadedProducts, loadedSettings, loadedOrders] = await Promise.all([
        listProducts(),
        getSettings(),
        listOrders()
      ]);
      setProducts(loadedProducts);
      setSettings(loadedSettings);
      setOrders(loadedOrders);

      try {
        setRefunds(await listRefunds());
      } catch {
        setRefunds([]);
        if (!options.preserveStatus) {
          setStatus({ kind: "error", text: "退款记录加载失败，订单售后标识可能不完整。" });
        }
      }
    } catch {
      setStatus(options.failureStatus ?? { kind: "error", text: "售卖数据加载失败，请刷新后重试。" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveFieldLock(nextSettings: AppSettings) {
    await saveSettings(nextSettings);
    setSettings(nextSettings);
    notifySettingsUpdated(nextSettings);
    setStatus({ kind: "success", text: "现场模式已重新锁定。" });
  }

  useEffect(() => {
    void refreshSalesData();
  }, []);

  useEffect(() => {
    let isCurrent = true;

    async function loadQrImages() {
      if (!settings) {
        setQrImageUrls({});
        return;
      }

      const [wechat, alipay] = await Promise.all([
        getImageUrl(settings.wechatQrImageId),
        getImageUrl(settings.alipayQrImageId)
      ]);

      if (isCurrent) {
        setQrImageUrls({ wechat, alipay });
      }
    }

    void loadQrImages().catch(() => {
      if (isCurrent) {
        setQrImageUrls({});
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [settings]);

  const sellableProducts = useMemo(
    () => products.filter((product) => product.status === "active" && product.isSellable),
    [products]
  );

  const spuList = useMemo(
    () => ["全部", ...Array.from(new Set(sellableProducts.map((product) => product.spu))).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))],
    [sellableProducts]
  );

  useEffect(() => {
    if (!spuList.includes(selectedSpu)) {
      setSelectedSpu("全部");
    }
  }, [selectedSpu, spuList]);

  const visibleProducts = useMemo(
    () => sellableProducts.filter((product) => selectedSpu === "全部" || product.spu === selectedSpu),
    [sellableProducts, selectedSpu]
  );
  const hasSaleCartLine = useMemo(
    () => cartItems.some((item) => item.revenueType !== "non_sales" && item.quantity > 0),
    [cartItems]
  );
  const hasCampaignGiftWithoutSaleLine = useMemo(
    () =>
      cartItems.some(
        (item) => item.revenueType === "non_sales" && item.nonSalesReason === "campaign_gift" && item.quantity > 0
      ) && !hasSaleCartLine,
    [cartItems, hasSaleCartLine]
  );
  const giftEligibleProducts = useMemo(
    () => products.filter((product) => product.status === "active" && product.isGiftEligible),
    [products]
  );
  const campaignGift = settings ? normalizeCampaignGiftConfig(settings.campaignGift) : createDefaultCampaignGiftConfig();
  const nonSalesPickerProducts = useMemo(() => {
    if (!nonSalesPickerMode) {
      return [];
    }

    if (nonSalesPickerMode === "campaign_gift") {
      return campaignGiftPickerSpu
        ? giftEligibleProducts.filter((product) => product.spu === campaignGiftPickerSpu)
        : giftEligibleProducts;
    }

    return (showAllNonSalesProducts ? products.filter((product) => product.status === "active") : giftEligibleProducts);
  }, [campaignGiftPickerSpu, giftEligibleProducts, nonSalesPickerMode, products, showAllNonSalesProducts]);
  const cartQuantityByProduct = useMemo(
    () =>
      cartItems.reduce((quantityByProduct, item) => {
        quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
        return quantityByProduct;
      }, new Map<string, number>()),
    [cartItems]
  );

  const calculated = useMemo(
    () =>
      calculateCart({
        items: cartItems,
        products,
        promotion: settings?.promotion ?? {
          enabled: false,
          addonDiscount: {
            enabled: false,
            discountSpu: "",
            discountPrice: 3,
            maxDiscountQty: 3
          },
          giftTiers: []
        }
      }),
    [cartItems, products, settings]
  );

  useEffect(() => {
    setGiftSelections({});
  }, [cartItems, products, settings?.promotion]);

  useEffect(() => {
    if (!nonSalesPickerMode) {
      return;
    }

    const selectedProduct = nonSalesPickerProducts.find((product) => product.id === nonSalesProductId);
    if (selectedProduct && isNonSalesProductSelectable(selectedProduct, cartQuantityByProduct)) {
      return;
    }

    setNonSalesProductId(
      nonSalesPickerProducts.find((product) => isNonSalesProductSelectable(product, cartQuantityByProduct))?.id ?? ""
    );
  }, [cartQuantityByProduct, nonSalesPickerMode, nonSalesPickerProducts, nonSalesProductId]);

  const filteredOrders = useMemo(
    () =>
      filterAndSortOrders(orders, {
        query: orderQuery,
        dateRange: orderDateRange,
        status: orderStatusFilter,
        paymentMethod: orderPaymentFilter
      }),
    [orders, orderDateRange, orderPaymentFilter, orderQuery, orderStatusFilter]
  );

  async function openOrderDetail(order: Order) {
    setIsOrderDetailLoading(true);
    setStatus(undefined);

    try {
      const [items, inventoryLogs, orderRefunds] = await Promise.all([
        listOrderItems(order.id),
        listInventoryLogsForOrder(order.id),
        listOrderRefunds(order.id)
      ]);
      setSelectedOrder(order);
      setSelectedOrderItems(items);
      setSelectedOrderInventoryLogs(inventoryLogs);
      setSelectedOrderRefunds(orderRefunds);
    } catch {
      setStatus({ kind: "error", text: "订单详情加载失败，请稍后重试。" });
    } finally {
      setIsOrderDetailLoading(false);
    }
  }

  function requestOrderDetail(order: Order) {
    if (settings && requiresFieldLockUnlock(settings.fieldLock)) {
      setOrderPendingUnlock(order);
      setIsOrderUnlockOpen(true);
      return;
    }

    void openOrderDetail(order);
  }

  async function handleVerifyOrderUnlock(pin: string) {
    if (!settings) {
      return { success: false, message: "设置尚未加载完成，请稍后重试。" };
    }

    const result = await verifyFieldLockPin(settings.fieldLock, pin);
    const nextSettings = {
      ...settings,
      fieldLock: result.settings
    };

    setSettings(nextSettings);
    await saveSettings(nextSettings);
    notifySettingsUpdated(nextSettings);
    return { success: result.success, message: result.message };
  }

  function handleOrderUnlockVerified() {
    const nextOrder = orderPendingUnlock;
    setIsOrderUnlockOpen(false);
    setOrderPendingUnlock(undefined);
    if (nextOrder) {
      void openOrderDetail(nextOrder);
    }
  }

  function handleCancelOrderUnlock() {
    setIsOrderUnlockOpen(false);
    setOrderPendingUnlock(undefined);
  }

  function closeOrderDetail() {
    setSelectedOrder(undefined);
    setSelectedOrderItems([]);
    setSelectedOrderInventoryLogs([]);
    setSelectedOrderRefunds([]);
  }

  function openNonSalesPicker(mode: NonSalesPickerMode, options: { campaignGiftSpu?: string } = {}) {
    if (mode === "campaign_gift" && !campaignGift.enabled) {
      setStatus({ kind: "error", text: "请先在设置页启用运营赠礼。" });
      return;
    }

    setNonSalesPickerMode(mode);
    setCampaignGiftPickerSpu(mode === "campaign_gift" ? options.campaignGiftSpu : undefined);
    setNonSalesNote("");
    setShowAllNonSalesProducts(false);
    setNonSalesPickerError(undefined);
    setNonSalesProductId(giftEligibleProducts.find((product) => isNonSalesProductSelectable(product, cartQuantityByProduct))?.id ?? "");
  }

  function addCampaignGift() {
    if (!campaignGift.enabled) {
      setStatus({ kind: "error", text: "请先在设置页启用运营赠礼。" });
      return;
    }

    if (!hasSaleCartLine) {
      setStatus({ kind: "error", text: "运营赠礼需要本单存在正常消费商品。" });
      return;
    }

    if (campaignGift.targetType === "spu") {
      openNonSalesPicker("campaign_gift", { campaignGiftSpu: campaignGift.defaultSpu || undefined });
      return;
    }

    const defaultProduct = products.find(
      (product) =>
        product.id === campaignGift.defaultProductId &&
        product.status === "active" &&
        product.isGiftEligible
    );

    if (defaultProduct) {
      if (getProductRemainingStock(defaultProduct, cartQuantityByProduct) <= 0) {
        setStatus({ kind: "error", text: "该商品库存不足，无法继续添加。" });
        return;
      }

      addNonSalesProduct({
        productId: defaultProduct.id,
        reason: "campaign_gift",
        campaignNameSnapshot: campaignGift.activityName
      });
      setStatus(undefined);
      return;
    }

    openNonSalesPicker("campaign_gift");
  }

  function confirmNonSalesProduct() {
    if (!nonSalesPickerMode) {
      return;
    }

    if (nonSalesPickerMode === "campaign_gift") {
      if (!campaignGift.enabled) {
        setNonSalesPickerError("请先在设置页启用运营赠礼。");
        return;
      }

      if (!hasSaleCartLine) {
        setNonSalesPickerError("运营赠礼需要本单存在正常消费商品。");
        return;
      }
    }

    if (!nonSalesProductId) {
      setNonSalesPickerError("请选择有效商品后再添加。");
      return;
    }

    const selectedProduct = nonSalesPickerProducts.find((product) => product.id === nonSalesProductId);
    if (!selectedProduct || !isNonSalesProductSelectable(selectedProduct, cartQuantityByProduct)) {
      setNonSalesPickerError("请选择有效商品后再添加。");
      return;
    }

    if ((nonSalesPickerMode === "manual_gift" || nonSalesPickerMode === "other_non_sales") && nonSalesNote.trim().length === 0) {
      setNonSalesPickerError("请填写备注后再添加。");
      return;
    }

    addNonSalesProduct({
      productId: nonSalesProductId,
      reason: nonSalesPickerMode,
      note: nonSalesNote,
      campaignNameSnapshot: nonSalesPickerMode === "campaign_gift" ? campaignGift.activityName : undefined
    });
    setNonSalesPickerMode(undefined);
    setCampaignGiftPickerSpu(undefined);
    setNonSalesProductId("");
    setNonSalesNote("");
    setNonSalesPickerError(undefined);
    setStatus(undefined);
  }

  async function handleVoidSelectedOrder(input: VoidOrderInput) {
    if (!selectedOrder) {
      return;
    }

    setIsVoidingOrder(true);
    setStatus(undefined);

    try {
      const voidedOrder = await voidPaidOrder(selectedOrder.id, input);
      setSelectedOrder(voidedOrder);

      try {
        const [items, inventoryLogs] = await Promise.all([
          listOrderItems(voidedOrder.id),
          listInventoryLogsForOrder(voidedOrder.id)
        ]);

        setSelectedOrderItems(items);
        setSelectedOrderInventoryLogs(inventoryLogs);
        setStatus({ kind: "success", text: `订单 ${voidedOrder.orderNo} 已作废，库存已回滚。` });
      } catch {
        setStatus({ kind: "error", text: `订单 ${voidedOrder.orderNo} 已作废，但详情刷新失败，请刷新页面查看最新库存流水。` });
      }

      await refreshSalesData({ preserveStatus: true });
    } catch {
      setStatus({ kind: "error", text: "订单作废失败，请刷新后重试。" });
    } finally {
      setIsVoidingOrder(false);
    }
  }

  async function handleSaveSelectedRefund(input: SaveRefundInput) {
    if (!selectedOrder) {
      return;
    }

    setIsSavingRefund(true);
    setStatus(undefined);

    try {
      try {
        await saveOrderRefund({
          orderId: selectedOrder.id,
          amount: input.amount,
          method: input.method,
          reason: input.reason,
          note: input.note
        });
      } catch {
        setStatus({ kind: "error", text: "退款记录保存失败，请刷新后重试。" });
        throw new Error("refund-save-failed");
      }

      try {
        const updatedRefunds = await listOrderRefunds(selectedOrder.id);
        setSelectedOrderRefunds(updatedRefunds);
        setStatus({ kind: "success", text: `订单 ${selectedOrder.orderNo} 已记录退款 ${formatMoney(input.amount)}。` });
      } catch {
        setStatus({
          kind: "error",
          text: `订单 ${selectedOrder.orderNo} 已记录退款，但退款记录刷新失败，请刷新页面查看最新退款记录。`
        });
      }

      await refreshSalesData({
        preserveStatus: true,
        failureStatus: {
          kind: "error",
          text: `订单 ${selectedOrder.orderNo} 已记录退款，但售卖数据刷新失败，请刷新页面查看最新订单列表。`
        }
      });
    } finally {
      setIsSavingRefund(false);
    }
  }

  async function refreshSelectedOrderAccountingDetails(orderId: string) {
    const [items, inventoryLogs, refunds] = await Promise.all([
      listOrderItems(orderId),
      listInventoryLogsForOrder(orderId),
      listOrderRefunds(orderId)
    ]);

    setSelectedOrderItems(items);
    setSelectedOrderInventoryLogs(inventoryLogs);
    setSelectedOrderRefunds(refunds);
  }

  async function handleAdjustSelectedOrderItem(input: AdjustOrderItemAccountingInput) {
    if (!selectedOrder) {
      return;
    }

    setIsAdjustingAccounting(true);
    setStatus(undefined);

    try {
      try {
        const adjustedItem = await adjustOrderItemAccounting(input);
        if (adjustedItem) {
          setSelectedOrderItems((items) => items.map((item) => (item.id === adjustedItem.id ? adjustedItem : item)));
        }
      } catch {
        setStatus({ kind: "error", text: "订单统计口径修正失败，请刷新后重试。" });
        throw new Error("order-accounting-adjustment-failed");
      }

      try {
        await refreshSelectedOrderAccountingDetails(selectedOrder.id);
        setStatus({ kind: "success", text: "订单统计口径已修正，原始支付、退款和库存流水未改动。" });
      } catch {
        setStatus({ kind: "error", text: "订单统计口径已修正，但详情刷新失败，请刷新页面查看最新数据。" });
      }

      await refreshSalesData({
        preserveStatus: true,
        failureStatus: {
          kind: "error",
          text: "订单统计口径已修正，但售卖数据刷新失败，请刷新页面查看最新订单列表。"
        }
      });
    } finally {
      setIsAdjustingAccounting(false);
    }
  }

  async function handleAdjustSelectedWholeOrder(input: AdjustOrderAccountingInput) {
    if (!selectedOrder) {
      return;
    }

    setIsAdjustingAccounting(true);
    setStatus(undefined);

    try {
      try {
        const adjustedItems = await adjustOrderAccounting(input);
        if (adjustedItems.length > 0) {
          setSelectedOrderItems(adjustedItems);
        }
      } catch {
        setStatus({ kind: "error", text: "订单统计口径修正失败，请刷新后重试。" });
        throw new Error("order-accounting-adjustment-failed");
      }

      try {
        await refreshSelectedOrderAccountingDetails(selectedOrder.id);
        setStatus({ kind: "success", text: "订单统计口径已修正，原始支付、退款和库存流水未改动。" });
      } catch {
        setStatus({ kind: "error", text: "订单统计口径已修正，但详情刷新失败，请刷新页面查看最新数据。" });
      }

      await refreshSalesData({
        preserveStatus: true,
        failureStatus: {
          kind: "error",
          text: "订单统计口径已修正，但售卖数据刷新失败，请刷新页面查看最新订单列表。"
        }
      });
    } finally {
      setIsAdjustingAccounting(false);
    }
  }

  function canAdjustItemToCampaignGift(item: OrderItem): boolean {
    return products.find((product) => product.id === item.productId)?.isGiftEligible ?? false;
  }

  async function handleConfirmPaid() {
    if (!settings || calculated.lines.length === 0) {
      setStatus({ kind: "error", text: "购物车为空，无法保存订单。" });
      return;
    }

    if (calculated.giftStockWarnings.length > 0) {
      setStatus({ kind: "error", text: "赠品库存不足，无法保存订单。" });
      return;
    }

    if (hasCampaignGiftWithoutSaleLine) {
      setStatus({ kind: "error", text: "运营赠礼需要本单存在正常消费商品。" });
      return;
    }

    setStatus(undefined);

    try {
      const paidOrder = buildPaidOrder({
        products,
        calculated,
        resolvedGiftLines: resolveGiftLines({ calculated, products, selections: giftSelections }),
        promotion: settings.promotion,
        orderPrefix: settings.orderPrefix,
        paymentMethod: hasSaleCalculatedLine(calculated) ? paymentMethod : undefined
      });

      await savePaidOrder(paidOrder);
      clearCart();
      setMode("cart");
      setIsCartOpen(true);
      setStatus({ kind: "success", text: `订单 ${paidOrder.order.orderNo} 已保存，库存已扣减。` });
      await refreshSalesData({ preserveStatus: true });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? error.message : "订单保存失败，请检查库存后重试。"
      });
      throw error;
    }
  }

  return (
    <section className="salesPage" aria-labelledby="sales-title">
      <div className={mode === "checkout" ? "salesHeader isCheckout" : "salesHeader"}>
        <div className="salesTitleBlock">
          <div className="salesTitleLine">
            <h1 id="sales-title">{mode === "checkout" ? "收款" : "售卖"}</h1>
            {settings ? <FieldLockStatus settings={settings} onSave={handleSaveFieldLock} /> : null}
          </div>
          <p>选择商品、确认收款，订单只在手动确认已支付后保存并扣减库存。</p>
        </div>
        {mode !== "checkout" ? (
          <div className="salesHeaderControls">
            <div className="spuFilter" role="group" aria-label="按 SPU 筛选商品">
              {spuList.map((spu) => (
                <button
                  type="button"
                  aria-pressed={selectedSpu === spu}
                  className={selectedSpu === spu ? "isSelected" : ""}
                  key={spu}
                  onClick={() => setSelectedSpu(spu)}
                >
                  {spu}
                </button>
              ))}
            </div>
            <div className="salesHeaderActions">
              <button type="button" className="secondaryButton" disabled={isLoading} onClick={() => void refreshSalesData()}>
                <RefreshCw size={17} aria-hidden="true" />
                刷新
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="secondaryButton checkoutRefreshButton" disabled={isLoading} onClick={() => void refreshSalesData()}>
            <RefreshCw size={17} aria-hidden="true" />
            刷新
          </button>
        )}
      </div>

      {status ? (
        <p className={status.kind === "error" ? "errorBanner" : "successBanner"} role="status">
          {status.text}
        </p>
      ) : null}

      <div className={mode === "checkout" ? "salesLayout hasCheckout" : "salesLayout"}>
        <div className="salesProductsArea">
          {mode === "checkout" ? (
            <CheckoutOrderReview calculated={calculated} products={products} cartItems={cartItems} />
          ) : (
            <>
              {isLoading ? <p className="emptyState">正在加载售卖商品...</p> : null}
              {!isLoading && visibleProducts.length === 0 ? (
                <div className="salesEmpty">
                  <Search size={24} aria-hidden="true" />
                  <p>当前筛选下没有可售商品。</p>
                </div>
              ) : null}

              <div className="salesProductList" role="list" aria-label="售卖商品紧凑列表" aria-live="polite">
                {visibleProducts.map((product) => {
                  const quantityInCart = cartQuantityByProduct.get(product.id) ?? 0;
                  const remainingStock = product.stockQty - quantityInCart;
                  const hasReachedStock = remainingStock <= 0;

                  return (
                    <article className="salesProductRow" role="listitem" key={product.id}>
                      <SalesProductImage product={product} />
                      <div className="salesProductRowMain">
                        <div>
                          <h2>{product.name}</h2>
                          <p>{product.spu}</p>
                        </div>
                        <div className="salesProductRowMeta">
                          <span>{formatMoney(product.salePrice)}</span>
                          <span>库存 {product.stockQty}</span>
                          {quantityInCart > 0 ? <span>已加 {quantityInCart}</span> : null}
                          {hasReachedStock ? <span>已达库存</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="addSaleButton"
                        aria-label={`加入 ${product.name}`}
                        disabled={hasReachedStock}
                        onClick={() => addProduct(product.id)}
                      >
                        <Plus size={21} aria-hidden="true" />
                      </button>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {mode === "checkout" && settings ? (
          <CheckoutPanel
            calculated={calculated}
            settings={settings}
            products={products}
            giftSelections={giftSelections}
            setGiftSelection={(requirementKey, productId, quantity) => {
              setGiftSelections((current) => ({
                ...current,
                [requirementKey]: {
                  ...(current[requirementKey] ?? {}),
                  [productId]: Math.max(0, quantity)
                }
              }));
            }}
            qrImageUrls={qrImageUrls}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            confirmPaid={handleConfirmPaid}
            back={() => {
              setMode("cart");
              setIsCartOpen(true);
            }}
          />
        ) : null}
      </div>

      {mode !== "checkout" && isCartOpen ? (
        <div className="cartDrawerLayer">
          <button type="button" className="cartBackdrop" aria-label="关闭购物车遮罩" onClick={() => setIsCartOpen(false)} />
          <CartPanel
            products={products}
            calculated={calculated}
            cartItems={cartItems}
            increment={increment}
            decrement={decrement}
            clear={clearCart}
            campaignGiftEnabled={campaignGift.enabled}
            addCampaignGift={addCampaignGift}
            addManualGift={() => openNonSalesPicker("manual_gift")}
            addOtherOutbound={() => openNonSalesPicker("other_non_sales")}
            checkout={() => {
              setMode("checkout");
              setIsCartOpen(false);
            }}
            hold={() => {
              setStatus({ kind: "success", text: "购物车已暂存，可继续选择商品。" });
              setIsCartOpen(false);
            }}
            close={() => setIsCartOpen(false)}
          />
        </div>
      ) : null}

      {nonSalesPickerMode ? (
        <NonSalesProductPicker
          mode={nonSalesPickerMode}
          products={nonSalesPickerProducts}
          cartQuantityByProduct={cartQuantityByProduct}
          selectedProductId={nonSalesProductId}
          note={nonSalesNote}
          showAllActive={showAllNonSalesProducts}
          error={nonSalesPickerError}
          setSelectedProductId={(productId) => {
            setNonSalesProductId(productId);
            setNonSalesPickerError(undefined);
          }}
          setNote={(note) => {
            setNonSalesNote(note);
            setNonSalesPickerError(undefined);
          }}
          setShowAllActive={(showAllActive) => {
            setShowAllNonSalesProducts(showAllActive);
            setNonSalesPickerError(undefined);
          }}
          onConfirm={confirmNonSalesProduct}
          onCancel={() => {
            setNonSalesPickerMode(undefined);
            setCampaignGiftPickerSpu(undefined);
            setNonSalesPickerError(undefined);
          }}
        />
      ) : null}

      {mode !== "checkout" ? (
        <button
          type="button"
          className="salesDock"
          aria-label={`打开购物车，当前 ${cartItems.reduce((sum, item) => sum + item.quantity, 0)} 件，应收 ${formatMoney(calculated.payableAmount)}`}
          onClick={() => {
            setMode("cart");
            setIsCartOpen(true);
          }}
        >
          <ShoppingBasket size={18} aria-hidden="true" />
          {cartItems.reduce((sum, item) => sum + item.quantity, 0)} 件 / {formatMoney(calculated.payableAmount)}
        </button>
      ) : null}

      <section className="orderHistorySection" aria-labelledby="order-history-title">
        <button
          type="button"
          className="orderHistoryToggle"
          aria-expanded={isOrderHistoryOpen}
          aria-controls="recent-order-history"
          onClick={() => setIsOrderHistoryOpen((current) => !current)}
        >
          <span>
            <ReceiptText size={18} aria-hidden="true" />
            <strong id="order-history-title">订单记录</strong>
            <em>{filteredOrders.length} 笔</em>
          </span>
          {isOrderHistoryOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>

        {isOrderHistoryOpen ? (
          <div id="recent-order-history" className="orderHistoryPanel" role="region" aria-label="订单记录列表">
            <div className="orderHistoryFilters">
              <label>
                <span>搜索</span>
                <input
                  aria-label="搜索订单号"
                  value={orderQuery}
                  onChange={(event) => setOrderQuery(event.target.value)}
                  placeholder="订单号"
                />
              </label>
              <label>
                <span>日期</span>
                <select
                  aria-label="订单日期范围"
                  value={orderDateRange}
                  onChange={(event) => setOrderDateRange(event.target.value as OrderDateRange)}
                >
                  {(Object.keys(dateRangeLabels) as OrderDateRange[]).map((key) => (
                    <option key={key} value={key}>
                      {dateRangeLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select
                  aria-label="订单状态"
                  value={orderStatusFilter}
                  onChange={(event) => setOrderStatusFilter(event.target.value as OrderHistoryStatusFilter)}
                >
                  <option value="all">全部状态</option>
                  {(Object.keys(orderStatusLabels) as Array<keyof typeof orderStatusLabels>).map((key) => (
                    <option key={key} value={key}>
                      {orderStatusLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>支付</span>
                <select
                  aria-label="支付方式"
                  value={orderPaymentFilter}
                  onChange={(event) => setOrderPaymentFilter(event.target.value as OrderHistoryPaymentFilter)}
                >
                  <option value="all">全部方式</option>
                  {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((key) => (
                    <option key={key} value={key}>
                      {paymentMethodLabels[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {isLoading ? <p className="emptyState">正在加载订单记录...</p> : null}
            {!isLoading && filteredOrders.length === 0 ? <p className="emptyState">当前筛选下暂无订单。</p> : null}
            {filteredOrders.map((order) => {
              const afterSalesBadges = getOrderAfterSalesBadges(order, refunds);
              const accountingBadges = getOrderHistoryAccountingBadges(order);

              return (
                <article className="orderHistoryRow" key={order.id}>
                  <button
                    type="button"
                    className="orderHistoryOpenButton"
                    aria-label={`查看订单 ${order.orderNo}`}
                    disabled={isOrderDetailLoading}
                    onClick={() => requestOrderDetail(order)}
                  >
                    <span>
                      <strong>{order.orderNo}</strong>
                      <em>{formatPaidTime(orderBusinessTime(order))}</em>
                    </span>
                    <span className="orderHistoryMeta">
                      <span className="orderHistoryChip isStatus">{orderStatusLabels[order.status]}</span>
                      <span className="orderHistoryChip isPayment">{order.paymentMethod ? paymentMethodLabels[order.paymentMethod] : "未记录"}</span>
                      {accountingBadges.map((badge) => (
                        <span
                          className={badge.tone === "warning" ? "orderHistoryChip isAccounting isWarning" : "orderHistoryChip isAccounting"}
                          key={`${order.id}-${badge.label}`}
                        >
                          {badge.label}
                        </span>
                      ))}
                      <strong className="notranslate" translate="no">
                        {formatMoney(order.payableAmount)}
                      </strong>
                      {afterSalesBadges.length > 0 ? (
                        <span className="orderAfterSalesBadges" aria-label="订单售后标识">
                          {afterSalesBadges.map((badge) => (
                            <span
                              className={
                                badge.tone === "danger"
                                  ? "orderHistoryChip isAfterSales isDanger"
                                  : "orderHistoryChip isAfterSales"
                              }
                              key={`${order.id}-${badge.label}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {selectedOrder ? (
        <OrderDetailDialog
          order={selectedOrder}
          orderItems={selectedOrderItems}
          inventoryLogs={selectedOrderInventoryLogs}
          orderRefunds={selectedOrderRefunds}
          onClose={closeOrderDetail}
          onVoidOrder={handleVoidSelectedOrder}
          isVoiding={isVoidingOrder}
          onSaveRefund={handleSaveSelectedRefund}
          isSavingRefund={isSavingRefund}
          onAdjustOrderItem={handleAdjustSelectedOrderItem}
          onAdjustWholeOrder={handleAdjustSelectedWholeOrder}
          isAdjustingAccounting={isAdjustingAccounting}
          canAdjustItemToCampaignGift={canAdjustItemToCampaignGift}
          campaignGiftActivityName={campaignGift.activityName}
        />
      ) : null}
      <FieldLockDialog
        isOpen={isOrderUnlockOpen}
        onCancel={handleCancelOrderUnlock}
        onVerify={handleVerifyOrderUnlock}
        onVerified={handleOrderUnlockVerified}
      />
    </section>
  );
}
