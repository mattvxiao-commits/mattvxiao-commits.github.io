import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import type { OrderExportSheet } from "../domain/orderExport";

export type ExportOrderExcelInput = {
  sheets: OrderExportSheet[];
  exportedAt: string;
};

export function exportOrderExcel(input: ExportOrderExcelInput): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of input.sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const workbookArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([workbookArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  saveAs(blob, `ecrm-orders-${formatDateForFilename(input.exportedAt)}.xlsx`);
}

function formatDateForFilename(value: string): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
