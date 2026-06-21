import type {
  CalculatedCart,
  CalculatedCartLine,
  InventoryLog,
  NonSalesReason,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  PromotionConfig
} from "./types";
import { normalizeMoney } from "./money";
import { deriveOrderNature, getLineAccounting, getNormalizedOrderLine } from "./orderLines";

export type BuildPaidOrderInput = {
  products: Product[];
  calculated: CalculatedCart;
  resolvedGiftLines?: CalculatedCartLine[];
  promotion: PromotionConfig;
  orderPrefix: string;
  paymentMethod?: PaymentMethod;
  now?: string;
};

export type BuildPaidOrderResult = {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  updatedProducts: Product[];
};

export function buildPaidOrder(input: BuildPaidOrderInput): BuildPaidOrderResult {
  const createdAt = input.now ?? new Date().toISOString();
  const orderId = makeOrderId();
  const productById = new Map(input.products.map((product) => [product.id, product]));
  const stockById = new Map(input.products.map((product) => [product.id, product.stockQty]));
  const giftLines = input.resolvedGiftLines ?? input.calculated.giftLines;
  const allLines = [...input.calculated.lines, ...giftLines];
  const orderItems = allLines.map((line) => makeOrderItem(line, orderId, productById));
  const summary = summarizeOrderItems(orderItems);

  const order: Order = {
    id: orderId,
    orderNo: makeOrderNo(input.orderPrefix, createdAt),
    status: "paid",
    paymentMethod: input.paymentMethod,
    subtotalBeforeDiscount: input.calculated.subtotalBeforeDiscount,
    discountAmount: input.calculated.discountAmount,
    payableAmount: input.calculated.payableAmount,
    triggeredGiftTier: input.calculated.triggeredGiftTier?.threshold,
    promotionSnapshot: input.promotion,
    giftStockWarning: input.calculated.giftStockWarnings.length > 0,
    orderNature: summary.orderNature,
    salesAmount: summary.salesAmount,
    nonSalesQuantity: summary.nonSalesQuantity,
    nonSalesCost: summary.nonSalesCost,
    operatingActivityCost: summary.operatingActivityCost,
    nonOperatingOutboundCost: summary.nonOperatingOutboundCost,
    createdAt,
    paidAt: createdAt
  };

  const inventoryLogs = allLines.map((line) => deductInventory(line, orderId, createdAt, productById, stockById));
  const updatedProducts = input.products.map((product) => ({
    ...product,
    stockQty: stockById.get(product.id) ?? product.stockQty
  }));

  return {
    order,
    orderItems,
    inventoryLogs,
    updatedProducts
  };
}

function makeOrderItem(
  line: CalculatedCartLine,
  orderId: string,
  productById: Map<string, Product>
): OrderItem {
  const product = getProductForLine(line, productById);
  const unitCostSnapshot = product.costPrice;
  const costTotal = normalizeMoney(unitCostSnapshot * line.quantity);
  const revenueType = line.revenueType ?? (line.lineType === "gift" ? "non_sales" : "sale");
  const nonSalesReason = revenueType === "non_sales" ? line.nonSalesReason ?? "tier_gift" : undefined;
  const finalUnitPrice = revenueType === "non_sales" ? 0 : line.finalUnitPrice;
  const lineTotal = revenueType === "non_sales" ? 0 : line.lineTotal;
  const statisticalUnitPrice = revenueType === "non_sales" ? 0 : line.statisticalUnitPrice ?? finalUnitPrice;
  const statisticalSubtotal =
    revenueType === "non_sales" ? 0 : line.statisticalSubtotal ?? normalizeMoney(statisticalUnitPrice * line.quantity);
  const discountGiveawayAmount =
    revenueType === "non_sales"
      ? 0
      : line.discountGiveawayAmount ??
        normalizeMoney(line.lineType === "discount_addon" ? Math.max(0, line.originalUnitPrice - finalUnitPrice) * line.quantity : 0);
  const grossProfit = normalizeMoney(lineTotal - costTotal);

  return {
    id: makeLineId(),
    orderId,
    productId: line.productId,
    productNameSnapshot: line.productName,
    spuSnapshot: line.spu,
    productCodeSnapshot: line.productCode,
    quantity: line.quantity,
    originalUnitPrice: line.originalUnitPrice,
    finalUnitPrice,
    lineType: line.lineType,
    lineTotal,
    unitCostSnapshot,
    costTotal,
    grossProfit,
    revenueType,
    nonSalesReason,
    nonSalesNote: revenueType === "non_sales" ? line.nonSalesNote?.trim() || undefined : undefined,
    campaignNameSnapshot: revenueType === "non_sales" ? line.campaignNameSnapshot?.trim() || undefined : undefined,
    statisticalUnitPrice: normalizeMoney(statisticalUnitPrice),
    statisticalSubtotal: normalizeMoney(statisticalSubtotal),
    discountGiveawayAmount: normalizeMoney(discountGiveawayAmount)
  };
}

