import { saveAs } from "file-saver";
import { createDefaultCampaignGiftConfig, db, type StoredImage } from "../db/db";
import { createDefaultFieldLockSettings, sanitizeFieldLockForBackup } from "../domain/fieldLock";
import type { AppSettings, InventoryLog, Order, OrderItem, OrderRefund, Product } from "../domain/types";

const BACKUP_VERSION = 4;
const IMAGE_BACKUP_NOTE = "图片已包含在 JSON 备份中";
const LEGACY_IMAGE_BACKUP_NOTE = "图片暂不包含在 JSON 备份中";

type BackupImage = {
  id: string;
  mimeType: string;
  originalName: string;
  createdAt: string;
  dataBase64: string;
};

type BackupData = {
  products: Product[];
  settings: AppSettings[];
  orders: Order[];
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  orderRefunds: OrderRefund[];
  images: BackupImage[];
};

type BackupPayloadV4 = {
  version: 4;
  exportedAt: string;
  note: typeof IMAGE_BACKUP_NOTE;
  data: BackupData;
};

type ParsedBackupPayload = {
  version: 1 | 2 | 3 | 4;
  exportedAt: string;
  note: typeof IMAGE_BACKUP_NOTE | typeof LEGACY_IMAGE_BACKUP_NOTE;
  data: BackupData;
};

export type BackupImportResult = {
  version: 1 | 2 | 3 | 4;
  includedImages: boolean;
  imageCount: number;
};

type ImportDeps = {
  importData?: (data: BackupData) => Promise<void> | void;
};

const ORDER_STATUSES = new Set(["pending_payment", "paid", "cancelled"]);
const PAYMENT_METHODS = new Set(["wechat", "alipay", "cash", "other"]);
const ORDER_LINE_TYPES = new Set(["normal", "discount_addon", "gift"]);
const ORDER_CANCEL_REASONS = new Set(["mistake", "customer_cancelled", "duplicate_order", "inventory_issue", "payment_issue", "other"]);
const INVENTORY_REASONS = new Set(["order_paid", "gift_order_paid", "order_cancelled_rollback", "manual_adjust"]);
const PRODUCT_STATUSES = new Set(["active", "inactive"]);
const REFUND_REASONS = new Set(["customer_return", "overcharge", "product_issue", "manual_adjustment", "other"]);

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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
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

function assertOptionalString(record: Record<string, unknown>, key: string): void {
  if (record[key] !== undefined && !isString(record[key])) {
    throw new Error("备份文件格式不正确。");
  }
}

function assertOptionalFiniteNumber(record: Record<string, unknown>, key: string): void {
  if (record[key] !== undefined && !isFiniteNumber(record[key])) {
    throw new Error("备份文件格式不正确。");
  }
}

function assertOptionalNonNegativeNumber(record: Record<string, unknown>, key: string): void {
  if (record[key] !== undefined && !isNonNegativeNumber(record[key])) {
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
      const targetType = gift.targetType;

      if (targetType === undefined || targetType === "sku") {
        assertNonEmptyString(gift, "productId");
      } else if (targetType === "spu") {
        assertNonEmptyString(gift, "spu");
      } else {
        throw new Error("备份文件格式不正确。");
      }

      if (!isPositiveInteger(gift.quantity)) {
        throw new Error("备份文件格式不正确。");
      }
    }
  }
}

function validateCampaignGift(value: unknown): void {
  assertRecord(value, "备份文件格式不正确。");
  assertBoolean(value, "enabled");
  assertString(value, "activityName");
  assertString(value, "defaultProductId");
  assertBoolean(value, "requireSaleLine");
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

  if (setting.campaignGift !== undefined) {
    validateCampaignGift(setting.campaignGift);
  }

  if (setting.fieldLock !== undefined) {
    assertRecord(setting.fieldLock, "备份文件格式不正确。");
    assertBoolean(setting.fieldLock, "enabled");
    if (setting.fieldLock.pinHash !== undefined) {
      assertString(setting.fieldLock, "pinHash");
    }
    if (setting.fieldLock.pinSalt !== undefined) {
      assertString(setting.fieldLock, "pinSalt");
    }
    if (setting.fieldLock.unlockExpiresAt !== undefined) {
      assertString(setting.fieldLock, "unlockExpiresAt");
    }
    if (setting.fieldLock.lockedUntil !== undefined) {
      assertString(setting.fieldLock, "lockedUntil");
    }
    if (!isNonNegativeInteger(setting.fieldLock.failedAttempts)) {
      throw new Error("备份文件格式不正确。");
    }
  }
}

