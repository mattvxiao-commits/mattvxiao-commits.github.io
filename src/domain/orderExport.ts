import type {
  InventoryLog,
  Order,
  OrderItem,
  OrderLineType,
  OrderRefund,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductStatus,
  RefundReason
} from "./types";

export type OrderExportSheet = {
  name: string;
  rows: Record<string, string | number>[];
};

export type BuildOrderExportSheetsInput = {
  orders: Order[];
  orderItems: OrderItem[];
  refunds: OrderRefund[];
  inventoryLogs: InventoryLog[];
  products: Product[];
  exportedAt: string;
  appVersion: string;
};

const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "待支付",
  paid: "已支付",
  cancelled: "已作废"
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  wechat: "微信",
  alipay: "支付宝",
  cash: "现金",
  other: "其他"
};

const lineTypeLabels: Record<OrderLineType, string> = {
  normal: "普通",
  discount_addon: "优惠加购",
  gift: "赠品"
};

const refundReasonLabels: Record<RefundReason, string> = {
  customer_return: "顾客退货",
  overcharge: "多收退款",
  product_issue: "商品问题",
  manual_adjustment: "人工调整",
  other: "其他"
};

const inventoryReasonLabels: Record<InventoryLog["reason"], string> = {
  order_paid: "订单扣减",
  gift_order_paid: "赠品扣减",
  order_cancelled_rollback: "作废回滚",
  manual_adjust: "人工调整"
};

const productStatusLabels: Record<ProductStatus, string> = {
  active: "启用",
  inactive: "停用"
};

export function buildOrderExportSheets(input: BuildOrderExportSheetsInput): OrderExportSheet[] {
  const ordersById = new Map(input.orders.map((order) => [order.id, order]));
  const productsById = new Map(input.products.map((product) => [product.id, product]));
  const refundTotalByOrder = sumRefundsByOrder(input.refunds);

  return [
    { name: "订单汇总", rows: buildOrderSummaryRows(input.orders, refundTotalByOrder) },
    { name: "订单明细", rows: buildOrderItemRows(input.orderItems, ordersById) },
    { name: "退款记录", rows: buildRefundRows(input.refunds, ordersById) },
    { name: "库存流水", rows: buildInventoryRows(input.inventoryLogs, ordersById, productsById) },
    { name: "商品当前数据", rows: buildProductRows(input.products) },
    { name: "导出说明", rows: buildExportNoteRows(input.exportedAt, input.appVersion) }
  ];
}

function buildOrderSummaryRows(
  orders: Order[],
  refundTotalByOrder: Map<string, number>
): Record<string, string | number>[] {
  return orders.map((order) => {
    const refundAmount = refundTotalByOrder.get(order.id) ?? 0;

    return {
      订单编号: order.orderNo,
      订单ID: order.id,
      订单状态: orderStatusLabels[order.status],
      支付方式: formatPaymentMethod(order.paymentMethod),
      创建时间: order.createdAt,
      支付时间: order.paidAt ?? "",
      作废时间: order.cancelledAt ?? "",
      商品原价合计: order.subtotalBeforeDiscount,
      优惠金额: order.discountAmount,
      应收金额: order.payableAmount,
      退款金额: refundAmount,
      实收估算: roundNumber(order.payableAmount - refundAmount),
      触发满赠档位: order.triggeredGiftTier ?? "",
      是否赠品库存异常: formatBoolean(order.giftStockWarning),
      作废原因: order.cancelReason ?? "",
      作废备注: order.cancelNote ?? ""
    };
  });
}

function buildOrderItemRows(
  orderItems: OrderItem[],
  ordersById: Map<string, Order>
): Record<string, string | number>[] {
  return orderItems.map((item) => {
    const order = ordersById.get(item.orderId);
    const costSnapshot = getCompleteCostSnapshot(item);
    const unitCostSnapshot = costSnapshot ? costSnapshot.unitCostSnapshot : "";
    const costTotal = costSnapshot ? costSnapshot.costTotal : "";
    const grossProfit = costSnapshot ? costSnapshot.grossProfit : "";
    const grossMargin = costSnapshot ? calculateGrossMargin(item.lineTotal, costSnapshot.grossProfit) : "";

    return {
      订单编号: order?.orderNo ?? "",
      订单ID: item.orderId,
      订单状态: order ? orderStatusLabels[order.status] : "",
      支付时间: order?.paidAt ?? "",
      商品ID: item.productId,
      商品名称: item.productNameSnapshot,
      SPU: item.spuSnapshot,
      商品编码: item.productCodeSnapshot ?? "",
      数量: item.quantity,
      明细类型: lineTypeLabels[item.lineType],
      原单价: item.originalUnitPrice,
      成交单价: item.finalUnitPrice,
      销售小计: item.lineTotal,
      单位成本快照: unitCostSnapshot,
      成本小计: costTotal,
      毛利: grossProfit,
      毛利率: grossMargin,
      是否缺少成本快照: formatBoolean(!costSnapshot)
    };
  });
}

