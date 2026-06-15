import { saveAs } from "file-saver";
import { db } from "../db/db";
import { clearAllData } from "../db/repositories";
import type { AppSettings, InventoryLog, Order, OrderItem, Product } from "../domain/types";

const BACKUP_VERSION = 1;
const IMAGE_BACKUP_NOTE = "图片暂不包含在 JSON 备份中";

type BackupPayload = {
  version: 1;
  exportedAt: string;
  note: typeof IMAGE_BACKUP_NOTE;
  data: {
    products: Product[];
    settings: AppSettings[];
    orders: Order[];
    orderItems: OrderItem[];
    inventoryLogs: InventoryLog[];
  };
};

type ImportDeps = {
  clearAllData?: () => Promise<void> | void;
  importData?: (data: BackupPayload["data"]) => Promise<void> | void;
};

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function readArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error("备份文件格式不正确。");
  }

  return value;
}

function parseBackupPayload(text: string): BackupPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("备份文件不是有效的 JSON。");
  }

  assertRecord(parsed, "备份文件格式不正确。");

  if (parsed.version !== BACKUP_VERSION) {
    throw new Error("不支持的备份版本。");
  }

  assertRecord(parsed.data, "备份文件格式不正确。");

  return {
    version: BACKUP_VERSION,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    note: IMAGE_BACKUP_NOTE,
    data: {
      products: readArray(parsed.data, "products") as Product[],
      settings: readArray(parsed.data, "settings") as AppSettings[],
      orders: readArray(parsed.data, "orders") as Order[],
      orderItems: readArray(parsed.data, "orderItems") as OrderItem[],
      inventoryLogs: readArray(parsed.data, "inventoryLogs") as InventoryLog[]
    }
  };
}

async function readFileText(file: File): Promise<string> {
  return file.text();
}

async function importBackupData(data: BackupPayload["data"]): Promise<void> {
  await db.transaction(
    "rw",
    [db.products, db.settings, db.orders, db.orderItems, db.inventoryLogs],
    async () => {
      if (data.products.length > 0) {
        await db.products.bulkPut(data.products);
      }

      if (data.settings.length > 0) {
        await db.settings.bulkPut(data.settings);
      }

      if (data.orders.length > 0) {
        await db.orders.bulkPut(data.orders);
      }

      if (data.orderItems.length > 0) {
        await db.orderItems.bulkPut(data.orderItems);
      }

      if (data.inventoryLogs.length > 0) {
        await db.inventoryLogs.bulkPut(data.inventoryLogs);
      }
    }
  );
}

export async function exportJsonBackup(): Promise<void> {
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    note: IMAGE_BACKUP_NOTE,
    data: {
      products: await db.products.toArray(),
      settings: await db.settings.toArray(),
      orders: await db.orders.toArray(),
      orderItems: await db.orderItems.toArray(),
      inventoryLogs: await db.inventoryLogs.toArray()
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });

  saveAs(blob, `ecrm-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function importJsonBackup(file: File): Promise<void> {
  await importJsonBackupFromText(await readFileText(file));
}

export async function importJsonBackupFromText(text: string, deps: ImportDeps = {}): Promise<void> {
  const payload = parseBackupPayload(text);
  const clear = deps.clearAllData ?? clearAllData;
  const importer = deps.importData ?? importBackupData;

  await clear();
  await importer(payload.data);
}

export { IMAGE_BACKUP_NOTE };
