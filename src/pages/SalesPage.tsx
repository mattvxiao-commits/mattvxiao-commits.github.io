import {
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBasket
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import CartPanel from "../components/CartPanel";
import CheckoutPanel from "../components/CheckoutPanel";
import { getSettings, listOrders, listProducts, savePaidOrder } from "../db/repositories";
import { resolveGiftLines, type GiftSelections } from "../domain/giftSelection";
import { formatMoney } from "../domain/money";
import { buildPaidOrder } from "../domain/order";
import { calculateCart } from "../domain/promotions";
import type { AppSettings, Order, PaymentMethod, Product } from "../domain/types";
import { useCartStore } from "../state/cartStore";
import { getImageUrl } from "../utils/image";

type SalesMode = "cart" | "checkout";
type SalesViewMode = "list" | "grid";
type StatusMessage = {
  kind: "success" | "error";
  text: string;
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  wechat: "微信",
  alipay: "支付宝",
  cash: "现金",
  other: "其他"
};

const lineTypeLabels = {
  normal: "正常",
  discount_addon: "加购优惠",
  gift: "赠品"
} as const;

function orderPaidTime(order: Order): string {
  return order.paidAt ?? order.createdAt;
}

function compareRecentPaidOrders(left: Order, right: Order): number {
  return orderPaidTime(right).localeCompare(orderPaidTime(left));
}

function formatPaidTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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

function CheckoutOrderReview({ calculated, products }: { calculated: ReturnType<typeof calculateCart>; products: Product[] }) {
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

  return (
    <section className="checkoutOrderReview" aria-labelledby="checkout-order-review-title">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Order</p>
          <h2 id="checkout-order-review-title">本单商品</h2>
        </div>
        <span className="cartCount">{itemCount} 件</span>
      </div>

      {calculated.lines.length > 0 ? (
        <div className="cartLineList checkoutReviewLines" aria-label="本单商品明细">
          {calculated.lines.map((line, index) => (
            <div
              className={`cartLine checkoutReviewLine cartLine-${line.lineType}`}
              key={`${line.productId}-${line.lineType}-${line.finalUnitPrice}-${index}`}
            >
              <div className="cartLineThumb">
                {imageUrlsByProductId[line.productId] ? (
                  <img src={imageUrlsByProductId[line.productId]} alt={line.productName} />
                ) : (
                  <span aria-hidden="true">{line.productName.slice(0, 1) || "商"}</span>
                )}
              </div>
              <div className="lineMain">
                <div className="lineTitleRow">
                  <h3>{line.productName}</h3>
                  <span>{lineTypeLabels[line.lineType]}</span>
                </div>
                <p>{line.spu}</p>
                <div className="lineMeta">
                  <span className="unitPrice">单价 {formatMoney(line.finalUnitPrice)}</span>
                  {line.originalUnitPrice !== line.finalUnitPrice ? (
                    <span className="strikePrice">{formatMoney(line.originalUnitPrice)}</span>
                  ) : null}
                  <span>数量 x{line.quantity}</span>
                  <strong>{formatMoney(line.lineTotal)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="cartEmpty">还没有选择商品。</p>
      )}

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
    </section>
  );
}

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<AppSettings>();
  const [selectedSpu, setSelectedSpu] = useState("全部");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wechat");
  const [mode, setMode] = useState<SalesMode>("cart");
  const [salesViewMode, setSalesViewMode] = useState<SalesViewMode>("list");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [giftSelections, setGiftSelections] = useState<GiftSelections>({});
  const [qrImageUrls, setQrImageUrls] = useState<{ wechat?: string; alipay?: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<StatusMessage>();
  const cartItems = useCartStore((state) => state.items);
  const addProduct = useCartStore((state) => state.addProduct);
  const increment = useCartStore((state) => state.increment);
  const decrement = useCartStore((state) => state.decrement);
  const clearCart = useCartStore((state) => state.clear);

  async function refreshSalesData(options: { preserveStatus?: boolean } = {}) {
    setIsLoading(true);
    if (!options.preserveStatus) {
      setStatus(undefined);
    }

    try {
      const [loadedProducts, loadedSettings, loadedOrders] = await Promise.all([listProducts(), getSettings(), listOrders()]);
      setProducts(loadedProducts);
      setSettings(loadedSettings);
      setOrders(loadedOrders);
    } catch {
      setStatus({ kind: "error", text: "售卖数据加载失败，请刷新后重试。" });
    } finally {
      setIsLoading(false);
    }
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
  const cartQuantityByProduct = useMemo(
    () => new Map(cartItems.map((item) => [item.productId, item.quantity])),
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

  const recentPaidOrders = useMemo(
    () => orders.filter((order) => order.status === "paid").sort(compareRecentPaidOrders).slice(0, 10),
    [orders]
  );

  async function handleConfirmPaid() {
    if (!settings || calculated.lines.length === 0) {
      setStatus({ kind: "error", text: "购物车为空，无法保存订单。" });
      return;
    }

    if (calculated.giftStockWarnings.length > 0) {
      setStatus({ kind: "error", text: "赠品库存不足，无法保存订单。" });
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
        paymentMethod
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
      <div className="salesHeader">
        <div className="salesTitleBlock">
          <p className="eyebrow">Checkout</p>
          <h1 id="sales-title">售卖</h1>
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
              <div className="viewSwitch" role="group" aria-label="切换商品展示方式">
                <button
                  type="button"
                  aria-pressed={salesViewMode === "list"}
                  className={salesViewMode === "list" ? "isSelected" : ""}
                  onClick={() => setSalesViewMode("list")}
                >
                  <List size={16} aria-hidden="true" />
                  紧凑列表
                </button>
                <button
                  type="button"
                  aria-pressed={salesViewMode === "grid"}
                  className={salesViewMode === "grid" ? "isSelected" : ""}
                  onClick={() => setSalesViewMode("grid")}
                >
                  <LayoutGrid size={16} aria-hidden="true" />
                  图片网格
                </button>
              </div>
              <button type="button" className="secondaryButton" disabled={isLoading} onClick={() => void refreshSalesData()}>
                <RefreshCw size={17} aria-hidden="true" />
                刷新
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="secondaryButton" disabled={isLoading} onClick={() => void refreshSalesData()}>
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
            <CheckoutOrderReview calculated={calculated} products={products} />
          ) : (
            <>
              {isLoading ? <p className="emptyState">正在加载售卖商品...</p> : null}
              {!isLoading && visibleProducts.length === 0 ? (
                <div className="salesEmpty">
                  <Search size={24} aria-hidden="true" />
                  <p>当前筛选下没有可售商品。</p>
                </div>
              ) : null}

              {salesViewMode === "list" ? (
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
              ) : (
                <div className="salesProductGrid" role="list" aria-label="售卖商品图片网格" aria-live="polite">
                  {visibleProducts.map((product) => {
                    const quantityInCart = cartQuantityByProduct.get(product.id) ?? 0;
                    const remainingStock = product.stockQty - quantityInCart;
                    const hasReachedStock = remainingStock <= 0;

                    return (
                      <article className="salesProductCard" role="listitem" key={product.id}>
                        <SalesProductImage product={product} />
                        <div className="salesProductBody">
                          <div>
                            <h2>{product.name}</h2>
                            <p>{product.spu}</p>
                          </div>
                          <div className="salesProductFacts">
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
              )}
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
            <em>{recentPaidOrders.length} 笔已支付</em>
          </span>
          {isOrderHistoryOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>

        {isOrderHistoryOpen ? (
          <div id="recent-order-history" className="orderHistoryPanel" role="region" aria-label="最近订单记录">
            {isLoading ? <p className="emptyState">正在加载订单记录...</p> : null}
            {!isLoading && recentPaidOrders.length === 0 ? <p className="emptyState">暂无已支付订单。</p> : null}
            {recentPaidOrders.map((order) => (
              <article className="orderHistoryRow" key={order.id}>
                <div>
                  <h3>{order.orderNo}</h3>
                  <p>{formatPaidTime(orderPaidTime(order))}</p>
                </div>
                <div className="orderHistoryMeta">
                  <span>{paymentMethodLabels[order.paymentMethod ?? "other"]}</span>
                  <strong>{formatMoney(order.payableAmount)}</strong>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
