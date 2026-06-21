import { normalizeMoney } from "./money";
import type {
  CalculatedCart,
  CalculatedCartLine,
  CartItem,
  GiftConfig,
  GiftEntitlement,
  GiftStockWarning,
  GiftTierConfig,
  Product,
  PromotionConfig
} from "./types";

export type CalculateCartInput = {
  items: CartItem[];
  products: Product[];
  promotion: PromotionConfig;
};

type CartUnit = {
  index: number;
  cartItemId?: string;
  product: Product;
  addedAt: string;
};

type PricedUnit = CartUnit & {
  finalUnitPrice: number;
  lineType: CalculatedCartLine["lineType"];
};

export function calculateCart(input: CalculateCartInput): CalculatedCart {
  const productMap = new Map(input.products.map((product) => [product.id, product]));
  const saleItems = input.items.filter((item) => item.revenueType !== "non_sales");
  const nonSalesItems = input.items.filter((item) => item.revenueType === "non_sales");
  const units = expandCartUnits(saleItems, productMap);
  const { promotion } = input;
  const addon = promotion.addonDiscount;
  const discountEnabled =
    promotion.enabled &&
    addon.enabled &&
    addon.discountSpu.trim().length > 0 &&
    addon.maxDiscountQty > 0;

  const addonUnits = discountEnabled
    ? units.filter((unit) => unit.product.spu === addon.discountSpu)
    : [];
  const regularTriggerUnits = discountEnabled
    ? units.filter((unit) => unit.product.spu !== addon.discountSpu)
    : [];
  const discountedUnitIndexes = new Set<number>();

  if (discountEnabled && addonUnits.length > 0) {
    const sortedAddonUnits = [...addonUnits].sort(compareUnits);
    const discountableUnits =
      regularTriggerUnits.length > 0 ? sortedAddonUnits : sortedAddonUnits.slice(1);

    discountableUnits
      .slice(0, addon.maxDiscountQty)
      .forEach((unit) => discountedUnitIndexes.add(unit.index));
  }

  const pricedUnits: PricedUnit[] = units.map((unit) => {
    const isDiscounted = discountedUnitIndexes.has(unit.index);
    return {
      ...unit,
      finalUnitPrice: normalizeMoney(isDiscounted ? addon.discountPrice : unit.product.salePrice),
      lineType: isDiscounted ? "discount_addon" : "normal"
    };
  });

  const saleLines = compactPricedUnits(pricedUnits);
  const nonSalesLines = buildNonSalesLines(nonSalesItems, productMap);
  const lines = [...saleLines, ...nonSalesLines];
  const subtotalBeforeDiscount = normalizeMoney(
    units.reduce((total, unit) => total + unit.product.salePrice, 0)
  );
  const payableAmount = normalizeMoney(saleLines.reduce((total, line) => total + line.lineTotal, 0));
  const discountAmount = normalizeMoney(subtotalBeforeDiscount - payableAmount);
  const triggeredGiftTier = findGiftTier(promotion.enabled ? promotion.giftTiers : [], payableAmount);
  const giftLines = triggeredGiftTier ? buildGiftLines(triggeredGiftTier, productMap) : [];
  const giftEntitlements = triggeredGiftTier ? buildGiftEntitlements(triggeredGiftTier, productMap) : [];
  const giftStockWarnings = triggeredGiftTier
    ? buildGiftStockWarnings(triggeredGiftTier, productMap)
    : [];

  return {
    lines,
    giftLines,
    giftEntitlements,
    subtotalBeforeDiscount,
    discountAmount,
    payableAmount,
    appliedDiscountQty: discountedUnitIndexes.size,
    maxDiscountQty: discountEnabled ? addon.maxDiscountQty : 0,
    triggeredGiftTier,
    giftStockWarnings,
    salesSubtotal: payableAmount,
    nonSalesQuantity: nonSalesLines.reduce((sum, line) => sum + line.quantity, 0) + giftLines.reduce((sum, line) => sum + line.quantity, 0),
    nonSalesCost: normalizeMoney(
      nonSalesLines.reduce((sum, line) => sum + (productMap.get(line.productId)?.costPrice ?? 0) * line.quantity, 0) +
        giftLines.reduce((sum, line) => sum + (productMap.get(line.productId)?.costPrice ?? 0) * line.quantity, 0)
    )
  };
}

function expandCartUnits(items: CartItem[], productMap: Map<string, Product>): CartUnit[] {
  const units: CartUnit[] = [];

  items.forEach((item) => {
    const product = productMap.get(item.productId);
    if (!product || item.quantity <= 0) {
      return;
    }

    for (let i = 0; i < item.quantity; i += 1) {
      units.push({
        index: units.length,
        cartItemId: item.id,
        product,
        addedAt: item.addedAt
      });
    }
  });

  return units;
}

function compareUnits(left: CartUnit, right: CartUnit): number {
  const byAddedAt = left.addedAt.localeCompare(right.addedAt);
  return byAddedAt === 0 ? left.index - right.index : byAddedAt;
}

