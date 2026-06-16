import { describe, expect, it } from "vitest";
import { defaultPromotion, product } from "../test/fixtures";
import { buildGiftSelectionRequirements, resolveGiftLines, validateGiftSelections } from "./giftSelection";
import { calculateCart } from "./promotions";

const baseProduct = product({ id: "normal", name: "普通商品", salePrice: 68 });
const giftA1 = product({
  id: "gift-a-1",
  name: "赠品A黑色",
  spu: "赠品A",
  productCode: "GFTA-BLK",
  stockQty: 2,
  isSellable: false,
  isGiftEligible: true
});
const giftA2 = product({
  id: "gift-a-2",
  name: "赠品A白色",
  spu: "赠品A",
  productCode: "GFTA-WHT",
  stockQty: 1,
  isSellable: false,
  isGiftEligible: true
});

const calculated = calculateCart({
  items: [{ productId: "normal", quantity: 1, addedAt: "2026-06-15T00:00:00.000Z" }],
  products: [baseProduct, giftA1, giftA2],
  promotion: {
    ...defaultPromotion(),
    giftTiers: [
      {
        threshold: 68,
        gifts: [{ targetType: "spu", spu: "赠品A", quantity: 2 }]
      }
    ]
  }
});

describe("gift selection helpers", () => {
  it("builds SPU gift selection requirements from gift entitlements", () => {
    expect(buildGiftSelectionRequirements(calculated, [baseProduct, giftA1, giftA2])).toEqual([
      {
        key: "spu:赠品A",
        spu: "赠品A",
        label: "赠品A",
        requiredQty: 2,
        options: [
          expect.objectContaining({ productId: "gift-a-1", productName: "赠品A黑色", productCode: "GFTA-BLK", availableQty: 2 }),
          expect.objectContaining({ productId: "gift-a-2", productName: "赠品A白色", productCode: "GFTA-WHT", availableQty: 1 })
        ]
      }
    ]);
  });

  it("requires the full SPU gift quantity to be selected", () => {
    expect(
      validateGiftSelections({
        requirements: buildGiftSelectionRequirements(calculated, [baseProduct, giftA1, giftA2]),
        selections: { "spu:赠品A": { "gift-a-1": 1 } }
      })
    ).toEqual({ ok: false, message: "赠品A 还需要选择 1 个赠品。" });
  });

  it("rejects selections that exceed available stock", () => {
    expect(
      validateGiftSelections({
        requirements: buildGiftSelectionRequirements(calculated, [baseProduct, giftA1, giftA2]),
        selections: { "spu:赠品A": { "gift-a-1": 3 } }
      })
    ).toEqual({ ok: false, message: "赠品A黑色 库存不足，最多可选 2 个。" });
  });

  it("converts selected SPU gifts into actual gift lines and keeps existing SKU gift lines", () => {
    const resolved = resolveGiftLines({
      calculated: {
        ...calculated,
        giftLines: [
          {
            productId: "sku-gift",
            productName: "指定赠品",
            spu: "指定赠品SPU",
            productCode: "SKU-GIFT",
            quantity: 1,
            originalUnitPrice: 0,
            finalUnitPrice: 0,
            lineType: "gift",
            lineTotal: 0
          }
        ]
      },
      products: [baseProduct, giftA1, giftA2],
      selections: { "spu:赠品A": { "gift-a-1": 1, "gift-a-2": 1 } }
    });

    expect(resolved).toEqual([
      expect.objectContaining({ productId: "sku-gift", quantity: 1, lineType: "gift" }),
      expect.objectContaining({ productId: "gift-a-1", productName: "赠品A黑色", quantity: 1, lineType: "gift" }),
      expect.objectContaining({ productId: "gift-a-2", productName: "赠品A白色", quantity: 1, lineType: "gift" })
    ]);
  });
});
