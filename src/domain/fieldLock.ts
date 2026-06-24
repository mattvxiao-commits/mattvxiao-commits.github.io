import type { FieldLockScope, FieldLockSettings } from "./types";

const FOUR_DIGIT_PIN_PATTERN = /^\d{4}$/;
const UNLOCK_DURATION_MS = 5 * 60 * 1000;
const LOCKOUT_DURATION_MS = 30 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
export const defaultFieldLockProtectedScopes: FieldLockScope[] = ["products", "orderDetail", "dashboard", "settings"];
const fieldLockScopeSet = new Set<FieldLockScope>(defaultFieldLockProtectedScopes);

type PinValidationResult = { valid: true } | { valid: false; message: string };

export type FieldLockVerifyResult = {
  success: boolean;
  message?: string;
  settings: FieldLockSettings;
};

export function createDefaultFieldLockSettings(): FieldLockSettings {
  return {
    enabled: false,
    protectedScopes: [...defaultFieldLockProtectedScopes],
    failedAttempts: 0
  };
}

export function normalizeFieldLockSettings(value: unknown): FieldLockSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return createDefaultFieldLockSettings();
  }

  const record = value as Partial<FieldLockSettings>;
  return {
    enabled: record.enabled === true,
    protectedScopes: normalizeProtectedScopes(record.protectedScopes),
    pinHash: typeof record.pinHash === "string" ? record.pinHash : undefined,
    pinSalt: typeof record.pinSalt === "string" ? record.pinSalt : undefined,
    unlockExpiresAt: typeof record.unlockExpiresAt === "string" ? record.unlockExpiresAt : undefined,
    failedAttempts: Number.isInteger(record.failedAttempts) && Number(record.failedAttempts) >= 0
      ? Number(record.failedAttempts)
      : 0,
    lockedUntil: typeof record.lockedUntil === "string" ? record.lockedUntil : undefined
  };
}

export function normalizeProtectedScopes(value: unknown): FieldLockScope[] {
  if (!Array.isArray(value)) {
    return [...defaultFieldLockProtectedScopes];
  }

  const nextScopes: FieldLockScope[] = [];
  for (const item of value) {
    if (fieldLockScopeSet.has(item as FieldLockScope) && !nextScopes.includes(item as FieldLockScope)) {
      nextScopes.push(item as FieldLockScope);
    }
  }

  return nextScopes;
}

export function fieldLockProtectsScope(settings: FieldLockSettings, scope: FieldLockScope): boolean {
  const normalized = normalizeFieldLockSettings(settings);
  return normalized.enabled && normalized.protectedScopes.includes(scope);
}

export function validateFieldLockPinFormat(pin: string): PinValidationResult {
  if (!FOUR_DIGIT_PIN_PATTERN.test(pin)) {
    return { valid: false, message: "请输入 4 位数字密码。" };
  }

  return { valid: true };
}

export async function setFieldLockPin(
  settings: FieldLockSettings,
  pin: string,
  confirmPin: string
): Promise<FieldLockSettings> {
  const validation = validateFieldLockPinFormat(pin);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  if (pin !== confirmPin) {
    throw new Error("两次输入的密码不一致。");
  }

  const pinSalt = createSalt();
  const pinHash = await hashPin(pinSalt, pin);

  return {
    ...settings,
    enabled: true,
    pinHash,
    pinSalt,
    unlockExpiresAt: undefined,
    failedAttempts: 0,
    lockedUntil: undefined
  };
}

export async function verifyFieldLockPin(
  settings: FieldLockSettings,
  pin: string,
  now: Date = new Date()
): Promise<FieldLockVerifyResult> {
  const normalized = normalizeFieldLockSettings(settings);
  const lockedUntil = normalized.lockedUntil ? Date.parse(normalized.lockedUntil) : 0;

  if (Number.isFinite(lockedUntil) && lockedUntil > now.getTime()) {
    return {
      success: false,
      message: "尝试次数过多，请稍后再试。",
      settings: normalized
    };
  }

  const validation = validateFieldLockPinFormat(pin);
  if (!validation.valid) {
    return {
      success: false,
      message: validation.message,
      settings: normalized
    };
  }

  if (!normalized.pinHash || !normalized.pinSalt) {
    return {
      success: false,
      message: "现场模式配置异常，请重新设置 PIN。",
      settings: normalized
    };
  }

  const candidateHash = await hashPin(normalized.pinSalt, pin);
  if (candidateHash === normalized.pinHash) {
    return {
      success: true,
      settings: unlockFieldLock({
        ...normalized,
        failedAttempts: 0,
        lockedUntil: undefined
      }, now)
    };
  }

  const failedAttempts = normalized.failedAttempts + 1;
  return {
    success: false,
    message: "密码不正确，请重试。",
    settings: {
      ...normalized,
      failedAttempts,
      unlockExpiresAt: undefined,
      lockedUntil: failedAttempts >= MAX_FAILED_ATTEMPTS
        ? new Date(now.getTime() + LOCKOUT_DURATION_MS).toISOString()
        : undefined
    }
  };
}

export function unlockFieldLock(settings: FieldLockSettings, now: Date = new Date()): FieldLockSettings {
  return {
    ...settings,
    unlockExpiresAt: new Date(now.getTime() + UNLOCK_DURATION_MS).toISOString(),
    failedAttempts: 0,
    lockedUntil: undefined
  };
}

export function relockFieldLock(settings: FieldLockSettings): FieldLockSettings {
  return {
    ...settings,
    unlockExpiresAt: undefined
  };
}

export function isFieldLockTemporarilyUnlocked(settings: FieldLockSettings, now: Date = new Date()): boolean {
  if (!settings.unlockExpiresAt) {
    return false;
  }

  const unlockExpiresAt = Date.parse(settings.unlockExpiresAt);
  return Number.isFinite(unlockExpiresAt) && unlockExpiresAt > now.getTime();
}

export function requiresFieldLockUnlock(settings: FieldLockSettings, now: Date = new Date()): boolean {
  const normalized = normalizeFieldLockSettings(settings);
  return normalized.enabled && !isFieldLockTemporarilyUnlocked(normalized, now);
}

export function sanitizeFieldLockForBackup(_settings: FieldLockSettings | undefined): FieldLockSettings {
  return createDefaultFieldLockSettings();
}

function createSalt(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return bytesToHex(bytes);
}

async function hashPin(salt: string, pin: string): Promise<string> {
  const input = `${salt}:${pin}`;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);

  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(digest));
  }

  let hash = 5381;
  for (const byte of bytes) {
    hash = ((hash << 5) + hash) ^ byte;
  }

  return `fallback-${Math.abs(hash).toString(16)}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
