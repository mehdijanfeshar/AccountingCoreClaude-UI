import type { PettyCashLedgerRowType } from '../../types/pettyCash';
import type { ChipColor } from './pettyCashDocState';

/**
 * نوع ردیف گزارش گردش تنخواه — بخش ۳-الف (`docs/tankhah-khazaneh-module.md` §۹). سه مقدار رشته‌ای
 * ثابت سمت سرور (`PettyCashFundLedgerDto.cs`)، نه یک enum عددی — تنها محل عدد↔برچسب↔رنگ اینجاست.
 */
export const LEDGER_ROW_TYPE_OPTIONS: readonly { value: PettyCashLedgerRowType; label: string; color: ChipColor }[] = [
  { value: 'replenishment', label: 'ترمیم', color: 'success' },
  { value: 'expense', label: 'هزینه‌کرد', color: 'error' },
  { value: 'refund', label: 'استرداد', color: 'info' },
] as const;

export function getLedgerRowTypeLabel(value: PettyCashLedgerRowType | null | undefined): string {
  return LEDGER_ROW_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

export function getLedgerRowTypeColor(value: PettyCashLedgerRowType | null | undefined): ChipColor {
  return LEDGER_ROW_TYPE_OPTIONS.find((o) => o.value === value)?.color ?? 'default';
}
