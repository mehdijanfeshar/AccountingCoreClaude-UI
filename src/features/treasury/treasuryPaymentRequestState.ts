import type { PaymentRequestStateValue } from '../../types/treasury';
import type { ChipColor } from '../petty-cash/pettyCashDocState';

/**
 * وضعیت‌های درخواست پرداخت — `PaymentRequestState` سمت سرور، خزانه‌داری بخش ۴-الف
 * (`docs/tankhah-khazaneh-module.md` §۱۰). برچسب‌ها دقیقاً از
 * `PaymentRequestStateConflictException.StateLabel` سمت سرور کپی شده‌اند تا پیام خطای واقعی و متن
 * این UI هرگز با هم فرق نکنند. تنها محل عدد↔برچسب↔رنگ این enum — همان الگوی `pettyCashDocState.ts`.
 *
 * ⚠️ این فقط UI است. قابل ویرایش/حذف/ارسال بودن همیشه سمت سرور تصمیم گرفته می‌شود؛ این ثابت‌ها فقط
 * چیزی را که سرور از قبل تصمیم گرفته نمایش می‌دهند.
 */
export const PAYMENT_REQUEST_STATE = {
  draft: 1,
  pendingUnitManager: 2,
  pendingFinanceManager: 3,
  pendingCeo: 4,
  readyForExecution: 5,
  returned: 6,
  rejected: 7,
  /** بخش ۴-ب — اجرا شد؛ پایانی. */
  executed: 8,
  /** بخش ۴-ب — موقتاً معلق؛ فقط از/به `readyForExecution`. */
  suspended: 9,
} as const;

export const PAYMENT_REQUEST_STATE_OPTIONS: readonly {
  value: PaymentRequestStateValue;
  label: string;
  color: ChipColor;
}[] = [
  { value: 1, label: 'پیش‌نویس', color: 'default' },
  { value: 2, label: 'در انتظار تأیید مدیر واحد', color: 'info' },
  { value: 3, label: 'در انتظار تأیید مدیر مالی', color: 'primary' },
  { value: 4, label: 'در انتظار تأیید مدیرعامل', color: 'secondary' },
  { value: 5, label: 'آمادهٔ اجرا', color: 'success' },
  { value: 6, label: 'برگشتی', color: 'warning' },
  { value: 7, label: 'ردشده', color: 'error' },
  { value: 8, label: 'پرداخت شد', color: 'success' },
  { value: 9, label: 'معلق', color: 'warning' },
] as const;

export function getPaymentRequestStateLabel(value: number | null | undefined): string {
  return PAYMENT_REQUEST_STATE_OPTIONS.find((o) => o.value === value)?.label ?? 'بدون وضعیت';
}

export function getPaymentRequestStateColor(value: number | null | undefined): ChipColor {
  return PAYMENT_REQUEST_STATE_OPTIONS.find((o) => o.value === value)?.color ?? 'default';
}

/** پیش‌نویس و برگشتی — تنها وضعیت‌های قابل ویرایش/ارسال (بخش ۴-الف). کپی UI، منبع اصلی سرور است. */
export const EDITABLE_PAYMENT_REQUEST_STATES: readonly number[] = [
  PAYMENT_REQUEST_STATE.draft,
  PAYMENT_REQUEST_STATE.returned,
];

export function isPaymentRequestEditable(state: number | null | undefined): boolean {
  return state !== null && state !== undefined && EDITABLE_PAYMENT_REQUEST_STATES.includes(state);
}

/** فقط پیش‌نویس قابل حذف است. */
export function isPaymentRequestDeletable(state: number | null | undefined): boolean {
  return state === PAYMENT_REQUEST_STATE.draft;
}

/** وضعیت‌هایی که کارتابل تأیید ممکن است رویشان اقدام بخواهد (هر Pending*). */
export const PENDING_PAYMENT_REQUEST_STATES: readonly number[] = [
  PAYMENT_REQUEST_STATE.pendingUnitManager,
  PAYMENT_REQUEST_STATE.pendingFinanceManager,
  PAYMENT_REQUEST_STATE.pendingCeo,
];

