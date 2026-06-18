import type { Order, OrderItem, OrderRefund, PaymentMethod, Product } from "./types";

export type DashboardRangePreset = "today" | "yesterday" | "last3days" | "last7days" | "custom";

export type DashboardDateRange = {
  preset: DashboardRangePreset;
  startAt: string;
  endAt: string;
  label: string;
  isCurrentRange: boolean;
};

export type DashboardCustomRangeInput = {
  startDate: string;
  endDate: string;
};

export type DashboardInput = {
  dateRange: DashboardDateRange;
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

export type DashboardOperationsSummary = {
  soldQuantity: number;
  giftQuantity: number;
  outboundQuantity: number;
  averageOrderValue: number;
};

export type DashboardPaymentMethodKey = PaymentMethod | "unrecorded";

export type DashboardPaymentMethodRow = {
  method: DashboardPaymentMethodKey;
  label: string;
  orderCount: number;
  amount: number;
};

export type DashboardPromotionSummary = {
  addonQuantity: number;
  addonDiscountAmount: number;
  addonOrderCount: number;
  giftTriggeredOrderCount: number;
};

export type DashboardGiftTierRow = {
  threshold: number;
  orderCount: number;
};

export type DashboardSkuRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  quantity: number;
  amount: number;
};

export type DashboardSpuRow = {
  spu: string;
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

export type DashboardInventoryRiskRow = {
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  stockQty: number;
  soldQuantity: number;
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
  operationsSummary: DashboardOperationsSummary;
  paymentMethodRows: DashboardPaymentMethodRow[];
  promotionSummary: DashboardPromotionSummary;
  giftTierRows: DashboardGiftTierRow[];
  topSellingSkuRows: DashboardSkuRow[];
  topSellingSpuRows: DashboardSpuRow[];
  topRevenueSpuRows: DashboardSpuRow[];
  giftConsumptionRows: DashboardGiftRow[];
  lowStockRows: DashboardLowStockRow[];
  soldOutRows: DashboardInventoryRiskRow[];
  highRiskRows: DashboardInventoryRiskRow[];
  slowMovingRows: DashboardInventoryRiskRow[];
  restockSuggestionRows: DashboardInventoryRiskRow[];
  exceptionRows: DashboardExceptionRow[];
};

const paymentMethodOrder: DashboardPaymentMethodKey[] = ["wechat", "alipay", "cash", "other", "unrecorded"];

const paymentMethodLabels: Record<DashboardPaymentMethodKey, string> = {
  wechat: "微信",
  alipay: "支付宝",
  cash: "现金",
  other: "其他",
  unrecorded: "未记录"
};

function startOfLocalDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfLocalDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addLocalDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function parseLocalDate(dateText: string): Date {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function buildDashboardDateRange(
  preset: DashboardRangePreset,
  now = new Date(),
  custom?: DashboardCustomRangeInput
): DashboardDateRange {
  if (preset === "today") {
    return {
      preset,
      startAt: startOfLocalDay(now).toISOString(),
      endAt: now.toISOString(),
      label: "今日",
      isCurrentRange: true
    };
  }

  if (preset === "yesterday") {
    const yesterday = addLocalDays(now, -1);
    return {
      preset,
      startAt: startOfLocalDay(yesterday).toISOString(),
      endAt: endOfLocalDay(yesterday).toISOString(),
      label: "昨天",
      isCurrentRange: false
    };
  }

  if (preset === "last3days") {
    return {
      preset,
      startAt: startOfLocalDay(addLocalDays(now, -2)).toISOString(),
      endAt: now.toISOString(),
      label: "近 3 天",
      isCurrentRange: true
    };
  }

  if (preset === "last7days") {
    return {
      preset,
      startAt: startOfLocalDay(addLocalDays(now, -6)).toISOString(),
      endAt: now.toISOString(),
      label: "近 7 天",
      isCurrentRange: true
    };
  }

  if (!custom?.startDate || !custom.endDate) {
    throw new Error("自定义日期范围不完整。");
  }

  const startDate = parseLocalDate(custom.startDate);
  const endDate = parseLocalDate(custom.endDate);

  if (endDate.getTime() < startDate.getTime()) {
    throw new Error("结束日期不能早于开始日期。");
  }

  return {
    preset,
    startAt: startOfLocalDay(startDate).toISOString(),
    endAt: endOfLocalDay(endDate).toISOString(),
    label: `${custom.startDate} 至 ${custom.endDate}`,
    isCurrentRange: false
  };
}

function isInDateRange(value: string | undefined, range: DashboardDateRange): boolean {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();
  return time >= new Date(range.startAt).getTime() && time <= new Date(range.endAt).getTime();
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

function buildOperationsSummary(
  rangePaidOrderIds: Set<string>,
  orderItems: OrderItem[],
  netAmount: number,
  paidOrderCount: number
): DashboardOperationsSummary {
  let soldQuantity = 0;
  let giftQuantity = 0;

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId)) {
      continue;
    }

    if (item.lineType === "gift") {
      giftQuantity += item.quantity;
      continue;
    }

    if (item.lineType === "normal" || item.lineType === "discount_addon") {
      soldQuantity += item.quantity;
    }
  }

  return {
    soldQuantity,
    giftQuantity,
    outboundQuantity: soldQuantity + giftQuantity,
    averageOrderValue: paidOrderCount > 0 ? roundMoney(netAmount / paidOrderCount) : 0
  };
}

