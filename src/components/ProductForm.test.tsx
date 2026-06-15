import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ProductForm from "./ProductForm";

test("disables save until required fields are valid and submits numeric fields as numbers", async () => {
  const onSave = vi.fn();

  render(<ProductForm mode="create" onCancel={() => undefined} onSave={onSave} />);

  const saveButton = screen.getByRole("button", { name: "保存商品" });
  expect(saveButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText("商品名称"), {
    target: { value: "手作柠檬茶" }
  });
  fireEvent.change(screen.getByLabelText("SPU"), {
    target: { value: "DRINK-LEMON" }
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

  expect(saveButton).toBeEnabled();
  fireEvent.click(saveButton);

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "手作柠檬茶",
      spu: "DRINK-LEMON",
      costPrice: 4.5,
      salePrice: 12,
      stockQty: 18
    })
  );
});