function deductInventory(
  line: CalculatedCartLine,
  orderId: string,
  createdAt: string,
  productById: Map<string, Product>,
  stockById: Map<string, number>
): InventoryLog {
  const product = getProductForLine(line, productById);
  const beforeQty = stockById.get(line.productId) ?? product.stockQty;
  const afterQty = beforeQty - line.quantity;

  if (afterQty < 0) {
    throw new Error(`商品 ${product.name} 库存不足，无法完成订单扣减`);
  }

  stockById.set(line.productId, afterQty);

  return {
    id: makeLineId(),
    productId: line.productId,
    orderId,
    changeQty: -line.quantity,
    reason: getInventoryReason(line),
    beforeQty,
    afterQty,
    createdAt
  };
}

function getInventoryReason(line: CalculatedCartLine): InventoryLog["reason"] {
  const revenueType = line.revenueType ?? (line.lineType === "gift" ? "non_sales" : "sale");

  if (revenueType === "sale") {
    return "order_paid";
  }

  return (line.nonSalesReason ?? "tier_gift") === "tier_gift" ? "gift_order_paid" : "non_sales_outbound";
}

function summarizeOrderItems(orderItems: OrderItem[]): Pick<
  Order,
  "orderNature" | "salesAmount" | "nonSalesQuantity" | "nonSalesCost" | "operatingActivityCost" | "nonOperatingOutboundCost"
> {
  const normalizedItems = orderItems.map(getNormalizedOrderLine);
  const accountingRows = normalizedItems.map(getLineAccounting);
  const nonOperatingReasons: NonSalesReason[] = ["manual_gift", "other_non_sales"];

  return {
    orderNature: deriveOrderNature(normalizedItems),
    salesAmount: normalizeMoney(accountingRows.reduce((sum, row) => sum + row.revenue, 0)),
    nonSalesQuantity: normalizedItems
      .filter((item) => item.revenueType === "non_sales")
      .reduce((sum, item) => sum + item.quantity, 0),
    nonSalesCost: normalizeMoney(
      accountingRows.reduce((sum, row) => sum + row.operatingActivityCost + row.nonOperatingOutboundCost, 0)
    ),
    operatingActivityCost: normalizeMoney(accountingRows.reduce((sum, row) => sum + row.operatingActivityCost, 0)),
    nonOperatingOutboundCost: normalizeMoney(
      normalizedItems.reduce((sum, item, index) => {
        if (item.nonSalesReason && nonOperatingReasons.includes(item.nonSalesReason)) {
          return sum + accountingRows[index].nonOperatingOutboundCost;
        }

        return sum;
      }, 0)
    )
  };
}

function getProductForLine(line: CalculatedCartLine, productById: Map<string, Product>): Product {
  const product = productById.get(line.productId);

  if (!product) {
    throw new Error(`订单明细商品 ${line.productId} 不存在，无法生成订单快照`);
  }

  return product;
}

function makeOrderNo(prefix: string, now: string): string {
  const timestamp = timestampParts(now);
  const suffix = String(Math.floor(Math.random() * 1000)).padStart(3, "0");

  return `${prefix}-${timestamp.date}-${timestamp.time}-${suffix}`;
}

function timestampParts(now: string): { date: string; time: string } {
  const match = now.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);

  if (match) {
    return {
      date: `${match[1]}${match[2]}${match[3]}`,
      time: `${match[4]}${match[5]}${match[6]}`
    };
  }

  const date = new Date(now);
  const yyyy = String(date.getFullYear());
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());

  return {
    date: `${yyyy}${mm}${dd}`,
    time: `${hh}${min}${ss}`
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function makeOrderId(): string {
  return makeId("order");
}

export function makeLineId(): string {
  return makeId("line");
}

function makeId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
