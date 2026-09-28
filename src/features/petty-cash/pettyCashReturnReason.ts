/**
 * بخش ۲ — دلایل برگشت سند (`ReturnPettyCashExpenseDocRequest.reasonCodes`) و کدهای شکست تأیید
 * گروهی. هم‌الگوی `pettyCashDocState.ts`: تنها محل عدد/رشته↔برچسب فارسی برای این دو enum.
 *
 * عبارت‌ها دقیقاً از صفحهٔ ۸ پاورپوینت مرجع («برگشت سند برای اصلاح») و
 * `Accounting.Domain.ValueObjects.PettyCashReturnReason` سمت سرور کپی شده‌اند (۲۰۲۶-۰۹-۲۸ — کدهای
 * قبلی ۱..۷ دیگر معتبر نیستند).
 */
export const RETURN_REASON_OPTIONS = [
  { value: 1, label: 'پیوست ناقص است' },
  { value: 2, label: 'حساب هزینه نادرست است' },
  { value: 3, label: 'مبلغ با مدرک مطابقت ندارد' },
  { value: 4, label: 'شرح هزینه نیازمند توضیح است' },
  { value: 5, label: 'سایر' },
] as const;

export function getReturnReasonLabel(value: number): string {
  return RETURN_REASON_OPTIONS.find((o) => o.value === value)?.label ?? `دلیل ${value}`;
}

/**
 * `PettyCashDocEventDto.returnReasons` یک رشتهٔ کدهای کاما-جداست (مثلاً `"1,3"`) یا `null`. این
 * تابع آن را به آرایه‌ای از کدهای عددی تبدیل می‌کند — استفادهٔ اصلی: گردش عملیات
 * (`PettyCashDocEventsPanel`).
 */
export function parseReturnReasonCodes(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((segment) => Number(segment.trim()))
    .filter((code) => !Number.isNaN(code));
}

/** همان `parseReturnReasonCodes`، اما مستقیماً برچسب‌های فارسی را برمی‌گرداند. */
export function getReturnReasonLabels(value: string | null | undefined): string[] {
  return parseReturnReasonCodes(value).map(getReturnReasonLabel);
}

/**
 * کدهای رشته‌ای `failedIds[].reason` که `BulkApprovePettyCashExpenseDocsCommandHandler` روی ۴۰۹
 * برمی‌گرداند (`GlobalExceptionHandler.BuildBulkApproveConflictProblemDetails`). این کدها ثابت و
 * machine-readable‌اند؛ فقط برچسب فارسی‌شان اینجاست.
 */
const BULK_APPROVE_FAILURE_REASON_LABELS: Record<string, string> = {
  'not-found': 'یافت نشد',
  forbidden: 'شما بررسی‌کنندهٔ این تنخواه نیستید',
  'self-review': 'نمی‌توانید سند خودتان را بررسی کنید',
  'invalid-state': 'وضعیت سند تغییر کرده',
  'not-verified': 'هنوز کنترل بازرس انجام نشده',
  'over-authority': 'خارج از سقف اختیار شما',
};

export function getBulkApproveFailureReasonLabel(reason: string): string {
  return BULK_APPROVE_FAILURE_REASON_LABELS[reason] ?? reason;
}
