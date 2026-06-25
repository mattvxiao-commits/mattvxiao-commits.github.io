import { Download, FileSpreadsheet, Gift, Info, QrCode, Save, Settings2, TicketPercent, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import FieldLockSettingsPanel from "../components/FieldLockSettingsPanel";
import {
  getSettings,
  listInventoryLogsForOrder,
  listOrderItems,
  listOrders,
  listProducts,
  listRefunds,
  saveImage,
  saveSettings
} from "../db/repositories";
import { normalizeFieldLockSettings } from "../domain/fieldLock";
import { buildOrderExportSheets } from "../domain/orderExport";
import { displayProductCode } from "../domain/productCode";
import { createDefaultCampaignGiftConfig, normalizeCampaignGiftConfig } from "../domain/settings";
import type { AppSettings, GiftConfig, Product } from "../domain/types";
import { exportJsonBackup, IMAGE_BACKUP_NOTE, importJsonBackup } from "../utils/backup";
import { exportOrderExcel } from "../utils/orderExcelExport";
import { notifySettingsUpdated } from "../utils/settingsEvents";

const APP_VERSION = __APP_VERSION__;

type StatusKind = "success" | "error";

type StatusMessage = {
  kind: StatusKind;
  text: string;
};

type GiftTargetType = "sku" | "spu";

type GiftTargetDraft = {
  targetType: GiftTargetType;
  value: string;
};

const defaultCampaignGift = createDefaultCampaignGiftConfig();

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isSkuGift(gift?: GiftConfig): gift is Extract<GiftConfig, { productId: string }> {
  return Boolean(gift && gift.targetType !== "spu" && "productId" in gift);
}

function isSpuGift(gift?: GiftConfig): gift is Extract<GiftConfig, { targetType: "spu" }> {
  return Boolean(gift && gift.targetType === "spu");
}

function giftToDraft(gift?: GiftConfig): GiftTargetDraft {
  if (isSpuGift(gift)) {
    return { targetType: "spu", value: gift.spu };
  }

  if (isSkuGift(gift)) {
    return { targetType: "sku", value: gift.productId };
  }

  return { targetType: "sku", value: "" };
}

function selectedGiftTargets(settings?: AppSettings): { giftA: GiftTargetDraft; giftB: GiftTargetDraft } {
  const tier35 = settings?.promotion.giftTiers.find((tier) => tier.threshold === 35);
  const tier68 = settings?.promotion.giftTiers.find((tier) => tier.threshold === 68);
  const giftAConfig = tier35?.gifts[0];
  const giftBConfig = tier68?.gifts.find((gift) => {
    if (!giftAConfig) {
      return true;
    }

    if (isSpuGift(giftAConfig) && isSpuGift(gift)) {
      return gift.spu !== giftAConfig.spu || gift.quantity === 1;
    }

    if (isSkuGift(giftAConfig) && isSkuGift(gift)) {
      return gift.productId !== giftAConfig.productId || gift.quantity === 1;
    }

    return true;
  });

  return {
    giftA: giftToDraft(giftAConfig),
    giftB: giftToDraft(giftBConfig)
  };
}

function giftFromDraft(draft: GiftTargetDraft, quantity: number): GiftConfig | undefined {
  if (!draft.value) {
    return undefined;
  }

  return draft.targetType === "spu"
    ? { targetType: "spu", spu: draft.value, quantity }
    : { targetType: "sku", productId: draft.value, quantity };
}

function applyGiftTiers(settings: AppSettings, giftA: GiftTargetDraft, giftB: GiftTargetDraft): AppSettings {
  const tiers = [
    {
      threshold: 35,
      gifts: [giftFromDraft(giftA, 1)].filter((gift): gift is GiftConfig => gift !== undefined)
    },
    {
      threshold: 68,
      gifts: [
        giftFromDraft(giftA, 2),
        giftFromDraft(giftB, 1)
      ].filter((gift): gift is GiftConfig => gift !== undefined)
    },
    {
      threshold: 148,
      gifts: [
        giftFromDraft(giftA, 5),
        giftFromDraft(giftB, 1)
      ].filter((gift): gift is GiftConfig => gift !== undefined)
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
  const [giftA, setGiftA] = useState<GiftTargetDraft>({ targetType: "sku", value: "" });
  const [giftB, setGiftB] = useState<GiftTargetDraft>({ targetType: "sku", value: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingOrders, setIsExportingOrders] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<StatusMessage>();
  const [pendingImportFile, setPendingImportFile] = useState<File>();
  const importInputRef = useRef<HTMLInputElement>(null);
  const isBusy = isSaving || isExporting || isExportingOrders || isImporting;

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
        setGiftA(selectedGiftTargets(loadedSettings).giftA);
        setGiftB(selectedGiftTargets(loadedSettings).giftB);
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
  const giftSpuOptions = useMemo(() => {
    const counts = new Map<string, number>();

    for (const product of giftProducts) {
      const spu = product.spu.trim();

      if (spu.length > 0) {
        counts.set(spu, (counts.get(spu) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"));
  }, [giftProducts]);
  const discountSpuOptions = useMemo(() => {
    const counts = new Map<string, number>();

    for (const product of products) {
      const spu = product.spu.trim();

      if (spu.length > 0) {
        counts.set(spu, (counts.get(spu) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right, "zh-Hans-CN"));
  }, [products]);
  const configuredDiscountSpu = settings?.promotion.addonDiscount.discountSpu ?? "";
  const hasMissingDiscountSpu =
    configuredDiscountSpu.trim().length > 0 && !discountSpuOptions.some(([spu]) => spu === configuredDiscountSpu);
  const campaignGift = settings ? normalizeCampaignGiftConfig(settings.campaignGift) : defaultCampaignGift;

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
      const nextSettings = normalizeSettingsForSave(applyGiftTiers(settings, giftA, giftB));
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      notifySettingsUpdated(nextSettings);
      setStatus({ kind: "success", text: "设置已保存。" });
    } catch {
      setStatus({ kind: "error", text: "设置保存失败，请检查后重试。" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFieldLockSave(fieldLock: AppSettings["fieldLock"], action: "enable" | "relock" | "disable") {
    if (!settings || isBusy) {
      throw new Error("设置当前正忙，请稍后重试。");
    }

    setIsSaving(true);
    setStatus(undefined);

    try {
      const nextSettings = normalizeSettingsForSave(applyGiftTiers({ ...settings, fieldLock }, giftA, giftB));
      await saveSettings(nextSettings);
      setSettings(nextSettings);
      notifySettingsUpdated(nextSettings, { suppressUnlockDialog: action === "relock" });
      setStatus({ kind: "success", text: getFieldLockStatusText(fieldLock, action) });
    } catch {
      setStatus({ kind: "error", text: "现场模式保存失败，请重试。" });
      throw new Error("现场模式保存失败");
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

  async function handleOrderExcelExport() {
    if (isBusy) {
      return;
    }

    setIsExportingOrders(true);
    setStatus(undefined);

    try {
      const exportedAt = new Date().toISOString();
      const [orders, refunds, currentProducts] = await Promise.all([listOrders(), listRefunds(), listProducts()]);
      const [orderItemGroups, inventoryLogGroups] = await Promise.all([
        Promise.all(orders.map((order) => listOrderItems(order.id))),
        Promise.all(orders.map((order) => listInventoryLogsForOrder(order.id)))
      ]);
      const sheets = buildOrderExportSheets({
        orders,
        orderItems: orderItemGroups.flat(),
        refunds,
        inventoryLogs: inventoryLogGroups.flat(),
        products: currentProducts,
        exportedAt,
        appVersion: APP_VERSION
      });

      await exportOrderExcel({ sheets, exportedAt });
      setStatus({ kind: "success", text: "订单 Excel 已导出。" });
    } catch {
      setStatus({ kind: "error", text: "订单 Excel 导出失败，请稍后重试。" });
    } finally {
      setIsExportingOrders(false);
    }
  }

  function handleImportFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (isBusy) {
      return;
    }

    setStatus(undefined);
    setPendingImportFile(file);
  }

  async function handleExportBeforeImport() {
    if (isBusy) {
      return;
    }

    setIsExporting(true);
    setStatus(undefined);

    try {
      await exportJsonBackup();
      setStatus({ kind: "success", text: `当前数据已先导出。确认无误后可继续导入备份。` });
    } catch {
      setStatus({ kind: "error", text: "当前数据导出失败，请先处理后再导入备份。" });
    } finally {
      setIsExporting(false);
    }
  }

  async function confirmImportOverwrite() {
    if (!pendingImportFile || isBusy) {
      return;
    }

    const file = pendingImportFile;

    setIsImporting(true);
    setStatus(undefined);

    try {
      const importResult = await importJsonBackup(file);
      const [nextSettings, nextProducts] = await Promise.all([getSettings(), listProducts()]);
      setSettings(nextSettings);
      notifySettingsUpdated(nextSettings);
      setProducts(nextProducts);
      setGiftA(selectedGiftTargets(nextSettings).giftA);
      setGiftB(selectedGiftTargets(nextSettings).giftB);
      setStatus({
        kind: "success",
        text: importResult.includedImages
          ? `备份已导入，当前数据已替换。已恢复 ${importResult.imageCount} 张图片。`
          : "备份已导入，当前数据已替换。旧版备份不包含图片，商品图需要重新上传。"
      });
    } catch (error) {
      setStatus({
        kind: "error",
        text: error instanceof Error ? `备份导入失败：${error.message}` : "备份导入失败，请确认文件格式。"
      });
    } finally {
      setIsImporting(false);
      setPendingImportFile(undefined);
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

      {pendingImportFile ? (
        <div className="modalBackdrop" role="presentation">
          <section className="confirmDialog" role="dialog" aria-modal="true" aria-labelledby="import-confirm-title">
            <div>
              <p className="eyebrow">Import</p>
              <h2 id="import-confirm-title">确认导入备份</h2>
            </div>
            <p className="warningText">导入备份会覆盖当前本机数据。</p>
            <p>
              覆盖范围包括商品、订单、库存记录、设置、促销规则、收款码配置，以及后续仪表盘配置。建议先导出当前数据，再确认导入。
            </p>
            <p className="fieldHint">待导入文件：{pendingImportFile.name}</p>
            <div className="dialogActions">
              <button
                type="button"
                className="secondaryButton"
                disabled={isBusy}
                onClick={() => setPendingImportFile(undefined)}
              >
                取消
              </button>
              <button
                type="button"
                className="secondaryButton"
                disabled={isBusy}
                onClick={() => void handleExportBeforeImport()}
              >
                先导出当前数据
              </button>
              <button
                type="button"
                className="primaryButton"
                disabled={isBusy}
                onClick={() => void confirmImportOverwrite()}
              >
                {isImporting ? "导入中..." : "确认导入并覆盖"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isLoading && !settings ? <p className="emptyState">正在加载设置...</p> : null}

      {settings ? (
        <div className="settingsGrid">
          <FieldLockSettingsPanel
            fieldLock={settings.fieldLock}
            onSave={handleFieldLockSave}
          />

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
                <select
                  aria-label="优惠 SPU"
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
                >
                  <option value="">不选择</option>
                  {hasMissingDiscountSpu ? <option value={configuredDiscountSpu}>{configuredDiscountSpu}（当前商品库未找到）</option> : null}
                  {discountSpuOptions.map(([spu, count]) => (
                    <option key={spu} value={spu}>
                      {spu}（{count} 个商品）
                    </option>
                  ))}
                </select>
                {hasMissingDiscountSpu ? (
                  <p className="fieldHint isWarning">当前商品库未找到该 SPU，请确认是否已停用或删除相关商品。</p>
                ) : null}
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

          <section className="settingsSection wideSection" aria-labelledby="campaign-gift-settings-title">
            <div className="sectionTitle">
              <Gift size={21} aria-hidden="true" />
              <div>
                <h2 id="campaign-gift-settings-title">运营赠礼</h2>
                <p>用于记录关注社媒、加入社群、现场互动等运营活动赠品。</p>
              </div>
            </div>

            <div className="toggleRow">
              <label className="checkControl">
                <input
                  aria-label="启用运营赠礼"
                  type="checkbox"
                  checked={campaignGift.enabled}
                  onChange={(event) =>
                    updateSettings((current) => ({
                      ...current,
                      campaignGift: {
                        ...normalizeCampaignGiftConfig(current.campaignGift),
                        enabled: event.target.checked
                      }
                    }))
                  }
                />
                <span>启用运营赠礼</span>
              </label>
            </div>

            <div className="settingsFieldGrid threeColumns">
              <label>
                <span>运营活动名称</span>
                <input
                  aria-label="运营活动名称"
                  value={campaignGift.activityName}
                  onChange={(event) =>
                    updateSettings((current) => ({
                      ...current,
                      campaignGift: {
                        ...normalizeCampaignGiftConfig(current.campaignGift),
                        activityName: event.target.value
                      }
                    }))
                  }
                />
              </label>
              <label>
                <span>默认运营赠礼目标类型</span>
                <select
                  aria-label="默认运营赠礼目标类型"
                  value={campaignGift.targetType}
                  onChange={(event) =>
                    updateSettings((current) => ({
                      ...current,
                      campaignGift: {
                        ...normalizeCampaignGiftConfig(current.campaignGift),
                        targetType: event.target.value === "spu" ? "spu" : "sku"
                      }
                    }))
                  }
                >
                  <option value="sku">指定 SKU</option>
                  <option value="spu">指定 SPU</option>
                </select>
              </label>
              {campaignGift.targetType === "spu" ? (
                <label>
                  <span>默认运营赠礼 SPU</span>
                  <select
                    aria-label="默认运营赠礼 SPU"
                    value={campaignGift.defaultSpu}
                    onChange={(event) =>
                      updateSettings((current) => ({
                        ...current,
                        campaignGift: {
                          ...normalizeCampaignGiftConfig(current.campaignGift),
                          defaultSpu: event.target.value
                        }
                      }))
                    }
                  >
                    <option value="">不选择</option>
                    {giftSpuOptions.map(([spu, count]) => (
                      <option key={spu} value={spu}>
                        {spu}（{count} 个 SKU）
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  <span>默认运营赠礼 SKU</span>
                  <select
                    aria-label="默认运营赠礼 SKU"
                    value={campaignGift.defaultProductId}
                    onChange={(event) =>
                      updateSettings((current) => ({
                        ...current,
                        campaignGift: {
                          ...normalizeCampaignGiftConfig(current.campaignGift),
                          defaultProductId: event.target.value
                        }
                      }))
                    }
                  >
                  <option value="">不选择</option>
                  {giftProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {displayProductCode(product.productCode)} / {product.name} / {product.spu}
                    </option>
                  ))}
                  </select>
                </label>
              )}
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
                <span>A 赠品目标类型</span>
                <select
                  aria-label="A 赠品目标类型"
                  value={giftA.targetType}
                  onChange={(event) =>
                    setGiftA({ targetType: event.target.value as GiftTargetType, value: "" })
                  }
                >
                  <option value="sku">指定 SKU</option>
                  <option value="spu">指定 SPU</option>
                </select>
              </label>
              <label>
                <span>{giftA.targetType === "spu" ? "A 赠品 SPU" : "A 赠品 SKU"}</span>
                <select
                  aria-label={giftA.targetType === "spu" ? "A 赠品 SPU" : "A 赠品 SKU"}
                  value={giftA.value}
                  onChange={(event) => setGiftA((current) => ({ ...current, value: event.target.value }))}
                >
                  <option value="">不选择</option>
                  {giftA.targetType === "spu"
                    ? giftSpuOptions.map(([spu, count]) => (
                        <option key={spu} value={spu}>
                          {spu}（{count} 个 SKU）
                        </option>
                      ))
                    : giftProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {displayProductCode(product.productCode)} / {product.name} / {product.spu}
                        </option>
                      ))}
                </select>
              </label>
              <label>
                <span>B 赠品目标类型</span>
                <select
                  aria-label="B 赠品目标类型"
                  value={giftB.targetType}
                  onChange={(event) =>
                    setGiftB({ targetType: event.target.value as GiftTargetType, value: "" })
                  }
                >
                  <option value="sku">指定 SKU</option>
                  <option value="spu">指定 SPU</option>
                </select>
              </label>
              <label>
                <span>{giftB.targetType === "spu" ? "B 赠品 SPU" : "B 赠品 SKU"}</span>
                <select
                  aria-label={giftB.targetType === "spu" ? "B 赠品 SPU" : "B 赠品 SKU"}
                  value={giftB.value}
                  onChange={(event) => setGiftB((current) => ({ ...current, value: event.target.value }))}
                >
                  <option value="">不选择</option>
                  {giftB.targetType === "spu"
                    ? giftSpuOptions.map(([spu, count]) => (
                        <option key={spu} value={spu}>
                          {spu}（{count} 个 SKU）
                        </option>
                      ))
                    : giftProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {displayProductCode(product.productCode)} / {product.name} / {product.spu}
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
              <input ref={importInputRef} className="visuallyHidden" type="file" accept="application/json,.json" onChange={handleImportFileSelected} />
              <button type="button" className="secondaryButton" disabled={isBusy} onClick={() => importInputRef.current?.click()}>
                <Upload size={18} aria-hidden="true" />
                {isImporting ? "导入中..." : "导入备份"}
              </button>
            </div>
          </section>

          <section className="settingsSection wideSection" aria-labelledby="table-export-settings-title">
            <div className="sectionTitle">
              <FileSpreadsheet size={21} aria-hidden="true" />
              <div>
                <h2 id="table-export-settings-title">表格导出</h2>
                <p>Excel 用于统计、盘点和复盘，不能用于恢复系统数据。恢复数据请使用 JSON 备份。</p>
              </div>
            </div>
            <div className="backupActions">
              <button
                type="button"
                className="secondaryButton"
                disabled={isBusy}
                onClick={() => void handleOrderExcelExport()}
              >
                <FileSpreadsheet size={18} aria-hidden="true" />
                {isExportingOrders ? "导出中..." : "导出订单 Excel"}
              </button>
            </div>
          </section>

          <section className="settingsSection wideSection" aria-labelledby="system-info-settings-title">
            <div className="sectionTitle">
              <Info size={21} aria-hidden="true" />
              <div>
                <h2 id="system-info-settings-title">系统信息</h2>
                <p>用于确认当前运行版本、部署方式和本机数据存储位置。</p>
              </div>
            </div>
            <dl className="systemInfoList">
              <div>
                <dt>当前版本</dt>
                <dd>v{APP_VERSION}</dd>
              </div>
              <div>
                <dt>部署方式</dt>
                <dd>GitHub Pages / PWA</dd>
              </div>
              <div>
                <dt>数据存储</dt>
                <dd>当前设备浏览器 IndexedDB</dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function normalizeSettingsForSave(settings: AppSettings): AppSettings {
  return {
    ...settings,
    campaignGift: normalizeCampaignGiftConfig(settings.campaignGift),
    fieldLock: normalizeFieldLockSettings(settings.fieldLock)
  };
}

function getFieldLockStatusText(fieldLock: AppSettings["fieldLock"], action: "enable" | "relock" | "disable"): string {
  if (!fieldLock.enabled || action === "disable") {
    return "现场模式已关闭。";
  }

  if (action === "relock") {
    return "现场模式已重新锁定。";
  }

  return fieldLock.unlockExpiresAt
    ? "现场模式已保存并启动，进入临时解锁状态。"
    : "现场模式已保存并生效。";
}
