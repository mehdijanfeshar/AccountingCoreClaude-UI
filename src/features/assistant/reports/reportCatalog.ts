import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../../lib/format/dates';
import { reportUrl } from '../../reports/_shared/reportUrlParams';
import { DOC_LIFE_FILTER_OPTIONS } from '../../../types/trialBalance';
import { MATRIX_ALL_DIMENSIONS } from '../../../types/matrixReport';

/**
 * گزارش‌ساز حسابیار — گزارش‌های موجودی که حسابیار می‌تواند باز کند و سؤال‌های هرکدام. حسابیار هیچ عددی
 * نمی‌سازد: فقط پارامترها را جمع می‌کند و همان صفحهٔ گزارش را با آن‌ها باز می‌کند (reportUrlParams).
 */

export type ReportKind = 'trial-balance' | 'matrix' | 'account-review' | 'voucher-review';

export interface ParamOption {
  value: string;
  label: string;
}

export interface ReportParamSpec {
  key: string;
  title: string;
  /** سؤالی که از کاربر پرسیده می‌شود. */
  ask: string;
  type: 'period' | 'choice' | 'text';
  options?: ParamOption[];
  /** مقدار پیش‌فرض وقتی پرسیده نمی‌شود. */
  defaultValue: string;
  /** برای گزارش آماده (نه ذخیره‌شده) پرسیده شود؟ بقیه پیش‌فرض‌اند و در خود صفحهٔ گزارش قابل تغییرند. */
  askByDefault: boolean;
}

export interface ReportKindSpec {
  kind: ReportKind;
  title: string;
  description: string;
  path: string;
  keywords: string[];
  params: ReportParamSpec[];
}

const DOC_LIFE_OPTIONS: ParamOption[] = [
  { value: '', label: 'همهٔ اسناد' },
  ...DOC_LIFE_FILTER_OPTIONS.map((o) => ({ value: String(o.value), label: o.label })),
];

const CODING_LEVELS: ParamOption[] = [
  { value: '1', label: 'گروه' },
  { value: '2', label: 'کل' },
  { value: '3', label: 'معین' },
];

const ALL_LEVELS: ParamOption[] = MATRIX_ALL_DIMENSIONS.map((d) => ({ value: String(d.value), label: d.label }));

const PERIOD: ReportParamSpec = {
  key: 'period', title: 'بازهٔ زمانی', ask: 'گزارش چه بازه‌ای؟', type: 'period', defaultValue: 'wholeYear', askByDefault: true,
};
const DOC_LIFE: ReportParamSpec = {
  key: 'docLife', title: 'وضعیت اسناد', ask: 'کدام اسناد حساب شوند؟', type: 'choice', options: DOC_LIFE_OPTIONS, defaultValue: '', askByDefault: false,
};

export const REPORT_KINDS: ReportKindSpec[] = [
  {
    kind: 'trial-balance',
    title: 'تراز آزمایشی',
    description: 'گردش و ماندهٔ حساب‌ها در سطح گروه، کل یا معین (۴، ۶ یا ۸ ستونی).',
    path: '/reports/trial-balance',
    keywords: ['تراز', 'تراز آزمایشی', 'مانده حساب ها', 'گردش حساب ها', 'ستونی'],
    params: [
      PERIOD,
      { key: 'level', title: 'سطح', ask: 'در چه سطحی؟', type: 'choice', options: CODING_LEVELS, defaultValue: '3', askByDefault: true },
      {
        key: 'variant', title: 'نوع تراز', ask: 'چند ستونی؟', type: 'choice', defaultValue: '4', askByDefault: false,
        options: [{ value: '4', label: '۴ ستونی' }, { value: '6', label: '۶ ستونی (با اول دوره)' }, { value: '8', label: '۸ ستونی (با جمع کل)' }],
      },
      DOC_LIFE,
      { key: 'code', title: 'فیلتر کد', ask: 'کد حساب خاصی مد نظر است؟ (مثلاً ۳۰۲)', type: 'text', defaultValue: '', askByDefault: false },
    ],
  },
  {
    kind: 'matrix',
    title: 'گزارش ماتریسی',
    description: 'جمع گردش به تفکیک دو محور، مثلاً هزینه‌ها (معین) به تفکیک مرکز هزینه (تفصیلی).',
    path: '/reports/matrix',
    keywords: ['ماتریسی', 'ماتریس', 'به تفکیک', 'تفکیک', 'به ازای هر', 'جدول متقاطع'],
    params: [
      PERIOD,
      { key: 'row', title: 'ردیف‌ها', ask: 'ردیف‌های جدول چه باشند؟', type: 'choice', options: ALL_LEVELS, defaultValue: '4', askByDefault: true },
      { key: 'col', title: 'ستون‌ها', ask: 'ستون‌های جدول چه باشند؟', type: 'choice', options: ALL_LEVELS, defaultValue: '3', askByDefault: true },
      DOC_LIFE,
      { key: 'rowCode', title: 'فیلتر کد ردیف', ask: 'کد خاصی برای ردیف‌ها؟', type: 'text', defaultValue: '', askByDefault: false },
      { key: 'colCode', title: 'فیلتر کد ستون', ask: 'کد خاصی برای ستون‌ها؟ (مثلاً معین‌های دارو)', type: 'text', defaultValue: '', askByDefault: false },
    ],
  },
  {
    kind: 'account-review',
    title: 'مرور حساب‌ها',
    description: 'گردش و ماندهٔ هر سطح حساب یا تفصیلی، با امکان رفتن به سطح پایین‌تر.',
    path: '/reports/account-review',
    keywords: ['مرور حساب', 'مرور حساب ها', 'مانده', 'گردش', 'تفصیلی', 'طرف حساب'],
    params: [
      PERIOD,
      { key: 'level', title: 'سطح', ask: 'در چه سطحی؟', type: 'choice', options: ALL_LEVELS, defaultValue: '3', askByDefault: true },
      DOC_LIFE,
      { key: 'code', title: 'جستجوی کد', ask: 'کد یا نام خاصی؟', type: 'text', defaultValue: '', askByDefault: false },
    ],
  },
  {
    kind: 'voucher-review',
    title: 'مرور اسناد',
    description: 'فهرست اسناد در یک بازه با وضعیت، نوع سند و شرح.',
    path: '/reports/voucher-review',
    keywords: ['مرور اسناد', 'اسناد', 'سندها', 'فهرست اسناد', 'سند های'],
    params: [
      PERIOD,
      DOC_LIFE,
      { key: 'desc', title: 'شرح', ask: 'در شرح سند چه کلمه‌ای باشد؟', type: 'text', defaultValue: '', askByDefault: false },
    ],
  },
];