function buildPaymentMethodRows(rangePaidOrders: Order[]): DashboardPaymentMethodRow[] {
  const rowsByMethod = new Map<DashboardPaymentMethodKey, DashboardPaymentMethodRow>();

  for (const method of paymentMethodOrder) {
    rowsByMethod.set(method, {
      method,
      label: paymentMethodLabels[method],
      orderCount: 0,
      amount: 0
    });
  }

  for (const order of rangePaidOrders) {
    const method = order.paymentMethod ?? "unrecorded";
    const existing = rowsByMethod.get(method);

    if (!existing) {
      continue;
    }

    rowsByMethod.set(method, {
      ...existing,
      orderCount: existing.orderCount + 1,
      amount: roundMoney(existing.amount + order.payableAmount)
    });
  }

  return paymentMethodOrder.map((method) => rowsByMethod.get(method)).filter((row): row is DashboardPaymentMethodRow => Boolean(row));
}

function buildPromotionSummary(
  rangePaidOrders: Order[],
  rangePaidOrderIds: Set<string>,
  orderItems: OrderItem[]
): DashboardPromotionSummary {
  const addonOrderIds = new Set<string>();
  let addonQuantity = 0;
  let addonDiscountAmount = 0;

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId) || item.lineType !== "discount_addon") {
      continue;
    }

    addonOrderIds.add(item.orderId);
    addonQuantity += item.quantity;
    addonDiscountAmount = roundMoney(addonDiscountAmount + (item.originalUnitPrice - item.finalUnitPrice) * item.quantity);
  }

  return {
    addonQuantity,
    addonDiscountAmount,
    addonOrderCount: addonOrderIds.size,
    giftTriggeredOrderCount: rangePaidOrders.filter((order) => typeof order.triggeredGiftTier === "number").length
  };
}

function buildGiftTierRows(rangePaidOrders: Order[]): DashboardGiftTierRow[] {
  const rowsByThreshold = new Map<number, DashboardGiftTierRow>();

  for (const order of rangePaidOrders) {
    if (typeof order.triggeredGiftTier !== "number") {
      continue;
    }

    const existing = rowsByThreshold.get(order.triggeredGiftTier);
    rowsByThreshold.set(order.triggeredGiftTier, {
      threshold: order.triggeredGiftTier,
      orderCount: (existing?.orderCount ?? 0) + 1
    });
  }

  return [...rowsByThreshold.values()].sort((left, right) => left.threshold - right.threshold);
}

function buildTopSellingSkuRows(rangePaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardSkuRow[] {
  const rowsByProduct = new Map<string, DashboardSkuRow>();

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId) || item.lineType === "gift") {
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

  return sortByQuantityThenName([...rowsByProduct.values()]).slice(0, 5);
}

