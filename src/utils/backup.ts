import { saveAs } from "file-saver";
import { db } from "../db/db";
import type { AppSettings, InventoryLog, Order, OrderItem, Product } from "../domain/types";

const BACKUP_VERSION = 1;
const IMAGE_BACKUP_NOTE = "图片暂不包含在 JSON 备份中";

type BackupPayload = {
  version: 1;
  exportedAt: string;
  note: typeof IMAGE_BACKUP_NOTE;
  data: {
    products: Product[];
    settings: AppSettings[];
    orders: Order[];
    orderItems: OrderItem[];
    inventoryLogs: InventoryLog[];
  };
};

type ImportDeps = {
  importData?: (data: BackupPayload["data"]) => Promise<void> | void;
};

const ORDER_STATUSES = new Set(["pending_payment", "paid", "cancelled"]);
const PAYMENT_METHODS = new Set(["wechat", "alipay", "cash", "other"]);
const ORDER_LINE_TYPES = new Set(["normal", "discount_addon", "gift"]);
const INVENTORY_REASONS = new Set(["order_paid", "gift_order_paid", "manual_adjust"]);
const PRODUCT_STATUSES = new Set(["active", "inactive"]);

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function readArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error("备份文件格式不正确。");
  }

  return value;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function assertString(record: Record<string, unknown>, key: string): void {
  if (!isString(record[key])) {
    throw new Error("备份文件格式不正确。");
  }
}

function assertNonEmptyString(record: Record<string, unknown>, key: string): void {
  if (!isNonEmptyString(record[key])) {
    throw new Error("备份文件格式不正确。");
  }
}

function assertBoolean(record: Record<string, unknown>, key: string): void {
  if (typeof record[key] !== "boolean") {
    throw new Error("备份文件格式不正确。");
  }
}

function assertFiniteNumber(record: Record<string, unknown>, key: string): void {
  if (!isFiniteNumber(record[key])) {
    throw new Error("备份文件格式不正确。");
  }
}

function assertNonNegativeNumber(record: Record<string, unknown>, key: string): void {
  if (!isNonNegativeNumber(record[key])) {
    throw new Error("备份文件格式不正确。");
  }
}

function assertEnum(record: Record<string, unknown>, key: string, allowed: Set<string>): void {
  const value = record[key];
  if (!isString(value) || !allowed.has(value)) {
    throw new Error("备份文件格式不正确。");
  }
}

function validatePromotion(value: unknown): void {
  assertRecord(value, "备份文件格式不正确。");
  assertBoolean(value, "enabled");
  assertRecord(value.addonDiscount, "备份文件格式不正确。");
  assertBoolean(value.addonDiscount, "enabled");
  assertString(value.addonDiscount, "discountSpu");
  assertNonNegativeNumber(value.addonDiscount, "discountPrice");
  assertNonNegativeNumber(value.addonDiscount, "maxDiscountQty");

  if (!Array.isArray(value.giftTiers)) {
    throw new Error("备份文件格式不正确。");
  }

  for (const tier of value.giftTiers) {
    assertRecord(tier, "备份文件格式不正确。");
    assertFiniteNumber(tier, "threshold");

    if (!Array.isArray(tier.gifts)) {
      throw new Error("备份文件格式不正确。");
    }

    for (const gift of tier.gifts) {
      assertRecord(gift, "备份文件格式不正确。");
      assertNonEmptyString(gift, "productId");

      if (!isPositiveInteger(gift.quantity)) {
        throw new Error("备份文件格式不正确。");
      }
    }
  }
}

function validateSettings(settings: unknown[]): asserts settings is AppSettings[] {
  if (settings.length !== 1) {
    throw new Error("备份文件格式不正确。");
  }

  const setting = settings[0];
  assertRecord(setting, "备份文件格式不正确。");

  if (setting.id !== "settings") {
    throw new Error("备份文件格式不正确。");
  }

  validatePromotion(setting.promotion);
}

function validateProducts(products: unknown[]): asserts products is Product[] {
  for (const product of products) {
    assertRecord(product, "备份文件格式不正确。");
    assertString(product, "id");
    assertString(product, "name");
    assertString(product, "spu");
    assertString(product, "createdAt");
    assertString(product, "updatedAt");
    assertNonNegativeNumber(product, "costPrice");
    assertNonNegativeNumber(product, "salePrice");
    assertNonNegativeNumber(product, "stockQty");

    if (!Number.isInteger(product.stockQty)) {
      throw new Error("备份文件格式不正确。");
    }

    assertBoolean(product, "isSellable");
    assertBoolean(product, "isGiftEligible");
    assertEnum(product, "status", PRODUCT_STATUSES);
  }
}

