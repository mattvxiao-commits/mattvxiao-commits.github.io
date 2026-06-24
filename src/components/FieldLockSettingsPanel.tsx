import { Info, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  defaultFieldLockProtectedScopes,
  normalizeFieldLockSettings,
  relockFieldLock,
  setFieldLockPin,
  unlockFieldLock
} from "../domain/fieldLock";
import type { FieldLockScope, FieldLockSettings } from "../domain/types";

type FieldLockSettingsPanelProps = {
  fieldLock: FieldLockSettings;
  onSave: (fieldLock: FieldLockSettings, action: "enable" | "relock" | "disable") => Promise<void>;
};

const scopeOptions: Array<{ value: FieldLockScope; label: string }> = [
  { value: "products", label: "商品页" },
  { value: "orderDetail", label: "订单详情" },
  { value: "dashboard", label: "数据页" },
  { value: "settings", label: "设置页" }
];

export default function FieldLockSettingsPanel({ fieldLock, onSave }: FieldLockSettingsPanelProps) {
  const normalizedFieldLock = normalizeFieldLockSettings(fieldLock);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [protectedScopes, setProtectedScopes] = useState<FieldLockScope[]>(normalizedFieldLock.protectedScopes);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  async function handleEnable() {
    setError(undefined);
    setIsSaving(true);
    try {
      const nextFieldLock = unlockFieldLock(
        await setFieldLockPin(
          {
            ...normalizedFieldLock,
            protectedScopes
          },
          pin,
          confirmPin
        )
      );
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
          protectedScopes: [...defaultFieldLockProtectedScopes],
          failedAttempts: 0
        },
        "disable"
      );
      setProtectedScopes([...defaultFieldLockProtectedScopes]);
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
      await onSave(
        relockFieldLock({
          ...normalizedFieldLock,
          protectedScopes
        }),
        "relock"
      );
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

  function toggleScope(scope: FieldLockScope, checked: boolean) {
    setProtectedScopes((current) => {
      if (checked) {
        return current.includes(scope) ? current : [...current, scope];
      }

      return current.filter((item) => item !== scope);
    });
  }

  return (
    <section className="settingsSection wideSection fieldLockSettings" aria-labelledby="field-lock-settings-title">
      <div className="sectionTitle">
        <ShieldCheck size={21} aria-hidden="true" />
        <div>
          <div className="sectionTitleLine">
            <h2 id="field-lock-settings-title">现场模式</h2>
            <span className={fieldLock.enabled ? "stateChip isActive" : "stateChip"}>{stateLabel}</span>
            <button
              type="button"
              className="inlineInfoButton"
              aria-label="查看现场模式说明"
              aria-expanded={isHelpOpen}
              onClick={() => setIsHelpOpen((current) => !current)}
            >
              <Info size={14} aria-hidden="true" />
            </button>
          </div>
          <p>开启后，所选管理范围需要输入 4 位数字 PIN 才能查看或操作。</p>
        </div>
      </div>

      {isHelpOpen ? (
        <div className="fieldLockHelpPanel" role="note">
          <p>临时解锁表示现场模式已开启，但当前设备短时间内仍可进入已勾选的管理范围。</p>
          <p>需要立即锁定时，可在售卖页标题右侧点击重新锁定，或在本模块点击立即重新锁定。</p>
        </div>
      ) : null}

      <div className="fieldLockCompactGrid">
        <div className="fieldLockConfigColumn">
          <div className="fieldLockSubsection" role="group" aria-label="现场模式 PIN">
            <div className="fieldLockSubsectionHeader">
              <span>PIN</span>
              <p>4 位数字，仅保存在当前设备。</p>
            </div>
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
          </div>

          <div className="fieldLockSubsection fieldLockScopeGroup" role="group" aria-label="锁定范围">
            <div className="fieldLockSubsectionHeader">
              <span>锁定范围</span>
              <p>控制现场模式重新锁定后需要 PIN 的页面和详情。</p>
            </div>
            <div className="fieldLockScopeOptions">
              {scopeOptions.map((option) => (
                <label className="checkControl" key={option.value}>
                  <input
                    type="checkbox"
                    checked={protectedScopes.includes(option.value)}
                    aria-label={`锁定${option.label}`}
                    onChange={(event) => toggleScope(option.value, event.target.checked)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="dialogActions fieldLockActions" role="group" aria-label="现场模式操作">
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
