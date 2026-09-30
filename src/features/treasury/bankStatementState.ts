import type {
  BankStatementLineMatchStateValue,
  BankStatementLineResolutionTypeValue,
  BankStatementSourceValue,
  BankStatementStateValue,
} from '../../types/treasury';
import type { ChipColor } from '../petty-cash/pettyCashDocState';

/**
 * وضعیت‌ها/مقادیر enum مغایرت‌گیری بانکی — `BankStatementState`/`BankStatementSource`/
 * `BankStatementLineMatchState`/`BankStatementLineResolutionType` سمت سرور، خزانه‌داری بخش ۴-د
 * (`docs/tankhah-khazaneh-module.md` §۱۰). همان الگوی `receiptTransferState.ts` — تنها محل
 * عدد↔برچسب↔رنگ این enumها.
 *
 * ⚠️ این فقط UI است. باز/بسته/تطبیق‌پذیر بودن همیشه سمت سرور تصمیم گرفته می‌شود.
 */
export const BANK_STATEMENT_STATE = {
  open: 1,
  closed: 2,
} as const;

export const BANK_STATEMENT_STATE_OPTIONS: readonly { value: BankStatementStateValue; label: string; color: ChipColor }[] = [
  { value: 1, label: 'باز', color: 'info' },
  { value: 2, label: 'بسته', color: 'default' },
] as const;

export function getBankStatementStateLabel(value: number | null | undefined): string {
  return BANK_STATEMENT_STATE_OPTIONS.find((o) => o.value === value)?.label ?? 'بدون وضعیت';
}

export function getBankStatementStateColor(value: number | null | undefined): ChipColor {
  return BANK_STATEMENT_STATE_OPTIONS.find((o) => o.value === value)?.color ?? 'default';
}

export function isBankStatementOpen(state: number | null | undefined): boolean {
  return state === BANK_STATEMENT_STATE.open;
}

export const BANK_STATEMENT_SOURCE_OPTIONS: readonly { value: BankStatementSourceValue; label: string }[] = [
  { value: 1, label: 'دستی' },
  { value: 2, label: 'فایل دیسکت' },
] as const;

export function getBankStatementSourceLabel(value: number | null | undefined): string {
  return BANK_STATEMENT_SOURCE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

export const BANK_STATEMENT_LINE_MATCH_STATE = {
  unmatched: 1,
  autoMatched: 2,
  manualMatched: 3,
  resolved: 4,
} as const;

export const BANK_STATEMENT_LINE_MATCH_STATE_OPTIONS: readonly {
  value: BankStatementLineMatchStateValue;
  label: string;
  color: ChipColor;
}[] = [
  { value: 1, label: 'تطبیق‌نیافته', color: 'warning' },
  { value: 2, label: 'تطبیق خودکار', color: 'success' },
  { value: 3, label: 'تطبیق دستی', color: 'success' },
  { value: 4, label: 'رفع‌شده', color: 'default' },
] as const;

export function getBankStatementLineMatchStateLabel(value: number | null | undefined): string {
  return BANK_STATEMENT_LINE_MATCH_STATE_OPTIONS.find((o) => o.value === value)?.label ?? 'بدون وضعیت';
}

export function getBankStatementLineMatchStateColor(value: number | null | undefined): ChipColor {
  return BANK_STATEMENT_LINE_MATCH_STATE_OPTIONS.find((o) => o.value === value)?.color ?? 'default';
}

export function isBankStatementLineUnmatched(state: number | null | undefined): boolean {
  return state === BANK_STATEMENT_LINE_MATCH_STATE.unmatched;
}

export function isBankStatementLineMatched(state: number | null | undefined): boolean {
  return state === BANK_STATEMENT_LINE_MATCH_STATE.autoMatched || state === BANK_STATEMENT_LINE_MATCH_STATE.manualMatched;
}

export function isBankStatementLineResolved(state: number | null | undefined): boolean {
  return state === BANK_STATEMENT_LINE_MATCH_STATE.resolved;
}

export const BANK_STATEMENT_LINE_RESOLUTION_TYPE = {
  bankFeeVoucher: 1,
  linkedReceipt: 2,
  ignored: 3,
} as const;

export const BANK_STATEMENT_LINE_RESOLUTION_TYPE_OPTIONS: readonly {
  value: BankStatementLineResolutionTypeValue;
  label: string;
}[] = [
  { value: 1, label: 'سند کارمزد بانکی' },
  { value: 2, label: 'اتصال به دریافت' },
  { value: 3, label: 'نادیده‌گرفته‌شده' },
] as const;

export function getBankStatementLineResolutionTypeLabel(value: number | null | undefined): string {
  return BANK_STATEMENT_LINE_RESOLUTION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}
