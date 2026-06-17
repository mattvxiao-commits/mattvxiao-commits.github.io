import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { product } from "../test/fixtures";
import ProductsPage from "./ProductsPage";

const repositories = vi.hoisted(() => ({
  listProducts: vi.fn(),
  makeId: vi.fn(),
  upsertProduct: vi.fn()
}));

vi.mock("../db/repositories", () => repositories);

vi.mock("../utils/image", () => ({
  getImageUrl: vi.fn(() => Promise.resolve(undefined))
}));

beforeEach(() => {
  vi.clearAllMocks();
  repositories.makeId.mockReturnValue("product-new");
  repositories.upsertProduct.mockResolvedValue(undefined);
  repositories.listProducts.mockResolvedValue([
    product({
      id: "existing",
      name: "已有商品",
      spu: "服装",
      spuCode: "CLTH-24001",
      skuCode: "BLK-M",
      productCode: "CLTH-24001-BLK-M"
    })
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("rejects saving a product when the generated product code already exists", async () => {
  render(<ProductsPage />);

  expect(await screen.findByText("编码 CLTH-24001-BLK-M")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "新增商品" }));

  fireEvent.change(screen.getByLabelText("商品名称"), {
    target: { value: "重复编码商品" }
  });
  fireEvent.change(screen.getByLabelText("SPU"), {
    target: { value: "服装" }
  });
  fireEvent.change(screen.getByLabelText("SPU 编码"), {
    target: { value: "CLTH-24001" }
  });
  fireEvent.change(screen.getByLabelText("SKU 编码"), {
    target: { value: "BLK-M" }
  });

  fireEvent.click(screen.getByRole("button", { name: "保存商品" }));

  expect(await screen.findByText("完整商品编码已存在，请调整 SPU 编码或 SKU 编码。")).toBeVisible();
  await waitFor(() => expect(repositories.upsertProduct).not.toHaveBeenCalled());
});

test("opens create and edit product forms in dialogs", async () => {
  render(<ProductsPage />);

  expect(await screen.findByText("编码 CLTH-24001-BLK-M")).toBeVisible();
  expect(screen.getByText("服装")).toBeVisible();
  expect(screen.queryByText("SPU 服装")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "新增商品" }));
  expect(screen.getByRole("dialog", { name: "新增商品" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "关闭商品弹窗" }));

  fireEvent.click(screen.getByRole("button", { name: "编辑 已有商品" }));
  expect(screen.getByRole("dialog", { name: "编辑商品" })).toBeVisible();
  expect(screen.getByLabelText("商品名称")).toHaveValue("已有商品");
});

test("copies an existing product into a new dialog draft with blank SKU and zero stock", async () => {
  render(<ProductsPage />);

  expect(await screen.findByText("编码 CLTH-24001-BLK-M")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "复制 已有商品" }));

  expect(screen.getByRole("dialog", { name: "复制创建商品" })).toBeVisible();
  expect(screen.getByLabelText("商品名称")).toHaveValue("已有商品");
  expect(screen.getByLabelText("SPU")).toHaveValue("服装");
  expect(screen.getByLabelText("SPU 编码")).toHaveValue("CLTH-24001");
  expect(screen.getByLabelText("SKU 编码")).toHaveValue("");
  expect(screen.getByLabelText("库存")).toHaveValue(0);
  expect(screen.getByLabelText("完整商品编码")).toHaveValue("未设置编码");
});

test("confirms before disabling an active product", async () => {
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

  render(<ProductsPage />);

  expect(await screen.findByText("编码 CLTH-24001-BLK-M")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "停用 已有商品" }));

  expect(confirmSpy).toHaveBeenCalledWith("确认停用商品？停用后该商品不会出现在售卖商品列表中，已有订单记录不受影响。");
  expect(repositories.upsertProduct).not.toHaveBeenCalled();

  confirmSpy.mockReturnValue(true);

  fireEvent.click(screen.getByRole("button", { name: "停用 已有商品" }));

  await waitFor(() => expect(repositories.upsertProduct).toHaveBeenCalledTimes(1));
  expect(repositories.upsertProduct).toHaveBeenCalledWith(expect.objectContaining({
    id: "existing",
    status: "inactive"
  }));
});

test("shows enable action for inactive products and confirms before enabling", async () => {
  repositories.listProducts.mockResolvedValue([
    product({
      id: "inactive",
      name: "停用商品",
      status: "inactive",
      spu: "服装",
      productCode: "CLTH-24001-BLK-M"
    })
  ]);
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

  render(<ProductsPage />);

  expect(await screen.findByText("编码 CLTH-24001-BLK-M")).toBeVisible();
  expect(screen.getByText("停用")).toBeVisible();

  fireEvent.click(screen.getByRole("button", { name: "启用 停用商品" }));

  expect(confirmSpy).toHaveBeenCalledWith("确认启用商品？启用后该商品会重新出现在符合条件的售卖商品列表中。");
  await waitFor(() => expect(repositories.upsertProduct).toHaveBeenCalledTimes(1));
  expect(repositories.upsertProduct).toHaveBeenCalledWith(expect.objectContaining({
    id: "inactive",
    status: "active"
  }));
});
