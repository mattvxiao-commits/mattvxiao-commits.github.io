import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AppSettings } from "../domain/types";
import { appSettings, defaultPromotion, product } from "../test/fixtures";
import SettingsPage from "./SettingsPage";

const repositories = vi.hoisted(() => ({
  getSettings: vi.fn(),
  listInventoryLogsForOrder: vi.fn(),
  listOrderItems: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  listRefunds: vi.fn(),
  saveImage: vi.fn(),
  saveSettings: vi.fn()
}));

const backupUtils = vi.hoisted(() => ({
  exportJsonBackup: vi.fn(),
  importJsonBackup: vi.fn()
}));

const orderExcelExportUtils = vi.hoisted(() => ({
  exportOrderExcel: vi.fn()
}));

vi.mock("../db/repositories", () => repositories);

vi.mock("../utils/backup", () => ({
  IMAGE_BACKUP_NOTE: "图片会随 JSON 备份导出",
  exportJsonBackup: backupUtils.exportJsonBackup,
  importJsonBackup: backupUtils.importJsonBackup
}));

vi.mock("../utils/orderExcelExport", () => orderExcelExportUtils);

const settings: AppSettings = {
  ...appSettings()
};

beforeEach(() => {
  vi.clearAllMocks();
  repositories.getSettings.mockResolvedValue(settings);
  repositories.listProducts.mockResolvedValue([
    product({ id: "addon-1", name: "优惠商品 1", spu: "优惠SPU" }),
    product({ id: "addon-2", name: "优惠商品 2", spu: "优惠SPU" }),
    product({ id: "normal", name: "普通商品", spu: "普通SPU" })
  ]);
  repositories.listOrders.mockResolvedValue([]);
  repositories.listOrderItems.mockResolvedValue([]);
  repositories.listInventoryLogsForOrder.mockResolvedValue([]);
  repositories.listRefunds.mockResolvedValue([]);
  repositories.saveSettings.mockResolvedValue(undefined);
  backupUtils.exportJsonBackup.mockResolvedValue(undefined);
  backupUtils.importJsonBackup.mockResolvedValue(undefined);
  orderExcelExportUtils.exportOrderExcel.mockReturnValue(undefined);
});

test("shows system version information for support and cache checks", async () => {
  render(<SettingsPage />);

  const systemInfo = await screen.findByRole("region", { name: "系统信息" });

  expect(within(systemInfo).getByText("当前版本")).toBeVisible();
  expect(within(systemInfo).getByText("v1.6.1")).toBeVisible();
  expect(within(systemInfo).getByText("部署方式")).toBeVisible();
  expect(within(systemInfo).getByText("GitHub Pages / PWA")).toBeVisible();
  expect(within(systemInfo).getByText("数据存储")).toBeVisible();
  expect(within(systemInfo).getByText("当前设备浏览器 IndexedDB")).toBeVisible();
});

test("selects add-on discount SPU from product SPU options and saves it", async () => {
  render(<SettingsPage />);

  const select = await screen.findByLabelText("优惠 SPU");

  expect(within(select).getByRole("option", { name: "优惠SPU（2 个商品）" })).toBeVisible();
  expect(within(select).getByRole("option", { name: "普通SPU（1 个商品）" })).toBeVisible();

  fireEvent.change(select, { target: { value: "普通SPU" } });
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
  expect(repositories.saveSettings.mock.calls[0][0].promotion.addonDiscount.discountSpu).toBe("普通SPU");
});

test("运营赠礼可以切换指定 SKU 和指定 SPU", async () => {
  repositories.listProducts.mockResolvedValue([
    product({ id: "gift-a", name: "赠礼 A", spu: "赠礼SPU", isGiftEligible: true }),
    product({ id: "gift-b", name: "赠礼 B", spu: "赠礼SPU", isGiftEligible: true }),
    product({ id: "normal", name: "普通商品", spu: "普通SPU", isGiftEligible: false })
  ]);

  render(<SettingsPage />);

  const targetTypeSelect = await screen.findByLabelText("默认运营赠礼目标类型");
  expect(targetTypeSelect).toBeVisible();

  fireEvent.change(targetTypeSelect, { target: { value: "spu" } });

  const spuSelect = screen.getByLabelText("默认运营赠礼 SPU");
  expect(spuSelect).toBeVisible();
  expect(within(spuSelect).getByRole("option", { name: "赠礼SPU（2 个 SKU）" })).toBeInTheDocument();
  expect(within(spuSelect).queryByRole("option", { name: /普通SPU/ })).not.toBeInTheDocument();

  fireEvent.change(targetTypeSelect, { target: { value: "sku" } });

  expect(screen.getByLabelText("默认运营赠礼 SKU")).toBeVisible();
});

