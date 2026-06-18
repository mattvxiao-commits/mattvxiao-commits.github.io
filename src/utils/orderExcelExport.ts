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
  const isoDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];

  if (isoDate) {
    return isoDate;
  }

  const date = new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
