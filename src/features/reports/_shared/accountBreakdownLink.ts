import { getReportUnitScope } from './reportUnitScope';
import { reportUrl } from './reportUrlParams';

/**
 * پیوند «این حساب به تفکیک استان / واحد / سند» از هر گزارش به مرور حساب‌ها. مسیر (`path`) به شکل
 * `سطح:کد,سطح:کد` است (سطوح همان `ACCOUNT_REVIEW_LEVEL`)، و دامنهٔ واحد مشترک است پس همان دامنه باز می‌شود.
 * دامنهٔ چندواحدی ⇒ تفکیک استان؛ فقط واحد جاری ⇒ فهرست اسناد.
 */
export function accountBreakdownUrl(
  accountLevel: number,
  code: string,
  filters?: { from?: string; to?: string },
): string {
  const multiUnit = getReportUnitScope().unitScope !== 0;
  return reportUrl('/reports/account-review', {
    level: multiUnit ? 11 : 14,
    path: `${accountLevel}:${code}`,
    from: filters?.from,
    to: filters?.to,
  });
}

/** `path` آدرس ⇒ مراحل مسیر؛ مقادیر نامعتبر نادیده. */
export function parseBreakdownPath(raw: string): { level: number; code: string }[] {
  return raw
    .split(',')
    .map((part) => {
      const [level, ...rest] = part.split(':');
      return { level: Number(level), code: rest.join(':').trim() };
    })
    .filter((s) => Number.isInteger(s.level) && s.level >= 1 && s.level <= 13 && s.code.length > 0 && s.code.length <= 15);
}
