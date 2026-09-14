import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import { toPersianDigits } from './numbers';

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

/**
 * Formats a Legacy `YYYYMMDD` Jalali string (how this schema stores every user-facing date —
 * `checkBookDate`, `payReciveDate`, `dateDoc`, ...) for display, e.g. `"14040613"` →
 * `"۱۴۰۴/۰۶/۱۳"`. Display-only: the stored/sent value must stay the raw 8-char Latin-digit
 * string (see the hard rule in `numbers.ts`).
 *
 * Anything that isn't exactly 8 digits is returned unchanged rather than mangled — this column
 * has no CHECK constraint backing the format, so malformed rows do exist and showing them
 * verbatim beats inventing a date.
 */
export function formatLegacyJalaliDate(value: string | null | undefined): string {
  if (!value) return '—';
  if (!/^\d{8}$/.test(value)) return value;
  return toPersianDigits(`${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`);
}