function compactPricedUnits(units: PricedUnit[]): CalculatedCartLine[] {
  return units.reduce<CalculatedCartLine[]>((lines, unit) => {
    const previous = lines.at(-1);

    if (
      previous &&
      previous.productId === unit.product.id &&
      previous.finalUnitPrice === unit.finalUnitPrice &&
      previous.lineType === unit.lineType
    ) {
      previous.quantity += 1;
      previous.lineTotal = normalizeMoney(previous.quantity * previous.finalUnitPrice);
      return lines;
    }

    lines.push(toLine(unit.product, 1, unit.product.salePrice, unit.finalUnitPrice, unit.lineType, { id: unit.cartItemId, revenueType: "sale" }));
    return lines;
  }, []);
}

function buildNonSalesLines(items: CartItem[], productMap: Map<string, Product>): CalculatedCartLine[] {
  return items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product || item.quantity <= 0) {
        return undefined;
      }

      return toLine(product, item.quantity, product.salePrice, 0, "gift", {
        id: item.id,
        revenueType: "non_sales",
        nonSalesReason: item.nonSalesReason,
        nonSalesNote: item.nonSalesNote,
        campaignNameSnapshot: item.campaignNameSnapshot,
        statisticalUnitPrice: 0,
        statisticalSubtotal: 0,
        discountGiveawayAmount: 0
      });
    })
    .filter((line): line is CalculatedCartLine => line !== undefined);
}

function findGiftTier(tiers: GiftTierConfig[], payableAmount: number): GiftTierConfig | undefined {
  return [...tiers]
    .filter((tier) => payableAmount >= tier.threshold)
    .sort((left, right) => right.threshold - left.threshold)[0];
}

function buildGiftLines(
  tier: GiftTierConfig,
  productMap: Map<string, Product>
): CalculatedCartLine[] {
  return tier.gifts
    .map((gift) => {
      if (gift.targetType === "spu") {
        return undefined;
      }

      const product = productMap.get(gift.productId);
      if (!product || gift.quantity <= 0) {
        return undefined;
      }

      return toLine(product, gift.quantity, product.salePrice, 0, "gift", {
        revenueType: "non_sales",
        nonSalesReason: "tier_gift",
        statisticalUnitPrice: 0,
        statisticalSubtotal: 0,
        discountGiveawayAmount: 0
      });
    })
    .filter((line): line is CalculatedCartLine => line !== undefined);
}

function buildGiftEntitlements(
  tier: GiftTierConfig,
  productMap: Map<string, Product>
): GiftEntitlement[] {
  return tier.gifts
    .map<GiftEntitlement | undefined>((gift) => {
      if (gift.quantity <= 0) {
        return undefined;
      }

      if (gift.targetType === "spu") {
        return {
          targetType: "spu" as const,
          spu: gift.spu,
          label: gift.spu,
          quantity: gift.quantity
        };
      }

      const product = productMap.get(gift.productId);
      if (!product) {
        return undefined;
      }

      return {
        targetType: "sku" as const,
        productId: product.id,
        label: product.name,
        quantity: gift.quantity
      };
    })
    .filter((entitlement): entitlement is GiftEntitlement => entitlement !== undefined);
}

function buildGiftStockWarnings(
  tier: GiftTierConfig,
  productMap: Map<string, Product>
): GiftStockWarning[] {
  return tier.gifts
    .map((gift) => buildGiftStockWarning(gift, productMap))
    .filter((warning): warning is GiftStockWarning => warning !== undefined);
}

function buildGiftStockWarning(
  gift: GiftConfig,
  productMap: Map<string, Product>
): GiftStockWarning | undefined {
  if (gift.quantity <= 0) {
    return undefined;
  }

  if (gift.targetType === "spu") {
    const availableQty = [...productMap.values()]
      .filter((product) => product.spu === gift.spu && product.isGiftEligible && product.status === "active")
      .reduce((sum, product) => sum + product.stockQty, 0);

    if (gift.quantity <= availableQty) {
      return undefined;
    }

    return {
      targetType: "spu",
      spu: gift.spu,
      productName: gift.spu,
      requiredQty: gift.quantity,
      availableQty
    };
  }

  const product = productMap.get(gift.productId);
  if (!product || gift.quantity <= product.stockQty) {
    return undefined;
  }

  return {
    productId: product.id,
    productName: product.name,
    requiredQty: gift.quantity,
    availableQty: product.stockQty
  };
}

function toLine(
  product: Product,
  quantity: number,
  originalUnitPrice: number,
  finalUnitPrice: number,
  lineType: CalculatedCartLine["lineType"],
  patch: Partial<CalculatedCartLine> = {}
): CalculatedCartLine {
  return {
    ...patch,
    productId: product.id,
    productName: product.name,
    spu: product.spu,
    productCode: product.productCode,
    quantity,
    originalUnitPrice: normalizeMoney(originalUnitPrice),
    finalUnitPrice: normalizeMoney(finalUnitPrice),
    lineType,
    lineTotal: normalizeMoney(quantity * finalUnitPrice),
    statisticalUnitPrice: patch.statisticalUnitPrice ?? normalizeMoney(finalUnitPrice),
    statisticalSubtotal: patch.statisticalSubtotal ?? normalizeMoney(quantity * finalUnitPrice),
    discountGiveawayAmount:
      patch.discountGiveawayAmount ??
      normalizeMoney(lineType === "discount_addon" ? Math.max(0, originalUnitPrice - finalUnitPrice) * quantity : 0)
  };
}
