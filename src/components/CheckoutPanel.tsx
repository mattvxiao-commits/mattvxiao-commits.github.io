import { ArrowLeft, Banknote, CheckCircle2, QrCode } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildGiftSelectionRequirements,
  type GiftSelectionOption,
  type GiftSelectionRequirement,
  type GiftSelections,
  validateGiftSelections
} from "../domain/giftSelection";
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

function formatGiftOptionLabel(option: GiftSelectionOption): string {
  const code = option.productCode?.trim();
  return code
    ? `${code} / ${option.productName} / 库存 ${option.availableQty}`
    : `${option.productName} / 库存 ${option.availableQty}`;
}

function sumSelection(selection: Record<string, number> | undefined): number {
  return Object.values(selection ?? {}).reduce((sum, quantity) => sum + Math.max(0, quantity), 0);
}

function buildSelectionRows(requirement: GiftSelectionRequirement, giftSelections: GiftSelections) {
  const selected = giftSelections[requirement.key] ?? {};
  const rows = Object.entries(selected)
    .filter(([, quantity]) => quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }));

  if (rows.length > 0) {
    return rows;
  }

  return [{ productId: "", quantity: 0 }];
}

function giftGroupLabel(requirement: GiftSelectionRequirement, index: number): string {
  return `赠品${String.fromCharCode(65 + index)}：${requirement.label}`;
}

export default function CheckoutPanel({
  calculated,
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
  const isZeroPayable = calculated.payableAmount === 0;
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

      {isZeroPayable ? null : (
        <>
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

          {paymentMethod === "wechat" ? (
            <div className="qrGrid">
              <section className="qrBox" aria-label="微信收款码">
                {qrImageUrls.wechat ? (
                  <img src={qrImageUrls.wechat} alt="微信收款码" />
                ) : (
                  <p>微信收款码未设置</p>
                )}
              </section>
            </div>
          ) : null}

          {paymentMethod === "alipay" ? (
            <div className="qrGrid">
              <section className="qrBox" aria-label="支付宝收款码">
                {qrImageUrls.alipay ? (
                  <img src={qrImageUrls.alipay} alt="支付宝收款码" />
                ) : (
                  <p>支付宝收款码未设置</p>
                )}
              </section>
            </div>
          ) : null}

          {paymentMethod === "cash" || paymentMethod === "other" ? (
            <div className="qrBox singleQrNotice">
              <p>当前选择{paymentOptions.find((option) => option.value === paymentMethod)?.label}收款，无需展示收款码。</p>
            </div>
          ) : null}
        </>
      )}

      {giftRequirements.length > 0 ? (
        <div className="giftSelectionPanel" aria-label="赠品选择">
          {giftRequirements.map((requirement, requirementIndex) => {
            const displayLabel = giftGroupLabel(requirement, requirementIndex);

            return (
              <section className="giftSelectionGroup" key={requirement.key}>
                <div>
                  <h3>{displayLabel}</h3>
                  <p>需选 {requirement.requiredQty} 个，已选 {sumSelection(giftSelections[requirement.key])} 个</p>
                </div>
                <div className="giftSelectionRows">
                  {buildSelectionRows(requirement, giftSelections).map((row, index) => {
                    const selectedOption = requirement.options.find((option) => option.productId === row.productId);
                    const quantity = row.quantity;
                    const rowKey = row.productId || `empty-${index}`;

                    return (
                      <div className="giftSelectionRow" key={rowKey}>
                        <select
                          aria-label={`${displayLabel} 第 ${index + 1} 行 SKU`}
                          value={row.productId}
                          onChange={(event) => {
                            const nextProductId = event.target.value;
                            if (row.productId) {
                              setGiftSelection?.(requirement.key, row.productId, 0);
                            }
                            if (nextProductId) {
                              setGiftSelection?.(requirement.key, nextProductId, Math.max(1, quantity));
                            }
                          }}
                        >
                          <option value="">选择赠品 SKU</option>
                          {requirement.options.map((option) => (
                            <option key={option.productId} value={option.productId}>
                              {formatGiftOptionLabel(option)}
                            </option>
                          ))}
                        </select>
                        <div className="quantityStepper giftQuantityStepper">
                          <button
                            type="button"
                            className="iconButton"
                            aria-label={`减少 ${selectedOption?.productName ?? displayLabel} 赠品数量`}
                            disabled={!row.productId || quantity <= 0}
                            onClick={() => setGiftSelection?.(requirement.key, row.productId, Math.max(0, quantity - 1))}
                          >
                            -
                          </button>
                          <span>{quantity}</span>
                          <button
                            type="button"
                            className="iconButton"
                            aria-label={`增加 ${selectedOption?.productName ?? displayLabel} 赠品数量`}
                            disabled={!row.productId || quantity >= (selectedOption?.availableQty ?? 0)}
                            onClick={() => setGiftSelection?.(requirement.key, row.productId, quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="secondaryButton compactAddButton"
                    aria-label={`添加 ${displayLabel} 选择行`}
                    disabled={
                      requirement.options.length === 0 ||
                      requirement.options.every((option) => (giftSelections[requirement.key]?.[option.productId] ?? 0) > 0)
                    }
                    onClick={() => {
                      const selected = giftSelections[requirement.key] ?? {};
                      const nextOption = requirement.options.find((option) => !selected[option.productId]);
                      if (nextOption) {
                        setGiftSelection?.(requirement.key, nextOption.productId, 1);
                      }
                    }}
                  >
                    添加一行
                  </button>
                </div>
              </section>
            );
          })}
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
        <p>
          {isZeroPayable
            ? "本单无应收金额，保存后会扣减对应库存并记录为非销售出库。"
            : "确认线下已收到对应金额后，再保存为已支付订单并扣减库存。"}
        </p>
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
                  : isZeroPayable
                    ? "确认保存非销售出库"
                    : "确认已收款并保存订单"}
        </button>
      </div>
    </aside>
  );
}
