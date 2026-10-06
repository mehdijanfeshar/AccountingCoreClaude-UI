import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import { tafsiliApi } from '../chart-of-accounts/api';
import { formatThousands, toLatinDigits } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { DATE_KEY, orderedParameters, type Answer } from './assistantState';
import { normalizeFa, intentTokens } from './intentMatch';
import type { TemplateSummaryDto } from './types';

/**
 * Phase-1 stand-in for the agent's "understanding": pull answers out of the user's own sentence
 * («۲۰ میلیون دارو از شرکت جانفشار دیروز خریدم») so those questions are pre-answered. Everything here
 * is deterministic and conservative — when unsure it leaves the question to be asked. Every value
 * found is still shown to the user as an answer bubble they can change, and nothing is saved until
 * they press «ثبت».
 */

// ───────────── amount ─────────────

const UNITS: Record<string, number> = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9,
  ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, شونزده: 16,
  هفده: 17, هجده: 18, هیجده: 18, نوزده: 19,
  بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90,
  صد: 100, یکصد: 100, دویست: 200, سیصد: 300, چهارصد: 400, پانصد: 500, ششصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
};
const MULTIPLIERS: Record<string, number> = { هزار: 1e3, میلیون: 1e6, ملیون: 1e6, میلیارد: 1e9, ملیارد: 1e9 };
const CURRENCY: Record<string, number> = { ریال: 1, تومان: 10, تومن: 10 };
/** Tatweel (a letter-class char normalizeFa keeps) stands in for the decimal point while tokenising. */
const DECIMAL = 'ـ';

interface AmountMatch {
  rial: number;
  words: string[];
}

/**
 * Reads number phrases like «۲۰ میلیون تومان»، «دو میلیون و پانصد هزار»، «15,000,000». A phrase is
 * only taken as the amount when it has a multiplier or a currency, or is at least 1,000 — so «یک سند»
 * or «۸ مهر» are never mistaken for money.
 */
export function extractAmount(sentence: string): AmountMatch | null {
  const withoutDates = toLatinDigits(sentence)
    .replace(new RegExp(FULL_DATE_SOURCE, 'g'), ' ')
    .replace(new RegExp(COMPACT_DATE_SOURCE, 'g'), ' ')
    .replace(new RegExp(MONTH_DATE_SOURCE, 'g'), ' ');
  const words = normalizeFa(
    splitDigitsFromLetters(withoutDates.replace(/(\d)[,٬](?=\d{3})/g, '$1'))
      // normalizeFa drops punctuation; keep the decimal point of «1.5 میلیون» as a letter it keeps.
      .replace(/(\d)[.٫](\d)/g, `$1${DECIMAL}$2`),
  ).split(/\s+/).filter(Boolean);
  // «۵۶ میلیون» (با واحد/ضریب) بر هر عدد خالی مقدم است؛ عدد خالی فقط اگر چیز دیگری نبود.
  let plain: AmountMatch | null = null;
  for (let start = 0; start < words.length; start++) {
    let total = 0;
    let group = 0;
    let started = false;
    let strong = false;
    let rateToRial = 1;
    let end = start;
    for (let i = start; i < words.length; i++) {
      const w = words[i];
      const n = w.replace(DECIMAL, '.');
      const numeric = /^\d+(\.\d+)?$/.test(n) ? Number(n) : UNITS[w];
      if (numeric !== undefined) {
        group += numeric;
        started = true;
      } else if (w === 'و' && started) {
        // «دو میلیون و پانصد هزار»
      } else if (MULTIPLIERS[w] && started) {
        total += (group || 1) * MULTIPLIERS[w];
        group = 0;
        strong = true;
      } else if (CURRENCY[w] && started) {
        rateToRial = CURRENCY[w];
        strong = true;
        end = i;
        break;
      } else break;
      end = i;
    }
    if (!started) continue;
    const rial = Math.round((total + group) * rateToRial);
    if (rial <= 0) continue;
    const match = { rial, words: words.slice(start, end + 1) };
    if (strong) return match;
    if (!plain && rial >= 1000) plain = match;
  }
  return plain;
}

/** «56میلیون» / «میلیون56» ⇒ با فاصله، تا عدد و واحد جدا خوانده شوند. */
function splitDigitsFromLetters(text: string): string {
  return text.replace(/(\d)(\p{L})/gu, '$1 $2').replace(/(\p{L})(\d)/gu, '$1 $2');
}

// ───────────── date ─────────────

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/** 1404/07/08، 1404-7-8، 1404.7.8 */
const FULL_DATE_SOURCE = String.raw`(1[34]\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})`;
/** 14040707 — تاریخ بدون جداکننده (ماه ۰۱–۱۲، روز ۰۱–۳۱)، تا هرگز مبلغ خوانده نشود. */
const COMPACT_DATE_SOURCE = String.raw`(?<!\d)(1[34]\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)`;
/** «۸ مهر»، «۸ مهرماه ۱۴۰۴» — removed before amounts are read so their numbers are never taken as money. */
const MONTH_DATE_SOURCE = String.raw`\d{1,2}\s*(?:${MONTHS.join('|')})(?:ماه)?(?:\s*1[34]\d{2})?`;

