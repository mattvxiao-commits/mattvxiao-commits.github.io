# ECRM V1.5.2 Field Privacy Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-digit PIN based field mode that keeps sales usable while locking product, settings, and dashboard management pages.

**Architecture:** Add a focused field-lock domain module for PIN hashing, validation, lock timing, and backup sanitization. Store lock configuration inside `AppSettings`, guard protected routes in `App.tsx`, and expose compact controls in settings and sales pages.

**Tech Stack:** React, TypeScript, React Router, Dexie/IndexedDB, Web Crypto API with test fallback, Vitest, Testing Library.

---

## File Structure

- Modify: `src/domain/types.ts`
  - Add `FieldLockSettings` and `fieldLock` to `AppSettings`.
- Create: `src/domain/fieldLock.ts`
  - Own PIN format validation, salt creation, SHA-256 hashing, verification, lock/unlock state transitions, backup sanitization helpers.
- Create: `src/domain/fieldLock.test.ts`
  - Unit tests for PIN validation, hashing, verify behavior, failed attempts, temporary unlock expiry, backup sanitization.
- Modify: `src/db/db.ts`
  - Add default `fieldLock` configuration to `createDefaultSettings`.
- Modify: `src/utils/backup.ts`
  - Validate old and new settings, normalize missing `fieldLock`, strip lock secrets on export/import.
- Modify: `src/utils/backup.test.ts`
  - Cover export/import sanitization and old backup compatibility.
- Create: `src/components/FieldLockDialog.tsx`
  - PIN unlock modal used by route guard.
- Create: `src/components/FieldLockDialog.test.tsx`
  - Component behavior tests for invalid PIN, wrong PIN, correct PIN, locked-out retry message.
- Create: `src/components/FieldLockStatus.tsx`
  - Compact status/action UI for SalesPage.
- Create: `src/components/FieldLockSettingsPanel.tsx`
  - Settings section for enable, set/change PIN, disable/reset, immediate relock.
- Modify: `src/App.tsx`
  - Load settings, protect `/products`, `/settings`, `/dashboard`, redirect direct protected entry to `/sales` if cancelled.
- Modify: `src/App.test.tsx`
  - Route guard tests.
- Modify: `src/pages/SalesPage.tsx`
  - Show field lock status and immediate relock/open setup entry.
- Modify: `src/pages/SalesPage.test.tsx`
  - Ensure field mode does not block sales page.
- Modify: `src/pages/SettingsPage.tsx`
  - Add field lock settings panel and save flow integration.
- Modify: `src/pages/SettingsPage.test.tsx`
  - Settings panel tests.
- Modify: `src/styles.css`
  - Add compact modal/status/panel styles.
- Modify: `README.md`
  - Add field mode usage notes after implementation.
- Create: `docs/releases/2026-06-19-ecrm-v1-5-2-field-privacy-lock-record.md`
  - Release record and manual acceptance checklist.

