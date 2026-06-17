import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import { db } from "./db";
import { listInventoryLogsForOrder, savePaidOrder, voidPaidOrder } from "./repositories";
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

function paidGiftOrder(): Order {
  return {
    ...paidOrder(),
    id: "order-with-gift",
    orderNo: "ECRM-20260615-120000-002",
    subtotalBeforeDiscount: 35,
    payableAmount: 35,
    triggeredGiftTier: 35
  };
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

describe("listInventoryLogsForOrder", () => {
  test("lists inventory logs for one order sorted by created time", async () => {
    await db.inventoryLogs.bulkPut([
      {
        id: "log-late",
        productId: "product-1",
        orderId: "order-1",
        changeQty: -1,
        reason: "order_paid",
        beforeQty: 9,
        afterQty: 8,
        createdAt: "2026-06-17T10:02:00.000Z"
      },
      {
        id: "log-other",
        productId: "product-1",
        orderId: "order-2",
        changeQty: -1,
        reason: "order_paid",
        beforeQty: 8,
        afterQty: 7,
        createdAt: "2026-06-17T10:03:00.000Z"
      },
      {
        id: "log-early",
        productId: "product-2",
        orderId: "order-1",
        changeQty: -2,
        reason: "gift_order_paid",
        beforeQty: 5,
        afterQty: 3,
        createdAt: "2026-06-17T10:01:00.000Z"
      }
    ]);

    await expect(listInventoryLogsForOrder("order-1")).resolves.toEqual([
      expect.objectContaining({ id: "log-early" }),
      expect.objectContaining({ id: "log-late" })
    ]);
  });
});

describe("voidPaidOrder", () => {
  test("voids a paid order and rolls inventory back from current stock", async () => {
    const voidedAt = "2026-06-17T10:00:00.000Z";

    await db.products.bulkPut([
      product({ id: "normal", name: "普通商品", stockQty: 4, updatedAt: "2026-06-17T09:00:00.000Z" }),
      product({ id: "gift", name: "赠品", stockQty: 1, updatedAt: "2026-06-17T09:00:00.000Z" })
    ]);
    await db.orders.put(paidGiftOrder());
    await db.inventoryLogs.bulkPut([
      {
        id: "normal-deduct",
        productId: "normal",
        orderId: "order-with-gift",
        changeQty: -2,
        reason: "order_paid",
        beforeQty: 10,
        afterQty: 8,
        createdAt: "2026-06-15T12:00:01.000Z"
      },
      {
        id: "gift-deduct",
        productId: "gift",
        orderId: "order-with-gift",
        changeQty: -1,
        reason: "gift_order_paid",
        beforeQty: 3,
        afterQty: 2,
        createdAt: "2026-06-15T12:00:02.000Z"
      }
    ]);

    await expect(voidPaidOrder("order-with-gift", new Date(voidedAt))).resolves.toEqual(
      expect.objectContaining({
        id: "order-with-gift",
        status: "cancelled",
        cancelledAt: voidedAt
      })
    );

    await expect(db.products.get("normal")).resolves.toEqual(expect.objectContaining({ stockQty: 6, updatedAt: voidedAt }));
    await expect(db.products.get("gift")).resolves.toEqual(expect.objectContaining({ stockQty: 2, updatedAt: voidedAt }));

    const rollbackLogs = await db.inventoryLogs
      .where("orderId")
      .equals("order-with-gift")
      .filter((log) => log.reason === "order_cancelled_rollback")
      .sortBy("productId");

    expect(rollbackLogs).toEqual([
      expect.objectContaining({
        productId: "gift",
        changeQty: 1,
        beforeQty: 1,
        afterQty: 2,
        createdAt: voidedAt
      }),
      expect.objectContaining({
        productId: "normal",
        changeQty: 2,
        beforeQty: 4,
        afterQty: 6,
        createdAt: voidedAt
      })
    ]);
  });

  test("stores cancel reason and note when voiding a paid order", async () => {
    const voidedAt = "2026-06-17T10:30:00.000Z";

    await db.products.put(product({ id: "normal", stockQty: 5 }));
    await db.orders.put(paidOrder());
    await db.inventoryLogs.bulkPut(inventoryLogs());

    await expect(
      voidPaidOrder(
        "order-1",
        {
          cancelReason: "customer_cancelled",
          cancelNote: "客户临时改为不购买。"
        },
        new Date(voidedAt)
      )
    ).resolves.toEqual(
      expect.objectContaining({
        id: "order-1",
        status: "cancelled",
        cancelledAt: voidedAt,
        cancelReason: "customer_cancelled",
        cancelNote: "客户临时改为不购买。"
      })
    );

    await expect(db.orders.get("order-1")).resolves.toEqual(
      expect.objectContaining({
        cancelReason: "customer_cancelled",
        cancelNote: "客户临时改为不购买。"
      })
    );
  });

  test("uses mistake as the default cancel reason for legacy void calls", async () => {
    await db.products.put(product({ id: "normal", stockQty: 5 }));
    await db.orders.put(paidOrder());
    await db.inventoryLogs.bulkPut(inventoryLogs());

    await voidPaidOrder("order-1", new Date("2026-06-17T10:35:00.000Z"));

    await expect(db.orders.get("order-1")).resolves.toEqual(
      expect.objectContaining({
        cancelReason: "mistake"
      })
    );
  });

  test("stores blank cancel notes as undefined", async () => {
    await db.products.put(product({ id: "normal", stockQty: 5 }));
    await db.orders.put(paidOrder());
    await db.inventoryLogs.bulkPut(inventoryLogs());

    await voidPaidOrder("order-1", {
      cancelReason: "other",
      cancelNote: "   "
    });

    await expect(db.orders.get("order-1")).resolves.toEqual(
      expect.objectContaining({
        cancelReason: "other",
        cancelNote: undefined
      })
    );
  });

  test("rejects voiding an order that is not paid", async () => {
    await db.orders.put({ ...paidOrder(), status: "cancelled", cancelledAt: now });

    await expect(voidPaidOrder("order-1")).rejects.toThrow("只有已支付订单可以作废。");
  });

  test("rejects voiding a pending payment order", async () => {
    await db.orders.put({ ...paidOrder(), status: "pending_payment", paidAt: undefined, paymentMethod: undefined });

    await expect(voidPaidOrder("order-1")).rejects.toThrow("只有已支付订单可以作废。");
  });

  test("rejects voiding the same order twice without writing duplicate rollback logs", async () => {
    await db.products.put(product({ id: "normal", stockQty: 5 }));
    await db.orders.put(paidOrder());
    await db.inventoryLogs.bulkPut(inventoryLogs());

    await voidPaidOrder("order-1", new Date("2026-06-17T10:00:00.000Z"));
    await expect(voidPaidOrder("order-1", new Date("2026-06-17T10:05:00.000Z"))).rejects.toThrow("只有已支付订单可以作废。");

    const logs = await db.inventoryLogs.where("orderId").equals("order-1").toArray();
    expect(logs.filter((log) => log.reason === "order_cancelled_rollback")).toHaveLength(1);
    await expect(db.products.get("normal")).resolves.toEqual(expect.objectContaining({ stockQty: 6 }));
  });

  test("rejects voiding a paid order without rollback inventory logs", async () => {
    await db.orders.put(paidOrder());

    await expect(voidPaidOrder("order-1")).rejects.toThrow("订单缺少可回滚的库存流水。");
    await expect(db.orders.get("order-1")).resolves.toEqual(expect.objectContaining({ status: "paid" }));
  });

  test("rejects voiding a paid order with invalid positive deduction logs", async () => {
    await db.products.put(product({ id: "product-1", stockQty: 5 }));
    await db.orders.put(paidOrder());
    await db.inventoryLogs.bulkPut([
      {
        id: "valid-deduct",
        productId: "product-1",
        orderId: "order-1",
        changeQty: -1,
        reason: "order_paid",
        beforeQty: 10,
        afterQty: 9,
        createdAt: "2026-06-17T09:00:00.000Z"
      },
      {
        id: "invalid-deduct",
        productId: "product-1",
        orderId: "order-1",
        changeQty: 1,
        reason: "order_paid",
        beforeQty: 9,
        afterQty: 10,
        createdAt: "2026-06-17T09:01:00.000Z"
      }
    ]);

    await expect(voidPaidOrder("order-1")).rejects.toThrow("订单库存扣减流水异常，无法回滚库存。");

    await expect(db.orders.get("order-1")).resolves.toEqual(expect.objectContaining({ status: "paid" }));
    await expect(db.products.get("product-1")).resolves.toEqual(expect.objectContaining({ stockQty: 5 }));
    const logs = await db.inventoryLogs.where("orderId").equals("order-1").toArray();
    expect(logs.some((log) => log.reason === "order_cancelled_rollback")).toBe(false);
  });

  test("keeps order and product unchanged when rollback product is missing", async () => {
    await db.orders.put(paidOrder());
    await db.inventoryLogs.bulkPut(inventoryLogs());

    await expect(voidPaidOrder("order-1")).rejects.toThrow("订单关联商品不存在，无法回滚库存。");

    await expect(db.orders.get("order-1")).resolves.toEqual(expect.objectContaining({ status: "paid" }));
    const logs = await db.inventoryLogs.where("orderId").equals("order-1").toArray();
    expect(logs.some((log) => log.reason === "order_cancelled_rollback")).toBe(false);
  });
});
