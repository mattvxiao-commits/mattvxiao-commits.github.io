import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ProductForm from "./ProductForm";

test("keeps save clickable and explains missing required fields before submit", async () => {
  const onSave = vi.fn();

  render(<ProductForm mode="create" onCancel={() => undefined} onSave={onSave} />);

  const saveButton = screen.getByRole("button", { name: "保存商品" });
  expect(saveButton).toBeEnabled();

  fireEvent.change(screen.getByLabelText("商品名称"), {
    target: { value: "手作柠檬茶" }
  });
  fireEvent.change(screen.getByLabelText("SPU"), {
    target: { value: "DRINK-LEMON" }
  });
  fireEvent.change(screen.getByLabelText("SPU 编码"), {
    target: { value: "DRINK-LEMON" }
  });

  fireEvent.click(saveButton);

  expect(screen.getByText("请补全必填信息：SKU 编码。")).toBeVisible();
  expect(screen.getByText("请填写 SKU 编码。")).toBeVisible();
  expect(onSave).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText("SKU 编码"), {
    target: { value: "COLD" }
  });
  fireEvent.click(saveButton);

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "手作柠檬茶",
      spu: "DRINK-LEMON",
      spuCode: "DRINK-LEMON",
      skuCode: "COLD",
      productCode: "DRINK-LEMON-COLD",
      costPrice: 0,
      salePrice: 0,
      stockQty: 0
    })
  );
});

test("submits numeric fields as numbers", async () => {
  const onSave = vi.fn();

  render(<ProductForm mode="create" onCancel={() => undefined} onSave={onSave} />);

  fireEvent.change(screen.getByLabelText("商品名称"), {
    target: { value: "手作柠檬茶" }
  });
  fireEvent.change(screen.getByLabelText("SPU"), {
    target: { value: "DRINK-LEMON" }
  });
  fireEvent.change(screen.getByLabelText("SPU 编码"), {
    target: { value: "DRINK-LEMON" }
  });
  fireEvent.change(screen.getByLabelText("SKU 编码"), {
    target: { value: "COLD" }
  });
  fireEvent.change(screen.getByLabelText("成本价"), {
    target: { value: "4.5" }
  });
  fireEvent.change(screen.getByLabelText("售价"), {
    target: { value: "12" }
  });
  fireEvent.change(screen.getByLabelText("库存"), {
    target: { value: "18" }
  });

  const saveButton = screen.getByRole("button", { name: "保存商品" });
  expect(saveButton).toBeEnabled();
  fireEvent.click(saveButton);

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "手作柠檬茶",
      series: "",
      spu: "DRINK-LEMON",
      spuCode: "DRINK-LEMON",
      skuCode: "COLD",
      productCode: "DRINK-LEMON-COLD",
      costPrice: 4.5,
      salePrice: 12,
      stockQty: 18
    })
  );
});

test("submits optional product series when provided", async () => {
  const onSave = vi.fn();

  render(<ProductForm mode="create" onCancel={() => undefined} onSave={onSave} />);

  fireEvent.change(screen.getByLabelText("商品名称"), {
    target: { value: "角色徽章" }
  });
  fireEvent.change(screen.getByLabelText("系列（筛选）"), {
    target: { value: "作品A" }
  });
  fireEvent.change(screen.getByLabelText("SPU"), {
    target: { value: "徽章" }
  });
  fireEvent.change(screen.getByLabelText("SPU 编码"), {
    target: { value: "BADGE-24001" }
  });
  fireEvent.change(screen.getByLabelText("SKU 编码"), {
    target: { value: "A-01" }
  });

  fireEvent.click(screen.getByRole("button", { name: "保存商品" }));

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "角色徽章",
      series: "作品A",
      spu: "徽章"
    })
  );
});

test("ignores duplicate submit while save is pending", async () => {
  let resolveSave: () => void = () => undefined;
  const onSave = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      })
  );

  render(<ProductForm mode="create" onCancel={() => undefined} onSave={onSave} />);

  fireEvent.change(screen.getByLabelText("商品名称"), {
    target: { value: "手作柠檬茶" }
  });
  fireEvent.change(screen.getByLabelText("SPU"), {
    target: { value: "DRINK-LEMON" }
  });
  fireEvent.change(screen.getByLabelText("SPU 编码"), {
    target: { value: "DRINK-LEMON" }
  });
  fireEvent.change(screen.getByLabelText("SKU 编码"), {
    target: { value: "COLD" }
  });

  const saveButton = screen.getByRole("button", { name: "保存商品" });
  fireEvent.click(saveButton);
  fireEvent.click(saveButton);

  expect(onSave).toHaveBeenCalledTimes(1);

  resolveSave();
});

test("shows generated product code preview", () => {
  render(<ProductForm mode="create" onCancel={() => undefined} onSave={() => undefined} />);

  expect(screen.getByLabelText("完整商品编码")).toHaveValue("未设置编码");

  fireEvent.change(screen.getByLabelText("SPU 编码"), {
    target: { value: "CLTH-24001" }
  });
  fireEvent.change(screen.getByLabelText("SKU 编码"), {
    target: { value: "BLK-M" }
  });

  expect(screen.getByLabelText("完整商品编码")).toHaveValue("CLTH-24001-BLK-M");
});

test("rejects SKU code that repeats SPU code content", () => {
  const onSave = vi.fn();

  render(<ProductForm mode="create" onCancel={() => undefined} onSave={onSave} />);

  fireEvent.change(screen.getByLabelText("商品名称"), {
    target: { value: "黑色中码衣服" }
  });
  fireEvent.change(screen.getByLabelText("SPU"), {
    target: { value: "服装" }
  });
  fireEvent.change(screen.getByLabelText("SPU 编码"), {
    target: { value: "CLTH-24001" }
  });
  fireEvent.change(screen.getByLabelText("SKU 编码"), {
    target: { value: "CLTH-24001-BLK-M" }
  });

  fireEvent.click(screen.getByRole("button", { name: "保存商品" }));

  expect(
    screen.getByText(
      "SPU 编码与 SKU 编码存在重复内容。SKU 编码只需填写规格/变体部分，例如：BLK-M。完整商品编码将由系统自动生成：CLTH-24001-BLK-M。"
    )
  ).toBeVisible();
  expect(onSave).not.toHaveBeenCalled();
});
