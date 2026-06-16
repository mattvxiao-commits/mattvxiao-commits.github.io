import type {
  CalculatedCart,
  CalculatedCartLine,
  InventoryLog,
  Order,
  OrderItem,
  PaymentMethod,
  Product,
  PromotionConfig
} from "./types";

export type BuildPaidOrderInput = {
  products: Product[];
  calculated: CalculatedCart;
  resolvedGiftLines?: CalculatedCartLine[];
  promotion: PromotionConfig;
  orderPrefix: string;
  paymentMethod: PaymentMethod;
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
    createdAt,
    paidAt: createdAt
  };

  const orderItems = allLines.map((line) => makeOrderItem(line, orderId, productById));
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
  getProductForLine(line, productById);

  return {
    id: makeLineId(),
    orderId,
    productId: line.productId,
    productNameSnapshot: line.productName,
    spuSnapshot: line.spu,
    productCodeSnapshot: line.productCode,
    quantity: line.quantity,
    originalUnitPrice: line.originalUnitPrice,
    finalUnitPrice: line.finalUnitPrice,
    lineType: line.lineType,
    lineTotal: line.lineTotal
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
    reason: line.lineType === "gift" ? "gift_order_paid" : "order_paid",
    beforeQty,
    afterQty,
    createdAt
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
