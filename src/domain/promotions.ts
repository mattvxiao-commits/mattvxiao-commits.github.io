import { normalizeMoney } from "./money";
import type {
  CalculatedCart,
  CalculatedCartLine,
  CartItem,
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
  product: Product;
  addedAt: string;
};

type PricedUnit = CartUnit & {
  finalUnitPrice: number;
  lineType: CalculatedCartLine["lineType"];
};

export function calculateCart(input: CalculateCartInput): CalculatedCart {
  const productMap = new Map(input.products.map((product) => [product.id, product]));
  const units = expandCartUnits(input.items, productMap);
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

  const lines = compactPricedUnits(pricedUnits);
  const subtotalBeforeDiscount = normalizeMoney(
    units.reduce((total, unit) => total + unit.product.salePrice, 0)
  );
  const payableAmount = normalizeMoney(lines.reduce((total, line) => total + line.lineTotal, 0));
  const discountAmount = normalizeMoney(subtotalBeforeDiscount - payableAmount);
  const triggeredGiftTier = findGiftTier(promotion.enabled ? promotion.giftTiers : [], payableAmount);
  const giftLines = triggeredGiftTier ? buildGiftLines(triggeredGiftTier, productMap) : [];
  const giftStockWarnings = giftLines
    .filter((line) => line.quantity > productMap.get(line.productId)!.stockQty)
    .map((line) => ({
      productId: line.productId,
      productName: line.productName,
      requiredQty: line.quantity,
      availableQty: productMap.get(line.productId)!.stockQty
    }));

  return {
    lines,
    giftLines,
    subtotalBeforeDiscount,
    discountAmount,
    payableAmount,
    appliedDiscountQty: discountedUnitIndexes.size,
    maxDiscountQty: discountEnabled ? addon.maxDiscountQty : 0,
    triggeredGiftTier,
    giftStockWarnings
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

    lines.push(toLine(unit.product, 1, unit.product.salePrice, unit.finalUnitPrice, unit.lineType));
    return lines;
  }, []);
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
      const product = productMap.get(gift.productId);
      if (!product || gift.quantity <= 0) {
        return undefined;
      }

      return toLine(product, gift.quantity, product.salePrice, 0, "gift");
    })
    .filter((line): line is CalculatedCartLine => line !== undefined);
}

function toLine(
  product: Product,
  quantity: number,
  originalUnitPrice: number,
  finalUnitPrice: number,
  lineType: CalculatedCartLine["lineType"]
): CalculatedCartLine {
  return {
    productId: product.id,
    productName: product.name,
    spu: product.spu,
    productCode: product.productCode,
    quantity,
    originalUnitPrice: normalizeMoney(originalUnitPrice),
    finalUnitPrice: normalizeMoney(finalUnitPrice),
    lineType,
    lineTotal: normalizeMoney(quantity * finalUnitPrice)
  };
}
