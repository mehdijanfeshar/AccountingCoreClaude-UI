import type { PettyCashDocStateValue } from '../../types/pettyCash';

/**
 * وضعیت‌های سند تنخواه — `PettyCashDocState` (`docs/tankhah-khazaneh-module.md` §۲). این تنها
 * محل عدد↔برچسب↔رنگ برای کل ماژول است — همان الگوی `getDocLifeLabel`/`getDocLifeTone` در
 * `features/vouchers/api.ts`، اینجا برای ۷ وضعیت به‌جای ۴ وضعیت سند.
 *
 * ⚠️ این فقط UI است. تصمیم اینکه یک سند در کدام وضعیت قابل ویرایش/حذف/ارسال است همیشه سمت سرور
 * گرفته می‌شود (بخش ۴ سند مرجع) — این ثابت‌ها فقط چیزی را که سرور از قبل تصمیم گرفته نمایش می‌دهند.
 *
 * رنگ‌ها دقیقاً هفت مقدار Chip رنگی MUI‌اند (default/primary/secondary/error/info/success/warning)
 * — یک تصادف مفید که اجازه می‌دهد هر هفت وضعیت رنگ ثابت و متمایز خودش را بگیرد (طبق قاعدهٔ اسلاید
 * ۳ پروتوتایپ: «۷ وضعیت استاندارد با رنگ ثابت»).
 */
export const PETTY_CASH_DOC_STATE = {
  draft: 1,
  new: 2,
  pendingReview: 3,
  returned: 4,
  approved: 5,
  rejected: 6,
  settled: 7,
} as const;

export type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export const PETTY_CASH_DOC_STATE_OPTIONS: readonly {
  value: PettyCashDocStateValue;
  label: string;
  color: ChipColor;
}[] = [
  { value: 1, label: 'پیش‌نویس', color: 'default' },
  { value: 2, label: 'جدید', color: 'info' },
  { value: 3, label: 'در انتظار بررسی', color: 'primary' },
  { value: 4, label: 'برگشتی', color: 'warning' },
  { value: 5, label: 'تأییدشده', color: 'success' },
  { value: 6, label: 'ردشده', color: 'error' },
  { value: 7, label: 'تسویه‌شده', color: 'secondary' },
] as const;

export function getPettyCashStateLabel(value: number | null | undefined): string {
  return PETTY_CASH_DOC_STATE_OPTIONS.find((o) => o.value === value)?.label ?? 'بدون وضعیت';
}

export function getPettyCashStateColor(value: number | null | undefined): ChipColor {
  return PETTY_CASH_DOC_STATE_OPTIONS.find((o) => o.value === value)?.color ?? 'default';
}

/**
 * وضعیت‌هایی که سند در آن‌ها قابل ویرایش است — پیش‌نویس و برگشتی (بخش ۴ سند مرجع). این کپی، نه
 * منبع قاعده است: سرور با ۴۰۹ همین قاعده را مستقل اجرا می‌کند؛ این فقط تصمیم UI را برای مخفی‌کردن
 * دکمه‌هایی که قرار است شکست بخورند می‌گیرد. اگر این دو روزی اختلاف پیدا کنند، سرور برنده است.
 */
export const EDITABLE_PETTY_CASH_STATES: readonly number[] = [
  PETTY_CASH_DOC_STATE.draft,
  PETTY_CASH_DOC_STATE.returned,
];

export function isExpenseDocEditable(state: number | null | undefined): boolean {
  return state !== null && state !== undefined && EDITABLE_PETTY_CASH_STATES.includes(state);
}

/** فقط پیش‌نویس قابل حذف است (بخش ۴ سند مرجع). */
export function isExpenseDocDeletable(state: number | null | undefined): boolean {
  return state === PETTY_CASH_DOC_STATE.draft;
}

/** نوع مدرک — `EvidenceType`. */
export const EVIDENCE_TYPE_OPTIONS = [
  { value: 1, label: 'فاکتور رسمی' },
  { value: 2, label: 'رسید' },
  { value: 3, label: 'سایر' },
] as const;

export function getEvidenceTypeLabel(value: number | null | undefined): string {
  return EVIDENCE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

/** دورهٔ تسویهٔ تنخواه — `TB_PC_FUND_SETTING.SETTLEMENT_PERIOD`. */
export const SETTLEMENT_PERIOD_OPTIONS = [
  { value: 1, label: 'ماهانه' },
  { value: 2, label: 'فصلی' },
] as const;

export function getSettlementPeriodLabel(value: number | null | undefined): string {
  return SETTLEMENT_PERIOD_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

/**
 * نرخ پیشنهادی ارزش افزوده — فقط برای پرکردن اولیهٔ فیلد در فرم، **هرگز سمت سرور hardcode
 * نمی‌شود** (سند مرجع §۴). کاربر همیشه می‌تواند این مقدار را دستی عوض کند.
 */
export const SUGGESTED_VAT_RATE = 0.1;
