import { ClipboardList, PackageCheck, ReceiptText, X } from "lucide-react";
import { formatMoney } from "../domain/money";
import { orderStatusLabels, paymentMethodLabels } from "../domain/orderHistory";
import type { InventoryLog, Order, OrderItem, OrderLineType } from "../domain/types";

type OrderDetailDialogProps = {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  onClose: () => void;
};

const orderLineTypeLabels: Record<OrderLineType, string> = {
  normal: "普通商品",
  discount_addon: "加购优惠",
  gift: "赠品"
};

const inventoryReasonLabels: Record<InventoryLog["reason"], string> = {
  order_paid: "订单扣减",
  gift_order_paid: "赠品扣减",
  manual_adjust: "手动调整"
};

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

export default function OrderDetailDialog({ order, orderItems, inventoryLogs, onClose }: OrderDetailDialogProps) {
  const paymentLabel = order.paymentMethod ? paymentMethodLabels[order.paymentMethod] : "未记录";

  return (
    <div className="modalBackdrop" role="presentation">
      <section
        className="orderDetailDialog"
        role="dialog"
        aria-modal="true"
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
                </article>
              ))}
            </div>
          </section>

          <section className="orderDetailSection" aria-labelledby="order-detail-inventory-title">
            <div className="sectionTitle">
              <PackageCheck size={19} aria-hidden="true" />
              <div>
                <h2 id="order-detail-inventory-title">库存流水</h2>
                <p>支付入账后产生的库存扣减摘要</p>
              </div>
            </div>
            <div className="orderDetailList" role="list" aria-label="库存流水摘要">
              {inventoryLogs.map((log) => (
                <article className="inventoryLogRow" role="listitem" key={log.id}>
                  <div>
                    <span>productId</span>
                    <strong>{log.productId}</strong>
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
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
