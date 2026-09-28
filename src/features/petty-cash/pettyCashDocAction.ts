/**
 * «گردش عملیات» — `PettyCashDocAction` سمت سرور (`Accounting.Domain.ValueObjects.PettyCashDocAction`).
 * هم‌الگوی `pettyCashDocState.ts`/`pettyCashReturnReason.ts`: تنها محل عدد↔برچسب فارسی این enum.
 * ۱..۴ بخش ۱ (ایجاد/ویرایش/ارسال/حذف سند)، ۵..۸ بخش ۲ (شروع بررسی/تأیید/برگشت/رد — ۶ فقط دادهٔ
 * تاریخی، دیگر تولید نمی‌شود)، ۹..۱۰ تکمیل بخش ۲ (۲۰۲۶-۰۹-۲۸: کنترل بازرس/تأیید نهایی).
 */
export const PETTY_CASH_DOC_ACTION = {
  create: 1,
  update: 2,
  submit: 3,
  delete: 4,
  startReview: 5,
  approve: 6,
  return: 7,
  reject: 8,
  verify: 9,
  finalApprove: 10,
} as const;

export const PETTY_CASH_DOC_ACTION_OPTIONS = [
  { value: 1, label: 'ایجاد سند' },
  { value: 2, label: 'ویرایش سند' },
  { value: 3, label: 'ارسال برای بررسی' },
  { value: 4, label: 'حذف سند' },
  { value: 5, label: 'شروع بررسی' },
  { value: 6, label: 'تأیید سند' },
  { value: 7, label: 'برگشت سند' },
  { value: 8, label: 'رد سند' },
  { value: 9, label: 'تأیید کنترل' },
  { value: 10, label: 'تأیید نهایی' },
] as const;

export function getPettyCashDocActionLabel(value: number): string {
  return PETTY_CASH_DOC_ACTION_OPTIONS.find((o) => o.value === value)?.label ?? `اقدام ${value}`;
}
