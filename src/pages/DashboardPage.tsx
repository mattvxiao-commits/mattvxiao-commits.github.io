import { AlertTriangle, BarChart3, PackageX, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listOrderItems, listOrders, listProducts, listRefunds } from "../db/repositories";
import { buildDashboardModel } from "../domain/dashboard";
import { formatMoney } from "../domain/money";
import type { Order, OrderItem, OrderRefund, Product } from "../domain/types";

type DashboardState = {
  orders: Order[];
  orderItems: OrderItem[];
  products: Product[];
  refunds: OrderRefund[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardState>({ orders: [], orderItems: [], products: [], refunds: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [error, setError] = useState<string>();

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
    () =>
      buildDashboardModel({
        day: new Date(),
        orders: data.orders,
        orderItems: data.orderItems,
        products: data.products,
        refunds: data.refunds
      }),
    [data]
  );

  return (
    <section className="dashboardPage" aria-labelledby="dashboard-title">
      <div className="dashboardHeader">
        <div>
          <p className="eyebrow">经营看板</p>
          <h1 id="dashboard-title">仪表盘</h1>
          <p>查看今日销售、售后、热销商品和库存风险。</p>
        </div>
        <button type="button" className="secondaryButton" disabled={isLoading} onClick={() => void refreshDashboard()}>
          <RefreshCw size={17} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error ? (
        <p className="errorBanner" role="status">
          {error}
        </p>
      ) : null}

      {isLoading ? <p className="emptyState">正在加载仪表盘...</p> : null}

      {hasLoadedData ? (
        <>
          <div className="dashboardMetricStrip" aria-label="今日经营概览">
            <div>
              <span>{formatMoney(dashboard.summary.paidAmount)}</span>
              <p>今日销售额</p>
            </div>
            <div>
              <span>{formatMoney(dashboard.summary.refundAmount)}</span>
              <p>今日退款</p>
            </div>
            <div>
              <span>{formatMoney(dashboard.summary.netAmount)}</span>
              <p>今日实收</p>
            </div>
            <div>
              <span>{dashboard.summary.paidOrderCount}</span>
              <p>今日订单</p>
            </div>
          </div>

          <div className="dashboardMetricStrip" aria-label="今日售后概览">
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
                <p>今日已支付订单中销量最高的商品。</p>
              </div>
            </div>

            {!isLoading && dashboard.topSellingSkuRows.length === 0 ? (
              <div className="dashboardEmpty">
                <PackageX size={24} aria-hidden="true" />
                <p>暂无热销 SKU。</p>
              </div>
            ) : null}

            <div className="lowStockList">
              {dashboard.topSellingSkuRows.map((row) => (
                <article className="lowStockRow" key={row.productId}>
                  <div>
                    <h3>{row.productName}</h3>
                    <p>{row.spu}</p>
                  </div>
                  <span className="stockBadge">
                    {row.quantity} 件 / {formatMoney(row.amount)}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboardSection" aria-labelledby="gift-consumption-title">
            <div className="sectionTitle">
              <BarChart3 size={21} aria-hidden="true" />
              <div>
                <h2 id="gift-consumption-title">赠品消耗</h2>
                <p>今日已支付订单中发出的赠品数量。</p>
              </div>
            </div>

            {!isLoading && dashboard.giftConsumptionRows.length === 0 ? (
              <div className="dashboardEmpty">
                <PackageX size={24} aria-hidden="true" />
                <p>暂无赠品消耗。</p>
              </div>
            ) : null}

            <div className="lowStockList">
              {dashboard.giftConsumptionRows.map((row) => (
                <article className="lowStockRow" key={row.productId}>
                  <div>
                    <h3>{row.productName}</h3>
                    <p>{row.spu}</p>
                  </div>
                  <span className="stockBadge">消耗 {row.quantity}</span>
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
                <p>暂无低库存 SKU。</p>
              </div>
            ) : null}

            <div className="lowStockList">
              {dashboard.lowStockRows.map((row) => (
                <article className="lowStockRow" key={row.productId}>
                  <div>
                    <h3>{row.productName}</h3>
                    <p>{row.spu}</p>
                  </div>
                  <span className={row.stockQty === 0 ? "stockBadge isOut" : "stockBadge"}>
                    库存 {row.stockQty}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboardSection" aria-labelledby="exception-orders-title">
            <div className="sectionTitle">
              <AlertTriangle size={21} aria-hidden="true" />
              <div>
                <h2 id="exception-orders-title">今日异常订单</h2>
                <p>今日作废、退款、备注或赠品异常的订单。</p>
              </div>
            </div>

            {!isLoading && dashboard.exceptionRows.length === 0 ? (
              <div className="dashboardEmpty">
                <PackageX size={24} aria-hidden="true" />
                <p>暂无异常订单。</p>
              </div>
            ) : null}

            <div className="lowStockList">
              {dashboard.exceptionRows.map((row) => (
                <article className="lowStockRow" key={row.orderId}>
                  <div>
                    <h3>{row.orderNo}</h3>
                    <p>{formatMoney(row.payableAmount)}</p>
                  </div>
                  <span>
                    {row.badges.map((badge) => (
                      <span className="stockBadge" key={`${row.orderId}-${badge}`}>
                        {badge}
                      </span>
                    ))}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