test("enables and saves field mode immediately after setting matching four digit PIN", async () => {
  render(<SettingsPage />);

  fireEvent.change(await screen.findByLabelText("设置现场模式 PIN"), { target: { value: "2580" } });
  fireEvent.change(screen.getByLabelText("确认现场模式 PIN"), { target: { value: "2580" } });
  fireEvent.click(screen.getByRole("button", { name: "开启现场模式" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("已开启 · 临时解锁")).toBeVisible();
  const savedSettings = repositories.saveSettings.mock.calls.at(-1)?.[0] as AppSettings;
  expect(savedSettings.fieldLock).toEqual(expect.objectContaining({
    enabled: true,
    pinHash: expect.any(String),
    pinSalt: expect.any(String),
    unlockExpiresAt: expect.any(String)
  }));
  expect(JSON.stringify(savedSettings)).not.toContain("2580");
});

test("rejects mismatched field lock PIN confirmation", async () => {
  render(<SettingsPage />);

  fireEvent.change(await screen.findByLabelText("设置现场模式 PIN"), { target: { value: "2580" } });
  fireEvent.change(screen.getByLabelText("确认现场模式 PIN"), { target: { value: "2581" } });
  fireEvent.click(screen.getByRole("button", { name: "开启现场模式" }));

  expect(await screen.findByText("两次输入的密码不一致。")).toBeVisible();
});

test("relocks field mode immediately from settings page", async () => {
  repositories.getSettings.mockResolvedValue({
    ...settings,
    fieldLock: {
      ...settings.fieldLock,
      enabled: true,
      pinHash: "secret-hash",
      pinSalt: "secret-salt",
      unlockExpiresAt: "2099-06-19T09:05:00.000Z"
    }
  });

  render(<SettingsPage />);

  fireEvent.click(await screen.findByRole("button", { name: "立即重新锁定" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
  const savedSettings = repositories.saveSettings.mock.calls[0][0] as AppSettings;
  expect(savedSettings.fieldLock.unlockExpiresAt).toBeUndefined();
});

test("disables field mode immediately from settings page", async () => {
  repositories.getSettings.mockResolvedValue({
    ...settings,
    fieldLock: {
      ...settings.fieldLock,
      enabled: true,
      pinHash: "secret-hash",
      pinSalt: "secret-salt",
      failedAttempts: 2
    }
  });

  render(<SettingsPage />);

  fireEvent.click(await screen.findByRole("button", { name: "关闭现场模式" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
  const savedSettings = repositories.saveSettings.mock.calls[0][0] as AppSettings;
  expect(savedSettings.fieldLock).toEqual({
    enabled: false,
    failedAttempts: 0
  });
});

test("keeps and warns about a configured discount SPU that is missing from products", async () => {
  repositories.getSettings.mockResolvedValue({
    ...settings,
    promotion: {
      ...settings.promotion,
      addonDiscount: {
        ...settings.promotion.addonDiscount,
        discountSpu: "旧SPU"
      }
    }
  });

  render(<SettingsPage />);

  const select = await screen.findByLabelText("优惠 SPU");

  expect(within(select).getByRole("option", { name: "旧SPU（当前商品库未找到）" })).toBeVisible();
  expect(await screen.findByText("当前商品库未找到该 SPU，请确认是否已停用或删除相关商品。")).toBeVisible();
});

test("configures gift targets as SKU or SPU and saves generated tiers", async () => {
  repositories.listProducts.mockResolvedValue([
    product({
      id: "gift-a-1",
      name: "赠品A黑色",
      spu: "赠品A",
      productCode: "GFTA-BLK",
      isGiftEligible: true
    }),
    product({
      id: "gift-a-2",
      name: "赠品A白色",
      spu: "赠品A",
      productCode: "GFTA-WHT",
      isGiftEligible: true
    }),
    product({
      id: "gift-b-1",
      name: "赠品B",
      spu: "赠品B",
      productCode: "GFTB-BASE",
      isGiftEligible: true
    })
  ]);

  render(<SettingsPage />);

  const giftATargetType = await screen.findByLabelText("A 赠品目标类型");
  fireEvent.change(giftATargetType, { target: { value: "spu" } });

  const giftASpu = screen.getByLabelText("A 赠品 SPU");
  expect(within(giftASpu).getByRole("option", { name: "赠品A（2 个 SKU）" })).toBeVisible();
  fireEvent.change(giftASpu, { target: { value: "赠品A" } });

  const giftBTargetType = screen.getByLabelText("B 赠品目标类型");
  fireEvent.change(giftBTargetType, { target: { value: "sku" } });

  const giftBSku = screen.getByLabelText("B 赠品 SKU");
  expect(within(giftBSku).getByRole("option", { name: "GFTB-BASE / 赠品B / 赠品B" })).toBeVisible();
  fireEvent.change(giftBSku, { target: { value: "gift-b-1" } });

  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
  expect(repositories.saveSettings.mock.calls[0][0].promotion.giftTiers).toEqual([
    { threshold: 35, gifts: [{ targetType: "spu", spu: "赠品A", quantity: 1 }] },
    {
      threshold: 68,
      gifts: [
        { targetType: "spu", spu: "赠品A", quantity: 2 },
        { targetType: "sku", productId: "gift-b-1", quantity: 1 }
      ]
    },
    {
      threshold: 148,
      gifts: [
        { targetType: "spu", spu: "赠品A", quantity: 5 },
        { targetType: "sku", productId: "gift-b-1", quantity: 1 }
      ]
    }
  ]);
});

test("configures campaign gift activity and default eligible SKU", async () => {
  repositories.listProducts.mockResolvedValue([
    product({
      id: "gift-active",
      name: "可用赠礼",
      spu: "赠礼SPU",
      productCode: "GIFT-ACTIVE",
      isGiftEligible: true,
      status: "active"
    }),
    product({
      id: "gift-inactive",
      name: "停用赠礼",
      spu: "赠礼SPU",
      productCode: "GIFT-INACTIVE",
      isGiftEligible: true,
      status: "inactive"
    }),
    product({
      id: "normal-active",
      name: "普通商品",
      spu: "普通SPU",
      productCode: "NORMAL-ACTIVE",
      isGiftEligible: false,
      status: "active"
    })
  ]);

  render(<SettingsPage />);

  expect(await screen.findByRole("heading", { name: "运营赠礼" })).toBeVisible();

  const enabled = screen.getByLabelText("启用运营赠礼");
  const activityName = screen.getByLabelText("运营活动名称");
  const defaultSku = screen.getByLabelText("默认运营赠礼 SKU");

  expect(enabled).toBeInTheDocument();
  expect(activityName).toHaveValue("运营赠礼");
  expect(within(defaultSku).getByRole("option", { name: "GIFT-ACTIVE / 可用赠礼 / 赠礼SPU" })).toBeVisible();
  expect(within(defaultSku).queryByRole("option", { name: "GIFT-INACTIVE / 停用赠礼 / 赠礼SPU" })).not.toBeInTheDocument();
  expect(within(defaultSku).queryByRole("option", { name: "NORMAL-ACTIVE / 普通商品 / 普通SPU" })).not.toBeInTheDocument();

  fireEvent.click(enabled);
  fireEvent.change(activityName, { target: { value: "关注小红书赠礼" } });
  fireEvent.change(defaultSku, { target: { value: "gift-active" } });
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
  expect(repositories.saveSettings.mock.calls[0][0].campaignGift).toEqual({
    enabled: true,
    activityName: "关注小红书赠礼",
    targetType: "sku",
    defaultProductId: "gift-active",
    defaultSpu: "",
    requireSaleLine: true
  });
});

test("saves padded campaign gift activity name as trimmed value", async () => {
  const settingsUpdated = vi.fn();
  window.addEventListener("ecrm-settings-updated", settingsUpdated);

  try {
    render(<SettingsPage />);

    fireEvent.change(await screen.findByLabelText("运营活动名称"), { target: { value: "  关注小红书赠礼  " } });
    fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

    await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
    const savedSettings = repositories.saveSettings.mock.calls[0][0] as AppSettings;
    const notifiedSettings = settingsUpdated.mock.calls[0][0].detail.settings as AppSettings;

    expect(savedSettings.campaignGift.activityName).toBe("关注小红书赠礼");
    expect(notifiedSettings.campaignGift).toEqual(savedSettings.campaignGift);
  } finally {
    window.removeEventListener("ecrm-settings-updated", settingsUpdated);
  }
});

test("saves blank campaign gift activity name as default value", async () => {
  render(<SettingsPage />);

  fireEvent.change(await screen.findByLabelText("运营活动名称"), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));

  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalledTimes(1));
  const savedSettings = repositories.saveSettings.mock.calls[0][0] as AppSettings;

  expect(savedSettings.campaignGift.activityName).toBe("运营赠礼");
});

test("requires confirmation before importing a backup that overwrites current data", async () => {
  const { container } = render(<SettingsPage />);

  await screen.findByText("备份与恢复");

  const fileInput = container.querySelector('input[type="file"][accept="application/json,.json"]');
  expect(fileInput).toBeInstanceOf(HTMLInputElement);

  const backupFile = new File(["{}"], "old-backup.json", { type: "application/json" });
  fireEvent.change(fileInput as HTMLInputElement, { target: { files: [backupFile] } });

  expect(await screen.findByRole("dialog", { name: "确认导入备份" })).toBeVisible();
  expect(screen.getByText("导入备份会覆盖当前本机数据。")).toBeVisible();
  expect(backupUtils.importJsonBackup).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "取消" }));

  expect(screen.queryByRole("dialog", { name: "确认导入备份" })).not.toBeInTheDocument();
  expect(backupUtils.importJsonBackup).not.toHaveBeenCalled();
});

test("can export current data before confirming backup import overwrite", async () => {
  backupUtils.importJsonBackup.mockResolvedValue({
    version: 2,
    includedImages: true,
    imageCount: 1
  });
  const { container } = render(<SettingsPage />);

  await screen.findByText("备份与恢复");

  const fileInput = container.querySelector('input[type="file"][accept="application/json,.json"]');
  const backupFile = new File(["{}"], "old-backup.json", { type: "application/json" });
  fireEvent.change(fileInput as HTMLInputElement, { target: { files: [backupFile] } });

  fireEvent.click(await screen.findByRole("button", { name: "先导出当前数据" }));

  await waitFor(() => expect(backupUtils.exportJsonBackup).toHaveBeenCalledTimes(1));
  expect(backupUtils.importJsonBackup).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "确认导入并覆盖" }));

  await waitFor(() => expect(backupUtils.importJsonBackup).toHaveBeenCalledWith(backupFile));
  expect(await screen.findByText("备份已导入，当前数据已替换。已恢复 1 张图片。")).toBeVisible();
});

