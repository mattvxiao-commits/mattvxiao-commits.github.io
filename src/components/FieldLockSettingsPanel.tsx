import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { relockFieldLock, setFieldLockPin, unlockFieldLock } from "../domain/fieldLock";
import type { FieldLockSettings } from "../domain/types";

type FieldLockSettingsPanelProps = {
  fieldLock: FieldLockSettings;
  onSave: (fieldLock: FieldLockSettings, action: "enable" | "relock" | "disable") => Promise<void>;
};

export default function FieldLockSettingsPanel({ fieldLock, onSave }: FieldLockSettingsPanelProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  async function handleEnable() {
    setError(undefined);
    setIsSaving(true);
    try {
      const nextFieldLock = unlockFieldLock(await setFieldLockPin(fieldLock, pin, confirmPin));
      await onSave(nextFieldLock, "enable");
      setPin("");
      setConfirmPin("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "现场模式设置失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisable() {
    setError(undefined);
    setIsSaving(true);
    try {
      await onSave(
        {
          enabled: false,
          failedAttempts: 0
        },
        "disable"
      );
    } catch {
      setError("现场模式关闭失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRelock() {
    setError(undefined);
    setIsSaving(true);
    try {
      await onSave(relockFieldLock(fieldLock), "relock");
    } catch {
      setError("现场模式重新锁定失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  }

  const stateLabel = fieldLock.enabled
    ? fieldLock.unlockExpiresAt
      ? "已开启 · 临时解锁"
      : "已开启"
    : "未开启";

  return (
    <section className="settingsSection wideSection fieldLockSettings" aria-labelledby="field-lock-settings-title">
      <div className="sectionTitle">
        <ShieldCheck size={21} aria-hidden="true" />
        <div>
          <div className="sectionTitleLine">
            <h2 id="field-lock-settings-title">现场模式</h2>
            <span className={fieldLock.enabled ? "stateChip isActive" : "stateChip"}>{stateLabel}</span>
          </div>
          <p>开启后，商品、设置、仪表盘需要输入 4 位数字 PIN 才能进入。</p>
        </div>
      </div>

      <div className="fieldLockCompactGrid">
        <div className="settingsFieldGrid fieldLockInputs">
          <label>
            <span>设置现场模式 PIN</span>
            <input
              value={pin}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
          <label>
            <span>确认现场模式 PIN</span>
            <input
              value={confirmPin}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>
        </div>

        <div className="dialogActions fieldLockActions">
          <button type="button" className="primaryButton" onClick={() => void handleEnable()} disabled={isSaving}>
            {isSaving ? "保存中..." : fieldLock.enabled ? "更新 PIN" : "开启现场模式"}
          </button>
          {fieldLock.enabled ? (
            <>
              <button type="button" className="secondaryButton" onClick={() => void handleRelock()} disabled={isSaving}>
                立即重新锁定
              </button>
              <button type="button" className="secondaryButton dangerButton" onClick={() => void handleDisable()} disabled={isSaving}>
                关闭现场模式
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p className="formError">{error}</p> : null}
    </section>
  );
}
