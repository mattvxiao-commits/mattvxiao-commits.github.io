import { describe, expect, test } from "vitest";
import { buildProductCode, displayProductCode, validateProductCodeParts } from "./productCode";

describe("product code helpers", () => {
  test("builds product code from SPU code and SKU code", () => {
    expect(buildProductCode(" CLTH-24001 ", " BLK-M ")).toBe("CLTH-24001-BLK-M");
  });

  test("returns empty preview until both SPU code and SKU code are present", () => {
    expect(buildProductCode("CLTH-24001", "")).toBe("");
    expect(buildProductCode("", "BLK-M")).toBe("");
  });

  test("rejects SKU code that repeats SPU code prefix", () => {
    expect(validateProductCodeParts("CLTH-24001", "CLTH-24001-BLK-M")).toEqual({
      ok: false,
      message:
        "SPU 编码与 SKU 编码存在重复内容。SKU 编码只需填写规格/变体部分，例如：BLK-M。完整商品编码将由系统自动生成：CLTH-24001-BLK-M。"
    });
  });

  test("requires both code parts when saving a product", () => {
    expect(validateProductCodeParts("", "BLK-M")).toEqual({
      ok: false,
      message: "SPU 编码和 SKU 编码均为必填。"
    });
    expect(validateProductCodeParts("CLTH-24001", "")).toEqual({
      ok: false,
      message: "SPU 编码和 SKU 编码均为必填。"
    });
  });

  test("displays fallback when product code is missing", () => {
    expect(displayProductCode(undefined)).toBe("未设置编码");
    expect(displayProductCode("")).toBe("未设置编码");
    expect(displayProductCode("CLTH-24001-BLK-M")).toBe("CLTH-24001-BLK-M");
  });
});
