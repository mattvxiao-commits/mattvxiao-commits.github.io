import { describe, expect, it } from "vitest";
import {
  deriveOrderNature,
  getLineAccounting,
  getNormalizedOrderLine,
  isNonSalesLine,
  isRevenueLine
} from "./orderLines";
import type { OrderItem } from "./types";

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    productId: "product-1",
    productNameSnapshot: "贴纸 A",
    spuSnapshot: "贴纸",
    quantity: 2,
    originalUnitPrice: 5,
    finalUnitPrice: 3,
    lineType: "discount_addon",
    lineTotal: 6,
    unitCostSnapshot: 1,
    costTotal: 2,
    grossProfit: 4,
    ...overrides
  };
}

describe("orderLines", () => {
  it("旧订单明细默认归一化为销售明细", () => {
    const line = getNormalizedOrderLine(makeItem());

    expect(line.revenueType).toBe("sale");
    expect(line.statisticalUnitPrice).toBe(3);
    expect(line.statisticalSubtotal).toBe(6);
    expect(isRevenueLine(line)).toBe(true);
    expect(isNonSalesLine(line)).toBe(false);
  });

  it("赠品旧 lineType 归一化为满赠赠品", () => {
    const line = getNormalizedOrderLine(
      makeItem({
        lineType: "gift",
        originalUnitPrice: 0,
        finalUnitPrice: 0,
        lineTotal: 0,
        grossProfit: -2
      })
    );

    expect(line.revenueType).toBe("non_sales");
    expect(line.nonSalesReason).toBe("tier_gift");
    expect(line.statisticalUnitPrice).toBe(0);
    expect(line.statisticalSubtotal).toBe(0);
  });

  it("非销售明细持久化的非零统计金额会归零", () => {
    const line = getNormalizedOrderLine(
      makeItem({
        revenueType: "non_sales",
        nonSalesReason: "campaign_gift",
        finalUnitPrice: 9,
        statisticalUnitPrice: 9,
        statisticalSubtotal: 18
      })
    );

    expect(line.statisticalUnitPrice).toBe(0);
    expect(line.statisticalSubtotal).toBe(0);
  });

  it("销售明细携带陈旧非销售原因会清空", () => {
    const line = getNormalizedOrderLine(
      makeItem({
        revenueType: "sale",
        nonSalesReason: "manual_gift"
      })
    );

    expect(line.revenueType).toBe("sale");
    expect(line.nonSalesReason).toBeUndefined();
  });

  it("加购优惠销售计算优惠让利但成本仍归销售成本", () => {
    const accounting = getLineAccounting(getNormalizedOrderLine(makeItem()));

    expect(accounting.revenue).toBe(6);
    expect(accounting.discountGiveawayAmount).toBe(4);
    expect(accounting.salesCost).toBe(2);
    expect(accounting.operatingActivityCost).toBe(0);
    expect(accounting.basicGrossProfit).toBe(4);
  });

  it("缺失 costTotal 会标记为缺失成本且不等同真实 0 成本", () => {
    const accounting = getLineAccounting(makeItem({ costTotal: undefined }));

    expect(accounting.hasCostSnapshot).toBe(false);
    expect(accounting.missingCost).toBe(1);
    expect(accounting.salesCost).toBe(0);
    expect(accounting.basicGrossProfit).toBe(6);
  });

  it.each([NaN, Infinity, -1])("非法 costTotal %s 会标记为缺失成本", (costTotal) => {
    const accounting = getLineAccounting(makeItem({ costTotal }));

    expect(accounting.hasCostSnapshot).toBe(false);
    expect(accounting.missingCost).toBe(1);
    expect(accounting.salesCost).toBe(0);
    expect(accounting.fullOutboundCost).toBe(0);
  });

  it("costTotal 0 是有效成本快照", () => {
    const accounting = getLineAccounting(makeItem({ costTotal: 0 }));

    expect(accounting.hasCostSnapshot).toBe(true);
    expect(accounting.missingCost).toBe(0);
    expect(accounting.salesCost).toBe(0);
    expect(accounting.basicGrossProfit).toBe(6);
  });

  it("显式优惠让利覆盖值会用于销售明细但非销售 accounting 归零", () => {
    const saleAccounting = getLineAccounting(makeItem({ discountGiveawayAmount: 1.235 }));
    const nonSalesAccounting = getLineAccounting(
      makeItem({
        revenueType: "non_sales",
        nonSalesReason: "campaign_gift",
        discountGiveawayAmount: 1.235
      })
    );

    expect(getNormalizedOrderLine(makeItem({ discountGiveawayAmount: 1.235 })).discountGiveawayAmount).toBe(1.24);
    expect(saleAccounting.discountGiveawayAmount).toBe(1.24);
    expect(nonSalesAccounting.discountGiveawayAmount).toBe(0);
  });

  it("运营赠礼计入运营活动成本，不计收入", () => {
    const line = getNormalizedOrderLine(
      makeItem({
        revenueType: "non_sales",
        nonSalesReason: "campaign_gift",
        campaignNameSnapshot: "关注小红书赠礼",
        finalUnitPrice: 0,
        lineTotal: 0,
        costTotal: 2,
        grossProfit: -2
      })
    );
    const accounting = getLineAccounting(line);

    expect(accounting.revenue).toBe(0);
    expect(accounting.campaignGiftCost).toBe(2);
    expect(accounting.operatingActivityCost).toBe(2);
    expect(accounting.nonOperatingOutboundCost).toBe(0);
  });

  it("人工赠送计入非经营出库成本", () => {
    const line = getNormalizedOrderLine(
      makeItem({
        revenueType: "non_sales",
        nonSalesReason: "manual_gift",
        nonSalesNote: "好友赠送",
        finalUnitPrice: 0,
        lineTotal: 0,
        costTotal: 2,
        grossProfit: -2
      })
    );
    const accounting = getLineAccounting(line);

    expect(accounting.manualGiftCost).toBe(2);
    expect(accounting.nonOperatingOutboundCost).toBe(2);
    expect(accounting.operatingActivityCost).toBe(0);
  });

  it("其他非销售出库计入非经营出库成本和全出库成本", () => {
    const accounting = getLineAccounting(
      makeItem({
        revenueType: "non_sales",
        nonSalesReason: "other_non_sales",
        finalUnitPrice: 0,
        lineTotal: 0,
        costTotal: 2
      })
    );

    expect(accounting.otherNonSalesCost).toBe(2);
    expect(accounting.nonOperatingOutboundCost).toBe(2);
    expect(accounting.fullOutboundCost).toBe(2);
  });

  it("按明细派生订单性质", () => {
    expect(deriveOrderNature([getNormalizedOrderLine(makeItem())])).toBe("sale");
    expect(
      deriveOrderNature([
        getNormalizedOrderLine(makeItem()),
        getNormalizedOrderLine(makeItem({ revenueType: "non_sales", nonSalesReason: "manual_gift", lineTotal: 0 }))
      ])
    ).toBe("mixed");
    expect(
      deriveOrderNature([
        getNormalizedOrderLine(makeItem({ revenueType: "non_sales", nonSalesReason: "other_non_sales", lineTotal: 0 }))
      ])
    ).toBe("non_sales");
  });
});
