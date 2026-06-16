import type { Product, PromotionConfig } from "../domain/types";

export function product(overrides: Partial<Product> = {}): Product {
  const now = "2026-06-15T00:00:00.000Z";
  return {
    id: "product-normal",
    name: "普通商品",
    spu: "普通SPU",
    spuCode: "NORMAL",
    skuCode: "BASE",
    productCode: "NORMAL-BASE",
    costPrice: 2,
    salePrice: 20,
    stockQty: 100,
    isSellable: true,
    isGiftEligible: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

export function defaultPromotion(): PromotionConfig {
  return {
    enabled: true,
    addonDiscount: {
      enabled: true,
      discountSpu: "优惠SPU",
      discountPrice: 3,
      maxDiscountQty: 3
    },
    giftTiers: [
      { threshold: 35, gifts: [{ productId: "gift-a", quantity: 1 }] },
      {
        threshold: 68,
        gifts: [
          { productId: "gift-a", quantity: 2 },
          { productId: "gift-b", quantity: 1 }
        ]
      },
      {
        threshold: 148,
        gifts: [
          { productId: "gift-a", quantity: 5 },
          { productId: "gift-b", quantity: 1 }
        ]
      }
    ]
  };
}
