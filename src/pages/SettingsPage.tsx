import { Download, Gift, QrCode, Save, Settings2, TicketPercent, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSettings, listProducts, saveImage, saveSettings } from "../db/repositories";
import type { AppSettings, Product } from "../domain/types";
import { exportJsonBackup, IMAGE_BACKUP_NOTE, importJsonBackup } from "../utils/backup";

type StatusKind = "success" | "error";

type StatusMessage = {
  kind: StatusKind;
  text: string;
};

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function selectedGiftIds(settings?: AppSettings): { giftA: string; giftB: string } {
  const tier35 = settings?.promotion.giftTiers.find((tier) => tier.threshold === 35);
  const tier68 = settings?.promotion.giftTiers.find((tier) => tier.threshold === 68);
  const giftA = tier35?.gifts[0]?.productId ?? "";

  return {
    giftA,
    giftB: tier68?.gifts.find((gift) => gift.productId !== giftA && gift.quantity === 1)?.productId ?? ""
  };
}

function applyGiftTiers(settings: AppSettings, giftA: string, giftB: string): AppSettings {
  const tiers = [
    {
      threshold: 35,
      gifts: giftA ? [{ productId: giftA, quantity: 1 }] : []
    },
    {
      threshold: 68,
      gifts: [
        ...(giftA ? [{ productId: giftA, quantity: 2 }] : []),
        ...(giftB ? [{ productId: giftB, quantity: 1 }] : [])
      ]
    },
    {
      threshold: 148,
      gifts: [
        ...(giftA ? [{ productId: giftA, quantity: 5 }] : []),
        ...(giftB ? [{ productId: giftB, quantity: 1 }] : [])
      ]
    }
  ];

  return {
    ...settings,
    promotion: {
      ...settings.promotion,
      giftTiers: tiers
    }
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>();
  const [products, setProducts] = useState<Product[]>([]);
  const [giftA, setGiftA] = useState("");
  const [giftB, setGiftB] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<StatusMessage>();
  const importInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isSaving || isExporting || isImporting;

  useEffect(() => {
    let isCurrent = true;

    async function loadData() {
      setIsLoading(true);
      setStatus(undefined);

      try {
        const [loadedSettings, loadedProducts] = await Promise.all([getSettings(), listProducts()]);

        if (!isCurrent) {
          return;
        }

        setSettings(loadedSettings);
        setProducts(loadedProducts);
        setGiftA(selectedGiftIds(loadedSettings).giftA);
        setGiftB(selectedGiftIds(loadedSettings).giftB);
      } catch {
        if (isCurrent) {
          setStatus({ kind: "error", text: "设置加载失败，请刷新后重试。" });
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isCurrent = false;
    };
  }, []);

  const giftProducts = useMemo(
    () => products.filter((product) => product.isGiftEligible && product.status === "active"),
    [products]
  );

  function updateSettings(updater: (current: AppSettings) => AppSettings) {
    setSettings((current) => (current ? updater(current) : current));
  }

  async function handleQrUpload(kind: "wechat" | "alipay", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!settings) {
      setStatus({ kind: "error", text: "设置尚未加载完成，无法上传收款码。" });
      return;
    }

    setStatus(undefined);

    try {
      const image = await saveImage(file);
      updateSettings((current) => ({
        ...current,
        [kind === "wechat" ? "wechatQrImageId" : "alipayQrImageId"]: image.id
      }));
      setStatus({ kind: "success", text: `${kind === "wechat" ? "微信" : "支付宝"}收款码已暂存，请点击保存设置。` });
    } catch {
      setStatus({ kind: "error", text: `${kind === "wechat" ? "微信" : "支付宝"}收款码上传失败，请重试。` });
    }
  }

  async function handleSave() {
    if (!settings || isBusy) {
      return;
    }

    setIsSaving(true);
    setStatus(undefined);

    try {
      await saveSettings(applyGiftTiers(settings, giftA, giftB));
      setStatus({ kind: "success", text: "设置已保存。" });
    } catch {
      setStatus({ kind: "error", text: "设置保存失败，请检查后重试。" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExport() {
    if (isBusy) {
      return;
    }

    setIsExporting(true);
    setStatus(undefined);

    try {
      await exportJsonBackup();
      setStatus({ kind: "success", text: `备份已导出。${IMAGE_BACKUP_NOTE}。` });
    } catch {
      setStatus({ kind: "error", text: "备份导出失败，请稍后重试。" });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (isBusy) {
      return;
    }

    setStatus(undefined);
    setIsImporting(true);

    try {
      await importJsonBackup(file);
      const [nextSettings, nextProducts] = await Promise.all([getSettings(), listProducts()]);
      setSettings(nextSettings);
      setProducts(nextProducts);
      setGiftA(selectedGiftIds(nextSettings).giftA);
      setGiftB(selectedGiftIds(nextSettings).giftB);
      setStatus({ kind: "success", text: "备份已导入，当前数据已替换。" });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? `备份导入失败：${error.message}` : "备份导入失败，请确认文件格式。"
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="settingsPage" aria-labelledby="settings-title">
      <div className="settingsHeader">
        <div>
          <p className="eyebrow">Setup</p>
          <h1 id="settings-title">设置</h1>
          <p>维护摊位资料、收款码、促销规则和本机 JSON 备份。</p>
        </div>
        <button type="button" className="primaryButton" disabled={!settings || isBusy} onClick={() => void handleSave()}>
          <Save size={18} aria-hidden="true" />
          {isSaving ? "保存中..." : "保存设置"}
        </button>
      </div>

      {status ? (
        <p className={status.kind === "error" ? "errorBanner" : "successBanner"} role="status">
          {status.text}
        </p>
      ) : null}

      {isLoading && !settings ? <p className="emptyState">正在加载设置...</p> : null}

      {settings ? (
        <div className="settingsGrid">
          <section className="settingsSection" aria-labelledby="basic-settings-title">
            <div className="sectionTitle">
              <Settings2 size={21} aria-hidden="true" />
              <div>
                <h2 id="basic-settings-title">基础信息</h2>
                <p>用于订单抬头和编号前缀。</p>
              </div>
            </div>
            <div className="settingsFieldGrid">
              <label>
                <span>店铺名称</span>
                <input
                  value={settings.shopName}
                  onChange={(event) => updateSettings((current) => ({ ...current, shopName: event.target.value }))}
                />
              </label>
              <label>
                <span>订单前缀</span>
                <input
                  value={settings.orderPrefix}
                  onChange={(event) => updateSettings((current) => ({ ...current, orderPrefix: event.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="settingsSection" aria-labelledby="qr-settings-title">
            <div className="sectionTitle">
              <QrCode size={21} aria-hidden="true" />
              <div>
                <h2 id="qr-settings-title">收款码</h2>
                <p>上传后需要保存设置才会成为当前收款码。</p>
              </div>
            </div>
            <div className="qrUploadGrid">
              <label className="uploadButton">
                <Upload size={18} aria-hidden="true" />
                微信收款码
                <input type="file" accept="image/*" onChange={(event) => void handleQrUpload("wechat", event)} />
              </label>
              <label className="uploadButton">
                <Upload size={18} aria-hidden="true" />
                支付宝收款码
                <input type="file" accept="image/*" onChange={(event) => void handleQrUpload("alipay", event)} />
              </label>
            </div>
            <div className="qrStatusGrid">
              <span>{settings.wechatQrImageId ? "微信收款码已设置" : "微信收款码未设置"}</span>
              <span>{settings.alipayQrImageId ? "支付宝收款码已设置" : "支付宝收款码未设置"}</span>
            </div>
          </section>

          <section className="settingsSection wideSection" aria-labelledby="promotion-settings-title">
            <div className="sectionTitle">
              <TicketPercent size={21} aria-hidden="true" />
              <div>
                <h2 id="promotion-settings-title">促销配置</h2>
                <p>加购优惠和满额赠品会在售卖计算中使用。</p>
              </div>
            </div>

            <div className="toggleRow">
              <label className="checkControl">
                <input
                  type="checkbox"
                  checked={settings.promotion.enabled}
                  onChange={(event) =>
                    updateSettings((current) => ({
                      ...current,
                      promotion: { ...current.promotion, enabled: event.target.checked }
                    }))
                  }
                />
                <span>启用促销</span>
              </label>
              <label className="checkControl">
                <input
                  type="checkbox"
                  checked={settings.promotion.addonDiscount.enabled}
                  onChange={(event) =>
                    updateSettings((current) => ({
                      ...current,
                      promotion: {
                        ...current.promotion,
                        addonDiscount: { ...current.promotion.addonDiscount, enabled: event.target.checked }
                      }
                    }))
                  }
                />
                <span>启用加购优惠</span>
              </label>
            </div>

            <div className="settingsFieldGrid threeColumns">
              <label>
                <span>优惠 SPU</span>
                <input
                  value={settings.promotion.addonDiscount.discountSpu}
                  onChange={(event) =>
                    updateSettings((current) => ({
                      ...current,
                      promotion: {
                        ...current.promotion,
                        addonDiscount: { ...current.promotion.addonDiscount, discountSpu: event.target.value }
                      }
                    }))
                  }
                />
              </label>
              <label>
                <span>优惠单价</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.promotion.addonDiscount.discountPrice}
                  onChange={(event) =>
                    updateSettings((current) => ({
                      ...current,
                      promotion: {
                        ...current.promotion,
                        addonDiscount: {
                          ...current.promotion.addonDiscount,
                          discountPrice: toNumber(event.target.value, 0)
                        }
                      }
                    }))
                  }
                />
              </label>
              <label>
                <span>最多优惠件数</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={settings.promotion.addonDiscount.maxDiscountQty}
                  onChange={(event) =>
                    updateSettings((current) => ({
                      ...current,
                      promotion: {
                        ...current.promotion,
                        addonDiscount: {
                          ...current.promotion.addonDiscount,
                          maxDiscountQty: toNumber(event.target.value, 0)
                        }
                      }
                    }))
                  }
                />
              </label>
            </div>
          </section>

          <section className="settingsSection wideSection" aria-labelledby="gift-settings-title">
            <div className="sectionTitle">
              <Gift size={21} aria-hidden="true" />
              <div>
                <h2 id="gift-settings-title">赠品档位</h2>
                <p>选择 A/B 赠品后自动生成 35、68、148 三档数量规则。</p>
              </div>
            </div>
            <div className="settingsFieldGrid">
              <label>
                <span>A 赠品</span>
                <select value={giftA} onChange={(event) => setGiftA(event.target.value)}>
                  <option value="">不选择</option>
                  {giftProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} / {product.spu}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>B 赠品</span>
                <select value={giftB} onChange={(event) => setGiftB(event.target.value)}>
                  <option value="">不选择</option>
                  {giftProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} / {product.spu}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="tierPreview" aria-label="赠品规则预览">
              <span>满 35：A x1</span>
              <span>满 68：A x2 + B x1</span>
              <span>满 148：A x5 + B x1</span>
            </div>
          </section>

          <section className="settingsSection wideSection" aria-labelledby="backup-settings-title">
            <div className="sectionTitle">
              <Download size={21} aria-hidden="true" />
              <div>
                <h2 id="backup-settings-title">备份与恢复</h2>
                <p>{IMAGE_BACKUP_NOTE}。</p>
              </div>
            </div>
            <div className="backupActions">
              <button type="button" className="secondaryButton" disabled={isBusy} onClick={() => void handleExport()}>
                <Download size={18} aria-hidden="true" />
                {isExporting ? "导出中..." : "导出备份"}
              </button>
              <input ref={importInputRef} className="visuallyHidden" type="file" accept="application/json,.json" onChange={(event) => void handleImport(event)} />
              <button type="button" className="secondaryButton" disabled={isBusy} onClick={() => importInputRef.current?.click()}>
                <Upload size={18} aria-hidden="true" />
                {isImporting ? "导入中..." : "导入备份"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
