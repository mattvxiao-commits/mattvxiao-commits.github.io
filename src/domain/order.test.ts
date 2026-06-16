import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPaidOrder } from "./order";
import type { CalculatedCart, PromotionConfig } from "./types";
import { defaultPromotion, product } from "../test/fixtures";

const now = "2026-06-15T12:34:56.789Z";
const promotion = defaultPromotion();

afterEach(() => {
  vi.restoreAllMocks();
});

function calculated(overrides: Partial<CalculatedCart> = {}): CalculatedCart {
  return {
    lines: [
      {
        productId: "normal",
        productName: "普通商品",
        spu: "普通SPU",
        productCode: "NORMAL-BASE",
        quantity: 2,
        originalUnitPrice: 20,
        finalUnitPrice: 20,
        lineType: "normal",
        lineTotal: 40
      },
      {
        productId: "addon",
        productName: "优惠商品A",
        spu: "优惠SPU",
        productCode: "ADDON-A",
        quantity: 3,
        originalUnitPrice: 5,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 9
      }
    ],
    giftLines: [
      {
        productId: "gift-a",
        productName: "商品A赠品",
        spu: "赠品SPU-A",
        productCode: "GIFT-A",
        quantity: 1,
        originalUnitPrice: 0,
        finalUnitPrice: 0,
        lineType: "gift",
        lineTotal: 0
      }
    ],
    giftEntitlements: [],
    subtotalBeforeDiscount: 55,
    discountAmount: 6,
    payableAmount: 49,
    appliedDiscountQty: 3,
    maxDiscountQty: 3,
    triggeredGiftTier: promotion.giftTiers[0],
    giftStockWarnings: [],
    ...overrides
  };
}

function products() {
  return [
    product({ id: "normal", name: "普通商品", spu: "普通SPU", productCode: "NORMAL-BASE", salePrice: 20, stockQty: 10 }),
    product({ id: "addon", name: "优惠商品A", spu: "优惠SPU", productCode: "ADDON-A", salePrice: 5, stockQty: 8 }),
    product({
      id: "gift-a",
      name: "商品A赠品",
      spu: "赠品SPU-A",
      productCode: "GIFT-A",
      salePrice: 0,
      stockQty: 4,
      isSellable: false,
      isGiftEligible: true
    })
  ];
}

