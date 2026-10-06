import { formatThousands } from '../../lib/format/numbers';
import type { Answer } from './assistantState';
import type { RecentOperation, TemplateSummaryDto } from './types';

/**
 * جواب‌های آخرین اجرای همین الگو ⇒ جواب‌های گفتگو، برای «تکرار» / «مثل دفعهٔ قبل».
 * تاریخ‌ها عمداً تکرار نمی‌شوند: سند تازه تاریخ تازه می‌خواهد و همان سؤال پرسیده می‌شود.
 */
export function recentToAnswers(template: TemplateSummaryDto, recent: RecentOperation): Record<string, Answer> {
  const found: Record<string, Answer> = {};
  for (const a of recent.answers) {
    const p = template.parameters.find((x) => x.key === a.key);
    if (!p || p.type === 4) continue;
    const label = p.type === 1 ? `${formatThousands(Number(a.value))} ریال` : p.type === 2 ? a.label ?? a.value : a.value;
    found[p.key] = { value: a.value, label, fromRecent: true };
  }
  return found;
}

export function latestFor(recent: RecentOperation[] | undefined, templateId: string): RecentOperation | undefined {
  return recent?.find((r) => r.templateId === templateId);
}
