import type { Order, OrderCancelReason, OrderRefund, OrderStatus, PaymentMethod } from "./types";

export type OrderDateRange = "today" | "yesterday" | "last7" | "last30" | "all";
export type OrderHistoryStatusFilter = OrderStatus | "all";
export type OrderHistoryPaymentFilter = PaymentMethod | "all";

export type OrderHistoryFilters = {
  query: string;
  dateRange: OrderDateRange;
  status: OrderHistoryStatusFilter;
  paymentMethod: OrderHistoryPaymentFilter;
};

export const dateRangeLabels: Record<OrderDateRange, string> = {
  today: "今日",
  yesterday: "昨日",
  last7: "近 7 天",
  last30: "近 30 天",
  all: "全部"
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "待支付",
  paid: "已支付",
  cancelled: "已取消"
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  wechat: "微信",
  alipay: "支付宝",
  cash: "现金",
  other: "其他"
};

export const orderCancelReasonLabels: Record<OrderCancelReason, string> = {
  mistake: "误操作",
  customer_cancelled: "客户取消",
  duplicate_order: "重复下单",
  inventory_issue: "库存/赠品异常",
  payment_issue: "收款异常",
  other: "其他"
};

export type OrderAfterSalesBadgeTone = "danger" | "neutral";

export type OrderAfterSalesBadge = {
  label: string;
  tone: OrderAfterSalesBadgeTone;
};

export function getOrderAfterSalesBadges(order: Order, refunds: OrderRefund[] = []): OrderAfterSalesBadge[] {
  const badges: OrderAfterSalesBadge[] = [];

  if (order.status === "cancelled") {
    badges.push(
      { label: "已作废", tone: "danger" },
      { label: orderCancelReasonLabels[order.cancelReason ?? "mistake"], tone: "neutral" }
    );

    if (order.cancelNote?.trim()) {
      badges.push({ label: "有备注", tone: "neutral" });
    }
  }

  const refundedAmount = refunds
    .filter((refund) => refund.orderId === order.id)
    .reduce((sum, refund) => sum + refund.amount, 0);

  if (refundedAmount > 0) {
    const isFullyRefunded = refundedAmount >= order.payableAmount;
    badges.push({
      label: isFullyRefunded ? "已退款" : "部分退款",
      tone: isFullyRefunded ? "danger" : "neutral"
    });
  }

  return badges;
}

export function orderBusinessTime(order: Order): string {
  return order.paidAt ?? order.createdAt;
}

export function filterAndSortOrders(orders: Order[], filters: OrderHistoryFilters, now = new Date()): Order[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return orders
    .filter((order) => {
      if (query && !order.orderNo.toLocaleLowerCase().includes(query)) {
        return false;
      }

      if (filters.status !== "all" && order.status !== filters.status) {
        return false;
      }

      if (filters.paymentMethod !== "all" && order.paymentMethod !== filters.paymentMethod) {
        return false;
      }

      return isInDateRange(orderBusinessTime(order), filters.dateRange, now);
    })
    .sort((left, right) => orderBusinessTime(right).localeCompare(orderBusinessTime(left)));
}

function isInDateRange(value: string, range: OrderDateRange, now: Date): boolean {
  if (range === "all") {
    return true;
  }

  const date = startOfLocalDay(new Date(value));
  const today = startOfLocalDay(now);

  if (range === "today") {
    return date.getTime() === today.getTime();
  }

  const yesterday = addLocalDays(today, -1);
  if (range === "yesterday") {
    return date.getTime() === yesterday.getTime();
  }

  const days = range === "last7" ? 6 : 29;
  const start = addLocalDays(today, -days);

  return date.getTime() >= start.getTime() && date.getTime() <= today.getTime();
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
