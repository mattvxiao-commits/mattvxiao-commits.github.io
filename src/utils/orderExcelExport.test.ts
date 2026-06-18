import { describe, expect, it, vi } from "vitest";
import { exportOrderExcel } from "./orderExcelExport";

const { bookNew, jsonToSheet, bookAppendSheet, write, saveAs } = vi.hoisted(() => ({
  bookNew: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
  jsonToSheet: vi.fn((rows) => ({ rows })),
  bookAppendSheet: vi.fn(),
  write: vi.fn(() => new ArrayBuffer(8)),
  saveAs: vi.fn()
}));

vi.mock("xlsx", () => ({
  utils: {
    book_new: bookNew,
    json_to_sheet: jsonToSheet,
    book_append_sheet: bookAppendSheet
  },
  write
}));

vi.mock("file-saver", () => ({
  saveAs
}));

describe("exportOrderExcel", () => {
  it("把订单导出 sheet 写入 xlsx 并保存文件", () => {
    exportOrderExcel({
      sheets: [
        { name: "订单汇总", rows: [{ 订单编号: "ECRM-001" }] },
        { name: "订单明细", rows: [{ 商品名称: "徽章 A" }] }
      ],
      exportedAt: "2026-06-18T12:00:00.000Z"
    });

    expect(bookNew).toHaveBeenCalled();
    expect(jsonToSheet).toHaveBeenCalledTimes(2);
    expect(bookAppendSheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), "订单汇总");
    expect(bookAppendSheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), "订单明细");
    expect(write).toHaveBeenCalledWith(expect.anything(), { bookType: "xlsx", type: "array" });
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "ecrm-orders-2026-06-18.xlsx");
  });
});
