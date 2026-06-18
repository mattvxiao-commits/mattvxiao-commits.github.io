import Dexie, { type Table } from "dexie";
import { createDefaultFieldLockSettings } from "../domain/fieldLock";
import type {
  AppSettings,
  InventoryLog,
  Order,
  OrderItem,
  OrderRefund,
  Product,
  PromotionConfig
} from "../domain/types";

export type StoredImage = {
  id: string;
  blob: Blob;
  mimeType: string;
  originalName: string;
  createdAt: string;
};

export class EcrmDatabase extends Dexie {
  products!: Table<Product, string>;
  images!: Table<StoredImage, string>;
  settings!: Table<AppSettings, string>;
  orders!: Table<Order, string>;
  orderItems!: Table<OrderItem, string>;
  inventoryLogs!: Table<InventoryLog, string>;
  orderRefunds!: Table<OrderRefund, string>;

  constructor() {
    super("ecrm-offline-pos");
    this.version(1).stores({
      products:
        "id, spu, name, status, salePrice, stockQty, isSellable, isGiftEligible, createdAt, [status+isSellable], [status+isGiftEligible]",
      images: "id, createdAt",
      settings: "id",
      orders: "id, &orderNo, status, createdAt, paidAt, [status+paidAt]",
      orderItems: "id, orderId, productId, lineType",
      inventoryLogs: "id, productId, orderId, createdAt"
    });
    this.version(2).stores({
      products:
        "id, spu, name, status, salePrice, stockQty, isSellable, isGiftEligible, createdAt, [status+isSellable], [status+isGiftEligible]",
      images: "id, createdAt",
      settings: "id",
      orders: "id, &orderNo, status, createdAt, paidAt, [status+paidAt]",
      orderItems: "id, orderId, productId, lineType",
      inventoryLogs: "id, productId, orderId, createdAt",
      orderRefunds: "id, orderId, createdAt"
    });
    this.version(3).stores({
      products:
        "id, spu, name, status, salePrice, stockQty, isSellable, isGiftEligible, createdAt, [status+isSellable], [status+isGiftEligible]",
      images: "id, createdAt",
      settings: "id",
      orders: "id, &orderNo, status, createdAt, paidAt, [status+paidAt]",
      orderItems: "id, orderId, productId, lineType",
      inventoryLogs: "id, productId, orderId, createdAt",
      orderRefunds: "id, orderId, createdAt"
    });
  }
}

export const db = new EcrmDatabase();

const defaultPromotion: PromotionConfig = {
  enabled: false,
  addonDiscount: {
    enabled: false,
    discountSpu: "",
    discountPrice: 3,
    maxDiscountQty: 3
  },
  giftTiers: [
    { threshold: 35, gifts: [] },
    { threshold: 68, gifts: [] },
    { threshold: 148, gifts: [] }
  ]
};

export function createDefaultSettings(): AppSettings {
  return {
    id: "settings",
    shopName: "ECRM 摊位",
    orderPrefix: "ECRM",
    promotion: structuredClone(defaultPromotion),
    fieldLock: createDefaultFieldLockSettings()
  };
}
