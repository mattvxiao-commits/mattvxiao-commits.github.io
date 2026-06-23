import { ClipboardList, PackageCheck, ReceiptText, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "../domain/money";
import { buildOrderInventorySummary, type InventorySummaryMetric } from "../domain/orderInventorySummary";
import {
  deriveOrderNature,
  getNormalizedOrderLine,
  nonSalesReasonLabels,
  orderLineRevenueTypeLabels,
  orderNatureLabels,
  orderStatusLabels,
  paymentMethodLabels
} from "../domain/orderHistory";
import type {
  InventoryLog,
  NonSalesReason,
  Order,
  OrderCancelReason,
  OrderItem,
  OrderLineType,
  OrderLineRevenueType,
  OrderRefund,
  PaymentMethod,
  RefundReason
} from "../domain/types";

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

type OrderDetailDialogProps = {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  orderRefunds: OrderRefund[];
  onClose: () => void;
  onVoidOrder?: (input: VoidOrderInput) => Promise<void> | void;
  isVoiding?: boolean;
  onSaveRefund?: (input: SaveRefundInput) => Promise<void> | void;
  isSavingRefund?: boolean;
  onAdjustOrderItem?: (input: AdjustOrderItemAccountingInput) => Promise<void> | void;
  onAdjustWholeOrder?: (input: AdjustOrderAccountingInput) => Promise<void> | void;
  isAdjustingAccounting?: boolean;
  canAdjustItemToCampaignGift?: (item: OrderItem) => boolean;
  campaignGiftActivityName?: string;
};

const orderLineTypeLabels: Record<OrderLineType, string> = {
  normal: "普通商品",
  discount_addon: "加购优惠",
  gift: "赠品"
};

const inventoryReasonLabels: Record<InventoryLog["reason"], string> = {
  order_paid: "订单扣减",
  gift_order_paid: "赠品扣减",
  non_sales_outbound: "非销售出库",
  order_cancelled_rollback: "作废回滚",
  manual_adjust: "手动调整"
};

const cancelReasonLabels: Record<OrderCancelReason, string> = {
  mistake: "误操作",
  customer_cancelled: "客户取消",
  duplicate_order: "重复下单",
  inventory_issue: "库存/赠品异常",
  payment_issue: "收款异常",
  other: "其他"
};

const refundReasonLabels: Record<RefundReason, string> = {
  customer_return: "客户退单",
  overcharge: "多收款",
  product_issue: "商品问题",
  manual_adjustment: "人工调整",
  other: "其他"
};

const cancelReasonOptions = Object.keys(cancelReasonLabels) as OrderCancelReason[];
const refundReasonOptions = Object.keys(refundReasonLabels) as RefundReason[];
const paymentMethodOptions = Object.keys(paymentMethodLabels) as PaymentMethod[];

type AccountingAdjustmentMode = "sale" | Exclude<NonSalesReason, "tier_gift">;

const accountingAdjustmentLabels: Record<AccountingAdjustmentMode, string> = {
  sale: "销售",
  campaign_gift: "运营赠礼",
  manual_gift: "人工赠送",
  other_non_sales: "其他出库"
};

const accountingAdjustmentOptions = Object.keys(accountingAdjustmentLabels) as AccountingAdjustmentMode[];

const defaultCampaignActivityOptions = ["关注社媒赠礼", "现场互动赠礼", "活动补赠"];
const campaignNoteOptions = ["已完成关注", "现场活动赠礼", "补登记运营赠礼"];
const manualGiftNoteOptions = ["好友赠送", "摊主赠送", "合作赠送", "老客赠送"];
const otherNonSalesNoteOptions = ["样品出库", "问题补偿", "陈列损耗", "盘点修正"];
const adjustmentNoteOptions = ["历史订单补修正", "现场复核修正", "复盘口径修正"];

function NoTranslate({ children }: { children: string }) {
  return (
    <span className="notranslate" translate="no">
      {children}
    </span>
  );
}

function QuickOptionGroup({
  label,
  options,
  onPick
}: {
  label: string;
  options: string[];
  onPick: (value: string) => void;
}) {
  const uniqueOptions = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));

  if (uniqueOptions.length === 0) {
    return null;
  }

  return (
    <div className="quickOptionGroup" aria-label={label}>
      {uniqueOptions.map((option) => (
        <button type="button" className="quickOptionButton" key={option} onClick={() => onPick(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "未记录";
  }

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

function formatGiftTier(threshold?: number): string {
  return threshold === undefined ? "未触发满赠" : `满 ${threshold}`;
}

function formatInventoryChange(changeQty: number): string {
  if (changeQty < 0) {
    return `扣减 ${Math.abs(changeQty)}`;
  }

  return `增加 ${changeQty}`;
}

function formatInventoryMetric(metric: InventorySummaryMetric): string {
  return `${metric.productCount} 个SKU / ${metric.quantity} 件`;
}

function shouldOpenInventoryDetails(order: Order, inventoryLogs: InventoryLog[]): boolean {
  return order.status !== "cancelled" && !inventoryLogs.some((log) => log.reason === "order_cancelled_rollback");
}

function productSnapshotLabel(item?: OrderItem): string {
  if (!item) {
    return "未知商品";
  }

  return item.productCodeSnapshot ? `${item.productCodeSnapshot} / ${item.spuSnapshot}` : item.spuSnapshot;
}

export default function OrderDetailDialog({
  order,
  orderItems,
  inventoryLogs,
  orderRefunds,
  onClose,
  onVoidOrder,
  isVoiding = false,
  onSaveRefund,
  isSavingRefund = false,
  onAdjustOrderItem,
  onAdjustWholeOrder,
  isAdjustingAccounting = false,
  canAdjustItemToCampaignGift = () => true,
  campaignGiftActivityName = ""
}: OrderDetailDialogProps) {
  const [isVoidConfirmOpen, setIsVoidConfirmOpen] = useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [adjustmentTarget, setAdjustmentTarget] = useState<"whole" | OrderItem>();
  const [adjustmentMode, setAdjustmentMode] = useState<AccountingAdjustmentMode>("sale");
  const [adjustmentNonSalesNote, setAdjustmentNonSalesNote] = useState("");
  const [adjustmentCampaignName, setAdjustmentCampaignName] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [adjustmentError, setAdjustmentError] = useState("");
  const [adjustmentSuccessMessage, setAdjustmentSuccessMessage] = useState("");
  const [cancelReason, setCancelReason] = useState<OrderCancelReason>("mistake");
  const [cancelNote, setCancelNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>(order.paymentMethod ?? "cash");
  const [refundReason, setRefundReason] = useState<RefundReason>("customer_return");
  const [refundNote, setRefundNote] = useState("");
  const [refundError, setRefundError] = useState("");
  const paymentLabel = order.paymentMethod ? paymentMethodLabels[order.paymentMethod] : "未记录";
  const canVoidOrder = order.status === "paid" && onVoidOrder;
  const refundedAmount = useMemo(
    () => orderRefunds.reduce((sum, refund) => sum + refund.amount, 0),
    [orderRefunds]
  );
  const remainingRefundAmount = Math.max(0, order.payableAmount - refundedAmount);
  const canSaveRefund =
    (order.status === "paid" || order.status === "cancelled") &&
    Boolean(onSaveRefund) &&
    remainingRefundAmount > 0;
  const shouldShowAfterSalesSection = order.status === "cancelled" || orderRefunds.length > 0 || canSaveRefund;
  const orderItemByProductId = useMemo(
    () => new Map(orderItems.map((item) => [item.productId, item])),
    [orderItems]
  );
  const inventorySummary = useMemo(() => buildOrderInventorySummary(inventoryLogs), [inventoryLogs]);
  const shouldShowInventoryDetailsOpen = useMemo(
    () => shouldOpenInventoryDetails(order, inventoryLogs),
    [order, inventoryLogs]
  );
  const normalizedOrderItems = useMemo(() => orderItems.map(getNormalizedOrderLine), [orderItems]);
  const derivedNature = deriveOrderNature(normalizedOrderItems);
  const canAdjustAccounting = Boolean(onAdjustOrderItem || onAdjustWholeOrder);
  const isNestedDialogOpen = isRefundDialogOpen || isVoidConfirmOpen || Boolean(adjustmentTarget);

  async function confirmVoidOrder() {
    if (!onVoidOrder) {
      return;
    }

    await onVoidOrder({
      cancelReason,
      cancelNote: cancelNote.trim() || undefined
    });
    setIsVoidConfirmOpen(false);
  }

  function openRefundDialog() {
    setAdjustmentSuccessMessage("");
    setRefundAmount("");
    setRefundMethod(order.paymentMethod ?? "cash");
    setRefundReason("customer_return");
    setRefundNote("");
    setRefundError("");
    setIsRefundDialogOpen(true);
  }

  async function confirmSaveRefund() {
    if (!onSaveRefund) {
      return;
    }

    const trimmedAmount = refundAmount.trim();
    if (!trimmedAmount) {
      setRefundError("请填写退款金额。");
      return;
    }

    const amount = Number(trimmedAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRefundError("退款金额必须大于 0。");
      return;
    }

    if (amount > remainingRefundAmount) {
      setRefundError("退款金额不能超过剩余可退金额。");
      return;
    }

    try {
      await onSaveRefund({
        amount,
        method: refundMethod,
        reason: refundReason,
        note: refundNote.trim() || undefined
      });
      setIsRefundDialogOpen(false);
    } catch {
      setRefundError("退款记录保存失败，请刷新后重试。");
    }
  }

  function openItemAdjustment(item: OrderItem) {
    const normalized = getNormalizedOrderLine(item);
    setAdjustmentSuccessMessage("");
    setAdjustmentTarget(item);
    setAdjustmentMode(
      normalized.revenueType === "sale" ? "sale" : normalized.nonSalesReason === "tier_gift" ? "campaign_gift" : normalized.nonSalesReason ?? "manual_gift"
    );
    setAdjustmentNonSalesNote(item.nonSalesNote ?? "");
    setAdjustmentCampaignName(item.campaignNameSnapshot ?? "");
    setAdjustmentNote("");
    setAdjustmentError("");
  }

  function openWholeOrderAdjustment() {
    setAdjustmentSuccessMessage("");
    setAdjustmentTarget("whole");
    setAdjustmentMode("sale");
    setAdjustmentNonSalesNote("");
    setAdjustmentCampaignName("");
    setAdjustmentNote("");
    setAdjustmentError("");
  }

  function closeAdjustmentDialog() {
    setAdjustmentTarget(undefined);
    setAdjustmentError("");
  }

  function pickAdjustmentText(setter: (value: string) => void, value: string) {
    setter(value);
    setAdjustmentError("");
  }

  function handleAdjustmentModeChange(mode: AccountingAdjustmentMode) {
    setAdjustmentMode(mode);
    setAdjustmentError("");

    if (mode === "campaign_gift" && !adjustmentCampaignName.trim()) {
      setAdjustmentCampaignName(campaignGiftActivityName.trim());
    }
  }

  function buildAdjustmentPayload(): AdjustOrderAccountingInput | undefined {
    const trimmedNonSalesNote = adjustmentNonSalesNote.trim();
    const trimmedCampaignName = adjustmentCampaignName.trim();
    const trimmedAdjustmentNote = adjustmentNote.trim();

    if (adjustmentMode === "manual_gift" || adjustmentMode === "other_non_sales") {
      if (!trimmedNonSalesNote) {
        setAdjustmentError("人工赠送和其他出库必须填写备注。");
        return undefined;
      }
    }

    if (adjustmentMode === "campaign_gift") {
      if (adjustmentTarget === "whole" && orderItems.some((item) => !canAdjustItemToCampaignGift(item))) {
        setAdjustmentError("整单包含非赠品商品，不能整体修正为运营赠礼。");
        return undefined;
      }

      if (typeof adjustmentTarget !== "string" && adjustmentTarget && !canAdjustItemToCampaignGift(adjustmentTarget)) {
        setAdjustmentError("该商品不是赠品商品，不能修正为运营赠礼。");
        return undefined;
      }
    }

    if (adjustmentMode === "sale") {
      return {
        orderId: order.id,
        revenueType: "sale",
        adjustmentNote: trimmedAdjustmentNote || undefined
      };
    }

    return {
      orderId: order.id,
      revenueType: "non_sales",
      nonSalesReason: adjustmentMode,
      nonSalesNote: trimmedNonSalesNote || undefined,
      campaignNameSnapshot: adjustmentMode === "campaign_gift" ? trimmedCampaignName || undefined : undefined,
      adjustmentNote: trimmedAdjustmentNote || undefined
    };
  }

  async function confirmAccountingAdjustment() {
    if (!adjustmentTarget) {
      return;
    }

    const payload = buildAdjustmentPayload();
    if (!payload) {
      return;
    }

    try {
      if (adjustmentTarget === "whole") {
        await onAdjustWholeOrder?.(payload);
      } else {
        await onAdjustOrderItem?.({
          ...payload,
          itemId: adjustmentTarget.id
        });
      }
      setAdjustmentSuccessMessage("统计口径已修正，原始支付、退款和库存流水未改动。");
      closeAdjustmentDialog();
    } catch {
      setAdjustmentError("统计口径修正失败，请刷新后重试。");
    }
  }

  return (
    <div className="modalBackdrop" role="presentation">
      <section
        className="orderDetailDialog"
        role={isNestedDialogOpen ? undefined : "dialog"}
        aria-modal={isNestedDialogOpen ? undefined : "true"}
        aria-label={`订单详情 ${order.orderNo}`}
      >
        <header className="dialogHeader">
          <div>
            <p className="eyebrow">Order Detail</p>
            <h2 className="notranslate" translate="no">
              {order.orderNo}
            </h2>
            <p>
              <span>{orderStatusLabels[order.status]}</span>
              <span> / </span>
              <span>{paymentLabel}</span>
            </p>
          </div>
          <button type="button" className="iconButton" aria-label="关闭订单详情" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="orderDetailBody">
          {adjustmentSuccessMessage ? (
            <p className="successBanner" role="status">
              {adjustmentSuccessMessage}
            </p>
          ) : null}
          <section className="orderDetailSection" aria-labelledby="order-detail-basic-title">
            <div className="sectionTitle">
              <ReceiptText size={19} aria-hidden="true" />
              <div>
                <h2 id="order-detail-basic-title">基本信息</h2>
                <p>订单金额、收款时间和满赠结果</p>
              </div>
            </div>
            <dl className="orderDetailMetrics">
              <div>
                <dt>创建时间</dt>
                <dd>{formatDateTime(order.createdAt)}</dd>
              </div>
              <div>
                <dt>支付时间</dt>
                <dd>{formatDateTime(order.paidAt)}</dd>
              </div>
              <div>
                <dt>应收</dt>
                <dd>
                  <NoTranslate>{formatMoney(order.payableAmount)}</NoTranslate>
                </dd>
              </div>
              <div>
                <dt>原价</dt>
                <dd>
                  <NoTranslate>{formatMoney(order.subtotalBeforeDiscount)}</NoTranslate>
                </dd>
              </div>
              <div>
                <dt>优惠</dt>
                <dd>
                  <NoTranslate>{formatMoney(order.discountAmount)}</NoTranslate>
                </dd>
              </div>
              <div>
                <dt>订单性质</dt>
                <dd>{orderNatureLabels[derivedNature]}</dd>
              </div>
              <div>
                <dt>满赠档位</dt>
                <dd>{formatGiftTier(order.triggeredGiftTier)}</dd>
              </div>
            </dl>
          </section>

          {shouldShowAfterSalesSection ? (
            <section className="orderDetailSection" aria-labelledby="order-detail-after-sales-title">
              <div className="sectionTitle">
                <ReceiptText size={19} aria-hidden="true" />
                <div>
                  <h2 id="order-detail-after-sales-title">售后记录</h2>
                  <p>作废处理和人工退款记录</p>
                </div>
              </div>
              <dl className="orderDetailMetrics afterSalesMetrics" aria-label="售后摘要指标">
                {order.status === "cancelled" ? (
                  <>
                    <div>
                      <dt>作废时间</dt>
                      <dd>{formatDateTime(order.cancelledAt)}</dd>
                    </div>
                    <div>
                      <dt>作废原因</dt>
                      <dd>{cancelReasonLabels[order.cancelReason ?? "mistake"]}</dd>
                    </div>
                    <div>
                      <dt>作废备注</dt>
                      <dd>{order.cancelNote || "未记录"}</dd>
                    </div>
                  </>
                ) : null}
                <div>
                  <dt>累计退款</dt>
                  <dd>
                    <NoTranslate>{formatMoney(refundedAmount)}</NoTranslate>
                  </dd>
                </div>
                <div>
                  <dt>剩余可退</dt>
                  <dd>
                    <NoTranslate>{formatMoney(remainingRefundAmount)}</NoTranslate>
                  </dd>
                </div>
              </dl>
              {orderRefunds.length > 0 ? (
                <div className="refundRecordList" role="list" aria-label="人工退款记录">
                  {orderRefunds.map((refund) => (
                    <article className="refundRecordRow" role="listitem" key={refund.id}>
                      <div>
                        <span>退款金额</span>
                        <strong>
                          <NoTranslate>{formatMoney(refund.amount)}</NoTranslate>
                        </strong>
                      </div>
                      <div>
                        <span>退款方式</span>
                        <strong>{paymentMethodLabels[refund.method]}</strong>
                      </div>
                      <div>
                        <span>退款原因</span>
                        <strong>{refundReasonLabels[refund.reason]}</strong>
                      </div>
                      <div>
                        <span>记录时间</span>
                        <strong>{formatDateTime(refund.createdAt)}</strong>
                      </div>
                      <div className="refundNoteCell">
                        <span>退款备注</span>
                        <strong>{refund.note || "未记录"}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="orderDetailSection" aria-labelledby="order-detail-items-title">
            <div className="sectionTitle">
              <ClipboardList size={19} aria-hidden="true" />
              <div>
                <h2 id="order-detail-items-title">商品明细</h2>
                <p>按订单保存时的商品快照展示</p>
              </div>
            </div>
            <div className="orderDetailList" role="list" aria-label="订单商品明细">
              {normalizedOrderItems.map((item) => (
                <article className="orderDetailLine" role="listitem" key={item.id}>
                  <div className="orderDetailLineMain">
                    <strong>{item.productNameSnapshot}</strong>
                    <span>{orderLineTypeLabels[item.lineType]}</span>
                  </div>
                  <div>
                    <span>SPU</span>
                    <strong>{item.spuSnapshot}</strong>
                  </div>
                  <div>
                    <span>商品编码</span>
                    <strong className="notranslate" translate="no">
                      {item.productCodeSnapshot || "未设置"}
                    </strong>
                  </div>
                  <div>
                    <span>数量</span>
                    <strong>x{item.quantity}</strong>
                  </div>
                  <div>
                    <span>收入类型</span>
                    <strong>{orderLineRevenueTypeLabels[item.revenueType]}</strong>
                  </div>
                  <div>
                    <span>非销售原因</span>
                    <strong>{item.revenueType === "non_sales" && item.nonSalesReason ? nonSalesReasonLabels[item.nonSalesReason] : "无"}</strong>
                  </div>
                  <div>
                    <span>运营活动快照</span>
                    <strong>{item.campaignNameSnapshot || "未记录"}</strong>
                  </div>
                  <div>
                    <span>非销售备注</span>
                    <strong>{item.nonSalesNote || "未记录"}</strong>
                  </div>
                  <div>
                    <span>统计小计</span>
                    <strong>
                      <NoTranslate>{`统计小计 ${formatMoney(item.statisticalSubtotal)}`}</NoTranslate>
                    </strong>
                  </div>
                  <div>
                    <span>优惠让利</span>
                    <strong>
                      <NoTranslate>{`优惠让利 ${formatMoney(item.discountGiveawayAmount)}`}</NoTranslate>
                    </strong>
                  </div>
                  <div>
                    <span>是否修正</span>
                    <strong>{item.adjustedAt ? "已修正" : "未修正"}</strong>
                  </div>
                  <div>
                    <span>单价</span>
                    <strong>
                      <NoTranslate>{`单价 ${formatMoney(item.finalUnitPrice)}`}</NoTranslate>
                    </strong>
                  </div>
                  <div>
                    <span>原价</span>
                    <strong>
                      <NoTranslate>{`原价 ${formatMoney(item.originalUnitPrice)}`}</NoTranslate>
                    </strong>
                  </div>
                  <div>
                    <span>小计</span>
                    <strong>
                      <NoTranslate>{`小计 ${formatMoney(item.lineTotal)}`}</NoTranslate>
                    </strong>
                  </div>
                  <div className="orderDetailLineCost">
                    <span>成本/毛利</span>
                    {typeof item.costTotal === "number" && typeof item.grossProfit === "number" ? (
                      <>
                        <strong>
                          <NoTranslate>{`成本 ${formatMoney(item.costTotal)}`}</NoTranslate>
                        </strong>
                        <strong>
                          <NoTranslate>{`毛利 ${formatMoney(item.grossProfit)}`}</NoTranslate>
                        </strong>
                      </>
                    ) : (
                      <strong>缺少成本快照</strong>
                    )}
                  </div>
                  {onAdjustOrderItem ? (
                    <div>
                      <span>统计修正</span>
                      <button
                        type="button"
                        className="secondaryButton"
                        disabled={isAdjustingAccounting}
                        onClick={() => openItemAdjustment(item)}
                      >
                        修正统计口径
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="orderDetailSection" aria-labelledby="order-detail-inventory-title">
            <div className="sectionTitle">
              <PackageCheck size={19} aria-hidden="true" />
              <div>
                <h2 id="order-detail-inventory-title">库存摘要</h2>
                <p>先看汇总，完整流水可展开复核</p>
              </div>
            </div>
            <div className="inventorySummaryGrid" aria-label="库存摘要指标">
              <div>
                <span>售卖扣减</span>
                <strong>{formatInventoryMetric(inventorySummary.paidDeduction)}</strong>
              </div>
              <div>
                <span>赠品扣减</span>
                <strong>{formatInventoryMetric(inventorySummary.giftDeduction)}</strong>
              </div>
              <div>
                <span>作废回滚</span>
                <strong>{formatInventoryMetric(inventorySummary.rollback)}</strong>
              </div>
            </div>
            <details className="inventoryDetails" open={shouldShowInventoryDetailsOpen}>
              <summary>{`完整库存流水（${inventoryLogs.length} 条）`}</summary>
              {inventoryLogs.length > 0 ? (
                <div className="orderDetailList" role="list" aria-label="完整库存流水">
                  {inventoryLogs.map((log) => {
                    const item = orderItemByProductId.get(log.productId);

                    return (
                      <article className="inventoryLogRow" role="listitem" key={log.id}>
                        <div className="inventoryProductCell">
                          <span>商品</span>
                          <strong>{item?.productNameSnapshot ?? log.productId}</strong>
                          {item ? <em>{productSnapshotLabel(item)}</em> : null}
                        </div>
                        <div>
                          <span>库存原因</span>
                          <strong>{inventoryReasonLabels[log.reason]}</strong>
                        </div>
                        <div>
                          <span>数量</span>
                          <strong>{formatInventoryChange(log.changeQty)}</strong>
                        </div>
                        <div>
                          <span>库存</span>
                          <strong>{`库存 ${log.beforeQty} -> ${log.afterQty}`}</strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="emptyStateText">暂无库存流水。</p>
              )}
            </details>
          </section>

          {canVoidOrder || canSaveRefund || canAdjustAccounting ? (
            <section className="orderDetailActions" aria-label="订单操作">
              <div className="orderDetailActionButtons" role="group" aria-label="订单操作按钮">
                {onAdjustWholeOrder ? (
                  <button
                    type="button"
                    className="secondaryButton"
                    disabled={isAdjustingAccounting}
                    onClick={openWholeOrderAdjustment}
                  >
                    整单修正统计口径
                  </button>
                ) : null}
                {canSaveRefund ? (
                  <button
                    type="button"
                    className="secondaryButton"
                    disabled={isSavingRefund}
                    onClick={openRefundDialog}
                  >
                    记录退款
                  </button>
                ) : null}
                {canVoidOrder ? (
                  <button
                    type="button"
                    className="dangerButton"
                    disabled={isVoiding}
                    onClick={() => setIsVoidConfirmOpen(true)}
                  >
                    作废订单
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </section>

      {isVoidConfirmOpen ? (
        <div className="modalBackdrop nestedModalBackdrop" role="presentation">
          <section className="confirmDialog" role="dialog" aria-modal="true" aria-label="确认作废订单">
            <div>
              <p className="eyebrow">Void Order</p>
              <h2>确认作废订单</h2>
            </div>
            <p className="warningText">作废后订单会标记为已取消，并自动回滚本订单扣减的库存。此操作不可撤销。</p>
            <label className="dialogField">
              <span>作废原因</span>
              <select
                aria-label="作废原因"
                value={cancelReason}
                disabled={isVoiding}
                onChange={(event) => setCancelReason(event.target.value as OrderCancelReason)}
              >
                {cancelReasonOptions.map((reason) => (
                  <option key={reason} value={reason}>
                    {cancelReasonLabels[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="dialogField">
              <span>作废备注</span>
              <textarea
                aria-label="作废备注"
                value={cancelNote}
                disabled={isVoiding}
                maxLength={120}
                rows={3}
                onChange={(event) => setCancelNote(event.target.value)}
                placeholder="可选"
              />
            </label>
            <p className="fieldHint">{order.orderNo}</p>
            <div className="dialogActions">
              <button
                type="button"
                className="secondaryButton"
                disabled={isVoiding}
                onClick={() => setIsVoidConfirmOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="dangerButton"
                disabled={isVoiding}
                onClick={() => void confirmVoidOrder()}
              >
                {isVoiding ? "作废中..." : "确认作废"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isRefundDialogOpen ? (
        <div className="modalBackdrop nestedModalBackdrop" role="presentation">
          <section className="confirmDialog" role="dialog" aria-modal="true" aria-label="记录人工退款">
            <div>
              <p className="eyebrow">Manual Refund</p>
              <h2>记录人工退款</h2>
            </div>
            <p className="fieldHint">{`剩余可退 ${formatMoney(remainingRefundAmount)}`}</p>
            <label className="dialogField">
              <span>退款金额</span>
              <input
                aria-label="退款金额"
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                disabled={isSavingRefund}
                onChange={(event) => {
                  setRefundAmount(event.target.value);
                  setRefundError("");
                }}
                placeholder="0.00"
              />
            </label>
            <label className="dialogField">
              <span>退款方式</span>
              <select
                aria-label="退款方式"
                value={refundMethod}
                disabled={isSavingRefund}
                onChange={(event) => setRefundMethod(event.target.value as PaymentMethod)}
              >
                {paymentMethodOptions.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabels[method]}
                  </option>
                ))}
              </select>
            </label>
            <label className="dialogField">
              <span>退款原因</span>
              <select
                aria-label="退款原因"
                value={refundReason}
                disabled={isSavingRefund}
                onChange={(event) => setRefundReason(event.target.value as RefundReason)}
              >
                {refundReasonOptions.map((reason) => (
                  <option key={reason} value={reason}>
                    {refundReasonLabels[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="dialogField">
              <span>退款备注</span>
              <textarea
                aria-label="退款备注"
                value={refundNote}
                disabled={isSavingRefund}
                maxLength={120}
                rows={3}
                onChange={(event) => setRefundNote(event.target.value)}
                placeholder="可选"
              />
            </label>
            {refundError ? <p className="fieldError">{refundError}</p> : null}
            <div className="dialogActions">
              <button
                type="button"
                className="secondaryButton"
                disabled={isSavingRefund}
                onClick={() => setIsRefundDialogOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="primaryButton"
                disabled={isSavingRefund}
                onClick={() => void confirmSaveRefund()}
              >
                {isSavingRefund ? "保存中..." : "保存退款记录"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {adjustmentTarget ? (
        <div className="modalBackdrop nestedModalBackdrop" role="presentation">
          <section
            className="confirmDialog"
            role="dialog"
            aria-modal="true"
            aria-label={adjustmentTarget === "whole" ? "整单修正统计口径" : "修正单行统计口径"}
          >
            <div>
              <p className="eyebrow">Accounting</p>
              <h2>{adjustmentTarget === "whole" ? "整单修正统计口径" : "修正单行统计口径"}</h2>
            </div>
            <p className="fieldHint">
              {adjustmentTarget === "whole" ? "仅修正订单明细统计口径，不改动原始支付、退款和库存流水。" : adjustmentTarget.productNameSnapshot}
            </p>
            <label className="dialogField">
              <span>修正为</span>
              <select
                aria-label="修正为"
                value={adjustmentMode}
                disabled={isAdjustingAccounting}
                onChange={(event) => handleAdjustmentModeChange(event.target.value as AccountingAdjustmentMode)}
              >
                {accountingAdjustmentOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {accountingAdjustmentLabels[mode]}
                  </option>
                ))}
              </select>
            </label>
            {adjustmentMode === "campaign_gift" ? (
              <div className="dialogField">
                <label>
                  <span>运营活动快照</span>
                  <input
                    aria-label="运营活动快照"
                    value={adjustmentCampaignName}
                    disabled={isAdjustingAccounting}
                    onChange={(event) => {
                      setAdjustmentCampaignName(event.target.value);
                      setAdjustmentError("");
                    }}
                    placeholder="可选"
                  />
                </label>
                <QuickOptionGroup
                  label="运营活动快照快速选项"
                  options={[campaignGiftActivityName, ...defaultCampaignActivityOptions]}
                  onPick={(value) => pickAdjustmentText(setAdjustmentCampaignName, value)}
                />
              </div>
            ) : null}
            {adjustmentMode !== "sale" ? (
              <div className="dialogField">
                <label>
                  <span>{adjustmentMode === "manual_gift" || adjustmentMode === "other_non_sales" ? "非销售备注（必填）" : "非销售备注"}</span>
                  <textarea
                    aria-label="非销售备注"
                    value={adjustmentNonSalesNote}
                    disabled={isAdjustingAccounting}
                    maxLength={120}
                    rows={3}
                    onChange={(event) => {
                      setAdjustmentNonSalesNote(event.target.value);
                      setAdjustmentError("");
                    }}
                    placeholder={adjustmentMode === "manual_gift" || adjustmentMode === "other_non_sales" ? "必填" : "可选"}
                  />
                </label>
                <QuickOptionGroup
                  label="非销售备注快速选项"
                  options={
                    adjustmentMode === "campaign_gift"
                      ? campaignNoteOptions
                      : adjustmentMode === "manual_gift"
                        ? manualGiftNoteOptions
                        : otherNonSalesNoteOptions
                  }
                  onPick={(value) => pickAdjustmentText(setAdjustmentNonSalesNote, value)}
                />
              </div>
            ) : null}
            <div className="dialogField">
              <label>
                <span>修正备注</span>
                <textarea
                  aria-label="修正备注"
                  value={adjustmentNote}
                  disabled={isAdjustingAccounting}
                  maxLength={120}
                  rows={3}
                  onChange={(event) => setAdjustmentNote(event.target.value)}
                  placeholder="可选"
                />
              </label>
              <QuickOptionGroup
                label="修正备注快速选项"
                options={adjustmentNoteOptions}
                onPick={(value) => pickAdjustmentText(setAdjustmentNote, value)}
              />
            </div>
            <p className="dialogErrorSlot" role={adjustmentError ? "alert" : undefined} aria-label="修正错误提示">
              {adjustmentError}
            </p>
            <div className="dialogActions">
              <button
                type="button"
                className="secondaryButton"
                disabled={isAdjustingAccounting}
                onClick={closeAdjustmentDialog}
              >
                取消
              </button>
              <button
                type="button"
                className="primaryButton"
                disabled={isAdjustingAccounting}
                onClick={() => void confirmAccountingAdjustment()}
              >
                {isAdjustingAccounting ? "修正中..." : "确认修正"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