function validateProducts(products: unknown[]): asserts products is Product[] {
  const productCodes = new Set<string>();

  for (const product of products) {
    assertRecord(product, "备份文件格式不正确。");
    assertString(product, "id");
    assertString(product, "name");
    assertString(product, "spu");
    assertOptionalString(product, "spuCode");
    assertOptionalString(product, "skuCode");
    assertOptionalString(product, "productCode");
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

    if (isNonEmptyString(product.productCode)) {
      const normalizedProductCode = product.productCode.trim();
      if (productCodes.has(normalizedProductCode)) {
        throw new Error("完整商品编码重复。");
      }

      productCodes.add(normalizedProductCode);
    }
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

    if (order.cancelReason !== undefined && !ORDER_CANCEL_REASONS.has(String(order.cancelReason))) {
      throw new Error("备份文件格式不正确。");
    }

    if (order.cancelNote !== undefined && !isString(order.cancelNote)) {
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

    if (!isPositiveInteger(item.quantity)) {
      throw new Error("备份文件格式不正确。");
    }

    assertNonNegativeNumber(item, "originalUnitPrice");
    assertNonNegativeNumber(item, "finalUnitPrice");
    assertEnum(item, "lineType", ORDER_LINE_TYPES);
    assertNonNegativeNumber(item, "lineTotal");
    assertOptionalNonNegativeNumber(item, "unitCostSnapshot");
    assertOptionalNonNegativeNumber(item, "costTotal");
    assertOptionalFiniteNumber(item, "grossProfit");
  }
}

function validateInventoryLogs(inventoryLogs: unknown[]): asserts inventoryLogs is InventoryLog[] {
  for (const log of inventoryLogs) {
    assertRecord(log, "备份文件格式不正确。");
    assertString(log, "id");
    assertString(log, "productId");
    assertString(log, "orderId");
    const changeQty = log.changeQty;
    const beforeQty = log.beforeQty;
    const afterQty = log.afterQty;

    if (typeof changeQty !== "number" || !Number.isInteger(changeQty) || changeQty === 0) {
      throw new Error("备份文件格式不正确。");
    }

    assertEnum(log, "reason", INVENTORY_REASONS);

    if (!isNonNegativeInteger(beforeQty) || !isNonNegativeInteger(afterQty)) {
      throw new Error("备份文件格式不正确。");
    }

    if (afterQty !== beforeQty + changeQty) {
      throw new Error("备份文件格式不正确。");
    }

    assertString(log, "createdAt");
  }
}

function validateOrderRefunds(orderRefunds: unknown[]): asserts orderRefunds is OrderRefund[] {
  for (const refund of orderRefunds) {
    assertRecord(refund, "备份文件格式不正确。");
    assertString(refund, "id");
    assertString(refund, "orderId");
    const amount = refund.amount;

    if (!isFiniteNumber(amount) || amount <= 0) {
      throw new Error("备份文件格式不正确。");
    }

    assertEnum(refund, "method", PAYMENT_METHODS);
    assertEnum(refund, "reason", REFUND_REASONS);
    assertOptionalString(refund, "note");
    assertString(refund, "createdAt");
  }
}

function validateImages(images: unknown[]): asserts images is BackupImage[] {
  for (const image of images) {
    assertRecord(image, "备份文件格式不正确。");
    assertNonEmptyString(image, "id");
    assertNonEmptyString(image, "mimeType");
    assertString(image, "originalName");
    assertString(image, "createdAt");
    assertNonEmptyString(image, "dataBase64");
  }
}

function validateBackupData(data: {
  products: unknown[];
  settings: unknown[];
  orders: unknown[];
  orderItems: unknown[];
  inventoryLogs: unknown[];
  orderRefunds: unknown[];
  images: unknown[];
}): asserts data is BackupData {
  validateSettings(data.settings);
  validateProducts(data.products);
  validateOrders(data.orders);
  validateOrderItems(data.orderItems);
  validateInventoryLogs(data.inventoryLogs);
  validateOrderRefunds(data.orderRefunds);
  validateImages(data.images);
}

function parseBackupPayload(text: string): ParsedBackupPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("备份文件不是有效的 JSON。");
  }

  assertRecord(parsed, "备份文件格式不正确。");

  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== BACKUP_VERSION) {
    throw new Error("不支持的备份版本。");
  }

  assertRecord(parsed.data, "备份文件格式不正确。");

  const data = {
    products: readArray(parsed.data, "products"),
    settings: readArray(parsed.data, "settings"),
    orders: readArray(parsed.data, "orders"),
    orderItems: readArray(parsed.data, "orderItems"),
    inventoryLogs: readArray(parsed.data, "inventoryLogs"),
    orderRefunds: parsed.version === 3 || parsed.version === 4 ? readArray(parsed.data, "orderRefunds") : [],
    images: parsed.version === 1 ? [] : readArray(parsed.data, "images")
  };

  validateBackupData(data);

  return {
    version: parsed.version,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    note: parsed.version === 1 ? LEGACY_IMAGE_BACKUP_NOTE : IMAGE_BACKUP_NOTE,
    data: normalizeBackupData(data)
  };
}

