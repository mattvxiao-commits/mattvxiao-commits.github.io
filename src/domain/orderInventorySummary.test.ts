import { describe, expect, it } from "vitest";
import type { InventoryLog } from "./types";
import { buildOrderInventorySummary } from "./orderInventorySummary";

function inventoryLog(overrides: Partial<InventoryLog> = {}): InventoryLog {
  return {
    id: "log-1",
    productId: "sku-normal",
    orderId: "order-1",
    changeQty: -1,
    reason: "order_paid",
    beforeQty: 10,
    afterQty: 9,
    createdAt: "2026-06-17T09:35:01.000Z",
    ...overrides
  };
}

describe("buildOrderInventorySummary", () => {
  it("summarizes paid, gift, and rollback inventory logs", () => {
    const summary = buildOrderInventorySummary([
      inventoryLog({ id: "paid-1", productId: "sku-normal", changeQty: -2, reason: "order_paid" }),
      inventoryLog({ id: "gift-1", productId: "sku-gift", changeQty: -1, reason: "gift_order_paid" }),
      inventoryLog({ id: "rollback-1", productId: "sku-normal", changeQty: 2, reason: "order_cancelled_rollback" })
    ]);

    expect(summary).toEqual({
      paidDeduction: { productCount: 1, quantity: 2 },
      giftDeduction: { productCount: 1, quantity: 1 },
      rollback: { productCount: 1, quantity: 2 }
    });
  });

  it("counts each product once while accumulating quantities", () => {
    const summary = buildOrderInventorySummary([
      inventoryLog({ id: "paid-1", productId: "sku-normal", changeQty: -1, reason: "order_paid" }),
      inventoryLog({ id: "paid-2", productId: "sku-normal", changeQty: -3, reason: "order_paid" }),
      inventoryLog({ id: "paid-3", productId: "sku-other", changeQty: -2, reason: "order_paid" })
    ]);

    expect(summary.paidDeduction).toEqual({ productCount: 2, quantity: 6 });
  });

  it("returns zero metrics for empty logs", () => {
    expect(buildOrderInventorySummary([])).toEqual({
      paidDeduction: { productCount: 0, quantity: 0 },
      giftDeduction: { productCount: 0, quantity: 0 },
      rollback: { productCount: 0, quantity: 0 }
    });
  });
});
