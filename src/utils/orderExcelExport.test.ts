import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportOrderExcel } from "./orderExcelExport";

const { workbook, bookNew, jsonToSheet, bookAppendSheet, write, saveAs } = vi.hoisted(() => ({
  workbook: { SheetNames: [], Sheets: {} },
  bookNew: vi.fn(),
  jsonToSheet: vi.fn((rows) => ({ worksheetRows: rows })),
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
  beforeEach(() => {
    vi.clearAllMocks();
    bookNew.mockReturnValue(workbook);
  });

  it("把订单导出 sheet 写入 xlsx 并保存文件", () => {
    const summaryRows = [{ 订单编号: "ECRM-001" }];
    const detailRows = [{ 商品名称: "徽章 A" }];

    exportOrderExcel({
      sheets: [
        { name: "订单汇总", rows: summaryRows },
        { name: "订单明细", rows: detailRows }
      ],
      exportedAt: "2026-06-17T23:30:00.000Z"
    });

    expect(bookNew).toHaveBeenCalledOnce();
    expect(bookNew).toHaveReturnedWith(workbook);
    expect(jsonToSheet).toHaveBeenNthCalledWith(1, summaryRows);
    expect(jsonToSheet).toHaveBeenNthCalledWith(2, detailRows);
    expect(jsonToSheet).toHaveBeenCalledTimes(2);
    expect(bookAppendSheet).toHaveBeenNthCalledWith(1, workbook, { worksheetRows: summaryRows }, "订单汇总");
    expect(bookAppendSheet).toHaveBeenNthCalledWith(2, workbook, { worksheetRows: detailRows }, "订单明细");
    expect(write).toHaveBeenCalledWith(workbook, { bookType: "xlsx", type: "array" });
    const blob = saveAs.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(saveAs).toHaveBeenCalledWith(blob, "ecrm-orders-2026-06-17.xlsx");
  });
});
