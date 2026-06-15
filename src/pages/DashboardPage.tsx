import { AlertTriangle, BarChart3, PackageX, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listOrders, listProducts } from "../db/repositories";
import { formatMoney } from "../domain/money";
import type { Order, Product } from "../domain/types";

type DashboardState = {
  orders: Order[];
  products: Product[];
};

function orderBusinessTime(order: Order): string {
  return order.paidAt ?? order.createdAt;
}

function isSameLocalDay(value: string, day: Date): boolean {
  const date = new Date(value);

  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardState>({ orders: [], products: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function refreshDashboard() {
    setIsLoading(true);
    setError(undefined);

    try {
      const [orders, products] = await Promise.all([listOrders(), listProducts()]);
      setData({ orders, products });
    } catch {
      setError("仪表盘数据加载失败，请刷新后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshDashboard();
  }, []);

  const todayPaidOrders = useMemo(() => {
    const today = new Date();

    return data.orders.filter((order) => order.status === "paid" && isSameLocalDay(orderBusinessTime(order), today));
  }, [data.orders]);

  const todayPaidAmount = todayPaidOrders.reduce((sum, order) => sum + order.payableAmount, 0);
  const lowStockProducts = useMemo(
    () =>
      data.products
        .filter((product) => product.status === "active" && product.stockQty < 3)
        .sort((a, b) => a.stockQty - b.stockQty || a.name.localeCompare(b.name, "zh-Hans-CN")),
    [data.products]
  );

  return (
    <section className="dashboardPage" aria-labelledby="dashboard-title">
      <div className="dashboardHeader">
        <div>
          <p className="eyebrow">Overview</p>
          <h1 id="dashboard-title">仪表盘</h1>
          <p>查看今日已支付销售和需要补货的商品。</p>
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

      <div className="dashboardMetricStrip" aria-label="今日经营概览">
        <div>
          <span>{formatMoney(todayPaidAmount)}</span>
          <p>今日已支付销售额</p>
        </div>
        <div>
          <span>{todayPaidOrders.length}</span>
          <p>今日已支付订单</p>
        </div>
        <div>
          <span>{lowStockProducts.length}</span>
          <p>低库存商品</p>
        </div>
      </div>

      <section className="dashboardSection" aria-labelledby="low-stock-title" aria-label="低库存商品">
        <div className="sectionTitle">
          <AlertTriangle size={21} aria-hidden="true" />
          <div>
            <h2 id="low-stock-title">低库存商品</h2>
            <p>库存低于 3 的启用商品。</p>
          </div>
        </div>

        {!isLoading && lowStockProducts.length === 0 ? (
          <div className="dashboardEmpty">
            <PackageX size={24} aria-hidden="true" />
            <p>暂无低库存商品。</p>
          </div>
        ) : null}

        <div className="lowStockList">
          {lowStockProducts.map((product) => (
            <article className="lowStockRow" key={product.id}>
              <div>
                <h3>{product.name}</h3>
                <p>{product.spu}</p>
              </div>
              <span className={product.stockQty === 0 ? "stockBadge isOut" : "stockBadge"}>
                库存 {product.stockQty}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboardSection" aria-labelledby="dashboard-note-title">
        <div className="sectionTitle">
          <BarChart3 size={21} aria-hidden="true" />
          <div>
            <h2 id="dashboard-note-title">统计口径</h2>
            <p>仅统计状态为已支付的订单；优先使用支付时间，缺失时使用创建时间。</p>
          </div>
        </div>
      </section>
    </section>
  );
}
