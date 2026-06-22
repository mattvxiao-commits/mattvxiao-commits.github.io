import type { CalculatedCartLine, CartItem, NonSalesReason } from "./types";

const NON_SALES_LINE_PRIORITY: Partial<Record<NonSalesReason, number>> = {
  campaign_gift: 0,
  manual_gift: 1,
  other_non_sales: 2,
  tier_gift: 2
};

function linePriority(line: CalculatedCartLine): number {
  if (line.revenueType === "non_sales" && line.nonSalesReason) {
    return NON_SALES_LINE_PRIORITY[line.nonSalesReason] ?? 2;
  }

  if (line.lineType === "discount_addon") {
    return 3;
  }

  return 4;
}

function buildAddedAtLookup(items: CartItem[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const item of items) {
    if (item.id) {
      lookup.set(`id:${item.id}`, item.addedAt);
    }

    if (!lookup.has(`product:${item.productId}`)) {
      lookup.set(`product:${item.productId}`, item.addedAt);
    }
  }

  return lookup;
}

function resolveAddedAt(line: CalculatedCartLine, lookup: Map<string, string>): string {
  if (line.id) {
    const byId = lookup.get(`id:${line.id}`);
    if (byId) {
      return byId;
    }
  }

  return lookup.get(`product:${line.productId}`) ?? "";
}

export function sortCartLinesForReview(lines: CalculatedCartLine[], items: CartItem[]): CalculatedCartLine[] {
  const addedAtLookup = buildAddedAtLookup(items);

  return lines
    .map((line, index) => ({
      line,
      index,
      priority: linePriority(line),
      addedAt: resolveAddedAt(line, addedAtLookup)
    }))
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority;
      }

      const byAddedAt = right.addedAt.localeCompare(left.addedAt);
      return byAddedAt === 0 ? left.index - right.index : byAddedAt;
    })
    .map(({ line }) => line);
}
