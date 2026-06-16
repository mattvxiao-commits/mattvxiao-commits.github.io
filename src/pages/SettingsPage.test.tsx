import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { AppSettings } from "../domain/types";
import { defaultPromotion, product } from "../test/fixtures";
import SettingsPage from "./SettingsPage";

const repositories = vi.hoisted(() => ({
  getSettings: vi.fn(),
  listProducts: vi.fn(),
  saveImage: vi.fn(),
  saveSettings: vi.fn()
}));

vi.mock("../db/repositories", () => repositories);

vi.mock("../utils/backup", () => ({
  IMAGE_BACKUP_NOTE: "图片会随 JSON 备份导出",
  exportJsonBackup: vi.fn(),
  importJsonBackup: vi.fn()
}));

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
  repositories.saveSettings.mockResolvedValue(undefined);
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
