import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { relockFieldLock, setFieldLockPin } from "../domain/fieldLock";
import type { FieldLockSettings } from "../domain/types";

type FieldLockSettingsPanelProps = {
  fieldLock: FieldLockSettings;
  onChange: (fieldLock: FieldLockSettings) => void;
};

export default function FieldLockSettingsPanel({ fieldLock, onChange }: FieldLockSettingsPanelProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string>();

  async function handleEnable() {
    setError(undefined);
    try {
      const nextFieldLock = await setFieldLockPin(fieldLock, pin, confirmPin);
      onChange(nextFieldLock);
      setPin("");
      setConfirmPin("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "现场模式设置失败。");
    }
  }

  function handleDisable() {
    onChange({
      enabled: false,
      failedAttempts: 0
    });
    setError(undefined);
  }

  function handleRelock() {
    onChange(relockFieldLock(fieldLock));
    setError(undefined);
  }

  return (
    <section className="settingsSection wideSection fieldLockSettings" aria-labelledby="field-lock-settings-title">
      <div className="sectionTitle">
        <ShieldCheck size={21} aria-hidden="true" />
        <div>
          <h2 id="field-lock-settings-title">现场模式</h2>
          <p>开启后，商品、设置、仪表盘需要输入 4 位数字 PIN 才能进入。</p>
        </div>
      </div>

      <div className="fieldLockState">
        <span>{fieldLock.enabled ? "现场模式已开启" : "现场模式未开启"}</span>
        {fieldLock.unlockExpiresAt ? <span>当前为临时解锁状态</span> : null}
      </div>

      <div className="settingsFieldGrid">
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

      {error ? <p className="formError">{error}</p> : null}

      <div className="dialogActions">
        <button type="button" className="primaryButton" onClick={() => void handleEnable()}>
          {fieldLock.enabled ? "更新 PIN" : "开启现场模式"}
        </button>
        {fieldLock.enabled ? (
          <>
            <button type="button" className="secondaryButton" onClick={handleRelock}>
              立即重新锁定
            </button>
            <button type="button" className="secondaryButton dangerButton" onClick={handleDisable}>
              关闭现场模式
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
