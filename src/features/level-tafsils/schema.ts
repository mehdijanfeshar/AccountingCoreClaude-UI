import { z } from 'zod';
import type { LevelTafsilWritePayload } from '../../lib/api/levelTafsilsApi';
import type { LevelTafsilDto } from '../../types/levelTafsil';

/**
 * UX-presentation validation only, mirroring `CreateLevelTafsilCommandValidator` /
 * `UpdateLevelTafsilCommandValidator` (NotEmpty + MaximumLength on both fields — that is the
 * whole server-side rule set for this table).
 *
 * ⚠️ Deliberately does NOT enforce «کد سطح یکتا باشد» or «حداکثر ۷ سطح». Both are real business
 * rules (see `LevelTafsilWritePayload`), but `TB_LEVEL_TAFSIL` carries no UNIQUE constraint and
 * the backend validators do not check either one. Hard-blocking them here would put a business
 * rule in the UI only — exactly what team working-rule #1 forbids — so the list and form warn
 * loudly instead, and the gap is recorded in docs/open-decisions.md.
 */
export const levelTafsilFormSchema = z.object({
  levelCode: z
    .string()
    .trim()
    .min(1, 'کد سطح الزامی است')
    .max(2, 'کد سطح حداکثر ۲ کاراکتر است'),
  levelName: z
    .string()
    .trim()
    .min(1, 'نام سطح الزامی است')
    .max(50, 'نام سطح حداکثر ۵۰ کاراکتر است'),
});

export type LevelTafsilFormValues = z.infer<typeof levelTafsilFormSchema>;

export const emptyLevelTafsilFormValues: LevelTafsilFormValues = {
  levelCode: '',
  levelName: '',
};

export function levelTafsilDtoToFormValues(dto: LevelTafsilDto): LevelTafsilFormValues {
  return {
    levelCode: dto.levelCode ?? '',
    levelName: dto.levelName ?? '',
  };
}

export function levelTafsilFormValuesToPayload(values: LevelTafsilFormValues): LevelTafsilWritePayload {
  return {
    levelCode: values.levelCode.trim(),
    levelName: values.levelName.trim(),
  };
}

/** The ceiling the reference project's `for (i = 1; i <= 7; i++)` loops imply. */
export const MAX_TAFSILI_LEVELS = 7;

/**
 * One generous page is always the complete set (see `MAX_TAFSILI_LEVELS`). Shared by the list
 * page and the form's advisory duplicate-code lookup so both land on the same React Query cache
 * entry rather than fetching the table twice.
 */
export const LEVEL_TAFSILS_PAGE_SIZE = 200;
