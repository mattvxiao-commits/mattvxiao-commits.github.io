import type { InventoryLog } from "./types";

export type InventorySummaryMetric = {
  productCount: number;
  quantity: number;
};

export type OrderInventorySummary = {
  paidDeduction: InventorySummaryMetric;
  giftDeduction: InventorySummaryMetric;
  rollback: InventorySummaryMetric;
};

type MutableMetric = {
  productIds: Set<string>;
  quantity: number;
};

function createMetric(): MutableMetric {
  return {
    productIds: new Set<string>(),
    quantity: 0
  };
}

function addLog(metric: MutableMetric, log: InventoryLog) {
  metric.productIds.add(log.productId);
  metric.quantity += Math.abs(log.changeQty);
}

function finalizeMetric(metric: MutableMetric): InventorySummaryMetric {
  return {
    productCount: metric.productIds.size,
    quantity: metric.quantity
  };
}

export function buildOrderInventorySummary(inventoryLogs: InventoryLog[]): OrderInventorySummary {
  const paidDeduction = createMetric();
  const giftDeduction = createMetric();
  const rollback = createMetric();

  for (const log of inventoryLogs) {
    if (log.reason === "order_paid") {
      addLog(paidDeduction, log);
      continue;
    }

    if (log.reason === "gift_order_paid") {
      addLog(giftDeduction, log);
      continue;
    }

    if (log.reason === "order_cancelled_rollback") {
      addLog(rollback, log);
    }
  }

  return {
    paidDeduction: finalizeMetric(paidDeduction),
    giftDeduction: finalizeMetric(giftDeduction),
    rollback: finalizeMetric(rollback)
  };
}
