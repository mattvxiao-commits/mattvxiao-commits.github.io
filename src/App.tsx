import {
  BarChart3,
  PackageSearch,
  ReceiptText,
  Settings,
  Store,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import ProductsPage from "./pages/ProductsPage";
import { revokeImageUrls } from "./utils/image";

const pages = [
  {
    to: "/products",
    label: "商品",
    icon: PackageSearch,
    eyebrow: "Catalog",
    title: "商品",
    summary: "管理摊位商品、规格与可售状态的工作区占位。",
    stats: ["商品档案", "库存状态", "价格标签"],
  },
  {
    to: "/sales",
    label: "售卖",
    icon: ReceiptText,
    eyebrow: "Checkout",
    title: "售卖",
    summary: "现场开单、收款确认与订单队列的工作区占位。",
    stats: ["快速开单", "待收款", "离线队列"],
  },
  {
    to: "/dashboard",
    label: "仪表盘",
    icon: BarChart3,
    eyebrow: "Overview",
    title: "仪表盘",
    summary: "查看今日销售、热卖商品与摊位经营状态的工作区占位。",
    stats: ["今日收入", "热卖商品", "同步状态"],
  },
  {
    to: "/settings",
    label: "设置",
    icon: Settings,
    eyebrow: "Setup",
    title: "设置",
    summary: "维护摊位资料、收款方式、备份与 PWA 偏好的工作区占位。",
    stats: ["摊位信息", "收款配置", "数据备份"],
  },
];

type PagePlaceholderProps = {
  page: (typeof pages)[number];
};

function PagePlaceholder({ page }: PagePlaceholderProps) {
  const Icon = page.icon;

  return (
    <section className="page" aria-labelledby={`${page.title}-title`}>
      <div className="pageHeader">
        <div className="pageCopy">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 id={`${page.title}-title`}>{page.title}</h1>
          <p>{page.summary}</p>
        </div>
        <div className="statusPanel" aria-label={`${page.title}占位模块`}>
          <div className="moduleIcon" aria-hidden="true">
            <Icon size={28} strokeWidth={2.2} />
          </div>
          <div>
            <p className="panelLabel">即将上线</p>
            <p className="panelText">当前版本先提供 PWA 外壳与导航结构。</p>
          </div>
          <div className="pillGrid">
            {page.stats.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  useEffect(() => {
    return () => {
      revokeImageUrls();
    };
  }, []);

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brandBlock">
          <div className="brandMark" aria-hidden="true">
            <Store size={21} strokeWidth={2.4} />
          </div>
          <div>
            <div className="brand">ECRM</div>
            <div className="subtitle">Booth POS 摊位工具</div>
          </div>
        </div>
        <nav className="nav" aria-label="主导航">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <NavLink key={page.to} to={page.to}>
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                <span>{page.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />
          <Route path="/products" element={<ProductsPage />} />
          {pages.map((page) => (
            page.to === "/products" ? null :
            <Route
              key={page.to}
              path={page.to}
              element={<PagePlaceholder page={page} />}
            />
          ))}
        </Routes>
      </main>
    </div>
  );
}
