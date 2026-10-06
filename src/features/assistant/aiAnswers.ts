import { formatThousands } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { DATE_KEY, orderedParameters, type Answer } from './assistantState';
import { findUniqueDetail } from './sentenceExtract';
import type { InterpretResult, TemplateSummaryDto } from './types';

/**
 * پاسخ هوش مصنوعی ⇒ جواب‌های گفتگو (همان شکلی که کاربر یا روش قاعده‌ای می‌دهد). نام طرف حساب را مدل فقط
 * به‌صورت متن می‌دهد؛ تفصیلی را خود سیستم با جستجوی همان معین/سطح الگو (قاعدهٔ B واحد) پیدا می‌کند و
 * فقط اگر دقیقاً یک نتیجه داشت می‌گذارد — وگرنه سؤال پرسیده می‌شود.
 */
export async function aiAnswers(template: TemplateSummaryDto, result: InterpretResult): Promise<Record<string, Answer>> {
  const found: Record<string, Answer> = {};
  const mark = { fromSentence: true, fromAi: true } as const;

  if (result.voucherDate) {
    found[DATE_KEY] = { value: result.voucherDate, label: formatLegacyJalaliDate(result.voucherDate), ...mark };
  }

  const params = orderedParameters(template);
  for (const a of result.answers) {
    const p = params.find((x) => x.key === a.key);
    if (!p) continue;
    if (p.type === 1) {
      found[p.key] = { value: a.value, label: `${formatThousands(Number(a.value))} ریال`, ...mark };
    } else if (p.type === 4) {
      found[p.key] = { value: a.value, label: formatLegacyJalaliDate(a.value), ...mark };
    } else if (p.type === 3) {
      found[p.key] = { value: a.value, label: a.value, ...mark };
    } else if (p.type === 2 && p.pickerAccountId && p.pickerLevel !== null) {
      const name = a.value.trim();
      const shortName = name.replace(/^(شرکت|آقای|خانم|فروشگاه|داروخانه)\s+/, '');
      try {
        const hit = await findUniqueDetail(p.pickerAccountId, p.pickerLevel, [...new Set([name, shortName])]);
        if (hit) found[p.key] = { value: hit.id, label: hit.label, ...mark };
      } catch {
        // جستجو نشد ⇒ سؤال پرسیده می‌شود.
      }
    }
  }
  return found;
}
