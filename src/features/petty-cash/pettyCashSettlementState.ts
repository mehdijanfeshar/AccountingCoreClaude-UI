import type { PettyCashSettlementStateValue } from '../../types/pettyCash';

/**
 * وضعیت دورهٔ تسویهٔ تنخواه — `PettyCashSettlementState` سمت سرور، بخش ۳-ب
 * (`docs/tankhah-khazaneh-module.md` §۹). دو مقدار ساده، برخلاف چرخهٔ چندمرحله‌ایِ ترمیم/صورت‌هزینه.
 */
export const PETTY_CASH_SETTLEMENT_STATE = {
  draft: 1,
  final: 2,
} as const;

export const PETTY_CASH_SETTLEMENT_STATE_OPTIONS: readonly {
  value: PettyCashSettlementStateValue;
  label: string;
}[] = [
  { value: 1, label: 'پیش‌نویس' },
  { value: 2, label: 'نهایی' },
];

export function getSettlementStateLabel(value: number | null | undefined): string {
  return PETTY_CASH_SETTLEMENT_STATE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}
