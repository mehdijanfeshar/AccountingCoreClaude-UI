import type { TemplateSummaryDto } from './types';

/**
 * Phase-1 stand-in for the agent: match a free sentence ("میخام یه سند خرید کالا بزنم") to the
 * templates by their title/description/parameter words. No AI — in phase 3 the LLM replaces this
 * function and nothing else, because it picks a template the same way (`selectTemplate`).
 */

// Filler words of a request sentence that say nothing about WHICH operation.
const STOP_WORDS = new Set([
  'میخام', 'میخوام', 'میخواهم', 'خواهم', 'بخواهم', 'یه', 'ی', 'یک', 'سند', 'سندی', 'بزنم', 'زدن', 'بزن', 'ثبت', 'کنم', 'کن',
  'بکنم', 'کردن', 'کردم', 'شد', 'شده', 'است', 'هست', 'برای', 'بابت', 'را', 'رو', 'از', 'با', 'به', 'و', 'در', 'که', 'این',
  'اون', 'آن', 'من', 'ما', 'لطفا', 'لطفاً', 'باید', 'داریم', 'دارم', 'صدور', 'صادر', 'عملیات', 'یک‌', 'چطور', 'چگونه',
]);

export function normalizeFa(text: string): string {
  return text
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ً-ٰٟ]/g, '') // اعراب
    .replace(/‌/g, ' ')                // نیم‌فاصله
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .trim();
}

export function intentTokens(sentence: string): string[] {
  return normalizeFa(sentence)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

export interface TemplateMatch {
  template: TemplateSummaryDto;
  score: number;
}

/**
 * Templates ranked by how many request words they contain. Keyword hits weigh 3 (the accountant
 * wrote them exactly for this), title hits 2, description/parameter hits 1; a whole sample sentence
 * found inside the request adds 3 more.
 */
export function rankTemplates(templates: TemplateSummaryDto[], sentence: string): TemplateMatch[] {
  const tokens = intentTokens(sentence);
  if (tokens.length === 0) return templates.map((template) => ({ template, score: 0 }));
  const request = normalizeFa(sentence);
  return templates
    .map((template) => {
      const title = normalizeFa(template.title);
      const keywordLines = (template.keywords ?? '').split(/\n+/).map(normalizeFa).filter(Boolean);
      const keywords = keywordLines.join(' ');
      const rest = normalizeFa(
        [template.description, template.code.replace(/_/g, ' '), ...template.parameters.map((p) => p.title)].join(' '),
      );
      let score = tokens.reduce(
        (s, t) => s + (hits(keywords, t) ? 3 : hits(title, t) ? 2 : hits(rest, t) ? 1 : 0),
        0,
      );
      score += keywordLines.filter((line) => line.includes(' ') && request.includes(line)).length * 3;
      return { template, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * A request word hits a text when the text contains it, or when one of the text's words (3+ letters)
 * starts it — so «خریدم/خریدیم/خریداری» hit «خرید کالا» and «پرداختم» hits «پرداخت».
 */
function hits(text: string, token: string): boolean {
  if (text.includes(token)) return true;
  return text.split(/\s+/).some((word) => word.length >= 3 && token.startsWith(word));
}

/** The words of the request that are worth keeping as a شرح when no template matches. */
export function intentSummary(sentence: string): string {
  return intentTokens(sentence).join(' ');
}
