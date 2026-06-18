import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AppSettings } from "../domain/types";
import { defaultPromotion, product } from "../test/fixtures";
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
  id: "settings",
  shopName: "ECRM 摊位",
  orderPrefix: "ECRM",
  promotion: defaultPromotion()
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
