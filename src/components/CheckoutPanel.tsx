import { ArrowLeft, Banknote, CheckCircle2, QrCode } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildGiftSelectionRequirements,
  type GiftSelections,
  validateGiftSelections
} from "../domain/giftSelection";
import { displayProductCode } from "../domain/productCode";
import type { AppSettings, CalculatedCart, PaymentMethod, Product } from "../domain/types";

type CheckoutPanelProps = {
  calculated: CalculatedCart;
  settings: AppSettings;
  products?: Product[];
  giftSelections?: GiftSelections;
  setGiftSelection?: (requirementKey: string, productId: string, quantity: number) => void;
  qrImageUrls: {
    wechat?: string;
    alipay?: string;
  };
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  confirmPaid: () => Promise<void>;
  back: () => void;
};

const paymentOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "wechat", label: "微信" },
  { value: "alipay", label: "支付宝" },
  { value: "cash", label: "现金" },
  { value: "other", label: "其他" }
];

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}

export default function CheckoutPanel({
  calculated,
  settings,
  products = [],
  giftSelections = {},
  setGiftSelection,
  qrImageUrls,
  paymentMethod,
  setPaymentMethod,
  confirmPaid,
  back
}: CheckoutPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isEmpty = calculated.lines.length === 0;
  const hasGiftStockWarnings = calculated.giftStockWarnings.length > 0;
  const giftRequirements = useMemo(
    () => buildGiftSelectionRequirements(calculated, products),
    [calculated, products]
  );
  const giftSelectionValidation = useMemo(
    () => validateGiftSelections({ requirements: giftRequirements, selections: giftSelections }),
    [giftRequirements, giftSelections]
  );
  const hasIncompleteGiftSelections = !giftSelectionValidation.ok;

  async function handleConfirmPaid() {
    if (isSaving || isEmpty || hasGiftStockWarnings || hasIncompleteGiftSelections) {
      return;
    }

    setIsSaving(true);

    try {
      await confirmPaid();
    } catch {
      // The page owns the user-facing error message; the panel only owns the duplicate-submit guard.
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside className="checkoutPanel" aria-labelledby="checkout-title">
      <div className="panelHeading">
        <div>
          <p className="eyebrow">Checkout</p>
          <h2 id="checkout-title">收款确认</h2>
        </div>
        <button type="button" className="secondaryButton" onClick={back}>
          <ArrowLeft size={17} aria-hidden="true" />
          返回
        </button>
      </div>

      <div className="checkoutAmount">
        <span>订单金额</span>
        <strong>{formatMoney(calculated.payableAmount)}</strong>
        <p>{settings.shopName} / {settings.orderPrefix}</p>
      </div>

      <div className="paymentMethods" role="group" aria-label="收款方式">
        {paymentOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={paymentMethod === option.value ? "isSelected" : ""}
            aria-pressed={paymentMethod === option.value}
            onClick={() => setPaymentMethod(option.value)}
          >
            {option.value === "cash" ? <Banknote size={17} aria-hidden="true" /> : <QrCode size={17} aria-hidden="true" />}
            {option.label}
          </button>
        ))}
      </div>

      <div className="qrGrid">
        <section className="qrBox" aria-labelledby="wechat-qr-title">
          <h3 id="wechat-qr-title">微信收款码</h3>
          {qrImageUrls.wechat ? (
            <img src={qrImageUrls.wechat} alt="微信收款码" />
          ) : (
            <p>微信收款码未设置</p>
          )}
        </section>
        <section className="qrBox" aria-labelledby="alipay-qr-title">
          <h3 id="alipay-qr-title">支付宝收款码</h3>
          {qrImageUrls.alipay ? (
            <img src={qrImageUrls.alipay} alt="支付宝收款码" />
          ) : (
            <p>支付宝收款码未设置</p>
          )}
        </section>
      </div>

      {giftRequirements.length > 0 ? (
        <div className="giftSelectionPanel" aria-label="赠品选择">
          {giftRequirements.map((requirement) => (
            <section className="giftSelectionGroup" key={requirement.key}>
              <div>
                <h3>{requirement.label}</h3>
                <p>需选择 {requirement.requiredQty} 个实际赠品 SKU</p>
              </div>
              <div className="giftSelectionOptions">
                {requirement.options.map((option) => (
                  <label key={option.productId}>
                    <span>
                      {displayProductCode(option.productCode)} / {option.productName}，库存 {option.availableQty}
                    </span>
                    <input
                      aria-label={`${option.productName} 赠品数量`}
                      type="number"
                      min="0"
                      max={option.availableQty}
                      step="1"
                      value={giftSelections[requirement.key]?.[option.productId] ?? 0}
                      onChange={(event) =>
                        setGiftSelection?.(requirement.key, option.productId, Number(event.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
          {giftSelectionValidation.ok ? null : <p className="fieldHint isWarning">{giftSelectionValidation.message}</p>}
        </div>
      ) : null}

      <div className="manualConfirm">
        {hasGiftStockWarnings ? (
          <div className="cartWarning" role="alert">
            {calculated.giftStockWarnings.map((warning) => (
              <p key={warning.productId}>
                赠品库存不足：{warning.productName} 需要 {warning.requiredQty}，当前 {warning.availableQty}
              </p>
            ))}
          </div>
        ) : null}
        <p>确认线下已收到对应金额后，再保存为已支付订单并扣减库存。</p>
        <button
          type="button"
          className="primaryButton"
          disabled={isSaving || isEmpty || hasGiftStockWarnings || hasIncompleteGiftSelections}
          onClick={() => void handleConfirmPaid()}
        >
          <CheckCircle2 size={18} aria-hidden="true" />
          {isSaving
            ? "保存中..."
            : isEmpty
              ? "购物车为空，无法确认"
              : hasGiftStockWarnings
                ? "赠品库存不足，无法确认"
                : hasIncompleteGiftSelections
                  ? "赠品未选择完整，无法确认"
                  : "确认已收款并保存订单"}
        </button>
      </div>
    </aside>
  );
}
