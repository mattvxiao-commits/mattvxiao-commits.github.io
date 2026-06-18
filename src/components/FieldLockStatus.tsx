import { LockKeyhole } from "lucide-react";
import { isFieldLockTemporarilyUnlocked, relockFieldLock } from "../domain/fieldLock";
import type { AppSettings } from "../domain/types";

type FieldLockStatusProps = {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
};

export default function FieldLockStatus({ settings, onSave }: FieldLockStatusProps) {
  if (!settings.fieldLock.enabled) {
    return null;
  }

  const isTemporarilyUnlocked = isFieldLockTemporarilyUnlocked(settings.fieldLock);

  async function handleRelock() {
    await onSave({
      ...settings,
      fieldLock: relockFieldLock(settings.fieldLock)
    });
  }

  return (
    <div className="fieldLockStatus" aria-label="现场模式状态">
      <LockKeyhole size={16} aria-hidden="true" />
      <span>现场模式已开启</span>
      {isTemporarilyUnlocked ? (
        <button type="button" className="secondaryButton compactButton" onClick={() => void handleRelock()}>
          重新锁定
        </button>
      ) : null}
    </div>
  );
}
