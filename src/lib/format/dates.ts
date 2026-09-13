import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';

/**
 * Formats an ISO datetime string (as returned by the API's `createdDate`/`updatedDate` fields)
 * as a Jalali date+time for display, e.g. "۱۴۰۳/۰۵/۱۲ ۱۴:۳۰". Returns `'—'` for anything that
 * isn't a parseable date — display-only, never sent back to the API (see the hard
 * Latin-digit-only rule in `numbers.ts`, which does not apply here).
 */
export function formatPersianDateTime(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new DateObject({ date, calendar: persian, locale: persian_fa }).format('YYYY/MM/DD HH:mm');
}
