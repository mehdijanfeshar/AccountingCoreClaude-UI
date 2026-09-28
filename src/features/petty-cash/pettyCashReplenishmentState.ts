import type { PettyCashReplenishmentStateValue } from '../../types/pettyCash';
import type { ChipColor } from './pettyCashDocState';

/**
 * وضعیت پنج‌تایی ترمیم/شارژ تنخواه — `PettyCashReplenishmentState` سمت سرور (بخش ۳-الف،
 * ۲۰۲۶-۰۹-۲۸): `Draft → PendingFinanceManager → PendingTreasurer → Paid`، یا `Rejected` از هر
 * Pending. هم‌الگوی `pettyCashDocState.ts` — تنها محل عدد↔برچسب↔رنگ این enum.
 *
 * ⚠️ این فقط UI است؛ تصمیم اینکه یک ترمیم در کدام وضعیت قابل ارسال/تأیید/رد/پرداخت/حذف است همیشه
 * سمت سرور گرفته می‌شود (`docs/tankhah-khazaneh-module.md` §۹).
 */
export const PETTY_CASH_REPLENISHMENT_STATE = {
  draft: 1,
  pendingFinanceManager: 2,
  pendingTreasurer: 3,
  paid: 4,
  rejected: 5,
} as const;

export const PETTY_CASH_REPLENISHMENT_STATE_OPTIONS: readonly {
  value: PettyCashReplenishmentStateValue;
  label: string;
  color: ChipColor;
}[] = [
  { value: 1, label: 'پیش‌نویس', color: 'default' },
  { value: 2, label: 'در انتظار تأیید مدیر مالی', color: 'info' },
  { value: 3, label: 'در انتظار اقدام خزانه‌دار', color: 'primary' },
  { value: 4, label: 'پرداخت‌شده', color: 'success' },
  { value: 5, label: 'ردشده', color: 'error' },
] as const;

export function getReplenishmentStateLabel(value: number | null | undefined): string {
  return PETTY_CASH_REPLENISHMENT_STATE_OPTIONS.find((o) => o.value === value)?.label ?? 'بدون وضعیت';
}

export function getReplenishmentStateColor(value: number | null | undefined): ChipColor {
  return PETTY_CASH_REPLENISHMENT_STATE_OPTIONS.find((o) => o.value === value)?.color ?? 'default';
}

/** فقط پیش‌نویس قابل حذف/ارسال است (سند مرجع §۹). این کپی، نه منبع قاعده است — سرور با ۴۰۹ مرجع است. */
export function isReplenishmentDraft(state: number | null | undefined): boolean {
  return state === PETTY_CASH_REPLENISHMENT_STATE.draft;
}
