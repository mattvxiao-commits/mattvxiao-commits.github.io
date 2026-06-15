export function normalizeMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

export function formatMoney(value: number): string {
  return `¥${normalizeMoney(value).toFixed(2)}`;
}

export function parseMoneyInput(value: string): number {
  const parsed = Number(value);
  return normalizeMoney(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
}
