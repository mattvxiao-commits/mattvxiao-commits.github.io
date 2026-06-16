import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
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
