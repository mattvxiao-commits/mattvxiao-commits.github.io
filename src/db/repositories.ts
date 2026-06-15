import type { AppSettings, InventoryLog, Order, OrderItem, Product } from "../domain/types";
import { createDefaultSettings, db, type StoredImage } from "./db";

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function listProducts(): Promise<Product[]> {
  return db.products.orderBy("createdAt").toArray();
}

export async function upsertProduct(product: Product): Promise<void> {
  await db.products.put(product);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export async function saveImage(file: File): Promise<StoredImage> {
  const image: StoredImage = {
    id: makeId("image"),
    blob: file,
    mimeType: file.type,
    originalName: file.name,
    createdAt: new Date().toISOString()
  };

  await db.images.put(image);
  return image;
}

export async function getImage(id?: string): Promise<StoredImage | undefined> {
  if (!id) {
    return undefined;
  }

  return db.images.get(id);
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("settings");
  if (existing) {
    return existing;
  }

  const settings = createDefaultSettings();
  await db.settings.put(settings);
  return settings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put(settings);
}

export async function savePaidOrder(input: {
  order: Order;
  orderItems: OrderItem[];
  inventoryLogs: InventoryLog[];
  updatedProducts: Product[];
}): Promise<void> {
  if (input.order.status !== "paid") {
    throw new Error("订单状态必须为已支付");
  }

  if (input.orderItems.length === 0) {
    throw new Error("订单明细不能为空");
  }

  if (input.orderItems.some((item) => item.orderId !== input.order.id)) {
    throw new Error("订单明细归属订单不一致");
  }

  if (input.inventoryLogs.some((log) => log.orderId !== input.order.id)) {
    throw new Error("库存流水归属订单不一致");
  }

  if (input.updatedProducts.length === 0) {
    throw new Error("更新商品不能为空");
  }

  await db.transaction("rw", db.orders, db.orderItems, db.inventoryLogs, db.products, async () => {
    await db.orders.put(input.order);
    await db.orderItems.bulkPut(input.orderItems);

    if (input.inventoryLogs.length > 0) {
      await db.inventoryLogs.bulkPut(input.inventoryLogs);
    }

    await db.products.bulkPut(input.updatedProducts);
  });
}

export async function listOrders(): Promise<Order[]> {
  return db.orders.orderBy("createdAt").reverse().toArray();
}

export async function listOrderItems(orderId: string): Promise<OrderItem[]> {
  return db.orderItems.where("orderId").equals(orderId).toArray();
}

export async function clearAllData(): Promise<void> {
  // Only for full data replacement or backup restore flows. Callers must complete backup validation first.
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
    }
  );
}
