import { RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FieldLockDialog from "../components/FieldLockDialog";
import OrderDetailDialog from "../components/OrderDetailDialog";
import {
  adjustOrderAccounting,
  adjustOrderItemAccounting,
  getSettings,
  listInventoryLogsForOrder,
  listOrderItems,
  listOrderRefunds,
  listOrders,
  listProducts,
  listRefunds,
  saveOrderRefund,
  saveSettings,
  voidPaidOrder
} from "../db/repositories";
import { requiresFieldLockUnlock, verifyFieldLockPin } from "../domain/fieldLock";
import { formatMoney } from "../domain/money";
import {
  dateRangeLabels,
  filterAndSortOrders,
  getOrderAfterSalesBadges,
  getOrderHistoryAccountingBadges,
  orderBusinessTime,
  orderStatusLabels,
  paymentMethodLabels,
  sortOrdersForPairedColumns,
  type OrderDateRange,
  type OrderHistoryPaymentFilter,
  type OrderHistoryStatusFilter
} from "../domain/orderHistory";
import type {
  AppSettings,
  InventoryLog,
  NonSalesReason,
  Order,
  OrderCancelReason,
  OrderItem,
  OrderLineRevenueType,
  OrderRefund,
  PaymentMethod,
  Product,
  RefundReason
} from "../domain/types";
import { notifySettingsUpdated } from "../utils/settingsEvents";

type VoidOrderInput = {
  cancelReason: OrderCancelReason;
  cancelNote?: string;
};

type SaveRefundInput = {
  amount: number;
  method: PaymentMethod;
  reason: RefundReason;
  note?: string;
};

type AdjustOrderAccountingInput = {
  orderId: string;
  revenueType: OrderLineRevenueType;
  nonSalesReason?: NonSalesReason;
  nonSalesNote?: string;
  campaignNameSnapshot?: string;
  adjustmentNote?: string;
};

type AdjustOrderItemAccountingInput = AdjustOrderAccountingInput & {
  itemId: string;
};

type StatusMessage = {
  kind: "success" | "error";
  text: string;
};

function formatPaidTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function paymentMethodClassName(paymentMethod: PaymentMethod | undefined): string {
  return paymentMethod ? `orderHistoryChip isPayment isPayment-${paymentMethod}` : "orderHistoryChip isPayment";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<AppSettings>();
  const [orderQuery, setOrderQuery] = useState("");
  const [orderDateRange, setOrderDateRange] = useState<OrderDateRange>("today");
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderHistoryStatusFilter>("paid");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<OrderHistoryPaymentFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order>();
  const [selectedOrderItems, setSelectedOrderItems] = useState<OrderItem[]>([]);
  const [selectedOrderInventoryLogs, setSelectedOrderInventoryLogs] = useState<InventoryLog[]>([]);
  const [selectedOrderRefunds, setSelectedOrderRefunds] = useState<OrderRefund[]>([]);
  const [orderPendingUnlock, setOrderPendingUnlock] = useState<Order>();
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderDetailLoading, setIsOrderDetailLoading] = useState(false);
  const [isOrderUnlockOpen, setIsOrderUnlockOpen] = useState(false);
  const [isVoidingOrder, setIsVoidingOrder] = useState(false);
  const [isSavingRefund, setIsSavingRefund] = useState(false);
  const [isAdjustingAccounting, setIsAdjustingAccounting] = useState(false);
  const [status, setStatus] = useState<StatusMessage>();

  async function refreshOrdersData(options: { preserveStatus?: boolean; failureStatus?: StatusMessage } = {}) {
    setIsLoading(true);
    if (!options.preserveStatus) {
      setStatus(undefined);
    }

    try {
      const [loadedSettings, loadedOrders, loadedProducts] = await Promise.all([
        getSettings(),
        listOrders(),
        listProducts()
      ]);
      setSettings(loadedSettings);
      setOrders(loadedOrders);
      setProducts(loadedProducts);

      try {
        setRefunds(await listRefunds());
      } catch {
        setRefunds([]);
        if (!options.preserveStatus) {
          setStatus({ kind: "error", text: "退款记录加载失败，订单售后标识可能不完整。" });
        }
      }
    } catch {
      setStatus(options.failureStatus ?? { kind: "error", text: "订单记录加载失败，请刷新后重试。" });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshOrdersData();
  }, []);

  const filteredOrders = useMemo(
    () =>
      filterAndSortOrders(orders, {
        query: orderQuery,
        dateRange: orderDateRange,
        status: orderStatusFilter,
        paymentMethod: orderPaymentFilter
      }),
    [orders, orderDateRange, orderPaymentFilter, orderQuery, orderStatusFilter]
  );

  const pairedOrders = useMemo(() => sortOrdersForPairedColumns(filteredOrders), [filteredOrders]);

  async function openOrderDetail(order: Order) {
    setIsOrderDetailLoading(true);
    setStatus(undefined);

    try {
      const [items, inventoryLogs, orderRefunds] = await Promise.all([
        listOrderItems(order.id),
        listInventoryLogsForOrder(order.id),
        listOrderRefunds(order.id)
      ]);
      setSelectedOrder(order);
      setSelectedOrderItems(items);
      setSelectedOrderInventoryLogs(inventoryLogs);
      setSelectedOrderRefunds(orderRefunds);
    } catch {
      setStatus({ kind: "error", text: "订单详情加载失败，请稍后重试。" });
    } finally {
      setIsOrderDetailLoading(false);
    }
  }

  function requestOrderDetail(order: Order) {
    if (settings && requiresFieldLockUnlock(settings.fieldLock)) {
      setOrderPendingUnlock(order);
      setIsOrderUnlockOpen(true);
      return;
    }

    void openOrderDetail(order);
  }

  async function handleVerifyOrderUnlock(pin: string) {
    if (!settings) {
      return { success: false, message: "设置尚未加载完成，请稍后重试。" };
    }

    const result = await verifyFieldLockPin(settings.fieldLock, pin);
    const nextSettings = {
      ...settings,
      fieldLock: result.settings
    };

    setSettings(nextSettings);
    await saveSettings(nextSettings);
    notifySettingsUpdated(nextSettings);
    return { success: result.success, message: result.message };
  }

  function handleOrderUnlockVerified() {
    const nextOrder = orderPendingUnlock;
    setIsOrderUnlockOpen(false);
    setOrderPendingUnlock(undefined);
    if (nextOrder) {
      void openOrderDetail(nextOrder);
    }
  }

  function handleCancelOrderUnlock() {
    setIsOrderUnlockOpen(false);
    setOrderPendingUnlock(undefined);
  }

  function closeOrderDetail() {
    setSelectedOrder(undefined);
    setSelectedOrderItems([]);
    setSelectedOrderInventoryLogs([]);
    setSelectedOrderRefunds([]);
  }

  async function handleVoidSelectedOrder(input: VoidOrderInput) {
    if (!selectedOrder) {
      return;
    }

    setIsVoidingOrder(true);
    setStatus(undefined);

    try {
      const voidedOrder = await voidPaidOrder(selectedOrder.id, input);
      setSelectedOrder(voidedOrder);

      try {
        const [items, inventoryLogs] = await Promise.all([
          listOrderItems(voidedOrder.id),
          listInventoryLogsForOrder(voidedOrder.id)
        ]);

        setSelectedOrderItems(items);
        setSelectedOrderInventoryLogs(inventoryLogs);
        setStatus({ kind: "success", text: `订单 ${voidedOrder.orderNo} 已作废，库存已回滚。` });
      } catch {
        setStatus({ kind: "error", text: `订单 ${voidedOrder.orderNo} 已作废，但详情刷新失败，请刷新页面查看最新库存流水。` });
      }

      await refreshOrdersData({ preserveStatus: true });
    } catch {
      setStatus({ kind: "error", text: "订单作废失败，请刷新后重试。" });
    } finally {
      setIsVoidingOrder(false);
    }
  }

  async function handleSaveSelectedRefund(input: SaveRefundInput) {
    if (!selectedOrder) {
      return;
    }

    setIsSavingRefund(true);
    setStatus(undefined);

    try {
      try {
        await saveOrderRefund({
          orderId: selectedOrder.id,
          amount: input.amount,
          method: input.method,
          reason: input.reason,
          note: input.note
        });
      } catch {
        setStatus({ kind: "error", text: "退款记录保存失败，请刷新后重试。" });
        throw new Error("refund-save-failed");
      }

      try {
        const updatedRefunds = await listOrderRefunds(selectedOrder.id);
        setSelectedOrderRefunds(updatedRefunds);
        setStatus({ kind: "success", text: `订单 ${selectedOrder.orderNo} 已记录退款 ${formatMoney(input.amount)}。` });
      } catch {
        setStatus({
          kind: "error",
          text: `订单 ${selectedOrder.orderNo} 已记录退款，但退款记录刷新失败，请刷新页面查看最新退款记录。`
        });
      }

      await refreshOrdersData({
        preserveStatus: true,
        failureStatus: {
          kind: "error",
          text: `订单 ${selectedOrder.orderNo} 已记录退款，但订单列表刷新失败，请刷新页面查看最新订单列表。`
        }
      });
    } finally {
      setIsSavingRefund(false);
    }
  }

  async function refreshSelectedOrderAccountingDetails(orderId: string) {
    const [items, inventoryLogs, orderRefunds] = await Promise.all([
      listOrderItems(orderId),
      listInventoryLogsForOrder(orderId),
      listOrderRefunds(orderId)
    ]);

    setSelectedOrderItems(items);
    setSelectedOrderInventoryLogs(inventoryLogs);
    setSelectedOrderRefunds(orderRefunds);
  }

  async function handleAdjustSelectedOrderItem(input: AdjustOrderItemAccountingInput) {
    if (!selectedOrder) {
      return;
    }

    setIsAdjustingAccounting(true);
    setStatus(undefined);

    try {
      try {
        const adjustedItem = await adjustOrderItemAccounting(input);
        if (adjustedItem) {
          setSelectedOrderItems((items) => items.map((item) => (item.id === adjustedItem.id ? adjustedItem : item)));
        }
      } catch {
        setStatus({ kind: "error", text: "订单统计口径修正失败，请刷新后重试。" });
        throw new Error("order-accounting-adjustment-failed");
      }

      try {
        await refreshSelectedOrderAccountingDetails(selectedOrder.id);
        setStatus({ kind: "success", text: "订单统计口径已修正，原始支付、退款和库存流水未改动。" });
      } catch {
        setStatus({ kind: "error", text: "订单统计口径已修正，但详情刷新失败，请刷新页面查看最新数据。" });
      }

      await refreshOrdersData({
        preserveStatus: true,
        failureStatus: {
          kind: "error",
          text: "订单统计口径已修正，但订单列表刷新失败，请刷新页面查看最新订单列表。"
        }
      });
    } finally {
      setIsAdjustingAccounting(false);
    }
  }

  async function handleAdjustSelectedWholeOrder(input: AdjustOrderAccountingInput) {
    if (!selectedOrder) {
      return;
    }

    setIsAdjustingAccounting(true);
    setStatus(undefined);

    try {
      try {
        const adjustedItems = await adjustOrderAccounting(input);
        if (adjustedItems.length > 0) {
          setSelectedOrderItems(adjustedItems);
        }
      } catch {
        setStatus({ kind: "error", text: "订单统计口径修正失败，请刷新后重试。" });
        throw new Error("order-accounting-adjustment-failed");
      }

      try {
        await refreshSelectedOrderAccountingDetails(selectedOrder.id);
        setStatus({ kind: "success", text: "订单统计口径已修正，原始支付、退款和库存流水未改动。" });
      } catch {
        setStatus({ kind: "error", text: "订单统计口径已修正，但详情刷新失败，请刷新页面查看最新数据。" });
      }

      await refreshOrdersData({
        preserveStatus: true,
        failureStatus: {
          kind: "error",
          text: "订单统计口径已修正，但订单列表刷新失败，请刷新页面查看最新订单列表。"
        }
      });
    } finally {
      setIsAdjustingAccounting(false);
    }
  }

  function canAdjustItemToCampaignGift(item: OrderItem): boolean {
    return products.find((product) => product.id === item.productId)?.isGiftEligible ?? false;
  }

  return (
    <section className="ordersPage" aria-labelledby="orders-page-title">
      <header className="ordersHeader">
        <div>
          <p className="eyebrow">Orders</p>
          <h1 id="orders-page-title">订单</h1>
          <p>独立查看订单、售后状态和统计口径，详情操作沿用正式订单详情。</p>
        </div>
        <button type="button" className="secondaryButton ordersRefreshButton" disabled={isLoading} onClick={() => void refreshOrdersData()}>
          <RefreshCw size={15} aria-hidden="true" />
          刷新
        </button>
      </header>

      {status ? (
        <p className={status.kind === "success" ? "successBanner" : "errorBanner"} role="status">
          {status.text}
        </p>
      ) : null}

      <div className="ordersFilterBar">
        <label>
          <span>搜索</span>
          <div className="ordersSearchInput">
            <Search size={15} aria-hidden="true" />
            <input
              aria-label="搜索订单号"
              value={orderQuery}
              onChange={(event) => setOrderQuery(event.target.value)}
              placeholder="订单号"
            />
          </div>
        </label>
        <label>
          <span>日期</span>
          <select
            aria-label="订单日期范围"
            value={orderDateRange}
            onChange={(event) => setOrderDateRange(event.target.value as OrderDateRange)}
          >
            {(Object.keys(dateRangeLabels) as OrderDateRange[]).map((key) => (
              <option key={key} value={key}>
                {dateRangeLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>状态</span>
          <select
            aria-label="订单状态"
            value={orderStatusFilter}
            onChange={(event) => setOrderStatusFilter(event.target.value as OrderHistoryStatusFilter)}
          >
            <option value="all">全部状态</option>
            {(Object.keys(orderStatusLabels) as Array<keyof typeof orderStatusLabels>).map((key) => (
              <option key={key} value={key}>
                {orderStatusLabels[key]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>支付</span>
          <select
            aria-label="支付方式"
            value={orderPaymentFilter}
            onChange={(event) => setOrderPaymentFilter(event.target.value as OrderHistoryPaymentFilter)}
          >
            <option value="all">全部方式</option>
            {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((key) => (
              <option key={key} value={key}>
                {paymentMethodLabels[key]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="ordersListPanel" aria-labelledby="orders-list-title">
        <div className="ordersListHeader">
          <h2 id="orders-list-title">订单记录</h2>
          <span>{filteredOrders.length} 笔</span>
        </div>
        {isLoading ? <p className="emptyState">正在加载订单记录...</p> : null}
        {!isLoading && pairedOrders.length === 0 ? <p className="emptyState">当前筛选下暂无订单。</p> : null}
        <div className="ordersGrid" role="region" aria-label="订单记录列表">
          {pairedOrders.map((order) => {
            const afterSalesBadges = getOrderAfterSalesBadges(order, refunds);
            const accountingBadges = getOrderHistoryAccountingBadges(order);

            return (
              <article className="orderHistoryRow ordersGridItem" key={order.id}>
                <button
                  type="button"
                  className="orderHistoryOpenButton ordersOpenButton"
                  aria-label={`查看订单 ${order.orderNo}`}
                  disabled={isOrderDetailLoading}
                  onClick={() => requestOrderDetail(order)}
                >
                  <span>
                    <strong>{order.orderNo}</strong>
                    <em>{formatPaidTime(orderBusinessTime(order))}</em>
                  </span>
                  <span className="orderHistoryMeta ordersHistoryMeta">
                    <span className="orderHistoryChip isStatus">{orderStatusLabels[order.status]}</span>
                    <span className={paymentMethodClassName(order.paymentMethod)}>
                      {order.paymentMethod ? paymentMethodLabels[order.paymentMethod] : "未记录"}
                    </span>
                    {accountingBadges.map((badge) => (
                      <span
                        className={badge.tone === "warning" ? "orderHistoryChip isAccounting isWarning" : "orderHistoryChip isAccounting"}
                        key={`${order.id}-${badge.label}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                    {afterSalesBadges.map((badge) => (
                      <span
                        className={
                          badge.tone === "danger"
                            ? "orderHistoryChip isAfterSales isDanger"
                            : "orderHistoryChip isAfterSales"
                        }
                        key={`${order.id}-${badge.label}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                    <strong className="notranslate ordersAmount" translate="no">
                      {formatMoney(order.payableAmount)}
                    </strong>
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {selectedOrder ? (
        <OrderDetailDialog
          order={selectedOrder}
          orderItems={selectedOrderItems}
          inventoryLogs={selectedOrderInventoryLogs}
          orderRefunds={selectedOrderRefunds}
          onClose={closeOrderDetail}
          onVoidOrder={handleVoidSelectedOrder}
          isVoiding={isVoidingOrder}
          onSaveRefund={handleSaveSelectedRefund}
          isSavingRefund={isSavingRefund}
          onAdjustOrderItem={handleAdjustSelectedOrderItem}
          onAdjustWholeOrder={handleAdjustSelectedWholeOrder}
          isAdjustingAccounting={isAdjustingAccounting}
          canAdjustItemToCampaignGift={canAdjustItemToCampaignGift}
          campaignGiftActivityName={settings?.campaignGift.activityName ?? "运营赠礼"}
        />
      ) : null}

      <FieldLockDialog
        isOpen={isOrderUnlockOpen}
        onCancel={handleCancelOrderUnlock}
        onVerify={handleVerifyOrderUnlock}
        onVerified={handleOrderUnlockVerified}
      />
    </section>
  );
}
