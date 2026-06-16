export type ProductStatus = "active" | "inactive";

export type Product = {
  id: string;
  name: string;
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
  productId: string;
  quantity: number;
  addedAt: string;
};

export type PaymentMethod = "wechat" | "alipay" | "cash" | "other";

export type OrderStatus = "pending_payment" | "paid" | "cancelled";

export type OrderLineType = "normal" | "discount_addon" | "gift";

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
  productId: string;
  productName: string;
  spu: string;
  productCode?: string;
  quantity: number;
  originalUnitPrice: number;
  finalUnitPrice: number;
  lineType: OrderLineType;
  lineTotal: number;
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
};

export type AppSettings = {
  id: "settings";
  shopName: string;
  orderPrefix: string;
  wechatQrImageId?: string;
  alipayQrImageId?: string;
  promotion: PromotionConfig;
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
  createdAt: string;
  paidAt?: string;
  cancelledAt?: string;
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
};

export type InventoryLog = {
  id: string;
  productId: string;
  orderId: string;
  changeQty: number;
  reason: "order_paid" | "gift_order_paid" | "manual_adjust";
  beforeQty: number;
  afterQty: number;
  createdAt: string;
};
