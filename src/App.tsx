import {
  BarChart3,
  ClipboardList,
  LockKeyhole,
  PackageSearch,
  ReceiptText,
  Settings,
  Store,
  UnlockKeyhole,
} from "lucide-react";
import { type MouseEvent, type ReactElement, useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import FieldLockDialog from "./components/FieldLockDialog";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt";
import { getSettings, saveSettings } from "./db/repositories";
import {
  fieldLockProtectsScope,
  normalizeFieldLockSettings,
  requiresFieldLockUnlock,
  verifyFieldLockPin
} from "./domain/fieldLock";
import type { AppSettings, FieldLockScope } from "./domain/types";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import ProductsPage from "./pages/ProductsPage";
import SalesPage from "./pages/SalesPage";
import SettingsPage from "./pages/SettingsPage";
import { revokeImageUrls } from "./utils/image";
import { applyPwaUpdate, subscribePwaUpdateReady } from "./utils/pwaUpdate";
import { subscribeSettingsUpdated } from "./utils/settingsEvents";

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
    to: "/orders",
    label: "订单",
    icon: ClipboardList,
    eyebrow: "Orders",
    title: "订单",
    summary: "订单记录独立页将在 V1.7b 承接当前售卖页内的订单记录能力。",
    stats: ["订单记录", "售后状态", "统计口径"],
  },
  {
    to: "/dashboard",
    label: "数据",
    icon: BarChart3,
    eyebrow: "Data",
    title: "数据",
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

const protectedPageScopes: Partial<Record<string, FieldLockScope>> = {
  "/products": "products",
  "/dashboard": "dashboard",
  "/settings": "settings"
};
const defaultBrandSubtitle = "Booth POS 摊位工具";

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
  const [settings, setSettings] = useState<AppSettings>();
  const [pendingPath, setPendingPath] = useState<string>();
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);
  const [isUpdatePromptVisible, setIsUpdatePromptVisible] = useState(false);
  const [fieldModeTip, setFieldModeTip] = useState<string>();
  const suppressNextUnlockDialogRef = useRef(false);
  const fieldModeTipTimerRef = useRef<number | undefined>(undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const brandSubtitle = settings?.shopName.trim() || defaultBrandSubtitle;
  const isFieldModeEnabled = settings?.fieldLock.enabled === true;
  const fieldModeLabel = isFieldModeEnabled ? "现场模式" : "未锁定";
  const FieldModeIcon = isFieldModeEnabled ? LockKeyhole : UnlockKeyhole;

  useEffect(() => {
    return () => {
      revokeImageUrls();
      window.clearTimeout(fieldModeTipTimerRef.current);
    };
  }, []);

  useEffect(() => subscribePwaUpdateReady(() => {
    setIsUpdatePromptVisible(true);
  }), []);

  useEffect(() => subscribeSettingsUpdated((updatedSettings, options) => {
    const normalizedSettings = {
      ...updatedSettings,
      fieldLock: normalizeFieldLockSettings(updatedSettings.fieldLock)
    };

    setSettings(normalizedSettings);

    if (options?.suppressUnlockDialog && requiresFieldLockUnlock(normalizedSettings.fieldLock)) {
      suppressNextUnlockDialogRef.current = true;
      setPendingPath(undefined);
      setIsLockDialogOpen(false);
      navigate("/sales", { replace: true });
    }
  }), [navigate]);

  useEffect(() => {
    let isMounted = true;
    getSettings()
      .then((loadedSettings) => {
        if (isMounted) {
          setSettings({
            ...loadedSettings,
            fieldLock: normalizeFieldLockSettings(loadedSettings.fieldLock)
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setSettings(undefined);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!settings || !isProtectedPath(settings.fieldLock, location.pathname)) {
      return;
    }

    if (requiresFieldLockUnlock(settings.fieldLock)) {
      if (suppressNextUnlockDialogRef.current) {
        suppressNextUnlockDialogRef.current = false;
        setPendingPath(undefined);
        setIsLockDialogOpen(false);
        navigate("/sales", { replace: true });
        return;
      }

      setPendingPath(location.pathname);
      setIsLockDialogOpen(true);
      navigate("/sales", { replace: true });
    }
  }, [location.pathname, navigate, settings]);

  function shouldLockPath(path: string): boolean {
    return Boolean(settings && isProtectedPath(settings.fieldLock, path) && requiresFieldLockUnlock(settings.fieldLock));
  }

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (!shouldLockPath(path)) {
      return;
    }

    event.preventDefault();
    setPendingPath(path);
    setIsLockDialogOpen(true);
  }

  async function handleVerifyPin(pin: string) {
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
    return { success: result.success, message: result.message };
  }

  function handleVerified() {
    setIsLockDialogOpen(false);
    navigate(pendingPath ?? "/products");
    setPendingPath(undefined);
  }

  function handleCancelUnlock() {
    setIsLockDialogOpen(false);
    setPendingPath(undefined);
  }

  function handleDismissUpdatePrompt() {
    setIsUpdatePromptVisible(false);
  }

  function handleApplyUpdate() {
    void applyPwaUpdate();
  }

  function handleFieldModeStatusClick() {
    const nextTip = isFieldModeEnabled
      ? "现场模式已启动，页面已锁定"
      : "现场模式未开启";

    window.clearTimeout(fieldModeTipTimerRef.current);
    setFieldModeTip(nextTip);
    fieldModeTipTimerRef.current = window.setTimeout(() => {
      setFieldModeTip(undefined);
    }, 3000);
  }

  function renderProtectedPage(path: string, element: ReactElement) {
    const scope = protectedPageScopes[path];
    if (!scope) {
      return element;
    }

    if (!settings) {
      return <p className="emptyState">正在加载现场模式...</p>;
    }

    if (!fieldLockProtectsScope(settings.fieldLock, scope)) {
      return element;
    }

    if (requiresFieldLockUnlock(settings.fieldLock)) {
      return <Navigate to="/sales" replace />;
    }

    return element;
  }

  return (
    <div className="appShell">
      <aside className="appRail" aria-label="ECRM 应用侧栏">
        <div className="railBrandBlock">
          <div className="railBrandMark" aria-hidden="true">
            <Store size={20} strokeWidth={2.4} />
          </div>
          <div className="railBrandText">
            <div className="brandLine">
              <div className="brand">ECRM</div>
            </div>
            <span className="versionBadge">v{__APP_VERSION__}</span>
            <div className="subtitle railSubtitle">{brandSubtitle}</div>
          </div>
        </div>
        <div className="fieldModeRailSlot">
          <button
            type="button"
            className={isFieldModeEnabled ? "fieldModeRailButton isLocked" : "fieldModeRailButton"}
            aria-label={`现场模式状态：${fieldModeLabel}`}
            onClick={handleFieldModeStatusClick}
          >
            <FieldModeIcon size={24} strokeWidth={2.1} aria-hidden="true" />
            <span>{fieldModeLabel}</span>
          </button>
          {fieldModeTip ? (
            <div className="fieldModeRailTip" role="status">
              {fieldModeTip}
            </div>
          ) : null}
        </div>
        <nav className="railNav" aria-label="应用导航">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <NavLink key={page.to} to={page.to} onClick={(event) => handleNavClick(event, page.to)}>
                <Icon size={21} strokeWidth={2.15} aria-hidden="true" />
                <span>{page.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="railFooter" aria-hidden="true" />
      </aside>
      <main className="appMain">
        <PwaUpdatePrompt
          isVisible={isUpdatePromptVisible}
          onApply={handleApplyUpdate}
          onDismiss={handleDismissUpdatePrompt}
        />
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />
          <Route path="/products" element={renderProtectedPage("/products", <ProductsPage />)} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/dashboard" element={renderProtectedPage("/dashboard", <DashboardPage />)} />
          <Route path="/settings" element={renderProtectedPage("/settings", <SettingsPage />)} />
          {pages.map((page) => (
            page.to === "/products" || page.to === "/sales" || page.to === "/orders" || page.to === "/dashboard" || page.to === "/settings" ? null :
            <Route
              key={page.to}
              path={page.to}
              element={<PagePlaceholder page={page} />}
            />
          ))}
        </Routes>
      </main>
      <FieldLockDialog
        isOpen={isLockDialogOpen}
        onCancel={handleCancelUnlock}
        onVerify={handleVerifyPin}
        onVerified={handleVerified}
      />
    </div>
  );
}

function isProtectedPath(fieldLock: AppSettings["fieldLock"], path: string): boolean {
  const scope = protectedPageScopes[path];
  return Boolean(scope && fieldLockProtectsScope(fieldLock, scope));
}