export function kindSpec(kind: string): ReportKindSpec | undefined {
  return REPORT_KINDS.find((k) => k.kind === kind);
}

// ───────────── بازهٔ زمانی ─────────────

export const PERIOD_PRESETS: { value: string; label: string }[] = [
  { value: 'thisMonth', label: 'این ماه' },
  { value: 'lastMonth', label: 'ماه قبل' },
  { value: 'thisQuarter', label: 'این فصل' },
  { value: 'lastQuarter', label: 'فصل قبل' },
  { value: 'fromYearStart', label: 'از اول سال تا امروز' },
  { value: 'wholeYear', label: 'کل سال مالی' },
];

const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function daysIn(year: number, month: number): number {
  return new DateObject({ calendar: persian, locale: persian_fa, year, month, day: 1 }).month.length;
}

/** امروز به شمسی، ولی در سال مالی جاری کاربر (اگر سال مالی سال دیگری است، همان ماه/روز در آن سال). */
function todayInYear(financialYear: string) {
  const t = new DateObject({ calendar: persian, locale: persian_fa });
  const y = /^\d{4}$/.test(financialYear) ? Number(financialYear) : t.year;
  const m = t.month.number;
  return { y, m, d: Math.min(t.day, daysIn(y, m)) };
}

/** مقدار پارامتر بازه: نام پیش‌فرض (thisMonth…)، `month:7`، یا `14040701-14040730`. خروجی: from/to شمسی ('' = کل سال). */
export function resolvePeriod(value: string, financialYear: string): { from: string; to: string } {
  const { y, m, d } = todayInYear(financialYear);
  const monthRange = (mm: number) => ({ from: `${y}${pad(mm)}01`, to: `${y}${pad(mm)}${pad(daysIn(y, mm))}` });
  const quarterStart = Math.floor((m - 1) / 3) * 3 + 1;
  switch (value) {
    case 'thisMonth': return monthRange(m);
    case 'lastMonth': return m > 1 ? monthRange(m - 1) : monthRange(1);
    case 'thisQuarter': return { from: `${y}${pad(quarterStart)}01`, to: `${y}${pad(quarterStart + 2)}${pad(daysIn(y, quarterStart + 2))}` };
    case 'lastQuarter': {
      const s = Math.max(1, quarterStart - 3);
      return { from: `${y}${pad(s)}01`, to: `${y}${pad(s + 2)}${pad(daysIn(y, s + 2))}` };
    }
    case 'fromYearStart': return { from: `${y}0101`, to: `${y}${pad(m)}${pad(d)}` };
    case 'wholeYear':
    case '': return { from: '', to: '' };
  }
  const month = /^month:(\d{1,2})$/.exec(value);
  if (month) return monthRange(Math.min(12, Math.max(1, Number(month[1]))));
  const range = /^(\d{8})-(\d{8})$/.exec(value);
  if (range) return { from: range[1], to: range[2] };
  return { from: '', to: '' };
}

export function periodLabel(value: string, financialYear: string): string {
  const preset = PERIOD_PRESETS.find((p) => p.value === value);
  const { from, to } = resolvePeriod(value, financialYear);
  const range = from ? `${formatLegacyJalaliDate(from)} تا ${formatLegacyJalaliDate(to)}` : `سال مالی ${toPersianDigits(financialYear)}`;
  const month = /^month:(\d{1,2})$/.exec(value);
  const name = preset?.label ?? (month ? `${MONTH_NAMES[Number(month[1]) - 1]} ${toPersianDigits(financialYear)}` : null);
  return name && from ? `${name} (${toPersianDigits(range)})` : toPersianDigits(range);
}

/** «مهر»، «۸ مهر» نه — فقط نام ماه کامل ⇒ `month:7`. */
export function monthFromWord(word: string): string | null {
  const i = MONTH_NAMES.findIndex((n) => word === n || word === `${n}ماه`);
  return i >= 0 ? `month:${i + 1}` : null;
}

// ───────────── ساخت آدرس گزارش ─────────────

/** مقدار نهایی پارامترها (کلید ⇒ مقدار) ⇒ آدرس صفحهٔ گزارش. */
export function buildReportUrl(kind: ReportKind, values: Record<string, string>, financialYear: string, title?: string): string {
  const spec = kindSpec(kind)!;
  const { from, to } = resolvePeriod(values.period ?? '', financialYear);
  const params: Record<string, string> = { from, to };
  for (const p of spec.params) {
    if (p.key === 'period') continue;
    params[p.key] = toLatinDigits(values[p.key] ?? p.defaultValue);
  }
  if (title) params.title = title;
  return reportUrl(spec.path, params);
}

export function optionLabel(spec: ReportParamSpec, value: string): string {
  if (spec.type === 'text') return value || '—';
  return spec.options?.find((o) => o.value === value)?.label ?? value;
}
