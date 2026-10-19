import { ROLES, useRoles } from '../../lib/roles';

/**
 * کاربر «حسابدار» (مسئول حسابداری): پیش‌فرض زبانهٔ «سند حسابداری» و برچسب «ثبت سند».
 * بقیه (کاربر غیرمالی) زبان ساده و دکمهٔ «ارسال برای بررسی حسابدار» را می‌بینند. فقط نمایش — قاعدهٔ اصلی در سرور.
 */
export function useIsAccountant(): boolean {
  return useRoles().roles.includes(ROLES.MaliAdmin);
}

/** «۲ روز پیش» — فقط نمایش. */
export function relativeTimeFa(iso: string | null | undefined, now: number = Date.now()): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return '—';
  const minutes = Math.max(0, Math.round((now - t) / 60000));
  const fa = (n: number) => n.toLocaleString('fa-IR');
  if (minutes < 1) return 'همین الان';
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${fa(hours)} ساعت پیش`;
  return `${fa(Math.round(hours / 24))} روز پیش`;
}

export const RETURN_REASON_LABELS: Record<string, string> = {
  missing_attachment: 'پیوست ناقص',
  wrong_amount: 'مبلغ نادرست',
  wrong_account: 'حساب/طرف حساب نادرست',
  wrong_date: 'تاریخ نادرست',
  other: 'سایر',
};
