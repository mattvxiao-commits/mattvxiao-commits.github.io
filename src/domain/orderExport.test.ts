import { describe, expect, it } from "vitest";
import { buildOrderExportSheets } from "./orderExport";
import type { InventoryLog, Order, OrderItem, OrderRefund, Product } from "./types";

const exportedAt = "2026-06-18T12:00:00.000Z";
const appVersion = "0.1.0";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order_1",
    orderNo: "ECRM-001",
    status: "paid",
    paymentMethod: "wechat",
    subtotalBeforeDiscount: 40,
    discountAmount: 0,
    payableAmount: 40,
    triggeredGiftTier: 35,
    promotionSnapshot: {
      enabled: true,
      addonDiscount: { enabled: false, discountSpu: "", discountPrice: 0, maxDiscountQty: 0 },
      giftTiers: []
    },
    giftStockWarning: false,
    createdAt: "2026-06-18T10:00:00.000Z",
    paidAt: "2026-06-18T10:01:00.000Z",
    ...overrides
  };
}

function makeOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "line_1",
    orderId: "order_1",
    productId: "product_1",
    productNameSnapshot: "徽章 A",
    spuSnapshot: "徽章",
    productCodeSnapshot: "BADGE-A",
    quantity: 2,
    originalUnitPrice: 20,
    finalUnitPrice: 20,
    lineType: "normal",
    lineTotal: 40,
    unitCostSnapshot: 8,
    costTotal: 16,
    grossProfit: 24,
    ...overrides
  };
}

function makeRefund(overrides: Partial<OrderRefund> = {}): OrderRefund {
  return {
    id: "refund_1",
    orderId: "order_1",
    amount: 5,
    method: "cash",
    reason: "customer_return",
    note: "顾客退差价",
    createdAt: "2026-06-18T11:00:00.000Z",
    ...overrides
  };
}

function makeInventoryLog(overrides: Partial<InventoryLog> = {}): InventoryLog {
  return {
    id: "log_1",
    productId: "product_1",
    orderId: "order_1",
    changeQty: -2,
    reason: "order_paid",
    beforeQty: 10,
    afterQty: 8,
    createdAt: "2026-06-18T10:02:00.000Z",
    ...overrides
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product_1",
    name: "徽章 A",
    spu: "徽章",
    spuCode: "BADGE",
    skuCode: "A",
    productCode: "BADGE-A",
    costPrice: 8,
    salePrice: 20,
    stockQty: 8,
    isSellable: true,
    isGiftEligible: true,
    status: "active",
    createdAt: "2026-06-18T09:00:00.000Z",
    updatedAt: "2026-06-18T09:30:00.000Z",
    ...overrides
  };
}

function buildSheets(overrides: {
  orders?: Order[];
  orderItems?: OrderItem[];
  refunds?: OrderRefund[];
  inventoryLogs?: InventoryLog[];
  products?: Product[];
} = {}) {
  return buildOrderExportSheets({
    orders: overrides.orders ?? [makeOrder()],
    orderItems: overrides.orderItems ?? [makeOrderItem()],
    refunds: overrides.refunds ?? [],
    inventoryLogs: overrides.inventoryLogs ?? [],
    products: overrides.products ?? [makeProduct()],
    exportedAt,
    appVersion
  });
}