function buildSpuRows(rangePaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardSpuRow[] {
  const rowsBySpu = new Map<string, DashboardSpuRow>();

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId) || item.lineType === "gift") {
      continue;
    }

    const existing = rowsBySpu.get(item.spuSnapshot);
    rowsBySpu.set(item.spuSnapshot, {
      spu: item.spuSnapshot,
      quantity: (existing?.quantity ?? 0) + item.quantity,
      amount: roundMoney((existing?.amount ?? 0) + item.lineTotal)
    });
  }

  return [...rowsBySpu.values()];
}

function sortSpuRowsByQuantity(rows: DashboardSpuRow[]): DashboardSpuRow[] {
  return [...rows].sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return left.spu.localeCompare(right.spu, "zh-Hans-CN");
  });
}

function sortSpuRowsByAmount(rows: DashboardSpuRow[]): DashboardSpuRow[] {
  return [...rows].sort((left, right) => {
    if (right.amount !== left.amount) {
      return right.amount - left.amount;
    }

    return left.spu.localeCompare(right.spu, "zh-Hans-CN");
  });
}

function buildGiftConsumptionRows(rangePaidOrderIds: Set<string>, orderItems: OrderItem[]): DashboardGiftRow[] {
  const rowsByProduct = new Map<string, DashboardGiftRow>();

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId) || item.lineType !== "gift") {
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

  return sortByQuantityThenName([...rowsByProduct.values()]).slice(0, 5);
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

function buildSoldQuantityByProduct(rangePaidOrderIds: Set<string>, orderItems: OrderItem[]): Map<string, number> {
  const soldQuantityByProduct = new Map<string, number>();

  for (const item of orderItems) {
    if (!rangePaidOrderIds.has(item.orderId) || item.lineType === "gift") {
      continue;
    }

    soldQuantityByProduct.set(item.productId, (soldQuantityByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  return soldQuantityByProduct;
}

function toInventoryRiskRow(product: Product, soldQuantity: number): DashboardInventoryRiskRow {
  return {
    productId: product.id,
    productName: product.name,
    spu: product.spu,
    productCode: product.productCode,
    stockQty: product.stockQty,
    soldQuantity
  };
}

function sortInventoryRiskRows(rows: DashboardInventoryRiskRow[]): DashboardInventoryRiskRow[] {
  return [...rows].sort((left, right) => {
    if (left.stockQty !== right.stockQty) {
      return left.stockQty - right.stockQty;
    }

    if (right.soldQuantity !== left.soldQuantity) {
      return right.soldQuantity - left.soldQuantity;
    }

    return left.productName.localeCompare(right.productName, "zh-Hans-CN");
  });
}

function buildInventoryRiskRows(
  products: Product[],
  soldQuantityByProduct: Map<string, number>
): Pick<DashboardModel, "soldOutRows" | "highRiskRows" | "slowMovingRows" | "restockSuggestionRows"> {
  const activeProducts = products.filter((product) => product.status === "active");

  const soldOutRows = activeProducts
    .filter((product) => product.stockQty === 0)
    .map((product) => toInventoryRiskRow(product, soldQuantityByProduct.get(product.id) ?? 0))
    .sort((left, right) => left.productName.localeCompare(right.productName, "zh-Hans-CN"))
    .slice(0, 5);

  const highRiskRows = sortInventoryRiskRows(
    activeProducts
      .filter((product) => {
        const soldQuantity = soldQuantityByProduct.get(product.id) ?? 0;
        return product.isSellable && product.stockQty <= 2 && soldQuantity >= 2;
      })
      .map((product) => toInventoryRiskRow(product, soldQuantityByProduct.get(product.id) ?? 0))
  ).slice(0, 5);

  const slowMovingRows = activeProducts
    .filter((product) => product.isSellable && product.stockQty > 0 && (soldQuantityByProduct.get(product.id) ?? 0) === 0)
    .map((product) => toInventoryRiskRow(product, 0))
    .sort((left, right) => {
      if (right.stockQty !== left.stockQty) {
        return right.stockQty - left.stockQty;
      }

      return left.productName.localeCompare(right.productName, "zh-Hans-CN");
    })
    .slice(0, 5);

  return {
    soldOutRows,
    highRiskRows,
    slowMovingRows,
    restockSuggestionRows: highRiskRows
  };
}

function isRangeCancelledOrder(order: Order, range: DashboardDateRange): boolean {
  return order.status === "cancelled" && isInDateRange(order.cancelledAt, range);
}

function getExceptionTime(order: Order): string {
  return order.cancelledAt ?? order.paidAt ?? order.createdAt;
}

function buildExceptionRows(
  orders: Order[],
  refundTotalsByOrder: Map<string, number>,
  rangePaidOrderIds: Set<string>,
  range: DashboardDateRange
): DashboardExceptionRow[] {
  return orders
    .filter((order) => {
      const refundedAmount = refundTotalsByOrder.get(order.id) ?? 0;
      return isRangeCancelledOrder(order, range) || (rangePaidOrderIds.has(order.id) && (refundedAmount > 0 || order.giftStockWarning));
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
  const rangePaidOrders = input.orders.filter(
    (order) => order.status === "paid" && isInDateRange(orderBusinessTime(order), input.dateRange)
  );
  const rangePaidOrderIds = new Set(rangePaidOrders.map((order) => order.id));
  const rangeRefunds = input.refunds.filter((refund) => isInDateRange(refund.createdAt, input.dateRange));
  const allRefundTotalsByOrder = sumRefundsByOrder(input.refunds);
  const paidAmount = rangePaidOrders.reduce((sum, order) => roundMoney(sum + order.payableAmount), 0);
  const refundAmount = rangeRefunds.reduce((sum, refund) => roundMoney(sum + refund.amount), 0);
  const netAmount = roundMoney(paidAmount - refundAmount);
  const rangeCancelledOrders = input.orders.filter((order) => isRangeCancelledOrder(order, input.dateRange));
  const afterSalesRefundStates = [...rangePaidOrders, ...rangeCancelledOrders].map((order) => ({
    order,
    refundedAmount: allRefundTotalsByOrder.get(order.id) ?? 0
  }));
  const spuRows = buildSpuRows(rangePaidOrderIds, input.orderItems);
  const inventoryRiskRows = buildInventoryRiskRows(input.products, buildSoldQuantityByProduct(rangePaidOrderIds, input.orderItems));

  return {
    summary: {
      paidAmount,
      refundAmount,
      netAmount,
      paidOrderCount: rangePaidOrders.length,
      cancelledOrderCount: rangeCancelledOrders.length,
      partialRefundOrderCount: afterSalesRefundStates.filter(
        ({ order, refundedAmount }) => refundedAmount > 0 && refundedAmount < order.payableAmount
      ).length,
      fullyRefundedOrderCount: afterSalesRefundStates.filter(
        ({ order, refundedAmount }) => order.payableAmount > 0 && refundedAmount >= order.payableAmount
      ).length,
      notedCancelledOrderCount: rangeCancelledOrders.filter((order) => Boolean(order.cancelNote?.trim())).length
    },
    operationsSummary: buildOperationsSummary(rangePaidOrderIds, input.orderItems, netAmount, rangePaidOrders.length),
    paymentMethodRows: buildPaymentMethodRows(rangePaidOrders),
    promotionSummary: buildPromotionSummary(rangePaidOrders, rangePaidOrderIds, input.orderItems),
    giftTierRows: buildGiftTierRows(rangePaidOrders),
    topSellingSkuRows: buildTopSellingSkuRows(rangePaidOrderIds, input.orderItems),
    topSellingSpuRows: sortSpuRowsByQuantity(spuRows).slice(0, 5),
    topRevenueSpuRows: sortSpuRowsByAmount(spuRows).slice(0, 5),
    giftConsumptionRows: buildGiftConsumptionRows(rangePaidOrderIds, input.orderItems),
    lowStockRows: buildLowStockRows(input.products),
    ...inventoryRiskRows,
    exceptionRows: buildExceptionRows(input.orders, allRefundTotalsByOrder, rangePaidOrderIds, input.dateRange)
  };
}
