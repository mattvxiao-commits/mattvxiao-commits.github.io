type PwaUpdatePromptProps = {
  isVisible: boolean;
  onApply: () => void;
  onDismiss: () => void;
};

export default function PwaUpdatePrompt({ isVisible, onApply, onDismiss }: PwaUpdatePromptProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <section className="pwaUpdatePrompt" role="status" aria-live="polite">
      <div>
        <strong>发现新版本</strong>
        <span>建议在空闲时刷新更新，商品、订单和库存数据不会被清空。</span>
      </div>
      <div className="pwaUpdateActions">
        <button type="button" className="secondaryButton" onClick={onDismiss}>
          稍后
        </button>
        <button type="button" className="primaryButton" onClick={onApply}>
          刷新更新
        </button>
      </div>
    </section>
  );
}
