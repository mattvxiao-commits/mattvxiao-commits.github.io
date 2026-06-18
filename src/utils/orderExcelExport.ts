import { saveAs } from "file-saver";
import writeXlsxFile from "write-excel-file/browser";
import type { SheetData } from "write-excel-file/browser";
import type { OrderExportSheet } from "../domain/orderExport";

export type ExportOrderExcelInput = {
  sheets: OrderExportSheet[];
  exportedAt: string;
};

export async function exportOrderExcel(input: ExportOrderExcelInput): Promise<void> {
  const blob = await writeXlsxFile(input.sheets.map((sheet) => ({
    sheet: sheet.name,
    data: toSheetData(sheet)
  }))).toBlob();

  saveAs(blob, `ecrm-orders-${formatDateForFilename(input.exportedAt)}.xlsx`);
}

function toSheetData(sheet: OrderExportSheet): SheetData {
  const headers = Array.from(new Set(sheet.rows.flatMap((row) => Object.keys(row))));
  const headerRow = headers.map((header) => ({ value: header, fontWeight: "bold" as const }));
  const dataRows = sheet.rows.map((row) => headers.map((header) => ({ value: row[header] ?? "" })));

  return [headerRow, ...dataRows];
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
