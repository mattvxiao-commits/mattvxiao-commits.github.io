import { normalizeMoney } from "./money";
import type { NonSalesReason, OrderItem, OrderLineRevenueType, OrderNature } from "./types";

export type NormalizedOrderLine = OrderItem & {
  revenueType: OrderLineRevenueType;
  nonSalesReason?: NonSalesReason;
  statisticalUnitPrice: number;
  statisticalSubtotal: number;
  discountGiveawayAmount: number;
};

export type LineAccounting = {
  revenue: number;
  discountGiveawayAmount: number;
  salesCost: number;
  basicGrossProfit: number;
  tierGiftCost: number;
  campaignGiftCost: number;
  operatingActivityCost: number;
  manualGiftCost: number;
  otherNonSalesCost: number;
  nonOperatingOutboundCost: number;
  fullOutboundCost: number;
};

export function getNormalizedOrderLine(item: OrderItem): NormalizedOrderLine {
  const revenueType = inferRevenueType(item);
  const statisticalUnitPrice =
    item.statisticalUnitPrice ?? (revenueType === "sale" ? item.finalUnitPrice : 0);
  const statisticalSubtotal =
    item.statisticalSubtotal ?? normalizeMoney(statisticalUnitPrice * item.quantity);

  return {
    ...item,
    revenueType,
    nonSalesReason: inferNonSalesReason(item, revenueType),
    statisticalUnitPrice: normalizeMoney(statisticalUnitPrice),
    statisticalSubtotal: normalizeMoney(statisticalSubtotal),
    discountGiveawayAmount: normalizeMoney(
      item.discountGiveawayAmount ?? inferDiscountGiveawayAmount(item, revenueType)
    )
  };
}

export function isRevenueLine(item: OrderItem): boolean {
  return getNormalizedOrderLine(item).revenueType === "sale";
}

export function isNonSalesLine(item: OrderItem): boolean {
  return getNormalizedOrderLine(item).revenueType === "non_sales";
}

export function deriveOrderNature(items: OrderItem[]): OrderNature {
  const hasSale = items.some(isRevenueLine);
  const hasNonSales = items.some(isNonSalesLine);

  if (hasSale && hasNonSales) {
    return "mixed";
  }

  if (hasNonSales) {
    return "non_sales";
  }

  return "sale";
}

export function getLineAccounting(item: OrderItem): LineAccounting {
  const line = getNormalizedOrderLine(item);
  const costTotal = normalizeMoney(line.costTotal ?? 0);
  const revenue = line.revenueType === "sale" ? line.statisticalSubtotal : 0;
  const salesCost = line.revenueType === "sale" ? costTotal : 0;
  const tierGiftCost = line.nonSalesReason === "tier_gift" ? costTotal : 0;
  const campaignGiftCost = line.nonSalesReason === "campaign_gift" ? costTotal : 0;
  const manualGiftCost = line.nonSalesReason === "manual_gift" ? costTotal : 0;
  const otherNonSalesCost = line.nonSalesReason === "other_non_sales" ? costTotal : 0;
  const operatingActivityCost = normalizeMoney(tierGiftCost + campaignGiftCost);
  const nonOperatingOutboundCost = normalizeMoney(manualGiftCost + otherNonSalesCost);

  return {
    revenue,
    discountGiveawayAmount: line.revenueType === "sale" ? line.discountGiveawayAmount : 0,
    salesCost,
    basicGrossProfit: normalizeMoney(revenue - salesCost),
    tierGiftCost,
    campaignGiftCost,
    operatingActivityCost,
    manualGiftCost,
    otherNonSalesCost,
    nonOperatingOutboundCost,
    fullOutboundCost: normalizeMoney(salesCost + operatingActivityCost + nonOperatingOutboundCost)
  };
}

function inferRevenueType(item: OrderItem): OrderLineRevenueType {
  if (item.revenueType) {
    return item.revenueType;
  }

  return item.lineType === "gift" ? "non_sales" : "sale";
}

function inferNonSalesReason(item: OrderItem, revenueType: OrderLineRevenueType): NonSalesReason | undefined {
  if (revenueType === "sale") {
    return undefined;
  }

  return item.nonSalesReason ?? (item.lineType === "gift" ? "tier_gift" : "other_non_sales");
}

function inferDiscountGiveawayAmount(item: OrderItem, revenueType: OrderLineRevenueType): number {
  if (revenueType !== "sale" || item.lineType !== "discount_addon") {
    return 0;
  }

  return normalizeMoney(Math.max(0, item.originalUnitPrice - item.finalUnitPrice) * item.quantity);
}
