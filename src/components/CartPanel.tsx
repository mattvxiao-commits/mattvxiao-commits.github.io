import { Minus, PauseCircle, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CalculatedCart, CartItem, Product } from "../domain/types";
import { getImageUrl } from "../utils/image";

type CartPanelProps = {
  products: Product[];
  calculated: CalculatedCart;
  cartItems: CartItem[];
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  clear: () => void;
  checkout: () => void;
  hold: () => void;
  close?: () => void;
};

const lineTypeLabels = {
  normal: "正常",
  discount_addon: "加购优惠",
  gift: "赠品"
} as const;

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}

export default function CartPanel({
  products,
  calculated,
  cartItems,
  increment,
  decrement,
  clear,
  checkout,
  hold,
  close
}: CartPanelProps) {
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const imageProductIds = useMemo(
    () => Array.from(new Set(calculated.lines.map((line) => line.productId))).filter((productId) => productById.get(productId)?.imageId),
    [calculated.lines, productById]
  );
  const [imageUrlsByProductId, setImageUrlsByProductId] = useState<Record<string, string | undefined>>({});
  const cartQuantityByProduct = new Map(cartItems.map((item) => [item.productId, item.quantity]));
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasCartItems = itemCount > 0;
  const hasGiftStockWarnings = calculated.giftStockWarnings.length > 0;
  const giftSummaryText =
    calculated.triggeredGiftTier && calculated.giftEntitlements.length > 0
      ? `已触发满 ${calculated.triggeredGiftTier.threshold}：${calculated.giftEntitlements
          .map((gift) => `${gift.label} x${gift.quantity}`)
          .join("、")}`
      : undefined;

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

  return (
    <aside className="cartPanel" aria-labelledby="cart-title">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Cart</p>
          <h2 id="cart-title">购物车</h2>
        </div>
        <div className="panelHeadingActions">
          <span className="cartCount">{itemCount} 件</span>
          {close ? (
            <button type="button" className="iconButton" aria-label="关闭购物车" onClick={close}>
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {calculated.lines.length > 0 ? (
        <div className="cartLineList" aria-label="购物车明细">
          {calculated.lines.map((line, index) => (
            <div
              className={`cartLine cartLine-${line.lineType}`}
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
                  <div className="quantityStepper" aria-label={`${line.productName} 数量`}>
                    <button
                      type="button"
                      className="iconButton"
                      aria-label={`减少 ${line.productName}`}
                      onClick={() => decrement(line.productId)}
                    >
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      className="iconButton"
                      aria-label={`增加 ${line.productName}`}
                      disabled={(cartQuantityByProduct.get(line.productId) ?? 0) >= (productById.get(line.productId)?.stockQty ?? 0)}
                      onClick={() => increment(line.productId)}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="cartEmpty">还没有选择商品。</p>
      )}

      <div className="promotionSummary" aria-label="促销信息">
        <p>已享加购优惠 {calculated.appliedDiscountQty}/{calculated.maxDiscountQty} 个</p>
        <p>{giftSummaryText ?? "暂未触发满额赠品"}</p>
      </div>

      {calculated.giftStockWarnings.length > 0 ? (
        <div className="cartWarning" role="alert">
          {calculated.giftStockWarnings.map((warning) => (
            <p key={warning.productId}>
              赠品库存不足：{warning.productName} 需要 {warning.requiredQty}，当前 {warning.availableQty}
            </p>
          ))}
        </div>
      ) : null}

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

      <div className="cartActions">
        <button type="button" className="secondaryButton" disabled={!hasCartItems} onClick={clear}>
          <Trash2 size={17} aria-hidden="true" />
          清空购物车
        </button>
        <button type="button" className="secondaryButton" disabled={!hasCartItems} onClick={hold}>
          <PauseCircle size={17} aria-hidden="true" />
          暂存购物车
        </button>
        <button
          type="button"
          className="primaryButton"
          disabled={!hasCartItems || hasGiftStockWarnings}
          onClick={checkout}
        >
          <ShoppingCart size={18} aria-hidden="true" />
          {hasGiftStockWarnings ? "赠品库存不足，无法去收款" : "去收款"}
        </button>
      </div>
    </aside>
  );
}
