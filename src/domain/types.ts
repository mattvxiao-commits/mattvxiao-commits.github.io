export type ProductStatus = "active" | "inactive";

export type Product = {
  id: string;
  name: string;
  series?: string;
  spu: string;
  spuCode?: string;
  skuCode?: string;
  productCode?: string;
  imageId?: string;
  costPrice: number;
  salePrice: number;
  stockQty: number;
  isSellable: boolean;
  isGiftEligible: boolean;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  id?: string;
  productId: string;
  quantity: number;
  addedAt: string;
  revenueType?: OrderLineRevenueType;
  nonSalesReason?: NonSalesReason;
  nonSalesNote?: string;
  campaignNameSnapshot?: string;
};

export type PaymentMethod = "wechat" | "alipay" | "cash" | "other";

export type RefundReason =
  | "customer_return"
  | "overcharge"
  | "product_issue"
  | "manual_adjustment"
  | "other";

export type OrderStatus = "pending_payment" | "paid" | "cancelled";

export type OrderLineType = "normal" | "discount_addon" | "gift";

export type OrderLineRevenueType = "sale" | "non_sales";

export type NonSalesReason = "tier_gift" | "campaign_gift" | "manual_gift" | "other_non_sales";

export type OrderNature = "sale" | "mixed" | "non_sales";

export type CampaignGiftTargetType = "sku" | "spu";

export type OrderCancelReason =
  | "mistake"
  | "customer_cancelled"
  | "duplicate_order"
  | "inventory_issue"
  | "payment_issue"
  | "other";

export type PromotionConfig = {
  enabled: boolean;
  addonDiscount: {
    enabled: boolean;
    discountSpu: string;
    discountPrice: number;
    maxDiscountQty: number;
  };
  giftTiers: GiftTierConfig[];
};

export type FieldLockScope = "products" | "orderDetail" | "dashboard" | "settings";

export type FieldLockSettings = {
  enabled: boolean;
  protectedScopes: FieldLockScope[];
  pinHash?: string;
  pinSalt?: string;
  unlockExpiresAt?: string;
  failedAttempts: number;
  lockedUntil?: string;
};

export type CampaignGiftConfig = {
  enabled: boolean;
  activityName: string;
  targetType: CampaignGiftTargetType;
  defaultProductId: string;
  defaultSpu: string;
  requireSaleLine: boolean;
};

export type GiftTierConfig = {
  threshold: number;
  gifts: GiftConfig[];
};

export type GiftConfig =
  | {
      targetType?: "sku";
      productId: string;
      quantity: number;
    }
  | {
      targetType: "spu";
      spu: string;
      quantity: number;
    };

export type CalculatedCartLine = {
  id?: string;
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  quantity: number;
  originalUnitPrice: number;
  finalUnitPrice: number;
  lineType: OrderLineType;
  lineTotal: number;
  revenueType?: OrderLineRevenueType;
  nonSalesReason?: NonSalesReason;
  nonSalesNote?: string;
  campaignNameSnapshot?: string;
  statisticalUnitPrice?: number;
  statisticalSubtotal?: number;
  discountGiveawayAmount?: number;
};

export type GiftStockWarning = {
  targetType?: "sku" | "spu";
  productId?: string;
  spu?: string;
  productName: string;
  requiredQty: number;
  availableQty: number;
};

export type GiftEntitlement = {
  targetType: "sku" | "spu";
  productId?: string;
  spu?: string;
  label: string;
  quantity: number;
};

export type CalculatedCart = {
  lines: CalculatedCartLine[];
  giftLines: CalculatedCartLine[];
  giftEntitlements: GiftEntitlement[];
  subtotalBeforeDiscount: number;
  discountAmount: number;
  payableAmount: number;
  appliedDiscountQty: number;
  maxDiscountQty: number;
  triggeredGiftTier?: GiftTierConfig;
  giftStockWarnings: GiftStockWarning[];
  salesSubtotal?: number;
  nonSalesQuantity?: number;
  nonSalesCost?: number;
};

export type AppSettings = {
  id: "settings";
  shopName: string;
  orderPrefix: string;
  wechatQrImageId?: string;
  alipayQrImageId?: string;
  promotion: PromotionConfig;
  campaignGift: CampaignGiftConfig;
  fieldLock: FieldLockSettings;
};

export type Order = {
  id: string;
  orderNo: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  subtotalBeforeDiscount: number;
  discountAmount: number;
  payableAmount: number;
  triggeredGiftTier?: number;
  promotionSnapshot: PromotionConfig;
  giftStockWarning: boolean;
  orderNature?: OrderNature;
  salesAmount?: number;
  nonSalesQuantity?: number;
  nonSalesCost?: number;
  operatingActivityCost?: number;
  nonOperatingOutboundCost?: number;
  createdAt: string;
  paidAt?: string;
  cancelledAt?: string;
  cancelReason?: OrderCancelReason;
  cancelNote?: string;
};

export type OrderRefund = {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reason: RefundReason;
  note?: string;
  createdAt: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productNameSnapshot: string;
  spuSnapshot: string;
  productCodeSnapshot?: string;
  quantity: number;
  originalUnitPrice: number;
  finalUnitPrice: number;
  lineType: OrderLineType;
  lineTotal: number;
  unitCostSnapshot?: number;
  costTotal?: number;
  grossProfit?: number;
  revenueType?: OrderLineRevenueType;
  nonSalesReason?: NonSalesReason;
  nonSalesNote?: string;
  campaignNameSnapshot?: string;
  statisticalUnitPrice?: number;
  statisticalSubtotal?: number;
  discountGiveawayAmount?: number;
  originalRevenueType?: OrderLineRevenueType;
  originalNonSalesReason?: NonSalesReason;
  adjustedAt?: string;
  adjustmentNote?: string;
};

export type InventoryLog = {
  id: string;
  productId: string;
  orderId: string;
  changeQty: number;
  reason: "order_paid" | "gift_order_paid" | "non_sales_outbound" | "order_cancelled_rollback" | "manual_adjust";
  beforeQty: number;
  afterQty: number;
  createdAt: string;
};
