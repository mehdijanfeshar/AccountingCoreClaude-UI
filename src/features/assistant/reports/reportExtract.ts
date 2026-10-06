import { toLatinDigits } from '../../../lib/format/numbers';
import { intentTokens, normalizeFa } from '../intentMatch';
import { monthFromWord, type ReportKindSpec } from './reportCatalog';

/**
 * «گزارش با حسابیار» بدون هوش مصنوعی: کدام گزارش (رتبه‌بندی با کلمات) و کدام پارامترها از خود جمله
 * («تراز ۶ ستونی سطح کل ماه قبل»، «هزینهٔ دارو به تفکیک تفصیلی ۱ در مهر»). هر چیز ناپیدا پرسیده می‌شود.
 */

export interface ReportCandidate {
  id: string;
  title: string;
  keywords: string[];
  description: string;
  /** گزارش ذخیره‌شده دقیق‌تر از گزارش آماده است؛ در تساوی جلو می‌افتد. */
  specific: boolean;
}

export function rankReports<T extends ReportCandidate>(candidates: T[], sentence: string): { item: T; score: number }[] {
  const tokens = intentTokens(sentence).filter((t) => !REPORT_FILLER.has(t));
  if (tokens.length === 0) return [];
  const request = normalizeFa(sentence);
  return candidates
    .map((c) => {
      const title = normalizeFa(c.title);
      const keywordLines = c.keywords.map(normalizeFa).filter(Boolean);
      const keywords = keywordLines.join(' ');
      const rest = normalizeFa(c.description);
      let score = tokens.reduce((s, t) => s + (hits(keywords, t) ? 3 : hits(title, t) ? 2 : hits(rest, t) ? 1 : 0), 0);
      score += keywordLines.filter((line) => line.includes(' ') && request.includes(line)).length * 3;
      if (score > 0 && c.specific) score += 0.5;
      return { item: c, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** کلمه‌های جملهٔ گزارش که چیزی دربارهٔ «کدام گزارش» نمی‌گویند. */
const REPORT_FILLER = new Set([
  'گزارش', 'گزارشی', 'بده', 'بدهید', 'نشون', 'نشان', 'بگیر', 'بگیرم', 'میخوام', 'میخواهم', 'لطفا', 'ماه', 'این', 'قبل',
  'گذشته', 'سال', 'امسال', 'فصل', 'سطح', 'ستونی', 'تا', 'اول', 'امروز', 'کل',
]);

function hits(text: string, token: string): boolean {
  if (!text) return false;
  if (text.includes(token)) return true;
  return text.split(/\s+/).some((word) => word.length >= 3 && token.startsWith(word));
}

const LEVEL_WORDS: Record<string, string> = { گروه: '1', کل: '2', معین: '3' };
const ORDINAL: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7 };

/** «تفصیلی ۲» / «تفصیلی دو» / «معین» ⇒ کد سطح (۱ تا ۱۰) و جایش در جمله. */
function levelsIn(words: string[]): { value: string; index: number }[] {
  const found: { value: string; index: number }[] = [];
  words.forEach((w, i) => {
    if (w === 'تفصیلی' || w === 'تفصیل') {
      const next = words[i + 1];
      const n = next ? (/^\d$/.test(next) ? Number(next) : ORDINAL[next]) : undefined;
      found.push({ value: String(3 + (n && n >= 1 && n <= 7 ? n : 1)), index: i });
    } else if (LEVEL_WORDS[w] && !(w === 'کل' && (words[i + 1] === 'سال' || words[i - 1] === 'جمع'))) {
      found.push({ value: LEVEL_WORDS[w], index: i });
    }
  });
  return found;
}

/** 1404/07/01 یا 1404-7-1 یا 14040701 (بدون جداکننده دقیقاً ۸ رقم). */
const DATE_ANY = /(?<!\d)(?:(1[34]\d{2})[/\-.](\d{1,2})[/\-.](\d{1,2})|(1[34]\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01]))(?!\d)/g;

function toCompact(m: RegExpMatchArray): string {
  const [y, mo, d] = m[1] ? [m[1], m[2], m[3]] : [m[4], m[5], m[6]];
  return `${y}${mo.padStart(2, '0')}${d.padStart(2, '0')}`;
}

/** پارامترهایی که در جمله آمده‌اند — فقط برای کلیدهایی که این گزارش دارد. */
export function extractReportValues(spec: ReportKindSpec, sentence: string): Record<string, string> {
  const latin = toLatinDigits(sentence);
  const text = normalizeFa(latin);
  const words = text.split(/\s+/).filter(Boolean);
  const has = (phrase: string) => ` ${text} `.includes(` ${phrase} `);
  const keys = new Set(spec.params.map((p) => p.key));
  const out: Record<string, string> = {};

  // بازه
  if (keys.has('period')) {
    const dates = [...latin.matchAll(DATE_ANY)].map(toCompact); // «از … تا …»
    if (dates.length >= 2) out.period = `${dates[0]}-${dates[1]}`;
    else if (has('این ماه') || has('ماه جاری')) out.period = 'thisMonth';
    else if (has('ماه قبل') || has('ماه گذشته') || has('ماه پیش')) out.period = 'lastMonth';
    else if (has('این فصل') || has('فصل جاری')) out.period = 'thisQuarter';
    else if (has('فصل قبل') || has('فصل گذشته')) out.period = 'lastQuarter';
    else if (has('از اول سال') || has('تا امروز') || has('تا الان')) out.period = 'fromYearStart';
    else if (has('امسال') || has('کل سال') || has('سال جاری') || has('سال مالی')) out.period = 'wholeYear';
    else {
      for (const w of words) {
        const m = monthFromWord(w);
        if (m) {
          out.period = m;
          break;
        }
      }
    }
  }

  // سطح / محورها
  const levels = levelsIn(words);
  if (keys.has('row') && keys.has('col')) {
    const by = words.findIndex((w, i) => w === 'تفکیک' || (w === 'به' && words[i + 1] === 'تفکیک'));
    const after = levels.find((l) => by >= 0 && l.index > by);
    const before = levels.find((l) => l !== after);
    if (after) out.row = after.value;
    if (before) out.col = before.value;
  } else if (keys.has('level') && levels.length > 0) {
    const allowed = new Set(spec.params.find((p) => p.key === 'level')?.options?.map((o) => o.value));
    const pick = levels.find((l) => allowed.has(l.value));
    if (pick) out.level = pick.value;
  }

  // ۴/۶/۸ ستونی
  if (keys.has('variant')) {
    const m = /(?:^|\s)(4|6|8)\s*ستون/.exec(text) ?? /(چهار|شش|هشت)\s*ستون/.exec(text);
    if (m) out.variant = ({ چهار: '4', شش: '6', هشت: '8' } as Record<string, string>)[m[1]] ?? m[1];
  }

  // وضعیت اسناد
  if (keys.has('docLife')) {
    if (has('قطعی') || has('دائم') || has('تایید شده')) out.docLife = '4';
    else if (has('بررسی شده')) out.docLife = '3';
    else if (has('موقت')) out.docLife = '2';
  }

  return out;
}
