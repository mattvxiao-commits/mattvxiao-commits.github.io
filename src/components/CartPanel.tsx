import { Minus, PauseCircle, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type { CalculatedCart, CartItem, Product } from "../domain/types";

type CartPanelProps = {
  products: Product[];
  calculated: CalculatedCart;
  cartItems: CartItem[];
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  clear: () => void;
  checkout: () => void;
  hold: () => void;
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
  hold
}: CartPanelProps) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasCartItems = itemCount > 0;

  return (
    <aside className="cartPanel" aria-labelledby="cart-title">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Cart</p>
          <h2 id="cart-title">购物车</h2>
        </div>
        <span className="cartCount">{itemCount} 件</span>
      </div>

      {calculated.lines.length > 0 ? (
        <div className="cartLineList" aria-label="购物车明细">
          {calculated.lines.map((line, index) => (
            <div
              className={`cartLine cartLine-${line.lineType}`}
              key={`${line.productId}-${line.lineType}-${line.finalUnitPrice}-${index}`}
            >
              <div className="lineMain">
                <div>
                  <h3>{line.productName}</h3>
                  <p>{line.spu}</p>
                </div>
                <span>{lineTypeLabels[line.lineType]}</span>
              </div>
              <div className="lineMeta">
                <span>
                  {formatMoney(line.finalUnitPrice)} x {line.quantity}
                </span>
                {line.originalUnitPrice !== line.finalUnitPrice ? (
                  <span className="strikePrice">{formatMoney(line.originalUnitPrice)}</span>
                ) : null}
                <strong>{formatMoney(line.lineTotal)}</strong>
              </div>
              <div className="lineActions">
                <button
                  type="button"
                  className="iconButton"
                  aria-label={`减少 ${line.productName}`}
                  onClick={() => decrement(line.productId)}
                >
                  <Minus size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="iconButton"
                  aria-label={`增加 ${line.productName}`}
                  disabled={(productById.get(line.productId)?.stockQty ?? 0) <= 0}
                  onClick={() => increment(line.productId)}
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="cartEmpty">还没有选择商品。</p>
      )}

      <div className="promotionSummary" aria-label="促销信息">
        <p>已享加购优惠 {calculated.appliedDiscountQty}/{calculated.maxDiscountQty} 个</p>
        {calculated.triggeredGiftTier ? (
          <p>已触发满 {calculated.triggeredGiftTier.threshold} 赠品</p>
        ) : (
          <p>暂未触发满额赠品</p>
        )}
      </div>

      {calculated.giftLines.length > 0 ? (
        <div className="giftSummary" aria-label="赠品明细">
          {calculated.giftLines.map((line) => (
            <p key={`${line.productId}-gift`}>
              {line.productName} x{line.quantity}
            </p>
          ))}
        </div>
      ) : null}

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
        <button type="button" className="primaryButton" disabled={!hasCartItems} onClick={checkout}>
          <ShoppingCart size={18} aria-hidden="true" />
          去收款
        </button>
      </div>
    </aside>
  );
}
