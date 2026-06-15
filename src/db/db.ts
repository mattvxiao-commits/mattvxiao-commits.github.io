import Dexie, { type Table } from "dexie";
import type {
  AppSettings,
  InventoryLog,
  Order,
  OrderItem,
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

  constructor() {
    super("ecrm-offline-pos");
    this.version(1).stores({
      products: "id, spu, name, status, createdAt",
      images: "id, createdAt",
      settings: "id",
      orders: "id, orderNo, status, createdAt, paidAt",
      orderItems: "id, orderId, productId, lineType",
      inventoryLogs: "id, productId, orderId, createdAt"
    });
  }
}

export const db = new EcrmDatabase();

const defaultPromotion: PromotionConfig = {
  enabled: true,
  addonDiscount: {
    enabled: true,
    discountSpu: "优惠SPU",
    discountPrice: 3,
    maxDiscountQty: 3
  },
  giftTiers: [
    { threshold: 35, gifts: [{ productId: "gift-a", quantity: 1 }] },
    {
      threshold: 68,
      gifts: [
        { productId: "gift-a", quantity: 2 },
        { productId: "gift-b", quantity: 1 }
      ]
    },
    {
      threshold: 148,
      gifts: [
        { productId: "gift-a", quantity: 5 },
        { productId: "gift-b", quantity: 1 }
      ]
    }
  ]
};

export function createDefaultSettings(): AppSettings {
  return {
    id: "settings",
    shopName: "ECRM 摊位",
    orderPrefix: "ECRM",
    promotion: structuredClone(defaultPromotion)
  };
}
