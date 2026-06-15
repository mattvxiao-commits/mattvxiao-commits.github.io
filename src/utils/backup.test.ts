import { describe, expect, test, vi } from "vitest";
import { importJsonBackupFromText } from "./backup";

describe("backup utilities", () => {
  test("rejects unsupported backup versions before clearing existing data", async () => {
    const clearAllData = vi.fn();

    await expect(
      importJsonBackupFromText(
        JSON.stringify({
          version: 2,
          exportedAt: "2026-06-15T00:00:00.000Z",
          note: "图片暂不包含在 JSON 备份中",
          data: {
            products: [],
            settings: [],
            orders: [],
            orderItems: [],
            inventoryLogs: []
          }
        }),
        { clearAllData }
      )
    ).rejects.toThrow("不支持的备份版本");

    expect(clearAllData).not.toHaveBeenCalled();
  });
});