function buildRefundRows(refunds: OrderRefund[], ordersById: Map<string, Order>): Record<string, string | number>[] {
  return refunds.map((refund) => {
    const order = ordersById.get(refund.orderId);

    return {
      订单编号: order?.orderNo ?? "",
      订单ID: refund.orderId,
      退款ID: refund.id,
      退款时间: refund.createdAt,
      退款金额: refund.amount,
      退款方式: paymentMethodLabels[refund.method],
      退款原因: refundReasonLabels[refund.reason],
      备注: refund.note ?? ""
    };
  });
}

function buildInventoryRows(
  inventoryLogs: InventoryLog[],
  ordersById: Map<string, Order>,
  productsById: Map<string, Product>
): Record<string, string | number>[] {
  return inventoryLogs.map((log) => {
    const order = ordersById.get(log.orderId);
    const product = productsById.get(log.productId);

    return {
      时间: log.createdAt,
      商品ID: log.productId,
      商品名称: product?.name ?? "商品不存在",
      商品编码: product?.productCode ?? "",
      订单编号: order?.orderNo ?? "",
      订单ID: log.orderId,
      变动数量: log.changeQty,
      变动原因: inventoryReasonLabels[log.reason],
      变动前库存: log.beforeQty,
      变动后库存: log.afterQty
    };
  });
}

function buildProductRows(products: Product[]): Record<string, string | number>[] {
  return products.map((product) => ({
    商品ID: product.id,
    商品名称: product.name,
    SPU: product.spu,
    SPU编码: product.spuCode ?? "",
    SKU编码: product.skuCode ?? "",
    完整商品编码: product.productCode ?? "",
    成本价: product.costPrice,
    售价: product.salePrice,
    当前库存: product.stockQty,
    是否可售: formatBoolean(product.isSellable),
    是否赠品: formatBoolean(product.isGiftEligible),
    状态: productStatusLabels[product.status],
    创建时间: product.createdAt,
    更新时间: product.updatedAt
  }));
}

function buildExportNoteRows(exportedAt: string, appVersion: string): Record<string, string | number>[] {
  return [
    { 项目: "导出时间", 说明: exportedAt },
    { 项目: "系统版本", 说明: appVersion },
    { 项目: "文件用途", 说明: "本 Excel 用于订单统计、盘点和经营复盘。" },
    { 项目: "恢复说明", 说明: "Excel 不能用于恢复系统数据；恢复数据请使用 JSON 备份。" },
    { 项目: "成本快照说明", 说明: "成本字段来自下单时订单明细保存的成本快照，旧订单缺少快照时留空。" },
    { 项目: "旧订单说明", 说明: "旧订单不会用当前商品成本补写历史成本，避免伪造毛利。" },
    { 项目: "人工退款说明", 说明: "人工退款按订单级记录导出，不拆分到 SKU 或 SPU 毛利。" },
    { 项目: "退款退货入库说明", 说明: "当前人工退款不会自动产生退货入库或库存回补；如需退货入库，请等待后续商品级售后功能。" }
  ];
}

function sumRefundsByOrder(refunds: OrderRefund[]): Map<string, number> {
  const result = new Map<string, number>();

  for (const refund of refunds) {
    result.set(refund.orderId, roundNumber((result.get(refund.orderId) ?? 0) + refund.amount));
  }

  return result;
}

function getCompleteCostSnapshot(
  item: OrderItem
): { unitCostSnapshot: number; costTotal: number; grossProfit: number } | null {
  if (
    !isNonNegativeFiniteNumber(item.unitCostSnapshot) ||
    !isNonNegativeFiniteNumber(item.costTotal) ||
    !isFiniteNumber(item.grossProfit)
  ) {
    return null;
  }

  return {
    unitCostSnapshot: item.unitCostSnapshot,
    costTotal: item.costTotal,
    grossProfit: item.grossProfit
  };
}

function calculateGrossMargin(lineTotal: number, grossProfit: number): number {
  return lineTotal === 0 ? 0 : roundNumber(grossProfit / lineTotal * 100);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function formatPaymentMethod(value: PaymentMethod | undefined): string {
  return value ? paymentMethodLabels[value] : "未记录";
}

function formatBoolean(value: boolean): string {
  return value ? "是" : "否";
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}
