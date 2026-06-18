import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportOrderExcel } from "./orderExcelExport";

const { writeXlsxFile, saveAs } = vi.hoisted(() => ({
  writeXlsxFile: vi.fn(() => ({
    toBlob: vi.fn(() => new Blob(["xlsx"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }))
  })),
  saveAs: vi.fn()
}));

vi.mock("write-excel-file/browser", () => ({
  default: writeXlsxFile
}));

vi.mock("file-saver", () => ({
  saveAs
}));

describe("exportOrderExcel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("把订单导出 sheet 写入 xlsx 并保存文件", async () => {
    const summaryRows = [{ 订单编号: "ECRM-001" }];
    const detailRows = [{ 商品名称: "徽章 A" }];

    await exportOrderExcel({
      sheets: [
        { name: "订单汇总", rows: summaryRows },
        { name: "订单明细", rows: detailRows }
      ],
      exportedAt: "2026-06-17T23:30:00.000Z"
    });

    expect(writeXlsxFile).toHaveBeenCalledOnce();
    expect(writeXlsxFile).toHaveBeenCalledWith([
      {
        sheet: "订单汇总",
        data: [
          [
            { value: "订单编号", fontWeight: "bold" }
          ],
          [
            { value: "ECRM-001" }
          ]
        ]
      },
      {
        sheet: "订单明细",
        data: [
          [
            { value: "商品名称", fontWeight: "bold" }
          ],
          [
            { value: "徽章 A" }
          ]
        ]
      }
    ]);
    expect(writeXlsxFile.mock.results[0].value.toBlob).toHaveBeenCalledOnce();
    const blob = saveAs.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(saveAs).toHaveBeenCalledWith(blob, "ecrm-orders-2026-06-17.xlsx");
  });
});