/** بخش ۴-ب — فقط «آمادهٔ اجرا» قابل اجرا/تعلیق است. */
export function isPaymentRequestExecutable(state: number | null | undefined): boolean {
  return state === PAYMENT_REQUEST_STATE.readyForExecution;
}

export function isPaymentRequestSuspendable(state: number | null | undefined): boolean {
  return state === PAYMENT_REQUEST_STATE.readyForExecution;
}

/** بخش ۴-ب — فقط «معلق» قابل رفع‌تعلیق است. */
export function isPaymentRequestResumable(state: number | null | undefined): boolean {
  return state === PAYMENT_REQUEST_STATE.suspended;
}

/** `PaymentRequestEventAction`. */
export const PAYMENT_REQUEST_EVENT_ACTION_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'ایجاد' },
  { value: 2, label: 'ویرایش' },
  { value: 3, label: 'ارسال برای تأیید' },
  { value: 4, label: 'حذف' },
  { value: 5, label: 'تأیید' },
  { value: 6, label: 'برگشت' },
  { value: 7, label: 'رد' },
  { value: 8, label: 'صدور سند شناسایی بدهی' },
  { value: 9, label: 'اجرای پرداخت' },
  { value: 10, label: 'تعلیق' },
  { value: 11, label: 'رفع تعلیق' },
] as const;

export function getPaymentRequestEventActionLabel(value: number | null | undefined): string {
  return PAYMENT_REQUEST_EVENT_ACTION_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

/** نوع ذی‌نفع — `TreasuryPaymentType`. */
export const TREASURY_PAYMENT_TYPE_OPTIONS = [
  { value: 1, label: 'تأمین‌کننده/پیمانکار' },
  { value: 2, label: 'کارمند' },
  { value: 3, label: 'سایر' },
] as const;

export function getTreasuryPaymentTypeLabel(value: number | null | undefined): string {
  return TREASURY_PAYMENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

/** روش پرداخت — `TreasuryPaymentMethod`. عمداً هم‌ترتیب `PettyCashPaymentMethod` نیست. */
export const TREASURY_PAYMENT_METHOD_OPTIONS = [
  { value: 1, label: 'ساتنا' },
  { value: 2, label: 'پایا' },
  { value: 3, label: 'چک' },
  { value: 4, label: 'نقد' },
] as const;

export function getTreasuryPaymentMethodLabel(value: number | null | undefined): string {
  return TREASURY_PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

/** نقش خزانه‌داری — `TreasuryRole`. فهرست کاملاً جدا از `PettyCashRole`. */
export const TREASURY_ROLE_OPTIONS = [
  { value: 1, label: 'مدیر واحد' },
  { value: 2, label: 'مدیر مالی' },
  { value: 3, label: 'مدیرعامل' },
  { value: 4, label: 'حسابدار ارشد' },
  { value: 5, label: 'خزانه‌دار' },
] as const;

export function getTreasuryRoleLabel(value: number | null | undefined): string {
  return TREASURY_ROLE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}

/**
 * کدهای رشته‌ای `failedIds[].reason` که `PaymentRequestBulkApproveConflictException` روی ۴۰۹
 * برمی‌گرداند (`GlobalExceptionHandler`) — همان الگوی `pettyCashReturnReason.ts`.
 */
const BULK_APPROVE_FAILURE_REASON_LABELS: Record<string, string> = {
  'not-found': 'یافت نشد',
  forbidden: 'شما نقش لازم برای این مرحله را ندارید',
  'self-approve': 'ثبت‌کنندهٔ درخواست نمی‌تواند آن را تأیید کند',
  'consecutive-approver': 'یک کاربر نمی‌تواند دو مرحلهٔ متوالی را تأیید کند',
  'invalid-state': 'وضعیت درخواست تغییر کرده',
  'over-bulk-limit': 'مبلغ از سقف تأیید گروهی بیشتر است',
};

export function getBulkApproveFailureReasonLabel(reason: string): string {
  return BULK_APPROVE_FAILURE_REASON_LABELS[reason] ?? reason;
}
