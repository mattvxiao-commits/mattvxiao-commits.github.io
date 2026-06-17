import type { Order, OrderItem, OrderRefund, PaymentMethod, Product } from "./types";

export type DashboardInput = {
  day: Date;
  orders: Order[];
  orderItems: OrderItem[];
  refunds: OrderRefund[];
  products: Product[];
};

export type DashboardSummary = {
  paidAmount: number;
  refundAmount: number;
  netAmount: number;
  paidOrderCount: number;
  cancelledOrderCount: number;
  partialRefundOrderCount: number;
  fullyRefundedOrderCount: number;
  notedCancelledOrderCount: number;
};

export type DashboardSkuRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  quantity: number;
  amount: number;
};

export type DashboardGiftRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  quantity: number;
};

export type DashboardLowStockRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  stockQty: number;
  isSellable: boolean;
  isGiftEligible: boolean;
};

export type DashboardExceptionBadge = "已作废" | "部分退款" | "已退款" | "有备注" | "赠品异常";

export type DashboardExceptionRow = {
  orderId: string;
  orderNo: string;
  time: string;
  paymentMethod?: PaymentMethod;
  payableAmount: number;
  badges: DashboardExceptionBadge[];
};

export type DashboardModel = {
  summary: DashboardSummary;
  topSellingSkuRows: DashboardSkuRow[];
  giftConsumptionRows: DashboardGiftRow[];
  lowStockRows: DashboardLowStockRow[];
  exceptionRows: DashboardExceptionRow[];
};

function isSameLocalDay(value: string | undefined, day: Date): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function orderBusinessTime(order: Order): string {
  return order.paidAt ?? order.createdAt;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumRefundsByOrder(refunds: OrderRefund[]): Map<string, number> {
  return refunds.reduce((totals, refund) => {
    totals.set(refund.orderId, roundMoney((totals.get(refund.orderId) ?? 0) + refund.amount));
    return totals;
  }, new Map<string, number>());
}

function sortByQuantityThenName<T extends { quantity: number; productName: string }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return left.productName.localeCompare(right.productName, "zh-Hans-CN");
  });
}