function validateOrders(orders: unknown[]): asserts orders is Order[] {
  for (const order of orders) {
    assertRecord(order, "备份文件格式不正确。");
    assertString(order, "id");
    assertString(order, "orderNo");
    assertEnum(order, "status", ORDER_STATUSES);
    assertString(order, "createdAt");
    assertNonNegativeNumber(order, "subtotalBeforeDiscount");
    assertNonNegativeNumber(order, "discountAmount");
    assertNonNegativeNumber(order, "payableAmount");
    assertBoolean(order, "giftStockWarning");
    validatePromotion(order.promotionSnapshot);

    if (order.paymentMethod !== undefined) {
      assertEnum(order, "paymentMethod", PAYMENT_METHODS);
    }

    if (order.triggeredGiftTier !== undefined && !isFiniteNumber(order.triggeredGiftTier)) {
      throw new Error("备份文件格式不正确。");
    }

    if (order.paidAt !== undefined && !isString(order.paidAt)) {
      throw new Error("备份文件格式不正确。");
    }

    if (order.cancelledAt !== undefined && !isString(order.cancelledAt)) {
      throw new Error("备份文件格式不正确。");
    }
  }
}

function validateOrderItems(orderItems: unknown[]): asserts orderItems is OrderItem[] {
  for (const item of orderItems) {
    assertRecord(item, "备份文件格式不正确。");
    assertString(item, "id");
    assertString(item, "orderId");
    assertString(item, "productId");
    assertString(item, "productNameSnapshot");
    assertString(item, "spuSnapshot");
    assertFiniteNumber(item, "quantity");
    assertNonNegativeNumber(item, "originalUnitPrice");
    assertNonNegativeNumber(item, "finalUnitPrice");
    assertEnum(item, "lineType", ORDER_LINE_TYPES);
    assertFiniteNumber(item, "lineTotal");
  }
}

function validateInventoryLogs(inventoryLogs: unknown[]): asserts inventoryLogs is InventoryLog[] {
  for (const log of inventoryLogs) {
    assertRecord(log, "备份文件格式不正确。");
    assertString(log, "id");
    assertString(log, "productId");
    assertString(log, "orderId");
    assertFiniteNumber(log, "changeQty");
    assertEnum(log, "reason", INVENTORY_REASONS);
    assertFiniteNumber(log, "beforeQty");
    assertFiniteNumber(log, "afterQty");
    assertString(log, "createdAt");
  }
}

function validateBackupData(data: {
  products: unknown[];
  settings: unknown[];
  orders: unknown[];
  orderItems: unknown[];
  inventoryLogs: unknown[];
}): asserts data is BackupPayload["data"] {
  validateSettings(data.settings);
  validateProducts(data.products);
  validateOrders(data.orders);
  validateOrderItems(data.orderItems);
  validateInventoryLogs(data.inventoryLogs);
}

function parseBackupPayload(text: string): BackupPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("备份文件不是有效的 JSON。");
  }

  assertRecord(parsed, "备份文件格式不正确。");

  if (parsed.version !== BACKUP_VERSION) {
    throw new Error("不支持的备份版本。");
  }

  assertRecord(parsed.data, "备份文件格式不正确。");

  const data = {
    products: readArray(parsed.data, "products"),
    settings: readArray(parsed.data, "settings"),
    orders: readArray(parsed.data, "orders"),
    orderItems: readArray(parsed.data, "orderItems"),
    inventoryLogs: readArray(parsed.data, "inventoryLogs")
  };

  validateBackupData(data);

  return {
    version: BACKUP_VERSION,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    note: IMAGE_BACKUP_NOTE,
    data
  };
}

async function readFileText(file: File): Promise<string> {
  return file.text();
}

export async function replaceAllDataInTransaction(data: BackupPayload["data"]): Promise<void> {
  await db.transaction(
    "rw",
    [db.products, db.images, db.settings, db.orders, db.orderItems, db.inventoryLogs],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.images.clear(),
        db.settings.clear(),
        db.orders.clear(),
        db.orderItems.clear(),
        db.inventoryLogs.clear()
      ]);

      if (data.products.length > 0) {
        await db.products.bulkPut(data.products);
      }

      if (data.settings.length > 0) {
        await db.settings.bulkPut(data.settings);
      }

      if (data.orders.length > 0) {
        await db.orders.bulkPut(data.orders);
      }

      if (data.orderItems.length > 0) {
        await db.orderItems.bulkPut(data.orderItems);
      }

      if (data.inventoryLogs.length > 0) {
        await db.inventoryLogs.bulkPut(data.inventoryLogs);
      }
    }
  );
}

export async function exportJsonBackup(): Promise<void> {
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    note: IMAGE_BACKUP_NOTE,
    data: {
      products: await db.products.toArray(),
      settings: await db.settings.toArray(),
      orders: await db.orders.toArray(),
      orderItems: await db.orderItems.toArray(),
      inventoryLogs: await db.inventoryLogs.toArray()
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });

  saveAs(blob, `ecrm-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function importJsonBackup(file: File): Promise<void> {
  await importJsonBackupFromText(await readFileText(file));
}

export async function importJsonBackupFromText(text: string, deps: ImportDeps = {}): Promise<void> {
  const payload = parseBackupPayload(text);
  const importer = deps.importData ?? replaceAllDataInTransaction;

  await importer(payload.data);
}

export { IMAGE_BACKUP_NOTE };
