import { normalizeMoney } from "./money";
import type { CalculatedCart, CalculatedCartLine, Product } from "./types";

export type GiftSelectionOption = {
  productId: string;
  productName: string;
  productCode?: string;
  availableQty: number;
};

export type GiftSelectionRequirement = {
  key: string;
  spu: string;
  label: string;
  requiredQty: number;
  options: GiftSelectionOption[];
};

export type GiftSelections = Record<string, Record<string, number>>;

export type GiftSelectionValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function buildGiftSelectionRequirements(
  calculated: CalculatedCart,
  products: Product[]
): GiftSelectionRequirement[] {
  return calculated.giftEntitlements
    .filter((entitlement) => entitlement.targetType === "spu" && entitlement.spu && entitlement.quantity > 0)
    .map((entitlement) => {
      const spu = entitlement.spu!;

      return {
        key: requirementKey(spu),
        spu,
        label: entitlement.label,
        requiredQty: entitlement.quantity,
        options: products
          .filter((product) => product.spu === spu && product.isGiftEligible && product.status === "active")
          .sort(compareGiftOptions)
          .map((product) => ({
            productId: product.id,
            productName: product.name,
            productCode: product.productCode,
            availableQty: product.stockQty
          }))
      };
    });
}

function compareGiftOptions(left: Product, right: Product): number {
  const leftCode = left.productCode?.trim();
  const rightCode = right.productCode?.trim();

  if (leftCode || rightCode) {
    return (leftCode ?? "").localeCompare(rightCode ?? "", "zh-Hans-CN");
  }

  return left.name.localeCompare(right.name, "zh-Hans-CN");
}

export function validateGiftSelections(input: {
  requirements: GiftSelectionRequirement[];
  selections: GiftSelections;
}): GiftSelectionValidationResult {
  for (const requirement of input.requirements) {
    const selection = input.selections[requirement.key] ?? {};
    const selectedQty = sumSelection(selection);

    for (const option of requirement.options) {
      const quantity = selection[option.productId] ?? 0;
      if (quantity > option.availableQty) {
        return {
          ok: false,
          message: `${option.productName} 库存不足，最多可选 ${option.availableQty} 个。`
        };
      }
    }

    if (selectedQty < requirement.requiredQty) {
      return {
        ok: false,
        message: `${requirement.label} 还需要选择 ${requirement.requiredQty - selectedQty} 个赠品。`
      };
    }

    if (selectedQty > requirement.requiredQty) {
      return {
        ok: false,
        message: `${requirement.label} 最多选择 ${requirement.requiredQty} 个赠品。`
      };
    }
  }

  return { ok: true };
}

export function resolveGiftLines(input: {
  calculated: CalculatedCart;
  products: Product[];
  selections: GiftSelections;
}): CalculatedCartLine[] {
  const productById = new Map(input.products.map((product) => [product.id, product]));
  const requirements = buildGiftSelectionRequirements(input.calculated, input.products);
  const selectedLines = requirements.flatMap((requirement) => {
    const selection = input.selections[requirement.key] ?? {};

    return Object.entries(selection).flatMap(([productId, quantity]) => {
      if (quantity <= 0) {
        return [];
      }

      const product = productById.get(productId);
      if (!product) {
        return [];
      }

      return [toGiftLine(product, quantity)];
    });
  });

  return [...input.calculated.giftLines, ...selectedLines];
}

export function requirementKey(spu: string): string {
  return `spu:${spu}`;
}

function sumSelection(selection: Record<string, number>): number {
  return Object.values(selection).reduce((sum, quantity) => sum + Math.max(0, quantity), 0);
}

function toGiftLine(product: Product, quantity: number): CalculatedCartLine {
  return {
    productId: product.id,
    productName: product.name,
    spu: product.spu,
    productCode: product.productCode,
    quantity,
    originalUnitPrice: normalizeMoney(product.salePrice),
    finalUnitPrice: 0,
    lineType: "gift",
    lineTotal: 0
  };
}
