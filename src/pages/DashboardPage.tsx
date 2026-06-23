import { AlertTriangle, BarChart3, PackageX, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listOrderItems, listOrders, listProducts, listRefunds } from "../db/repositories";
import {
  buildDashboardDateRange,
  buildDashboardModel,
  type DashboardAccountingScope,
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

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardState>({ orders: [], orderItems: [], products: [], refunds: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [error, setError] = useState<string>();
  const [dateRange, setDateRange] = useState<DashboardDateRange | undefined>(() => buildDashboardDateRange("today"));
  const [rangePreset, setRangePreset] = useState<DashboardRangePreset>("today");
  const [customRange, setCustomRange] = useState<DashboardCustomRangeInput>(() => todayCustomRange());
  const [accountingScope, setAccountingScope] = useState<DashboardAccountingScope>("sales");
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
        refunds: data.refunds,
        accountingScope
      });
    },
    [accountingScope, data, dateRange]
  );

  function selectRangePreset(nextPreset: DashboardRangePreset) {
    setRangePreset(nextPreset);

    if (nextPreset === "custom") {
      const nextCustomRange = todayCustomRange();
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
  const scopeOptions: Array<{ value: DashboardAccountingScope; label: string }> = [
    { value: "sales", label: "正常销售" },
    { value: "all", label: "全部活动" },
    { value: "campaign_gift", label: "运营赠礼" },
    { value: "manual_gift", label: "人工赠送" },
    { value: "other_non_sales", label: "其他出库" }
  ];

  return (
    <section className="dashboardPage" aria-labelledby="dashboard-title">
      <div className="dashboardHeader">
        <div>
          <p className="eyebrow">经营看板</p>
          <h1 id="dashboard-title">仪表盘</h1>
          <p>统计范围：{dateRange?.label ?? "自定义日期无效"}</p>
        </div>

        <div className="dashboardFilterPanel" role="group" aria-label="仪表盘筛选">
          <div className="dashboardFilterRow" role="group" aria-label="时间范围">
            <div className="dashboardRangeSwitch" role="group" aria-label="日期范围">
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

            <button
              type="button"
              className="secondaryButton dashboardRefreshButton"
              disabled={isLoading}
              onClick={() => void refreshDashboard()}
            >
              <RefreshCw size={17} aria-hidden="true" />
              刷新
            </button>
          </div>

          {rangePreset === "custom" ? (
            <div className="dashboardCustomRange" role="group" aria-label="自定义日期">
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

          <div className="dashboardFilterRow dashboardFilterScopeRow" role="group" aria-label="统计口径">
            <div className="dashboardScopeSwitch" role="group" aria-label="口径选项">
              {scopeOptions.map((option) => (
                <button
                  type="button"
                  className={accountingScope === option.value ? "secondaryButton isActive" : "secondaryButton"}
                  key={option.value}
                  onClick={() => setAccountingScope(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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

            <div className="dashboardOperationsStrip" aria-label="订单性质">
              <div>
                <span>{dashboard.orderNatureSummary.saleOrderCount}</span>
                <p>正常销售</p>
              </div>
              <div>
                <span>{dashboard.orderNatureSummary.mixedOrderCount}</span>
                <p>销售 + 赠送</p>
              </div>
              <div>
                <span>{dashboard.orderNatureSummary.nonSalesOrderCount}</span>
                <p>非销售出库</p>
              </div>
              <div>
                <span>{dashboard.orderNatureSummary.campaignGiftOrderCount}</span>
                <p>运营赠礼订单</p>
              </div>
            </div>

            <div className="dashboardOperationsStrip" aria-label="出库与客单">
              <div>
                <span>{dashboard.operationsSummary.soldQuantity}</span>
                <p>售出件数</p>
              </div>
              <div>
                <span>{dashboard.operationsSummary.giftQuantity}</span>
                <p>赠品件数</p>
              </div>
              <div>
                <span>{dashboard.operationsSummary.outboundQuantity}</span>
                <p>总出库</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.operationsSummary.averageOrderValue)}</span>
                <p>客单价</p>
              </div>
            </div>

            <div className="dashboardOperationsStrip dashboardNonSalesBreakdownStrip" aria-label="非销售拆分">
              <div>
                <span>
                  {dashboard.nonSalesBreakdown.tierGiftQuantity} / {formatMoney(dashboard.nonSalesBreakdown.tierGiftCost)}
                </span>
                <p>满赠</p>
              </div>
              <div>
                <span>
                  {dashboard.nonSalesBreakdown.campaignGiftQuantity} / {formatMoney(dashboard.nonSalesBreakdown.campaignGiftCost)}
                </span>
                <p>运营赠礼</p>
              </div>
              <div>
                <span>
                  {dashboard.nonSalesBreakdown.manualGiftQuantity} / {formatMoney(dashboard.nonSalesBreakdown.manualGiftCost)}
                </span>
                <p>人工赠送</p>
              </div>
              <div>
                <span>
                  {dashboard.nonSalesBreakdown.otherNonSalesQuantity} / {formatMoney(dashboard.nonSalesBreakdown.otherNonSalesCost)}
                </span>
                <p>其他出库</p>
              </div>
            </div>

            <div className="dashboardOperationsStrip" aria-label="活动效果">
              <div>
                <span>{dashboard.promotionSummary.addonQuantity}</span>
                <p>加购件数</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.promotionSummary.addonDiscountAmount)}</span>
                <p>优惠让利</p>
              </div>
              <div>
                <span>{dashboard.promotionSummary.addonOrderCount}</span>
                <p>优惠订单</p>
              </div>
              <div>
                <span>{dashboard.promotionSummary.giftTriggeredOrderCount}</span>
                <p>满赠订单</p>
              </div>
            </div>

            <div className="dashboardOperationsStrip dashboardActivityCostStrip" aria-label="经营成本口径">
              <div>
                <span>{formatMoney(dashboard.activityCostSummary.discountGiveawayAmount)}</span>
                <p>优惠让利</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.activityCostSummary.salesCost)}</span>
                <p>销售成本</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.activityCostSummary.basicGrossProfit)}</span>
                <p>基础毛利</p>
              </div>
              <div>
                <span>{formatPercent(dashboard.activityCostSummary.basicGrossMargin)}</span>
                <p>基础毛利率</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.activityCostSummary.operatingActivityCost)}</span>
                <p>运营活动成本</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.activityCostSummary.activityAdjustedGrossProfit)}</span>
                <p>活动后毛利</p>
              </div>
              <div>
                <span>{formatPercent(dashboard.activityCostSummary.activityAdjustedGrossMargin)}</span>
                <p>活动后毛利率</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.activityCostSummary.nonOperatingOutboundCost)}</span>
                <p>非经营出库</p>
              </div>
              <div>
                <span>{formatMoney(dashboard.activityCostSummary.fullOutboundCost)}</span>
                <p>全出库成本</p>
              </div>
            </div>

            <section className="dashboardSection dashboardProfitOverview" aria-labelledby="profit-overview-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="profit-overview-title">毛利概览</h2>
                  <p>当前范围有成本快照的订单明细汇总。</p>
                </div>
              </div>

              <div className="dashboardOperationsStrip dashboardProfitStrip" aria-label="毛利概览指标">
                <div>
                  <span>{formatMoney(dashboard.profitSummary.revenueWithCostSnapshot)}</span>
                  <p>销售额（有成本快照）</p>
                </div>
                <div>
                  <span>{formatMoney(dashboard.profitSummary.costAmount)}</span>
                  <p>成本</p>
                </div>
                <div>
                  <span>{formatMoney(dashboard.profitSummary.grossProfit)}</span>
                  <p>毛利</p>
                </div>
                <div>
                  <span>{formatPercent(dashboard.profitSummary.grossMargin)}</span>
                  <p>毛利率</p>
                </div>
                <div>
                  <span>{formatMoney(dashboard.profitSummary.giftCostAmount)}</span>
                  <p>赠品成本</p>
                </div>
              </div>

              {dashboard.profitSummary.missingCostItemCount > 0 ? (
                <p className="errorBanner" role="status">
                  当前范围有 {dashboard.profitSummary.missingCostItemCount} 条旧订单明细缺少成本快照，未纳入准确毛利。
                </p>
              ) : null}
            </section>

            {dashboard.accountingScope !== "sales" ? (
              <section className="dashboardSection" aria-labelledby="non-sales-reason-title">
                <div className="sectionTitle">
                  <BarChart3 size={21} aria-hidden="true" />
                  <div>
                    <h2 id="non-sales-reason-title">非销售出库分布</h2>
                    <p>当前统计口径下的赠礼和非销售出库 SKU。</p>
                  </div>
                </div>

                {!isLoading && dashboard.nonSalesReasonRows.length === 0 ? (
                  <div className="dashboardEmpty">
                    <PackageX size={24} aria-hidden="true" />
                    <p>当前口径暂无非销售出库。</p>
                  </div>
                ) : null}

                <div className="dashboardRankList">
                  {dashboard.nonSalesReasonRows.map((row) => (
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
            ) : null}

            <section className="dashboardSection" aria-labelledby="payment-method-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="payment-method-title">支付方式</h2>
                  <p>当前范围已支付订单按支付方式汇总。</p>
                </div>
              </div>

              {!isLoading && dashboard.paymentMethodRows.every((row) => row.orderCount === 0) ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无支付记录。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.paymentMethodRows.map((row) => (
                  <article className="dashboardRankRow" key={row.method}>
                    <div>
                      <h3>{row.label}</h3>
                      <p>支付方式</p>
                    </div>
                    <div className="dashboardRowMetric">
                      <span>{row.orderCount} 单</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="gift-tier-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="gift-tier-title">满赠触发</h2>
                  <p>当前范围已支付订单触发的满赠门槛。</p>
                </div>
              </div>

              {!isLoading && dashboard.giftTierRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无满赠触发。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.giftTierRows.map((row) => (
                  <article className="dashboardRankRow" key={row.threshold}>
                    <div>
                      <h3>满 {row.threshold}</h3>
                      <p>满赠门槛</p>
                    </div>
                    <div className="dashboardRowMetric">
                      <span>{row.orderCount} 单</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="profit-sku-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="profit-sku-title">SKU 毛利排行</h2>
                  <p>当前范围有成本快照的 SKU 按毛利排序。</p>
                </div>
              </div>

              {!isLoading && dashboard.profitSkuRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无 SKU 毛利数据。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.profitSkuRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className="dashboardRowMetric">
                      <span>{row.quantity} 件</span>
                      <strong>{formatMoney(row.grossProfit)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="profit-spu-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="profit-spu-title">SPU 毛利排行</h2>
                  <p>当前范围有成本快照的 SPU 按毛利排序。</p>
                </div>
              </div>

              {!isLoading && dashboard.profitSpuRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无 SPU 毛利数据。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.profitSpuRows.map((row) => (
                  <article className="dashboardRankRow" key={row.spu}>
                    <div>
                      <h3>{row.spu}</h3>
                      <p>SPU</p>
                    </div>
                    <div className="dashboardRowMetric">
                      <span>{row.quantity} 件</span>
                      <strong>{formatMoney(row.grossProfit)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="low-profit-sku-title">
              <div className="sectionTitle">
                <AlertTriangle size={21} aria-hidden="true" />
                <div>
                  <h2 id="low-profit-sku-title">低毛利 SKU</h2>
                  <p>毛利率低于 20%，或毛利不高于 0 的 SKU。</p>
                </div>
              </div>

              {!isLoading && dashboard.lowProfitSkuRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无低毛利 SKU。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.lowProfitSkuRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className={row.grossProfit <= 0 ? "dashboardRowMetric isOut" : "dashboardRowMetric"}>
                      <span>毛利率 {formatPercent(row.grossMargin)}</span>
                      <strong>{formatMoney(row.grossProfit)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

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

            <section className="dashboardSection" aria-labelledby="top-selling-spu-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="top-selling-spu-title">热销 SPU</h2>
                  <p>当前范围已支付订单中售出件数最高的 SPU。</p>
                </div>
              </div>

              {!isLoading && dashboard.topSellingSpuRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无 SPU 销售。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.topSellingSpuRows.map((row) => (
                  <article className="dashboardRankRow" key={row.spu}>
                    <div>
                      <h3>{row.spu}</h3>
                      <p>SPU</p>
                    </div>
                    <div className="dashboardRowMetric">
                      <span>{row.quantity} 件</span>
                      <strong>{formatMoney(row.amount)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="top-revenue-spu-title">
              <div className="sectionTitle">
                <BarChart3 size={21} aria-hidden="true" />
                <div>
                  <h2 id="top-revenue-spu-title">SPU 销售额</h2>
                  <p>当前范围已支付订单中销售额最高的 SPU。</p>
                </div>
              </div>

              {!isLoading && dashboard.topRevenueSpuRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>当前范围暂无 SPU 销售额。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.topRevenueSpuRows.map((row) => (
                  <article className="dashboardRankRow" key={row.spu}>
                    <div>
                      <h3>{row.spu}</h3>
                      <p>SPU</p>
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
                  <p>库存少于 3，或按当前范围估算剩余不高于 20%。</p>
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
                      {row.soldQuantity > 0 ? <strong>剩余 {row.stockRemainingPercent}%</strong> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="sold-out-sku-title">
              <div className="sectionTitle">
                <AlertTriangle size={21} aria-hidden="true" />
                <div>
                  <h2 id="sold-out-sku-title">售罄 SKU</h2>
                  <p>当前库存为 0 的启用商品。</p>
                </div>
              </div>

              {!isLoading && dashboard.soldOutRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>暂无售罄 SKU。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.soldOutRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className="dashboardRowMetric isOut">
                      <span>库存 {row.stockQty}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="high-risk-sku-title">
              <div className="sectionTitle">
                <AlertTriangle size={21} aria-hidden="true" />
                <div>
                  <h2 id="high-risk-sku-title">高风险 SKU</h2>
                  <p>当前范围有销量，且库存量或剩余比例已偏低。</p>
                </div>
              </div>

              {!isLoading && dashboard.highRiskRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>暂无高风险 SKU。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.highRiskRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className={row.stockQty === 0 ? "dashboardRowMetric isOut" : "dashboardRowMetric"}>
                      <span>售出 {row.soldQuantity} 件</span>
                      <strong>
                        库存 {row.stockQty} / 剩余 {row.stockRemainingPercent}%
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="slow-moving-sku-title">
              <div className="sectionTitle">
                <AlertTriangle size={21} aria-hidden="true" />
                <div>
                  <h2 id="slow-moving-sku-title">滞销 SKU</h2>
                  <p>当前范围无销量且仍有库存的可售商品。</p>
                </div>
              </div>

              {!isLoading && dashboard.slowMovingRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>暂无滞销 SKU。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.slowMovingRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className="dashboardRowMetric">
                      <span>库存 {row.stockQty}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboardSection" aria-labelledby="restock-suggestions-title">
              <div className="sectionTitle">
                <AlertTriangle size={21} aria-hidden="true" />
                <div>
                  <h2 id="restock-suggestions-title">补货建议</h2>
                  <p>优先处理可售售罄 SKU，其次处理高风险 SKU。</p>
                </div>
              </div>

              {!isLoading && dashboard.restockSuggestionRows.length === 0 ? (
                <div className="dashboardEmpty">
                  <PackageX size={24} aria-hidden="true" />
                  <p>暂无补货建议。</p>
                </div>
              ) : null}

              <div className="dashboardRankList">
                {dashboard.restockSuggestionRows.map((row) => (
                  <article className="dashboardRankRow" key={row.productId}>
                    <div>
                      <h3>{row.productName}</h3>
                      <p>{row.productCode ?? row.spu}</p>
                    </div>
                    <div className={row.stockQty === 0 ? "dashboardRowMetric isOut" : "dashboardRowMetric"}>
                      <span>建议补货</span>
                      <strong>
                        售出 {row.soldQuantity} / 库存 {row.stockQty} / 剩余 {row.stockRemainingPercent}%
                      </strong>
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
