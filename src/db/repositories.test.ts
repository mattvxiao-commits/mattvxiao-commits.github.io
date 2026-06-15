import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import { db } from "./db";
import { savePaidOrder } from "./repositories";
import type { InventoryLog, Order, OrderItem, Product } from "../domain/types";
import { defaultPromotion, product } from "../test/fixtures";

const now = "2026-06-15T12:00:00.000Z";

function paidOrder(): Order {
  return {
    id: "order-1",
    orderNo: "ECRM-20260615-120000-001",
    status: "paid",
    paymentMethod: "cash",
    subtotalBeforeDiscount: 20,
    discountAmount: 0,
    payableAmount: 20,
    promotionSnapshot: defaultPromotion(),
    giftStockWarning: false,
    createdAt: now,
    paidAt: now
  };
}

function orderItems(): OrderItem[] {
  return [
    {
      id: "line-1",
      orderId: "order-1",
      productId: "normal",
      productNameSnapshot: "普通商品",
      spuSnapshot: "普通SPU",
      quantity: 1,
      originalUnitPrice: 20,
      finalUnitPrice: 20,
      lineType: "normal",
      lineTotal: 20
    }
  ];
}

function inventoryLogs(): InventoryLog[] {
  return [
    {
      id: "inventory-1",
      productId: "normal",
      orderId: "order-1",
      changeQty: -1,
      reason: "order_paid",
      beforeQty: 10,
      afterQty: 9,
      createdAt: now
    }
  ];
}

function updatedProducts(): Product[] {
  return [
    product({
      id: "normal",
      name: "普通商品",
      spu: "普通SPU",
      salePrice: 20,
      stockQty: 9
    })
  ];
}

async function clearDb() {
  await db.transaction("rw", [db.products, db.images, db.settings, db.orders, db.orderItems, db.inventoryLogs], async () => {
    await Promise.all([
      db.products.clear(),
      db.images.clear(),
      db.settings.clear(),
      db.orders.clear(),
      db.orderItems.clear(),
      db.inventoryLogs.clear()
    ]);
  });
}

afterEach(async () => {
  await clearDb();
});

describe("savePaidOrder", () => {
  test("deducts inventory from current database stock inside the save transaction", async () => {
    await db.products.put(
      product({
        id: "normal",
        name: "当前商品名",
        spu: "当前SPU",
        salePrice: 20,
        stockQty: 5
      })
    );

    await savePaidOrder({
      order: paidOrder(),
      orderItems: orderItems(),
      inventoryLogs: inventoryLogs(),
      updatedProducts: updatedProducts()
    });

    const storedProduct = await db.products.get("normal");
    const storedLogs = await db.inventoryLogs.toArray();

    expect(storedProduct).toMatchObject({
      id: "normal",
      name: "当前商品名",
      spu: "当前SPU",
      stockQty: 4
    });
    expect(storedLogs).toEqual([
      expect.objectContaining({
        productId: "normal",
        beforeQty: 5,
        afterQty: 4,
        changeQty: -1
      })
    ]);
  });

  test("rejects paid orders when current database stock is insufficient", async () => {
    await db.products.put(product({ id: "normal", name: "普通商品", stockQty: 0 }));

    await expect(
      savePaidOrder({
        order: paidOrder(),
        orderItems: orderItems(),
        inventoryLogs: inventoryLogs(),
        updatedProducts: updatedProducts()
      })
    ).rejects.toThrow("商品 普通商品 库存不足，无法完成订单扣减");

    expect(await db.orders.count()).toBe(0);
    expect(await db.orderItems.count()).toBe(0);
    expect(await db.inventoryLogs.count()).toBe(0);
    expect((await db.products.get("normal"))?.stockQty).toBe(0);
  });
});