interface DateMatch {
  jalali: string;
  label: string;
  words: string[];
}

function jalaliOf(d: DateObject): string {
  return toLatinDigits(d.format('YYYYMMDD'));
}

/** امروز/دیروز/پریروز، 1404/07/08، «۸ مهر» یا «۸ مهر ۱۴۰۴». */
export function extractDate(sentence: string, financialYear: string): DateMatch | null {
  const latin = toLatinDigits(sentence);
  const words = normalizeFa(latin).split(/\s+/).filter(Boolean);
  const today = new DateObject({ calendar: persian, locale: persian_fa });

  const relative: Record<string, number> = { امروز: 0, دیروز: 1, پریروز: 2 };
  for (const w of words) {
    if (w in relative) {
      const d = new DateObject(today).subtract(relative[w], 'day');
      return { jalali: jalaliOf(d), label: `${w} — ${formatLegacyJalaliDate(jalaliOf(d))}`, words: [w] };
    }
  }

  const full = new RegExp(FULL_DATE_SOURCE).exec(latin) ?? new RegExp(COMPACT_DATE_SOURCE).exec(latin);
  if (full) {
    const d = new DateObject({ calendar: persian, locale: persian_fa, year: +full[1], month: +full[2], day: +full[3] });
    if (d.isValid) return { jalali: jalaliOf(d), label: formatLegacyJalaliDate(jalaliOf(d)), words: [] };
  }

  for (let i = 1; i < words.length; i++) {
    const month = MONTHS.findIndex((m) => words[i] === m || words[i] === `${m}ماه` || words[i] === `${m}ما`);
    if (month < 0 || !/^\d{1,2}$/.test(words[i - 1])) continue;
    const yearWord = words[i + 1] && /^1[34]\d{2}$/.test(words[i + 1]) ? words[i + 1] : null;
    const year = Number(yearWord ?? (/^\d{4}$/.test(financialYear) ? financialYear : today.year));
    const d = new DateObject({ calendar: persian, locale: persian_fa, year, month: month + 1, day: +words[i - 1] });
    if (d.isValid) {
      return { jalali: jalaliOf(d), label: formatLegacyJalaliDate(jalaliOf(d)), words: [words[i - 1], words[i], ...(yearWord ? [yearWord] : [])] };
    }
  }
  return null;
}

// ───────────── تفصیلی ─────────────

/**
 * Candidate names for a تفصیلی: the phrase after «از / به / برای / بابت / شرکت» first (longest
 * first), then single remaining words. Words already explained (amount, date, template words) are skipped.
 */
function detailCandidates(sentence: string, used: Set<string>): string[] {
  const words = normalizeFa(toLatinDigits(sentence)).split(/\s+/).filter(Boolean);
  const meaningful = new Set(intentTokens(sentence));
  const out: string[] = [];
  const markers = new Set(['از', 'به', 'برای', 'بابت', 'شرکت', 'آقای', 'خانم', 'فروشگاه', 'داروخانه']);
  words.forEach((w, i) => {
    if (!markers.has(w)) return;
    const tail = words.slice(i + 1).filter((x) => meaningful.has(x) && !used.has(x)).slice(0, 3);
    for (let n = tail.length; n >= 1; n--) out.push(tail.slice(0, n).join(' '));
  });
  for (const w of meaningful) if (!used.has(w) && w.length >= 3 && !/^\d+$/.test(w)) out.push(w);
  return [...new Set(out)].slice(0, 6);
}

export async function findUniqueDetail(accountId: string, levelCode: number, candidates: string[]) {
  const levels = await tafsiliApi.getLevels(accountId);
  const level = levels.find((l) => l.code === levelCode);
  if (!level) return null;
  for (const term of candidates) {
    const page = await tafsiliApi.getLevelItems(accountId, level.levelId, { search: term, pageNumber: 1, pageSize: 2 });
    if (page.items.length === 1) return { id: page.items[0].id, label: page.items[0].label, term };
  }
  return null;
}

// ───────────── شرح ─────────────

/** کلمه‌های درخواست/سؤال و برچسب‌های مبلغ و تاریخ — هرگز در شرح نمی‌آیند. */
const DESCRIPTION_FILLER = new Set([
  'میخام', 'میخوام', 'میخواهم', 'می', 'خواهم', 'یه', 'ی', 'یک', 'سند', 'سندی', 'بزنم', 'بزن', 'بزنید', 'ثبت', 'صدور', 'صادر',
  'کنم', 'کن', 'کنید', 'بکنم', 'لطفا', 'لطفاً', 'چطور', 'چگونه', 'چطوری', 'آیا', 'باید', 'رو', 'را', 'در', 'به', 'تاریخ', 'تاریخه',
  'مورخ', 'مورخه', 'مبلغ', 'ارزش', 'جمعا', 'جمعاً', 'امروز', 'دیروز', 'پریروز', 'ماه',
  ...Object.keys(UNITS), ...Object.keys(MULTIPLIERS), ...Object.keys(CURRENCY), ...MONTHS,
]);

