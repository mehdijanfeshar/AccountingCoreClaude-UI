/**
 * بخش ۲ — دلایل برگشت سند (`ReturnPettyCashExpenseDocRequest.reasonCodes`) و کدهای شکست تأیید
 * گروهی. هم‌الگوی `pettyCashDocState.ts`: تنها محل عدد/رشته↔برچسب فارسی برای این دو enum.
 *
 * کدهای دلیل برگشت طبق تصمیم accounting-domain قطعی‌اند؛ متن‌های فارسی پیش‌نویس‌اند و بدون تغییر
 * کد قابل ویرایش‌اند.
 */
export const RETURN_REASON_OPTIONS = [
  { value: 1, label: 'فاکتور/رسید ناقص یا مفقود' },
  { value: 2, label: 'تاریخ فاکتور نامعتبر یا خارج از دوره' },
  { value: 3, label: 'مغایرت مبلغ با فاکتور' },
  { value: 4, label: 'اطلاعات فروشنده ناقص' },
  { value: 5, label: 'مدارک/مجوز پشتیبان ناقص' },
  { value: 6, label: 'خارج از سقف یا ضوابط تنخواه' },
  { value: 7, label: 'سایر' },
] as const;

export function getReturnReasonLabel(value: number): string {
  return RETURN_REASON_OPTIONS.find((o) => o.value === value)?.label ?? `دلیل ${value}`;
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
};

export function getBulkApproveFailureReasonLabel(reason: string): string {
  return BULK_APPROVE_FAILURE_REASON_LABELS[reason] ?? reason;
}