## Task 1: Field Lock Domain And Settings Shape

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/fieldLock.ts`
- Create: `src/domain/fieldLock.test.ts`
- Modify: `src/db/db.ts`

- [ ] **Step 1: Write failing domain tests**

Create `src/domain/fieldLock.test.ts` with tests covering:

```ts
import {
  createDefaultFieldLockSettings,
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
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- src/domain/fieldLock.test.ts`

Expected: FAIL because `src/domain/fieldLock.ts` does not exist.

- [ ] **Step 3: Implement domain module and types**

Implement:

```ts
export type FieldLockSettings = {
  enabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  unlockExpiresAt?: string;
  failedAttempts: number;
  lockedUntil?: string;
};
```

Add `fieldLock: FieldLockSettings` to `AppSettings`.

Create domain functions:

```ts
const FOUR_DIGIT_PIN_PATTERN = /^\d{4}$/;
const UNLOCK_DURATION_MS = 5 * 60 * 1000;
const LOCKOUT_DURATION_MS = 30 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

export function createDefaultFieldLockSettings(): FieldLockSettings;
export function normalizeFieldLockSettings(value: unknown): FieldLockSettings;
export function validateFieldLockPinFormat(pin: string): { valid: true } | { valid: false; message: string };
export async function setFieldLockPin(settings: FieldLockSettings, pin: string, confirmPin: string): Promise<FieldLockSettings>;
export async function verifyFieldLockPin(settings: FieldLockSettings, pin: string, now?: Date): Promise<{ success: boolean; message?: string; settings: FieldLockSettings }>;
export function unlockFieldLock(settings: FieldLockSettings, now?: Date): FieldLockSettings;
export function relockFieldLock(settings: FieldLockSettings): FieldLockSettings;
export function isFieldLockTemporarilyUnlocked(settings: FieldLockSettings, now?: Date): boolean;
export function requiresFieldLockUnlock(settings: FieldLockSettings, now?: Date): boolean;
export function sanitizeFieldLockForBackup(settings: FieldLockSettings | undefined): FieldLockSettings;
```

Use `crypto.getRandomValues` for salt when available, fallback to `Math.random` for tests. Use `crypto.subtle.digest("SHA-256", ...)` when available, fallback to a deterministic non-cryptographic test-safe hash only when Web Crypto is absent.

Update `createDefaultSettings()` in `src/db/db.ts` to include `fieldLock: createDefaultFieldLockSettings()`.

- [ ] **Step 4: Run test to verify GREEN**

Run: `npm test -- src/domain/fieldLock.test.ts`

Expected: PASS.

## Task 2: Backup Sanitization And Compatibility

**Files:**
- Modify: `src/utils/backup.ts`
- Modify: `src/utils/backup.test.ts`

- [ ] **Step 1: Write failing backup tests**

Add tests:

```ts
test("exports settings without field lock secrets", async () => {
  await db.settings.put({
    ...createDefaultSettings(),
    fieldLock: {
      enabled: true,
      pinHash: "secret-hash",
      pinSalt: "secret-salt",
      unlockExpiresAt: "2026-06-19T09:05:00.000Z",
      failedAttempts: 2,
      lockedUntil: "2026-06-19T09:00:30.000Z"
    }
  });
  await exportJsonBackup();
  const exported = JSON.parse(await savedBlobText());
  expect(exported.data.settings[0].fieldLock).toEqual(createDefaultFieldLockSettings());
  expect(exported.data.settings[0].fieldLock.pinHash).toBeUndefined();
  expect(exported.data.settings[0].fieldLock.pinSalt).toBeUndefined();
});

test("imports old backup settings with field lock disabled by default", async () => {
  const importData = vi.fn();
  const payload = validPayload();
  delete payload.data.settings[0].fieldLock;
  await importJsonBackupFromText(JSON.stringify(payload), { importData });
  expect(importData.mock.calls[0][0].settings[0].fieldLock).toEqual(createDefaultFieldLockSettings());
});

test("imports backup with field lock secrets stripped", async () => {
  const importData = vi.fn();
  const payload = validPayload({
    settings: [{
      ...validPayload().data.settings[0],
      fieldLock: {
        enabled: true,
        pinHash: "secret-hash",
        pinSalt: "secret-salt",
        failedAttempts: 0
      }
    }]
  });
  await importJsonBackupFromText(JSON.stringify(payload), { importData });
  expect(importData.mock.calls[0][0].settings[0].fieldLock).toEqual(createDefaultFieldLockSettings());
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/utils/backup.test.ts`

Expected: FAIL because backup does not normalize/sanitize `fieldLock`.

- [ ] **Step 3: Implement backup normalization**

In `validateSettings`, accept missing `fieldLock` for old backups and validate object shape only if present.

Before `replaceAllDataInTransaction`, normalize parsed settings:

```ts
const normalizedSettings = data.settings.map((setting) => ({
  ...setting,
  fieldLock: createDefaultFieldLockSettings()
}));
```

For export, sanitize settings:

```ts
settings: (await db.settings.toArray()).map((setting) => ({
  ...setting,
  fieldLock: sanitizeFieldLockForBackup(setting.fieldLock)
}))
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/utils/backup.test.ts`

Expected: PASS.

## Task 3: Route Guard And Unlock Dialog

**Files:**
- Create: `src/components/FieldLockDialog.tsx`
- Create: `src/components/FieldLockDialog.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing route/component tests**

Add component tests proving:

```ts
test("shows a four digit PIN error before submit when input is invalid", async () => {
  const onVerify = vi.fn();
  render(<FieldLockDialog isOpen onCancel={vi.fn()} onVerify={onVerify} onVerified={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("4 位数字密码"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁" }));
  expect(screen.getByText("请输入 4 位数字密码。")).toBeVisible();
  expect(onVerify).not.toHaveBeenCalled();
});

test("submits a valid PIN and calls onVerified after success", async () => {
  const onVerified = vi.fn();
  render(
    <FieldLockDialog
      isOpen
      onCancel={vi.fn()}
      onVerify={vi.fn().mockResolvedValue({ success: true })}
      onVerified={onVerified}
    />
  );
  fireEvent.change(screen.getByLabelText("4 位数字密码"), { target: { value: "2580" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁" }));
  await waitFor(() => expect(onVerified).toHaveBeenCalled());
});
```

Add App tests proving:

```ts
test("locks products navigation when field mode is enabled", async () => {
  repositories.getSettings.mockResolvedValue(settingsWithEnabledFieldLock());
  render(<MemoryRouter initialEntries={["/sales"]}><App /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("link", { name: "商品" }));
  expect(await screen.findByRole("dialog", { name: "管理页面已锁定" })).toBeVisible();
  expect(screen.queryByRole("heading", { level: 1, name: "商品" })).not.toBeInTheDocument();
});

test("unlocks protected navigation with correct PIN", async () => {
  repositories.getSettings.mockResolvedValue(await settingsWithFieldLockPin("2580"));
  render(<MemoryRouter initialEntries={["/sales"]}><App /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("link", { name: "商品" }));
  fireEvent.change(await screen.findByLabelText("4 位数字密码"), { target: { value: "2580" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁" }));
  expect(await screen.findByRole("heading", { level: 1, name: "商品" })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- src/components/FieldLockDialog.test.tsx src/App.test.tsx
```

Expected: FAIL because components/guard do not exist.

- [ ] **Step 3: Implement dialog and route guard**

Implement `FieldLockDialog` with:

- `role="dialog"`
- title `管理页面已锁定`
- numeric input with `inputMode="numeric"`
- invalid PIN local validation
- async submit state
- cancel button

Modify `App.tsx`:

- load settings with `getSettings`.
- define protected paths: `/products`, `/settings`, `/dashboard`.
- intercept nav clicks for protected pages.
- if direct route is protected and locked, show dialog and avoid rendering protected page until unlocked.
- cancel from direct protected entry navigates to `/sales`.
- save updated field lock settings after failed/successful verify.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm test -- src/components/FieldLockDialog.test.tsx src/App.test.tsx
```

Expected: PASS.

## Task 4: Settings And Sales Controls

**Files:**
- Create: `src/components/FieldLockSettingsPanel.tsx`
- Create: `src/components/FieldLockStatus.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/pages/SettingsPage.test.tsx`
- Modify: `src/pages/SalesPage.tsx`
- Modify: `src/pages/SalesPage.test.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing UI integration tests**

Settings tests:

```ts
test("enables field mode after setting matching four digit PIN", async () => {
  render(<SettingsPage />);
  fireEvent.change(await screen.findByLabelText("设置现场模式 PIN"), { target: { value: "2580" } });
  fireEvent.change(screen.getByLabelText("确认现场模式 PIN"), { target: { value: "2580" } });
  fireEvent.click(screen.getByRole("button", { name: "开启现场模式" }));
  fireEvent.click(screen.getByRole("button", { name: "保存设置" }));
  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalled());
  expect(repositories.saveSettings.mock.calls.at(-1)[0].fieldLock).toEqual(expect.objectContaining({
    enabled: true,
    pinHash: expect.any(String),
    pinSalt: expect.any(String)
  }));
  expect(JSON.stringify(repositories.saveSettings.mock.calls.at(-1)[0])).not.toContain("2580");
});

test("rejects mismatched field lock PIN confirmation", async () => {
  render(<SettingsPage />);
  fireEvent.change(await screen.findByLabelText("设置现场模式 PIN"), { target: { value: "2580" } });
  fireEvent.change(screen.getByLabelText("确认现场模式 PIN"), { target: { value: "2581" } });
  fireEvent.click(screen.getByRole("button", { name: "开启现场模式" }));
  expect(screen.getByText("两次输入的密码不一致。")).toBeVisible();
});
```

Sales tests:

```ts
test("shows field mode status without blocking sales", async () => {
  repositories.getSettings.mockResolvedValue(settingsWithEnabledFieldLock());
  render(<SalesPage />);
  expect(await screen.findByText("现场模式已开启")).toBeVisible();
  expect(await screen.findByRole("button", { name: "加入 普通商品" })).toBeVisible();
});

test("relocks field mode from sales page", async () => {
  repositories.getSettings.mockResolvedValue(settingsWithEnabledFieldLock({
    unlockExpiresAt: "2026-06-19T09:05:00.000Z"
  }));
  render(<SalesPage />);
  fireEvent.click(await screen.findByRole("button", { name: "重新锁定" }));
  await waitFor(() => expect(repositories.saveSettings).toHaveBeenCalled());
  expect(repositories.saveSettings.mock.calls.at(-1)[0].fieldLock.unlockExpiresAt).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm test -- src/pages/SettingsPage.test.tsx src/pages/SalesPage.test.tsx
```

Expected: FAIL because UI controls do not exist.

- [ ] **Step 3: Implement settings and sales controls**

`FieldLockSettingsPanel`:

- displays current state.
- accepts `pin` and `confirmPin`.
- sets 4-digit PIN via `setFieldLockPin`.
- enables/disables/reset lock.
- shows concise Chinese validation errors.

`FieldLockStatus`:

- compact status in SalesPage header area.
- shows `现场模式已开启` when enabled.
- shows `重新锁定` when temporary unlock is active.
- calls `saveSettings` with `relockFieldLock`.

Update `SettingsPage` to include panel and save resulting `settings`.

Update `SalesPage` to include status after settings load.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm test -- src/pages/SettingsPage.test.tsx src/pages/SalesPage.test.tsx
```

Expected: PASS.

## Task 5: Docs, Release Record, Full Verification

**Files:**
- Modify: `README.md`
- Create: `docs/releases/2026-06-19-ecrm-v1-5-2-field-privacy-lock-record.md`

- [ ] **Step 1: Update documentation**

Update README current feature scope:

- add `现场模式 / 售卖锁定模式`.
- remove stale notes contradicted by current backup image support.
- add warning that PIN lock is local anti-mis-touch privacy control, not strong encryption.

Create release record with:

- implemented scope.
- not implemented scope.
- manual acceptance checklist.
- test command results.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected:

- all tests pass.
- build exits 0.
- `git diff --check` has no whitespace errors.

- [ ] **Step 3: Commit implementation**

Run:

```powershell
git status --short
git add src README.md docs
git commit -m 'feat: add field privacy lock'
```

- [ ] **Step 4: Push and deploy**

Run with local proxy if needed:

```powershell
git -c http.proxy=http://127.0.0.1:29499 -c https.proxy=http://127.0.0.1:29499 push origin main
```

Then verify GitHub Actions deploys and `https://mattvxiao-commits.github.io/` returns the updated app.

## Self-Review

- Spec coverage: plan covers fixed 4-digit PIN, product/settings/dashboard route lock, sales availability, temporary unlock, immediate relock, backup exclusion, tests, docs.
- Placeholder scan: no unresolved implementation placeholders remain.
- Type consistency: `FieldLockSettings`, `fieldLock`, `setFieldLockPin`, `verifyFieldLockPin`, `relockFieldLock`, and `sanitizeFieldLockForBackup` are consistently named across tasks.