function buildTopSellingSkuRows(todayPaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardSkuRow[] {
  const rowsByProduct = new Map<string, DashboardSkuRow>();

  for (const item of orderItems) {
    if (!todayPaidOrderIds.has(item.orderId) || item.lineType === "gift") {
      continue;
    }

    const existing = rowsByProduct.get(item.productId);
    rowsByProduct.set(item.productId, {
      productId: item.productId,
      productName: existing?.productName ?? item.productNameSnapshot,
      spu: existing?.spu ?? item.spuSnapshot,
      productCode: existing?.productCode ?? item.productCodeSnapshot,
      quantity: (existing?.quantity ?? 0) + item.quantity,
      amount: roundMoney((existing?.amount ?? 0) + item.lineTotal)
    });
  }

  return sortByQuantityThenName([...rowsByProduct.values()]);
}

function buildGiftConsumptionRows(todayPaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardGiftRow[] {
  const rowsByProduct = new Map<string, DashboardGiftRow>();

  for (const item of orderItems) {
    if (!todayPaidOrderIds.has(item.orderId) || item.lineType !== "gift") {
      continue;
    }

    const existing = rowsByProduct.get(item.productId);
    rowsByProduct.set(item.productId, {
      productId: item.productId,
      productName: existing?.productName ?? item.productNameSnapshot,
      spu: existing?.spu ?? item.spuSnapshot,
      productCode: existing?.productCode ?? item.productCodeSnapshot,
      quantity: (existing?.quantity ?? 0) + item.quantity
    });
  }

  return sortByQuantityThenName([...rowsByProduct.values()]);
}

function buildLowStockRows(products: Product[]): DashboardLowStockRow[] {
  return products
    .filter((product) => product.status === "active" && product.stockQty < 3)
    .sort((left, right) => {
      if (left.stockQty !== right.stockQty) {
        return left.stockQty - right.stockQty;
      }

      return left.name.localeCompare(right.name, "zh-Hans-CN");
    })
    .map((product) => ({
      productId: product.id,
      productName: product.name,
      spu: product.spu,
      productCode: product.productCode,
      stockQty: product.stockQty,
      isSellable: product.isSellable,
      isGiftEligible: product.isGiftEligible
    }));
}

function isTodayCancelledOrder(order: Order, day: Date): boolean {
  return order.status === "cancelled" && isSameLocalDay(order.cancelledAt, day);
}

function getExceptionTime(order: Order): string {
  return order.cancelledAt ?? order.paidAt ?? order.createdAt;
}

function buildExceptionRows(
  orders: Order[],
  refundTotalsByOrder: Map<string, number>,
  todayPaidOrderIds: Set<string>,
  day: Date
): DashboardExceptionRow[] {
  return orders
    .filter((order) => {
      const refundedAmount = refundTotalsByOrder.get(order.id) ?? 0;
      return isTodayCancelledOrder(order, day) || (todayPaidOrderIds.has(order.id) && (refundedAmount > 0 || order.giftStockWarning));
    })
    .map((order) => {
      const refundedAmount = refundTotalsByOrder.get(order.id) ?? 0;
      const badges: DashboardExceptionBadge[] = [];

      if (order.status === "cancelled") {
        badges.push("已作废");
      }

      if (refundedAmount > 0 && refundedAmount < order.payableAmount) {
        badges.push("部分退款");
      }

      if (order.payableAmount > 0 && refundedAmount >= order.payableAmount) {
        badges.push("已退款");
      }

      if (order.cancelNote?.trim()) {
        badges.push("有备注");
      }

      if (order.giftStockWarning) {
        badges.push("赠品异常");
      }

      return {
        orderId: order.id,
        orderNo: order.orderNo,
        time: getExceptionTime(order),
        paymentMethod: order.paymentMethod,
        payableAmount: order.payableAmount,
        badges
      };
    })
    .filter((row) => row.badges.length > 0)
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .slice(0, 8);
}

export function buildDashboardModel(input: DashboardInput): DashboardModel {
  const todayPaidOrders = input.orders.filter(
    (order) => order.status === "paid" && isSameLocalDay(orderBusinessTime(order), input.day)
  );
  const todayPaidOrderIds = new Set(todayPaidOrders.map((order) => order.id));
  const refundTotalsByOrder = sumRefundsByOrder(input.refunds);
  const paidAmount = todayPaidOrders.reduce((sum, order) => roundMoney(sum + order.payableAmount), 0);
  const refundAmount = input.refunds
    .filter((refund) => isSameLocalDay(refund.createdAt, input.day))
    .reduce((sum, refund) => roundMoney(sum + refund.amount), 0);
  const todayCancelledOrders = input.orders.filter((order) => isTodayCancelledOrder(order, input.day));
  const paidRefundStates = todayPaidOrders.map((order) => ({
    order,
    refundedAmount: refundTotalsByOrder.get(order.id) ?? 0
  }));

  return {
    summary: {
      paidAmount,
      refundAmount,
      netAmount: roundMoney(paidAmount - refundAmount),
      paidOrderCount: todayPaidOrders.length,
      cancelledOrderCount: todayCancelledOrders.length,
      partialRefundOrderCount: paidRefundStates.filter(
        ({ order, refundedAmount }) => refundedAmount > 0 && refundedAmount < order.payableAmount
      ).length,
      fullyRefundedOrderCount: paidRefundStates.filter(
        ({ order, refundedAmount }) => order.payableAmount > 0 && refundedAmount >= order.payableAmount
      ).length,
      notedCancelledOrderCount: todayCancelledOrders.filter((order) => Boolean(order.cancelNote?.trim())).length
    },
    topSellingSkuRows: buildTopSellingSkuRows(todayPaidOrderIds, input.orderItems),
    giftConsumptionRows: buildGiftConsumptionRows(todayPaidOrderIds, input.orderItems),
    lowStockRows: buildLowStockRows(input.products),
    exceptionRows: buildExceptionRows(input.orders, refundTotalsByOrder, todayPaidOrderIds, input.day)
  };
}