describe("buildPaidOrder", () => {
  it("builds a paid order snapshot and deducts purchased, discounted, and gift inventory", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.042);

    const result = buildPaidOrder({
      products: products(),
      calculated: calculated(),
      promotion,
      orderPrefix: "ECRM",
      paymentMethod: "wechat",
      now
    });

    expect(result.order).toMatchObject({
      orderNo: "ECRM-20260615-123456-042",
      status: "paid",
      paymentMethod: "wechat",
      subtotalBeforeDiscount: 55,
      discountAmount: 6,
      payableAmount: 49,
      triggeredGiftTier: 35,
      promotionSnapshot: promotion,
      giftStockWarning: false,
      createdAt: now,
      paidAt: now
    });
    expect(result.order.id).toEqual(expect.any(String));

    expect(result.orderItems).toEqual([
      expect.objectContaining({
        orderId: result.order.id,
        productId: "normal",
        productNameSnapshot: "普通商品",
        spuSnapshot: "普通SPU",
        productCodeSnapshot: "NORMAL-BASE",
        quantity: 2,
        originalUnitPrice: 20,
        finalUnitPrice: 20,
        lineType: "normal",
        lineTotal: 40
      }),
      expect.objectContaining({
        orderId: result.order.id,
        productId: "addon",
        productNameSnapshot: "优惠商品A",
        spuSnapshot: "优惠SPU",
        productCodeSnapshot: "ADDON-A",
        quantity: 3,
        originalUnitPrice: 5,
        finalUnitPrice: 3,
        lineType: "discount_addon",
        lineTotal: 9
      }),
      expect.objectContaining({
        orderId: result.order.id,
        productId: "gift-a",
        productNameSnapshot: "商品A赠品",
        spuSnapshot: "赠品SPU-A",
        productCodeSnapshot: "GIFT-A",
        quantity: 1,
        originalUnitPrice: 0,
        finalUnitPrice: 0,
        lineType: "gift",
        lineTotal: 0
      })
    ]);

    expect(result.inventoryLogs).toEqual([
      expect.objectContaining({
        productId: "normal",
        orderId: result.order.id,
        reason: "order_paid",
        beforeQty: 10,
        afterQty: 8,
        changeQty: -2,
        createdAt: now
      }),
      expect.objectContaining({
        productId: "addon",
        orderId: result.order.id,
        reason: "order_paid",
        beforeQty: 8,
        afterQty: 5,
        changeQty: -3,
        createdAt: now
      }),
      expect.objectContaining({
        productId: "gift-a",
        orderId: result.order.id,
        reason: "gift_order_paid",
        beforeQty: 4,
        afterQty: 3,
        changeQty: -1,
        createdAt: now
      })
    ]);

    expect(result.updatedProducts).toEqual([
      expect.objectContaining({ id: "normal", stockQty: 8 }),
      expect.objectContaining({ id: "addon", stockQty: 5 }),
      expect.objectContaining({ id: "gift-a", stockQty: 3 })
    ]);
  });

  it("throws a clear Chinese error when calculated references a missing product", () => {
    expect(() =>
      buildPaidOrder({
        products: products().filter((item) => item.id !== "addon"),
        calculated: calculated(),
        promotion,
        orderPrefix: "ECRM",
        paymentMethod: "cash",
        now
      })
    ).toThrow("订单明细商品 addon 不存在，无法生成订单快照");
  });

  it("throws a clear Chinese error when purchased inventory would become negative", () => {
    expect(() =>
      buildPaidOrder({
        products: products().map((item) => (item.id === "normal" ? { ...item, stockQty: 1 } : item)),
        calculated: calculated(),
        promotion,
        orderPrefix: "ECRM",
        paymentMethod: "alipay",
        now
      })
    ).toThrow("商品 普通商品 库存不足，无法完成订单扣减");
  });

  it("uses calculated line product names and spus for order item snapshots", () => {
    const result = buildPaidOrder({
      products: products().map((item) =>
        item.id === "normal" ? { ...item, name: "当前商品名", spu: "当前SPU" } : item
      ),
      calculated: calculated({
        lines: [
          {
            productId: "normal",
            productName: "下单时商品名",
            spu: "下单时SPU",
            productCode: "下单时编码",
            quantity: 2,
            originalUnitPrice: 20,
            finalUnitPrice: 20,
            lineType: "normal",
            lineTotal: 40
          }
        ],
        giftLines: [],
        subtotalBeforeDiscount: 40,
        discountAmount: 0,
        payableAmount: 40
      }),
      promotion,
      orderPrefix: "ECRM",
      paymentMethod: "wechat",
      now
    });

    expect(result.orderItems[0]).toMatchObject({
      productId: "normal",
      productNameSnapshot: "下单时商品名",
      spuSnapshot: "下单时SPU",
      productCodeSnapshot: "下单时编码"
    });
  });

  it("throws a clear Chinese error when discounted addon inventory would become negative", () => {
    expect(() =>
      buildPaidOrder({
        products: products().map((item) => (item.id === "addon" ? { ...item, stockQty: 2 } : item)),
        calculated: calculated(),
        promotion,
        orderPrefix: "ECRM",
        paymentMethod: "alipay",
        now
      })
    ).toThrow("商品 优惠商品A 库存不足，无法完成订单扣减");
  });

  it("throws a clear Chinese error when gift inventory would become negative", () => {
    expect(() =>
      buildPaidOrder({
        products: products().map((item) => (item.id === "gift-a" ? { ...item, stockQty: 0 } : item)),
        calculated: calculated({
          giftStockWarnings: [{ productId: "gift-a", productName: "商品A赠品", requiredQty: 1, availableQty: 0 }]
        }),
        promotion,
        orderPrefix: "ECRM",
        paymentMethod: "other",
        now
      })
    ).toThrow("商品 商品A赠品 库存不足，无法完成订单扣减");
  });

  it("stores whether gift stock warnings existed in the order snapshot", () => {
    const customPromotion: PromotionConfig = {
      ...promotion,
      giftTiers: [{ threshold: 49, gifts: [{ productId: "gift-a", quantity: 1 }] }]
    };

    const result = buildPaidOrder({
      products: products(),
      calculated: calculated({
        triggeredGiftTier: customPromotion.giftTiers[0],
        giftStockWarnings: [{ productId: "gift-a", productName: "商品A赠品", requiredQty: 1, availableQty: 4 }]
      }),
      promotion: customPromotion,
      orderPrefix: "BOOTH",
      paymentMethod: "cash",
      now
    });

    expect(result.order.giftStockWarning).toBe(true);
    expect(result.order.triggeredGiftTier).toBe(49);
  });
});
