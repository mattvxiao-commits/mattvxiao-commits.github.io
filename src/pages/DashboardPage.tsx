import { AlertTriangle, BarChart3, PackageX, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listOrderItems, listOrders, listProducts, listRefunds } from "../db/repositories";
import {
  buildDashboardDateRange,
  buildDashboardModel,
  type DashboardCustomRangeInput,
  type DashboardDateRange,
  type DashboardRangePreset
} from "../domain/dashboard";
import { formatMoney } from "../domain/money";
import type { Order, OrderItem, OrderRefund, Product } from "../domain/types";

type DashboardState = {
  orders: Order[];
  orderItems: OrderItem[];
  products: Product[];
  refunds: OrderRefund[];
};

function formatLocalDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayCustomRange(): DashboardCustomRangeInput {
  const today = formatLocalDateInput(new Date());
  return { startDate: today, endDate: today };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardState>({ orders: [], orderItems: [], products: [], refunds: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [error, setError] = useState<string>();
  const [dateRange, setDateRange] = useState<DashboardDateRange | undefined>(() => buildDashboardDateRange("today"));
  const [rangePreset, setRangePreset] = useState<DashboardRangePreset>("today");
  const [customRange, setCustomRange] = useState<DashboardCustomRangeInput>(() => todayCustomRange());
  const [rangeError, setRangeError] = useState<string>();

  async function refreshDashboard() {
    setIsLoading(true);
    setError(undefined);

    try {
      const [orders, products, refunds] = await Promise.all([listOrders(), listProducts(), listRefunds()]);
      const orderItemsByOrder = await Promise.all(orders.map((order) => listOrderItems(order.id)));
      setData({ orders, orderItems: orderItemsByOrder.flat(), products, refunds });
      setHasLoadedData(true);
    } catch {
      setError("仪表盘数据加载失败，请刷新后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshDashboard();
  }, []);

  const dashboard = useMemo(
    () => {
      if (!dateRange) {
        return undefined;
      }

      return buildDashboardModel({
        dateRange,
        orders: data.orders,
        orderItems: data.orderItems,
        products: data.products,
        refunds: data.refunds
      });
    },
    [data, dateRange]
  );

  function selectRangePreset(nextPreset: DashboardRangePreset) {
    setRangePreset(nextPreset);

    if (nextPreset === "custom") {
      const nextCustomRange = customRange.startDate && customRange.endDate ? customRange : todayCustomRange();
      setCustomRange(nextCustomRange);
      setDateRange(buildDashboardDateRange("custom", new Date(), nextCustomRange));
      setRangeError(undefined);
      return;
    }

    setDateRange(buildDashboardDateRange(nextPreset));
    setRangeError(undefined);
  }

  function updateCustomRange(nextCustomRange: DashboardCustomRangeInput) {
    setCustomRange(nextCustomRange);

    if (!nextCustomRange.startDate || !nextCustomRange.endDate) {
      setDateRange(undefined);
      setRangeError("自定义日期范围不完整。");
      return;
    }

    try {
      setDateRange(buildDashboardDateRange("custom", new Date(), nextCustomRange));
      setRangeError(undefined);
    } catch (customRangeError) {
      setDateRange(undefined);
      setRangeError(customRangeError instanceof Error ? customRangeError.message : "自定义日期范围无效。");
    }
  }

  const rangeOptions: Array<{ preset: DashboardRangePreset; label: string }> = [
    { preset: "today", label: "今日" },
    { preset: "yesterday", label: "昨天" },
    { preset: "last3days", label: "近 3 天" },
    { preset: "last7days", label: "近 7 天" },
    { preset: "custom", label: "自定义" }
  ];

  return (
    <section className="dashboardPage" aria-labelledby="dashboard-title">
      <div className="dashboardHeader">
        <div>
          <p className="eyebrow">经营看板</p>
          <h1 id="dashboard-title">仪表盘</h1>
          <p>统计范围：{dateRange?.label ?? "自定义日期无效"}</p>
        </div>
        <button type="button" className="secondaryButton" disabled={isLoading} onClick={() => void refreshDashboard()}>
          <RefreshCw size={17} aria-hidden="true" />
          刷新
        </button>
      </div>

      <div className="dashboardRangeControls" aria-label="时间范围">
        {rangeOptions.map((option) => (
          <button
            type="button"
            className={rangePreset === option.preset ? "secondaryButton isActive" : "secondaryButton"}
            key={option.preset}
            onClick={() => selectRangePreset(option.preset)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {rangePreset === "custom" ? (
        <div className="dashboardCustomRange">
          <label>
            开始日期
            <input
              type="date"
              value={customRange.startDate}
              onChange={(event) => updateCustomRange({ ...customRange, startDate: event.target.value })}
            />
          </label>
          <label>
            结束日期
            <input
              type="date"
              value={customRange.endDate}
              onChange={(event) => updateCustomRange({ ...customRange, endDate: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      {rangeError ? (
        <p className="errorBanner" role="status">
          {rangeError}
        </p>
      ) : null}

      {error ? (
        <p className="errorBanner" role="status">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="emptyState">正在加载仪表盘...</p> : null}

      {hasLoadedData && dashboard ? (
        <>
          <div className="dashboardGrid">
            <div className="dashboardMetricStrip" aria-label="经营概览">
              <div>
                <span>{formatMoney(dashboard.summary.paidAmount)}</span>
                <p>销售额</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.summary.refundAmount)}</span>
                <p>退款</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.summary.netAmount)}</span>
                <p>实收</p>
              </div>
              <div>
                <span>{dashboard.summary.paidOrderCount}</span>
                <p>订单</p>
              </div>
            </div>

            <div className="dashboardAfterSalesStrip" aria-label="售后概览">
              <div>
                <span>{dashboard.summary.cancelledOrderCount}</span>
                <p>作废订单</p>
              </div>
              <div>
                <span>{dashboard.summary.partialRefundOrderCount}</span>
                <p>部分退款</p>
              </div>
              <div>
                <span>{dashboard.summary.fullyRefundedOrderCount}</span>
                <p>已退款</p>
              </div>
              <div>
                <span>{dashboard.summary.notedCancelledOrderCount}</span>
                <p>作废备注</p>
              </div>
            </div>

            <section className="dashboardSection" aria-labelledby="top-selling-sku-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="top-selling-sku-title">热销 SKU</h2>
                  <p>当前范围已支付订单中销量最高的商品。</p>
                </div>
              </div>

              {!isLoading && dashboard.topSellingSkuRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无已支付订单。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.topSellingSkuRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className="dashboardRowMetric">
                      <span>{row.quantity} 件</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="gift-consumption-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="gift-consumption-title">赠品消耗</h2>
                  <p>当前范围已支付订单中发出的赠品数量。</p>
                </div>
              </div>

              {!isLoading && dashboard.giftConsumptionRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无赠品消耗。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.giftConsumptionRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className="dashboardRowMetric">
                      <span>{row.quantity} 件</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="low-stock-sku-title">
              <div className="sectionTitle">
                <AlertTriangle size={21} aria-hidden="true" />
                <div>
                  <h2 id="low-stock-sku-title">低库存 SKU</h2>
                  <p>库存低于 3 的启用商品。</p>
                </div>
              </div>

              {!isLoading && dashboard.lowStockRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>暂无低库存商品。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.lowStockRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className={row.stockQty === 0 ? "dashboardRowMetric isOut" : "dashboardRowMetric"}>
                      <span>库存 {row.stockQty}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="exception-orders-title">
              <div className="sectionTitle">
                <AlertTriangle size={21} aria-hidden="true" />
                <div>
                  <h2 id="exception-orders-title">异常订单</h2>
                  <p>当前范围作废、退款、备注或赠品异常的订单。</p>
                </div>
              </div>

              {!isLoading && dashboard.exceptionRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无异常订单。</p>
                </div>
              ) : null}

              <div className="dashboardExceptionList">
                {dashboard.exceptionRows.map((row) => (
                  <article className="dashboardExceptionRow" key={row.orderId}>
                    <div>
                      <h3>{row.orderNo}</h3>
                      <p>{formatMoney(row.payableAmount)}</p>
                    </div>
                    <div className="dashboardBadgeList">
                      {row.badges.map((badge) => (
                        <span className="dashboardBadge" key={`${row.orderId}-${badge}`}>
                          {badge}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
