import { expect, test } from "vitest";
import {
  createDefaultFieldLockSettings,
  fieldLockProtectsScope,
  isFieldLockTemporarilyUnlocked,
  normalizeFieldLockSettings,
  sanitizeFieldLockForBackup,
  setFieldLockPin,
  unlockFieldLock,
  validateFieldLockPinFormat,
  verifyFieldLockPin
} from "./fieldLock";

test("accepts only four digit PIN values", () => {
  expect(validateFieldLockPinFormat("1234")).toEqual({ valid: true });
  expect(validateFieldLockPinFormat("123")).toEqual({ valid: false, message: "请输入 4 位数字密码。" });
  expect(validateFieldLockPinFormat("12345")).toEqual({ valid: false, message: "请输入 4 位数字密码。" });
  expect(validateFieldLockPinFormat("12a4")).toEqual({ valid: false, message: "请输入 4 位数字密码。" });
});

test("stores a hashed PIN and verifies correct or wrong input", async () => {
  const configured = await setFieldLockPin(createDefaultFieldLockSettings(), "2580", "2580");

  expect(configured.pinHash).toBeTruthy();
  expect(configured.pinSalt).toBeTruthy();
  expect(configured.pinHash).not.toBe("2580");

  await expect(verifyFieldLockPin(configured, "2580", new Date("2026-06-19T09:00:00.000Z"))).resolves.toMatchObject({
    success: true
  });
  await expect(verifyFieldLockPin(configured, "0000", new Date("2026-06-19T09:00:00.000Z"))).resolves.toMatchObject({
    success: false,
    settings: expect.objectContaining({ failedAttempts: 1 })
  });
});

test("locks retry for thirty seconds after five failed attempts", async () => {
  let settings = await setFieldLockPin(createDefaultFieldLockSettings(), "2580", "2580");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await verifyFieldLockPin(settings, "0000", new Date("2026-06-19T09:00:00.000Z"));
    settings = result.settings;
  }

  expect(settings.lockedUntil).toBe("2026-06-19T09:00:30.000Z");

  const lockedResult = await verifyFieldLockPin(settings, "2580", new Date("2026-06-19T09:00:10.000Z"));
  expect(lockedResult).toMatchObject({
    success: false,
    message: "尝试次数过多，请稍后再试。"
  });
});

test("tracks temporary unlock expiry", async () => {
  const settings = await setFieldLockPin(createDefaultFieldLockSettings(), "2580", "2580");
  const unlocked = unlockFieldLock(settings, new Date("2026-06-19T09:00:00.000Z"));

  expect(unlocked.unlockExpiresAt).toBe("2026-06-19T09:05:00.000Z");
  expect(isFieldLockTemporarilyUnlocked(unlocked, new Date("2026-06-19T09:04:59.000Z"))).toBe(true);
  expect(isFieldLockTemporarilyUnlocked(unlocked, new Date("2026-06-19T09:05:00.000Z"))).toBe(false);
});

test("sanitizes field lock secrets for backup and normalizes old settings", async () => {
  const configured = await setFieldLockPin(createDefaultFieldLockSettings(), "2580", "2580");
  const sanitized = sanitizeFieldLockForBackup({
    ...configured,
    enabled: true,
    failedAttempts: 3,
    lockedUntil: "2026-06-19T09:00:30.000Z"
  });

  expect(sanitized).toEqual(createDefaultFieldLockSettings());
  expect(normalizeFieldLockSettings(undefined)).toEqual(createDefaultFieldLockSettings());
});

test("normalizes field lock protected scopes with safe defaults and filters invalid values", () => {
  expect(createDefaultFieldLockSettings().protectedScopes).toEqual(["products", "orderDetail", "dashboard", "settings"]);

  expect(normalizeFieldLockSettings({ enabled: true, failedAttempts: 0 }).protectedScopes).toEqual([
    "products",
    "orderDetail",
    "dashboard",
    "settings"
  ]);

  expect(
    normalizeFieldLockSettings({
      enabled: true,
      failedAttempts: 0,
      protectedScopes: ["settings", "sales", "orderDetail", "settings"]
    }).protectedScopes
  ).toEqual(["settings", "orderDetail"]);
});

test("checks whether a locked field mode protects a specific scope", () => {
  const configured = normalizeFieldLockSettings({
    enabled: true,
    failedAttempts: 0,
    protectedScopes: ["settings"]
  });

  expect(fieldLockProtectsScope(configured, "settings")).toBe(true);
  expect(fieldLockProtectsScope(configured, "products")).toBe(false);
  expect(fieldLockProtectsScope({ ...configured, enabled: false }, "settings")).toBe(false);
});