function normalizeBackupData(data: BackupData): BackupData {
  return {
    ...data,
    settings: data.settings.map((setting) => ({
      ...setting,
      campaignGift: normalizeCampaignGiftForBackup(setting.campaignGift),
      fieldLock: createDefaultFieldLockSettings()
    }))
  };
}

function normalizeCampaignGiftForBackup(campaignGift: AppSettings["campaignGift"]): AppSettings["campaignGift"] {
  const defaults = createDefaultCampaignGiftConfig();

  return {
    enabled: campaignGift?.enabled ?? defaults.enabled,
    activityName: campaignGift?.activityName.trim() || defaults.activityName,
    defaultProductId: campaignGift?.defaultProductId ?? defaults.defaultProductId,
    requireSaleLine: campaignGift?.requireSaleLine ?? defaults.requireSaleLine
  };
}

async function readFileText(file: File): Promise<string> {
  return file.text();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function imageToBackupImage(image: StoredImage): Promise<BackupImage> {
  return {
    id: image.id,
    mimeType: image.mimeType,
    originalName: image.originalName,
    createdAt: image.createdAt,
    dataBase64: bytesToBase64(new Uint8Array(await readBlobAsArrayBuffer(image.blob)))
  };
}

function readBlobAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error("图片读取失败。"));
    };
    reader.readAsArrayBuffer(blob);
  });
}

function backupImageToStoredImage(image: BackupImage): StoredImage {
  const bytes = base64ToBytes(image.dataBase64);
  const blobBytes = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobBytes).set(bytes);

  return {
    id: image.id,
    blob: new Blob([blobBytes], { type: image.mimeType }),
    mimeType: image.mimeType,
    originalName: image.originalName,
    createdAt: image.createdAt
  };
}

export async function replaceAllDataInTransaction(data: BackupData): Promise<void> {
  await db.transaction(
    "rw",
    [db.products, db.images, db.settings, db.orders, db.orderItems, db.inventoryLogs, db.orderRefunds],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.images.clear(),
        db.settings.clear(),
        db.orders.clear(),
        db.orderItems.clear(),
        db.inventoryLogs.clear(),
        db.orderRefunds.clear()
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

      if (data.orderRefunds.length > 0) {
        await db.orderRefunds.bulkPut(data.orderRefunds);
      }

      if (data.images.length > 0) {
        await db.images.bulkPut(data.images.map(backupImageToStoredImage));
      }
    }
  );
}

export async function exportJsonBackup(): Promise<void> {
  const images = await db.images.toArray();
  const payload: BackupPayloadV4 = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    note: IMAGE_BACKUP_NOTE,
    data: {
      products: await db.products.toArray(),
      settings: (await db.settings.toArray()).map((setting) => ({
        ...setting,
        campaignGift: normalizeCampaignGiftForBackup(setting.campaignGift),
        fieldLock: sanitizeFieldLockForBackup(setting.fieldLock)
      })),
      orders: await db.orders.toArray(),
      orderItems: await db.orderItems.toArray(),
      inventoryLogs: await db.inventoryLogs.toArray(),
      orderRefunds: await db.orderRefunds.toArray(),
      images: await Promise.all(images.map(imageToBackupImage))
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });

  saveAs(blob, `ecrm-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function importJsonBackup(file: File): Promise<BackupImportResult> {
  return importJsonBackupFromText(await readFileText(file));
}

export async function importJsonBackupFromText(text: string, deps: ImportDeps = {}): Promise<BackupImportResult> {
  const payload = parseBackupPayload(text);
  const importer = deps.importData ?? replaceAllDataInTransaction;

  await importer(payload.data);

  return {
    version: payload.version,
    includedImages: payload.version !== 1,
    imageCount: payload.data.images.length
  };
}

export { IMAGE_BACKUP_NOTE };
