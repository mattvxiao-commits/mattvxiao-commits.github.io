import { ClipboardList, PackageCheck, ReceiptText, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "../domain/money";
import { buildOrderInventorySummary, type InventorySummaryMetric } from "../domain/orderInventorySummary";
import { orderStatusLabels, paymentMethodLabels } from "../domain/orderHistory";
import type { InventoryLog, Order, OrderCancelReason, OrderItem, OrderLineType } from "../domain/types";

type VoidOrderInput = {
  cancelReason: OrderCancelReason;
  cancelNote?: string;
};

type OrderDetailDialogProps = {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  onClose: () => void;
  onVoidOrder?: (input: VoidOrderInput) => Promise<void> | void;
  isVoiding?: boolean;
};

const orderLineTypeLabels: Record<OrderLineType, string> = {
  normal: "普通商品",
  discount_addon: "加购优惠",
  gift: "赠品"
};

const inventoryReasonLabels: Record<InventoryLog["reason"], string> = {
  order_paid: "订单扣减",
  gift_order_paid: "赠品扣减",
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

const cancelReasonOptions = Object.keys(cancelReasonLabels) as OrderCancelReason[];

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
  onClose,
  onVoidOrder,
  isVoiding = false
}: OrderDetailDialogProps) {
  const [isVoidConfirmOpen, setIsVoidConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<OrderCancelReason>("mistake");
  const [cancelNote, setCancelNote] = useState("");
  const paymentLabel = order.paymentMethod ? paymentMethodLabels[order.paymentMethod] : "未记录";
  const canVoidOrder = order.status === "paid" && onVoidOrder;
  const orderItemByProductId = useMemo(
    () => new Map(orderItems.map((item) => [item.productId, item])),
    [orderItems]
  );
  const inventorySummary = useMemo(() => buildOrderInventorySummary(inventoryLogs), [inventoryLogs]);
  const shouldShowInventoryDetailsOpen = useMemo(
    () => shouldOpenInventoryDetails(order, inventoryLogs),
    [order, inventoryLogs]
  );

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

  return (
    <div className="modalBackdrop" role="presentation">
      <section
        className="orderDetailDialog"
        role="dialog"
        aria-modal={isVoidConfirmOpen ? undefined : "true"}
        aria-label={`订单详情 ${order.orderNo}`}
      >
        <header className="dialogHeader">
          <div>
            <p className="eyebrow">Order Detail</p>
            <h2>{order.orderNo}</h2>
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
                <dd>{formatMoney(order.payableAmount)}</dd>
              </div>
              <div>
                <dt>原价</dt>
                <dd>{formatMoney(order.subtotalBeforeDiscount)}</dd>
              </div>
              <div>
                <dt>优惠</dt>
                <dd>{formatMoney(order.discountAmount)}</dd>
              </div>
              <div>
                <dt>满赠档位</dt>
                <dd>{formatGiftTier(order.triggeredGiftTier)}</dd>
              </div>
            </dl>
          </section>

          {order.status === "cancelled" ? (
            <section className="orderDetailSection" aria-labelledby="order-detail-after-sales-title">
              <div className="sectionTitle">
                <ReceiptText size={19} aria-hidden="true" />
                <div>
                  <h2 id="order-detail-after-sales-title">售后记录</h2>
                  <p>作废原因和处理备注</p>
                </div>
              </div>
              <dl className="orderDetailMetrics">
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
              </dl>
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
              {orderItems.map((item) => (
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
                    <strong>{item.productCodeSnapshot || "未设置"}</strong>
                  </div>
                  <div>
                    <span>数量</span>
                    <strong>x{item.quantity}</strong>
                  </div>
                  <div>
                    <span>单价</span>
                    <strong>{`单价 ${formatMoney(item.finalUnitPrice)}`}</strong>
                  </div>
                  <div>
                    <span>原价</span>
                    <strong>{`原价 ${formatMoney(item.originalUnitPrice)}`}</strong>
                  </div>
                  <div>
                    <span>小计</span>
                    <strong>{`小计 ${formatMoney(item.lineTotal)}`}</strong>
                  </div>
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

          {canVoidOrder ? (
            <section className="orderDetailActions" aria-label="订单操作">
              <button
                type="button"
                className="dangerButton"
                disabled={isVoiding}
                onClick={() => setIsVoidConfirmOpen(true)}
              >
                作废订单
              </button>
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
    </div>
  );
}
