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

  it("writes unit cost snapshot, cost total, and gross profit for normal order items", () => {
    const result = buildPaidOrder({
      products: products().map((item) => (item.id === "normal" ? { ...item, costPrice: 8 } : item)),
      calculated: calculated({
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
      unitCostSnapshot: 8,
      costTotal: 16,
      grossProfit: 24
    });
  });

  it("calculates gross profit from line totals for discounted add-ons and gifts", () => {
    const result = buildPaidOrder({
      products: products().map((item) => {
        if (item.id === "addon") {
          return { ...item, costPrice: 2 };
        }

        if (item.id === "gift-a") {
          return { ...item, costPrice: 1.5 };
        }

        return item;
      }),
      calculated: calculated({
        lines: [
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
            quantity: 2,
            originalUnitPrice: 0,
            finalUnitPrice: 0,
            lineType: "gift",
            lineTotal: 0
          }
        ],
        subtotalBeforeDiscount: 15,
        discountAmount: 6,
        payableAmount: 9
      }),
      promotion,
      orderPrefix: "ECRM",
      paymentMethod: "cash",
      now
    });

    expect(result.orderItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: "addon",
          unitCostSnapshot: 2,
          costTotal: 6,
          grossProfit: 3
        }),
        expect.objectContaining({
          productId: "gift-a",
          unitCostSnapshot: 1.5,
          costTotal: 3,
          grossProfit: -3
        })
      ])
    );
  });

  it("does not change existing order item cost snapshots when product cost changes after order creation", () => {
    const [normalProduct] = products().map((item) => (item.id === "normal" ? { ...item, costPrice: 4 } : item));

    const result = buildPaidOrder({
      products: [normalProduct],
      calculated: calculated({
        lines: [
          {
            productId: "normal",
            productName: "普通商品",
            spu: "普通SPU",
            productCode: "NORMAL-BASE",
            quantity: 1,
            originalUnitPrice: 12,
            finalUnitPrice: 12,
            lineType: "normal",
            lineTotal: 12
          }
        ],
        giftLines: [],
        subtotalBeforeDiscount: 12,
        discountAmount: 0,
        payableAmount: 12
      }),
      promotion,
      orderPrefix: "ECRM",
      paymentMethod: "alipay",
      now
    });

    normalProduct.costPrice = 9;

    expect(result.orderItems[0].unitCostSnapshot).toBe(4);
    expect(result.orderItems[0].costTotal).toBe(4);
    expect(result.orderItems[0].grossProfit).toBe(8);
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

  it("uses resolved gift lines when they are provided", () => {
    const selectedGift = product({
      id: "selected-gift",
      name: "手动选择赠品",
      spu: "赠品SPU",
      productCode: "GIFT-SELECTED",
      stockQty: 2,
      isGiftEligible: true
    });

    const result = buildPaidOrder({
      products: [...products(), selectedGift],
      calculated: calculated({
        giftLines: [],
        giftEntitlements: [{ targetType: "spu", spu: "赠品SPU", label: "赠品SPU", quantity: 1 }]
      }),
      resolvedGiftLines: [
        {
          productId: "selected-gift",
          productName: "手动选择赠品",
          spu: "赠品SPU",
          productCode: "GIFT-SELECTED",
          quantity: 1,
          originalUnitPrice: 0,
          finalUnitPrice: 0,
          lineType: "gift",
          lineTotal: 0
        }
      ],
      promotion,
      orderPrefix: "ECRM",
      paymentMethod: "cash",
      now
    });

    expect(result.orderItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: "selected-gift",
          productCodeSnapshot: "GIFT-SELECTED",
          quantity: 1,
          lineType: "gift"
        })
      ])
    );
    expect(result.updatedProducts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "selected-gift", stockQty: 1 })])
    );
  });

  it("saves mixed sale and campaign gift lines with V1.6a accounting fields", () => {
    const mixedProducts = [
      product({
        id: "normal",
        name: "普通商品",
        spu: "普通SPU",
        productCode: "NORMAL-BASE",
        salePrice: 20,
        costPrice: 8,
        stockQty: 10
      }),
      product({
        id: "campaign-gift",
        name: "运营赠品",
        spu: "赠品SPU",
        productCode: "GIFT-CAMPAIGN",
        salePrice: 6,
        costPrice: 2.5,
        stockQty: 5,
        isSellable: false,
        isGiftEligible: true
      })
    ];

    const result = buildPaidOrder({
      products: mixedProducts,
      calculated: calculated({
        lines: [
          {
            productId: "normal",
            productName: "普通商品",
            spu: "普通SPU",
            productCode: "NORMAL-BASE",
            quantity: 1,
            originalUnitPrice: 20,
            finalUnitPrice: 20,
            lineType: "normal",
            lineTotal: 20,
            revenueType: "sale",
            statisticalUnitPrice: 20,
            statisticalSubtotal: 20,
            discountGiveawayAmount: 0
          },
          {
            productId: "campaign-gift",
            productName: "运营赠品",
            spu: "赠品SPU",
            productCode: "GIFT-CAMPAIGN",
            quantity: 2,
            originalUnitPrice: 6,
            finalUnitPrice: 0,
            lineType: "gift",
            lineTotal: 0,
            revenueType: "non_sales",
            nonSalesReason: "campaign_gift",
            campaignNameSnapshot: "关注小红书赠礼",
            statisticalUnitPrice: 0,
            statisticalSubtotal: 0,
            discountGiveawayAmount: 0
          }
        ],
        giftLines: [],
        subtotalBeforeDiscount: 20,
        discountAmount: 0,
        payableAmount: 20,
        salesSubtotal: 20,
        nonSalesQuantity: 2,
        nonSalesCost: 5
      }),
      promotion,
      orderPrefix: "ECRM",
      paymentMethod: "wechat",
      now
    });

    expect(result.order).toMatchObject({
      payableAmount: 20,
      paymentMethod: "wechat",
      orderNature: "mixed",
      salesAmount: 20,
      nonSalesQuantity: 2,
      nonSalesCost: 5,
      operatingActivityCost: 5,
      nonOperatingOutboundCost: 0
    });
    expect(result.orderItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: "normal",
          revenueType: "sale",
          nonSalesReason: undefined,
          statisticalUnitPrice: 20,
          statisticalSubtotal: 20,
          discountGiveawayAmount: 0,
          costTotal: 8,
          grossProfit: 12
        }),
        expect.objectContaining({
          productId: "campaign-gift",
          revenueType: "non_sales",
          nonSalesReason: "campaign_gift",
          campaignNameSnapshot: "关注小红书赠礼",
          finalUnitPrice: 0,
          lineTotal: 0,
          statisticalUnitPrice: 0,
          statisticalSubtotal: 0,
          discountGiveawayAmount: 0,
          unitCostSnapshot: 2.5,
          costTotal: 5,
          grossProfit: -5
        })
      ])
    );
    expect(result.inventoryLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: "normal", reason: "order_paid", changeQty: -1 }),
        expect.objectContaining({ productId: "campaign-gift", reason: "non_sales_outbound", changeQty: -2 })
      ])
    );
  });

  it("saves pure manual gift outbound without requiring a payment method", () => {
    const result = buildPaidOrder({
      products: [
        product({
          id: "manual-gift",
          name: "人工赠品",
          spu: "赠品SPU",
          productCode: "GIFT-MANUAL",
          salePrice: 9,
          costPrice: 3,
          stockQty: 4,
          isSellable: false,
          isGiftEligible: true
        })
      ],
      calculated: calculated({
        lines: [
          {
            productId: "manual-gift",
            productName: "人工赠品",
            spu: "赠品SPU",
            productCode: "GIFT-MANUAL",
            quantity: 1,
            originalUnitPrice: 9,
            finalUnitPrice: 0,
            lineType: "gift",
            lineTotal: 0,
            revenueType: "non_sales",
            nonSalesReason: "manual_gift",
            nonSalesNote: "好友赠送",
            statisticalUnitPrice: 0,
            statisticalSubtotal: 0,
            discountGiveawayAmount: 0
          }
        ],
        giftLines: [],
        subtotalBeforeDiscount: 0,
        discountAmount: 0,
        payableAmount: 0,
        salesSubtotal: 0,
        nonSalesQuantity: 1,
        nonSalesCost: 3
      }),
      promotion,
      orderPrefix: "ECRM",
      now
    });

    expect(result.order).toMatchObject({
      payableAmount: 0,
      paymentMethod: undefined,
      orderNature: "non_sales",
      salesAmount: 0,
      nonSalesQuantity: 1,
      nonSalesCost: 3,
      operatingActivityCost: 0,
      nonOperatingOutboundCost: 3
    });
    expect(result.orderItems[0]).toMatchObject({
      productId: "manual-gift",
      revenueType: "non_sales",
      nonSalesReason: "manual_gift",
      nonSalesNote: "好友赠送",
      finalUnitPrice: 0,
      lineTotal: 0,
      statisticalSubtotal: 0,
      costTotal: 3,
      grossProfit: -3
    });
    expect(result.inventoryLogs[0]).toEqual(expect.objectContaining({ reason: "non_sales_outbound" }));
  });

  it("includes resolved SPU tier gifts in order non-sales summaries", () => {
    const selectedGift = product({
      id: "selected-gift",
      name: "手动选择赠品",
      spu: "赠品SPU",
      productCode: "GIFT-SELECTED",
      salePrice: 6,
      costPrice: 2,
      stockQty: 2,
      isSellable: false,
      isGiftEligible: true
    });

    const result = buildPaidOrder({
      products: [...products(), selectedGift],
      calculated: calculated({
        giftLines: [],
        giftEntitlements: [{ targetType: "spu", spu: "赠品SPU", label: "赠品SPU", quantity: 1 }],
        nonSalesQuantity: 0,
        nonSalesCost: 0
      }),
      resolvedGiftLines: [
        {
          productId: "selected-gift",
          productName: "手动选择赠品",
          spu: "赠品SPU",
          productCode: "GIFT-SELECTED",
          quantity: 1,
          originalUnitPrice: 6,
          finalUnitPrice: 0,
          lineType: "gift",
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "tier_gift",
          statisticalUnitPrice: 0,
          statisticalSubtotal: 0,
          discountGiveawayAmount: 0
        }
      ],
      promotion,
      orderPrefix: "ECRM",
      paymentMethod: "cash",
      now
    });

    expect(result.order).toMatchObject({
      orderNature: "mixed",
      nonSalesQuantity: 1,
      nonSalesCost: 2,
      operatingActivityCost: 2,
      nonOperatingOutboundCost: 0
    });
    expect(result.orderItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: "selected-gift",
          revenueType: "non_sales",
          nonSalesReason: "tier_gift",
          costTotal: 2,
          grossProfit: -2
        })
      ])
    );
    expect(result.inventoryLogs).toEqual(
      expect.arrayContaining([expect.objectContaining({ productId: "selected-gift", reason: "gift_order_paid" })])
    );
  });
});