test("warns when importing a legacy backup without images", async () => {
  backupUtils.importJsonBackup.mockResolvedValue({
    version: 1,
    includedImages: false,
    imageCount: 0
  });
  const { container } = render(<SettingsPage />);

  await screen.findByText("备份与恢复");

  const fileInput = container.querySelector('input[type="file"][accept="application/json,.json"]');
  const backupFile = new File(["{}"], "legacy-backup.json", { type: "application/json" });
  fireEvent.change(fileInput as HTMLInputElement, { target: { files: [backupFile] } });
  fireEvent.click(await screen.findByRole("button", { name: "确认导入并覆盖" }));

  expect(await screen.findByText("备份已导入，当前数据已替换。旧版备份不包含图片，商品图需要重新上传。")).toBeVisible();
});

test("exports order Excel from settings page for analysis only", async () => {
  repositories.listOrders.mockResolvedValue([
    {
      id: "order-1",
      orderNo: "ECRM-001",
      status: "paid",
      paymentMethod: "cash",
      subtotalBeforeDiscount: 10,
      discountAmount: 0,
      payableAmount: 10,
      promotionSnapshot: defaultPromotion(),
      giftStockWarning: false,
      createdAt: "2026-06-18T10:00:00.000Z",
      paidAt: "2026-06-18T10:01:00.000Z"
    }
  ]);
  repositories.listOrderItems.mockResolvedValue([
    {
      id: "item-1",
      orderId: "order-1",
      productId: "normal",
      productNameSnapshot: "普通商品",
      spuSnapshot: "普通SPU",
      quantity: 1,
      originalUnitPrice: 10,
      finalUnitPrice: 10,
      lineType: "normal",
      lineTotal: 10,
      unitCostSnapshot: 4,
      costTotal: 4,
      grossProfit: 6
    }
  ]);

  render(<SettingsPage />);

  expect(await screen.findByText("表格导出")).toBeVisible();
  expect(screen.getByText("Excel 用于统计、盘点和复盘，不能用于恢复系统数据。恢复数据请使用 JSON 备份。")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "导出订单 Excel" }));

  await waitFor(() => expect(orderExcelExportUtils.exportOrderExcel).toHaveBeenCalledTimes(1));
  const exportInput = orderExcelExportUtils.exportOrderExcel.mock.calls[0][0];
  expect(exportInput.sheets.map((sheet: { name: string }) => sheet.name)).toEqual([
    "订单汇总",
    "订单明细",
    "退款记录",
    "库存流水",
    "商品当前数据",
    "导出说明"
  ]);
  expect(exportInput.sheets[0].rows[0].订单编号).toBe("ECRM-001");
  expect(await screen.findByText("订单 Excel 已导出。")).toBeVisible();
});

test("shows sanitized error when order Excel export fails", async () => {
  repositories.listOrders.mockRejectedValue(new Error("raw indexeddb failure"));

  render(<SettingsPage />);

  fireEvent.click(await screen.findByRole("button", { name: "导出订单 Excel" }));

  expect(await screen.findByText("订单 Excel 导出失败，请稍后重试。")).toBeVisible();
  expect(screen.queryByText(/raw indexeddb failure/)).not.toBeInTheDocument();
});
