import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toLatinDigits } from '../../../lib/format/numbers';

/**
 * فیلترهای اولیهٔ گزارش از آدرس صفحه — «گزارش با حسابیار» و «گزارش‌های ذخیره‌شده» گزارش را با همین
 * پارامترها باز می‌کنند (مثلاً `/reports/trial-balance?variant=6&level=2&from=14040701&to=14040730`).
 * فقط مقدار اولیه است؛ کاربر بعد از باز شدن همه را می‌تواند عوض کند. آدرس بدون پارامتر = رفتار قبلی.
 *
 * کلیدهای مشترک: `from`/`to` (شمسی YYYYMMDD)، `docLife`، `title` (عنوان گزارش ذخیره‌شده برای نمایش).
 */
export interface ReportUrlParams {
  /** متن خام یا '' */
  text(key: string): string;
  /** تاریخ شمسی YYYYMMDD معتبر یا '' */
  date(key: string): string;
  /** عدد از میان مقادیر مجاز، وگرنه پیش‌فرض */
  oneOf<T extends number>(key: string, allowed: readonly T[], fallback: T): T;
  /** آیا آدرس اصلاً پارامتر گزارش دارد */
  any: boolean;
}

export function useReportUrlParams(): ReportUrlParams {
  const [searchParams] = useSearchParams();
  // یک بار در اولین رندر خوانده می‌شود: مقدار اولیهٔ فیلترهاست، نه همگام‌سازی دائمی.
  const [snapshot] = useState(() => new URLSearchParams(searchParams));
  return {
    text: (key) => snapshot.get(key)?.trim() ?? '',
    date: (key) => {
      const v = toLatinDigits(snapshot.get(key) ?? '').replace(/\D/g, '');
      return /^1[34]\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(v) ? v : '';
    },
    oneOf: (key, allowed, fallback) => {
      const n = Number(snapshot.get(key));
      return (allowed as readonly number[]).includes(n) ? (n as typeof fallback) : fallback;
    },
    any: [...snapshot.keys()].length > 0,
  };
}

/** آدرس گزارش با پارامترها؛ مقادیر خالی حذف می‌شوند. */
export function reportUrl(path: string, params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && String(v) !== '') sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `${path}?${q}` : path;
}
