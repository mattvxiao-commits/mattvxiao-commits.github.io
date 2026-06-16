import { describe, expect, it } from "vitest";
import { calculateCart } from "./promotions";
import type { CartItem } from "./types";
import { defaultPromotion, product } from "../test/fixtures";

const normal = product({
  id: "normal",
  name: "普通商品",
  spu: "普通SPU",
  productCode: "NORMAL-BASE",
  salePrice: 20
});

const addon = product({
  id: "addon",
  name: "优惠商品A",
  spu: "优惠SPU",
  productCode: "ADDON-A",
  salePrice: 5,
  isGiftEligible: true
});

const giftA = product({
  id: "gift-a",
  name: "商品A赠品",
  spu: "赠品SPU-A",
  productCode: "GIFT-A",
  salePrice: 5,
  stockQty: 10,
  isGiftEligible: true
});

const giftB = product({
  id: "gift-b",
  name: "商品B赠品",
  spu: "赠品SPU-B",
  productCode: "GIFT-B",
  salePrice: 0,
  stockQty: 10,
  isSellable: false,
  isGiftEligible: true
});

function cart(productId: string, quantity: number, addedAt = "2026-06-15T00:00:00.000Z"): CartItem[] {
  return [{ productId, quantity, addedAt }];
}

describe("calculateCart", () => {
  it("prices only addon SPU as first original, next three discounted, then original", () => {
    const result = calculateCart({
      items: cart("addon", 5),
      products: [addon, giftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.payableAmount).toBe(19);
    expect(result.appliedDiscountQty).toBe(3);
    expect(result.lines).toEqual([
      expect.objectContaining({
        productId: "addon",
        quantity: 1,
        finalUnitPrice: 5,
        lineType: "normal",
        lineTotal: 5
      }),
      expect.objectContaining({
        productId: "addon",
        quantity: 3,
        originalUnitPrice: 5,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 9
      }),
      expect.objectContaining({
        productId: "addon",
        quantity: 1,
        finalUnitPrice: 5,
        lineType: "normal",
        lineTotal: 5
      })
    ]);
  });

  it("discounts first three addon units when another normal product exists", () => {
    const result = calculateCart({
      items: [
        { productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" },
        { productId: "addon", quantity: 4, addedAt: "2026-06-15T00:01:00.000Z" }
      ],
      products: [normal, addon, giftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.payableAmount).toBe(34);
    expect(result.appliedDiscountQty).toBe(3);
    expect(result.discountAmount).toBe(6);
    expect(result.lines).toEqual([
      expect.objectContaining({
        productId: "normal",
        productCode: "NORMAL-BASE",
        quantity: 1,
        finalUnitPrice: 20,
        lineType: "normal",
        lineTotal: 20
      }),
      expect.objectContaining({
        productId: "addon",
        productCode: "ADDON-A",
        quantity: 3,
        originalUnitPrice: 5,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 9
      }),
      expect.objectContaining({
        productId: "addon",
        productCode: "ADDON-A",
        quantity: 1,
        finalUnitPrice: 5,
        lineType: "normal",
        lineTotal: 5
      })
    ]);
  });

  it("uses final payable amount after discount for gift threshold", () => {
    const result = calculateCart({
      items: [
        { productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" },
        { productId: "addon", quantity: 4, addedAt: "2026-06-15T00:01:00.000Z" }
      ],
      products: [normal, addon, giftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.payableAmount).toBe(34);
    expect(result.triggeredGiftTier).toBeUndefined();
    expect(result.giftLines).toEqual([]);
  });

  it("selects only the highest gift tier", () => {
    const expensive = product({ id: "expensive", name: "高价商品", salePrice: 148 });

    const result = calculateCart({
      items: cart("expensive", 1),
      products: [expensive, giftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.triggeredGiftTier?.threshold).toBe(148);
    expect(result.giftLines).toEqual([
      expect.objectContaining({ productId: "gift-a", productCode: "GIFT-A", quantity: 5, lineType: "gift", lineTotal: 0 }),
      expect.objectContaining({ productId: "gift-b", productCode: "GIFT-B", quantity: 1, lineType: "gift", lineTotal: 0 })
    ]);
  });

  it("reports gift stock warnings without blocking calculation", () => {
    const expensive = product({ id: "expensive", name: "高价商品", salePrice: 148 });
    const lowGiftA = { ...giftA, stockQty: 1 };

    const result = calculateCart({
      items: cart("expensive", 1),
      products: [expensive, lowGiftA, giftB],
      promotion: defaultPromotion()
    });

    expect(result.payableAmount).toBe(148);
    expect(result.giftLines).toHaveLength(2);
    expect(result.giftStockWarnings).toEqual([
      { productId: "gift-a", productName: "商品A赠品", requiredQty: 5, availableQty: 1 }
    ]);
  });

  it("allocates addon discounts across multiple SKUs by added order", () => {
    const addon1 = product({
      id: "addon-1",
      name: "优惠商品A-1",
      spu: "优惠SPU",
      salePrice: 5
    });
    const addon2 = product({
      id: "addon-2",
      name: "优惠商品A-2",
      spu: "优惠SPU",
      salePrice: 5
    });

    const result = calculateCart({
      items: [
        { productId: "addon-1", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" },
        { productId: "addon-2", quantity: 4, addedAt: "2026-06-15T00:01:00.000Z" }
      ],
      products: [addon1, addon2],
      promotion: defaultPromotion()
    });

    expect(result.payableAmount).toBe(19);
    expect(result.appliedDiscountQty).toBe(3);
    expect(result.lines).toEqual([
      expect.objectContaining({
        productId: "addon-1",
        quantity: 1,
        finalUnitPrice: 5,
        lineType: "normal",
        lineTotal: 5
      }),
      expect.objectContaining({
        productId: "addon-2",
        quantity: 3,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 9
      }),
      expect.objectContaining({
        productId: "addon-2",
        quantity: 1,
        finalUnitPrice: 5,
        lineType: "normal",
        lineTotal: 5
      })
    ]);
  });
});