/** شروع عبارتی که «با چه کسی / برای چه» را می‌گوید. «به» عمداً نیست مگر بعد از پرداخت/فروش — ساده نگه داشته شده. */
const PHRASE_MARKERS = new Set(['از', 'برای', 'بابت', 'جهت', 'طی']);

/** پایان عبارت: فعل‌ها و کلمه‌هایی که بعد از نام طرف حساب می‌آیند. */
const PHRASE_STOPS = new Set([
  'خریدم', 'خریدیم', 'خرید', 'خریداری', 'خریده', 'کردم', 'کردیم', 'کرد', 'کردن', 'شد', 'شده', 'دادم', 'دادیم', 'داد',
  'گرفتم', 'گرفتیم', 'گرفت', 'پرداختم', 'پرداختیم', 'پرداخت', 'فروختم', 'فروختیم', 'دریافت', 'است', 'هست', 'بود', 'و',
]);

/**
 * «در تاریخ 14040707 به مبلغ 50میلیون دارو خرید از شرکت هجرت» ⇒ «خرید دارو از شرکت هجرت»:
 * عنوان عملیات + عبارت‌هایی که با «از / برای / بابت / جهت» شروع می‌شوند، بی تاریخ و مبلغ و کلمه‌های درخواست.
 */
export function describeSentence(title: string, sentence: string, usedWords: string[]): string {
  const latin = toLatinDigits(sentence)
    .replace(new RegExp(FULL_DATE_SOURCE, 'g'), ' ')
    .replace(new RegExp(COMPACT_DATE_SOURCE, 'g'), ' ')
    .replace(new RegExp(MONTH_DATE_SOURCE, 'g'), ' ');
  const used = new Set(usedWords);
  const words = normalizeFa(splitDigitsFromLetters(latin))
    .split(/\s+/)
    .filter((w) => w && !used.has(w) && !/^\d/.test(w) && !DESCRIPTION_FILLER.has(w));

  const phrases: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (!PHRASE_MARKERS.has(words[i])) continue;
    const tail: string[] = [];
    for (let j = i + 1; j < words.length && tail.length < 5; j++) {
      if (PHRASE_STOPS.has(words[j]) || PHRASE_MARKERS.has(words[j])) break;
      tail.push(words[j]);
    }
    if (tail.length) phrases.push(`${words[i]} ${tail.join(' ')}`);
  }

  return [title.trim(), ...new Set(phrases)].filter(Boolean).join(' ').slice(0, 200);
}

// ───────────── all together ─────────────

/** Answers found in the sentence, keyed like `AssistantState.answers` (DATE_KEY for the voucher date). */
export async function extractAnswers(
  template: TemplateSummaryDto,
  sentence: string,
  financialYear: string,
): Promise<Record<string, Answer>> {
  const found: Record<string, Answer> = {};
  const used = new Set<string>();
  const params = orderedParameters(template);

  const amount = extractAmount(sentence);
  const amountParam = params.find((p) => p.type === 1);
  if (amount && amountParam) {
    found[amountParam.key] = { value: String(amount.rial), label: `${formatThousands(amount.rial)} ریال`, fromSentence: true };
    amount.words.forEach((w) => used.add(w));
  }

  const date = extractDate(sentence, financialYear);
  if (date) {
    found[DATE_KEY] = { value: date.jalali, label: date.label, fromSentence: true };
    // اولین سؤال تاریخِ خود الگو (مثلاً تاریخ فاکتور) هم همان تاریخ را پیشنهاد می‌گیرد — قابل تغییر.
    const dateParam = params.find((p) => p.type === 4);
    if (dateParam) found[dateParam.key] = { value: date.jalali, label: date.label, fromSentence: true };
    date.words.forEach((w) => used.add(w));
  }

  // Words that only say WHICH operation this is («خرید», «دارو») are not a supplier's name.
  intentTokens([template.title, template.keywords ?? ''].join(' ')).forEach((w) => used.add(w));

  for (const p of params.filter((x) => x.type === 2 && x.pickerAccountId && x.pickerLevel !== null)) {
    try {
      const hit = await findUniqueDetail(p.pickerAccountId!, p.pickerLevel!, detailCandidates(sentence, used));
      if (hit) {
        found[p.key] = { value: hit.id, label: hit.label, fromSentence: true };
        hit.term.split(' ').forEach((w) => used.add(w));
      }
    } catch {
      // A failed lookup just means the question is asked normally.
    }
  }

  // «توضیح» = نام عملیات + بخش مفید جمله («از شرکت هجرت»)، نه خود جمله (که ممکن است سؤالی/درخواستی باشد).
  const textParam = params.find((p) => p.type === 3);
  const description = describeSentence(template.title, sentence, [...(amount?.words ?? []), ...(date?.words ?? [])]);
  if (textParam && description) {
    found[textParam.key] = { value: description, label: description, fromSentence: true };
  }

  return found;
}
