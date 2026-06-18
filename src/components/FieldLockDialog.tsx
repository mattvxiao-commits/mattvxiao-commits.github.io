import { useState } from "react";
import type { FieldLockVerifyResult } from "../domain/fieldLock";
import { validateFieldLockPinFormat } from "../domain/fieldLock";

type FieldLockDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  onVerify: (pin: string) => Promise<Pick<FieldLockVerifyResult, "success" | "message">>;
  onVerified: () => void;
};

export default function FieldLockDialog({
  isOpen,
  onCancel,
  onVerify,
  onVerified
}: FieldLockDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit() {
    const validation = validateFieldLockPinFormat(pin);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);
    setError(undefined);
    try {
      const result = await onVerify(pin);
      if (result.success) {
        setPin("");
        onVerified();
        return;
      }

      setError(result.message ?? "密码不正确，请重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modalBackdrop fieldLockBackdrop" role="presentation">
      <section className="fieldLockDialog" role="dialog" aria-modal="true" aria-labelledby="field-lock-title">
        <div className="modalHeader">
          <div>
            <p className="eyebrow">Field Lock</p>
            <h2 id="field-lock-title">管理页面已锁定</h2>
          </div>
        </div>
        <p className="fieldLockCopy">现场模式已开启，请输入 4 位数字密码后继续。</p>
        <label className="fieldLockInputLabel">
          <span>4 位数字密码</span>
          <input
            value={pin}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            type="password"
            autoFocus
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </label>
        {error ? <p className="formError">{error}</p> : null}
        <div className="modalActions">
          <button type="button" className="secondaryButton" onClick={onCancel} disabled={isSubmitting}>
            取消
          </button>
          <button type="button" className="primaryButton" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? "验证中..." : "解锁"}
          </button>
        </div>
      </section>
    </div>
  );
}
