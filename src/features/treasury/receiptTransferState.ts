import type { ReceiptStateValue, TransferEventActionValue, TransferStateValue } from '../../types/treasury';
import type { ChipColor } from '../petty-cash/pettyCashDocState';

/**
 * وضعیت‌های دریافت وجه و انتقال وجه — `ReceiptState`/`TransferState` سمت سرور، خزانه‌داری بخش
 * ۴-ج (`docs/tankhah-khazaneh-module.md` §۱۰). برچسب‌ها دقیقاً از
 * `TreasuryReceiptStateConflictException`/`TreasuryTransferStateConflictException.StateLabel`
 * سمت سرور کپی شده‌اند — همان الگوی `treasuryPaymentRequestState.ts`.
 *
 * ⚠️ این فقط UI است. قابل ویرایش/حذف/ثبت/تأیید بودن همیشه سمت سرور تصمیم گرفته می‌شود.
 */
export const RECEIPT_STATE = {
  draft: 1,
  registered: 2,
  cancelled: 3,
} as const;

export const RECEIPT_STATE_OPTIONS: readonly { value: ReceiptStateValue; label: string; color: ChipColor }[] = [
  { value: 1, label: 'پیش‌نویس', color: 'default' },
  { value: 2, label: 'ثبت‌شده', color: 'success' },
  { value: 3, label: 'لغوشده', color: 'error' },
] as const;

export function getReceiptStateLabel(value: number | null | undefined): string {
  return RECEIPT_STATE_OPTIONS.find((o) => o.value === value)?.label ?? 'بدون وضعیت';
}

export function getReceiptStateColor(value: number | null | undefined): ChipColor {
  return RECEIPT_STATE_OPTIONS.find((o) => o.value === value)?.color ?? 'default';
}

/** فقط پیش‌نویس قابل ویرایش/حذف/لغو/ثبت است. */
export function isReceiptDraft(state: number | null | undefined): boolean {
  return state === RECEIPT_STATE.draft;
}

export const TRANSFER_STATE = {
  draft: 1,
  pendingTreasurer: 2,
  executed: 3,
  returned: 4,
  rejected: 5,
} as const;

export const TRANSFER_STATE_OPTIONS: readonly { value: TransferStateValue; label: string; color: ChipColor }[] = [
  { value: 1, label: 'پیش‌نویس', color: 'default' },
  { value: 2, label: 'در انتظار تأیید خزانه‌دار', color: 'info' },
  { value: 3, label: 'انجام‌شده', color: 'success' },
  { value: 4, label: 'برگشتی', color: 'warning' },
  { value: 5, label: 'ردشده', color: 'error' },
] as const;

export function getTransferStateLabel(value: number | null | undefined): string {
  return TRANSFER_STATE_OPTIONS.find((o) => o.value === value)?.label ?? 'بدون وضعیت';
}

export function getTransferStateColor(value: number | null | undefined): ChipColor {
  return TRANSFER_STATE_OPTIONS.find((o) => o.value === value)?.color ?? 'default';
}

/** پیش‌نویس و برگشتی — تنها وضعیت‌های قابل ویرایش/حذف/ارسال. */
export const EDITABLE_TRANSFER_STATES: readonly number[] = [TRANSFER_STATE.draft, TRANSFER_STATE.returned];

export function isTransferEditable(state: number | null | undefined): boolean {
  return state !== null && state !== undefined && EDITABLE_TRANSFER_STATES.includes(state);
}

export function isTransferPendingTreasurer(state: number | null | undefined): boolean {
  return state === TRANSFER_STATE.pendingTreasurer;
}

/** `TransferEventAction`. */
export const TRANSFER_EVENT_ACTION_OPTIONS: readonly { value: TransferEventActionValue; label: string }[] = [
  { value: 1, label: 'ایجاد' },
  { value: 2, label: 'ویرایش' },
  { value: 3, label: 'حذف' },
  { value: 4, label: 'ارسال برای تأیید' },
  { value: 5, label: 'تأیید' },
  { value: 6, label: 'برگشت' },
  { value: 7, label: 'رد' },
] as const;

export function getTransferEventActionLabel(value: number | null | undefined): string {
  return TRANSFER_EVENT_ACTION_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}