describe("buildOrderExportSheets", () => {
  it("生成 6 个 sheet，名称顺序正确", () => {
    const sheets = buildSheets();

    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "订单汇总",
      "订单明细",
      "退款记录",
      "库存流水",
      "商品当前数据",
      "导出说明"
    ]);
  });

  it("导出订单汇总中文字段、状态支付方式中文、退款金额和实收估算", () => {
    const sheets = buildSheets({
      orders: [
        makeOrder({
          status: "paid",
          paymentMethod: "wechat",
          cancelledAt: "2026-06-18T12:30:00.000Z",
          cancelReason: "customer_cancelled",
          cancelNote: "客户临时取消"
        })
      ],
      refunds: [makeRefund({ amount: 5 }), makeRefund({ id: "refund_2", amount: 3, method: "wechat" })]
    });

    expect(sheets[0].rows[0]).toMatchObject({
      订单编号: "ECRM-001",
      订单ID: "order_1",
      订单状态: "已支付",
      支付方式: "微信",
      创建时间: "2026-06-18T10:00:00.000Z",
      支付时间: "2026-06-18T10:01:00.000Z",
      作废时间: "2026-06-18T12:30:00.000Z",
      商品原价合计: 40,
      优惠金额: 0,
      应收金额: 40,
      退款金额: 8,
      实收估算: 32,
      触发满赠档位: 35,
      是否赠品库存异常: "否",
      作废原因: "customer_cancelled",
      作废备注: "客户临时取消"
    });
  });

  it("订单明细成本字段完整时导出成本、毛利、毛利率", () => {
    const sheets = buildSheets();

    expect(sheets[1].rows[0]).toMatchObject({
      订单编号: "ECRM-001",
      订单ID: "order_1",
      订单状态: "已支付",
      支付时间: "2026-06-18T10:01:00.000Z",
      商品ID: "product_1",
      商品名称: "徽章 A",
      SPU: "徽章",
      商品编码: "BADGE-A",
      数量: 2,
      明细类型: "普通",
      原单价: 20,
      成交单价: 20,
      销售小计: 40,
      单位成本快照: 8,
      成本小计: 16,
      毛利: 24,
      毛利率: 60,
      是否缺少成本快照: "否"
    });
  });

  it("订单明细导出包含 V1.6a 明细口径、成本归属和经营归属字段", () => {
    const sheets = buildSheets({
      orderItems: [
        makeOrderItem({
          lineType: "discount_addon",
          originalUnitPrice: 20,
          finalUnitPrice: 15,
          lineTotal: 30,
          statisticalUnitPrice: 15,
          statisticalSubtotal: 30,
          discountGiveawayAmount: 10,
          originalRevenueType: "sale",
          adjustedAt: "2026-06-18T10:05:00.000Z",
          adjustmentNote: "确认优惠加购"
        }),
        makeOrderItem({
          id: "line_gift",
          productId: "gift_1",
          productNameSnapshot: "运营赠礼",
          lineType: "gift",
          originalUnitPrice: 0,
          finalUnitPrice: 0,
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "campaign_gift",
          nonSalesNote: "已关注社媒",
          campaignNameSnapshot: "关注社媒赠礼",
          statisticalUnitPrice: 0,
          statisticalSubtotal: 0,
          discountGiveawayAmount: 0,
          unitCostSnapshot: 2,
          costTotal: 4,
          grossProfit: -4
        })
      ]
    });

    expect(sheets[1].rows[0]).toMatchObject({
      明细收入类型: "销售",
      非销售原因: "",
      非销售备注: "",
      运营活动名称快照: "",
      是否统计修正: "是",
      原始销售小计: 30,
      统计销售小计: 30,
      优惠让利金额: 10,
      成本归属: "销售成本",
      经营归属: "销售 + 优惠让利",
      统计修正时间: "2026-06-18T10:05:00.000Z",
      统计修正备注: "确认优惠加购"
    });
    expect(sheets[1].rows[1]).toMatchObject({
      明细收入类型: "非销售出库",
      非销售原因: "运营赠礼",
      非销售备注: "已关注社媒",
      运营活动名称快照: "关注社媒赠礼",
      是否统计修正: "否",
      原始销售小计: 0,
      统计销售小计: 0,
      优惠让利金额: 0,
      成本归属: "运营赠礼成本",
      经营归属: "运营活动成本"
    });
  });

  it("订单汇总导出包含 V1.6a 经营口径字段", () => {
    const sheets = buildSheets({
      orders: [
        makeOrder({
          orderNature: "mixed",
          salesAmount: 40,
          nonSalesQuantity: 2,
          nonSalesCost: 4,
          operatingActivityCost: 4,
          nonOperatingOutboundCost: 0
        })
      ],
      orderItems: [
        makeOrderItem(),
        makeOrderItem({
          id: "line_gift",
          productId: "gift_1",
          lineType: "gift",
          lineTotal: 0,
          revenueType: "non_sales",
          nonSalesReason: "campaign_gift",
          costTotal: 4,
          grossProfit: -4,
          adjustedAt: "2026-06-18T10:05:00.000Z"
        })
      ]
    });

    expect(sheets[0].rows[0]).toMatchObject({
      订单整体性质: "销售 + 赠送",
      销售金额: 40,
      优惠让利: 0,
      销售成本: 16,
      基础销售毛利: 24,
      运营活动成本: 4,
      活动后毛利: 20,
      非经营出库成本: 0,
      非销售出库件数: 2,
      非销售出库成本: 4,
      是否含统计修正: "是"
    });
  });

  it("订单明细缺少成本快照时导出空成本字段和缺失标记", () => {
    const sheets = buildSheets({
      orderItems: [
        makeOrderItem({
          unitCostSnapshot: undefined,
          costTotal: undefined,
          grossProfit: undefined
        })
      ]
    });

    expect(sheets[1].rows[0]).toMatchObject({
      单位成本快照: "",
      成本小计: "",
      毛利: "",
      毛利率: "",
      是否缺少成本快照: "是"
    });
  });

  it("订单明细单位成本快照为负数时按缺少成本快照导出", () => {
    const sheets = buildSheets({
      orderItems: [makeOrderItem({ unitCostSnapshot: -1, costTotal: 16, grossProfit: 24 })]
    });

    expect(sheets[1].rows[0]).toMatchObject({
      单位成本快照: "",
      成本小计: "",
      毛利: "",
      毛利率: "",
      是否缺少成本快照: "是"
    });
  });

  it("订单明细成本小计为负数时按缺少成本快照导出", () => {
    const sheets = buildSheets({
      orderItems: [makeOrderItem({ unitCostSnapshot: 8, costTotal: -1, grossProfit: 24 })]
    });

    expect(sheets[1].rows[0]).toMatchObject({
      单位成本快照: "",
      成本小计: "",
      毛利: "",
      毛利率: "",
      是否缺少成本快照: "是"
    });
  });

  it("导出退款记录、库存流水和商品当前数据的中文字段", () => {
    const sheets = buildSheets({
      refunds: [makeRefund()],
      inventoryLogs: [makeInventoryLog()]
    });

    expect(sheets[2].rows[0]).toEqual({
      订单编号: "ECRM-001",
      订单ID: "order_1",
      退款ID: "refund_1",
      退款时间: "2026-06-18T11:00:00.000Z",
      退款金额: 5,
      退款方式: "现金",
      退款原因: "顾客退货",
      备注: "顾客退差价"
    });
    expect(sheets[3].rows[0]).toEqual({
      时间: "2026-06-18T10:02:00.000Z",
      商品ID: "product_1",
      商品名称: "徽章 A",
      商品编码: "BADGE-A",
      订单编号: "ECRM-001",
      订单ID: "order_1",
      变动数量: -2,
      变动原因: "订单扣减",
      变动前库存: 10,
      变动后库存: 8
    });
    expect(sheets[4].rows[0]).toEqual({
      商品ID: "product_1",
      商品名称: "徽章 A",
      SPU: "徽章",
      SPU编码: "BADGE",
      SKU编码: "A",
      完整商品编码: "BADGE-A",
      成本价: 8,
      售价: 20,
      当前库存: 8,
      是否可售: "是",
      是否赠品: "是",
      状态: "启用",
      创建时间: "2026-06-18T09:00:00.000Z",
      更新时间: "2026-06-18T09:30:00.000Z"
    });
  });

  it("库存流水商品缺失时显示商品不存在并清空商品编码", () => {
    const sheets = buildSheets({
      inventoryLogs: [makeInventoryLog({ productId: "missing_product", orderId: "missing_order" })],
      products: []
    });

    expect(sheets[3].rows[0]).toMatchObject({
      商品ID: "missing_product",
      商品名称: "商品不存在",
      商品编码: "",
      订单编号: "",
      订单ID: "missing_order"
    });
  });

  it("导出说明包含系统版本和 Excel 不能用于恢复系统数据的说明", () => {
    const sheets = buildSheets();

    expect(sheets[5].rows).toEqual(
      expect.arrayContaining([
        { 项目: "导出时间", 说明: exportedAt },
        { 项目: "系统版本", 说明: appVersion },
        expect.objectContaining({
          项目: "恢复说明",
          说明: expect.stringContaining("Excel 不能用于恢复系统数据")
        }),
        expect.objectContaining({
          项目: "退款退货入库说明",
          说明: expect.stringMatching(/人工退款.*不会自动.*退货入库|人工退款.*不会自动.*库存回补/)
        }),
        expect.objectContaining({
          项目: "V1.6a 统计口径说明",
          说明: expect.stringContaining("非销售明细不计入销售额")
        })
      ])
    );
  });
});
