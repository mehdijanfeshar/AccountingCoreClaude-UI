import { createResourceApi } from './createResourceApi';
import type { LevelTafsilDto } from '../../types/levelTafsil';

/**
 * Exact wire shape of `CreateLevelTafsilCommand` (create) / `UpdateLevelTafsilRequest` (update).
 * See backend/src/Accounting.Api/Controllers/LevelTafsilsController.cs.
 *
 * `levelCode` is the level *number* — the reference project maps a voucher line's
 * `Tafsili1Id`…`Tafsili7Id` onto a real `LEVEL_ID` by looking this column up as `"1"`…`"7"`
 * (docs/centralaccount-business-reference.md §3-3, «حداکثر ۷ سطح تفصیلی»), which is where both
 * the 7-level ceiling and the must-be-unique expectation come from.
 */
export interface LevelTafsilWritePayload {
  levelCode: string;
  levelName: string;
}

/**
 * Single client for `api/level-tafsils` — used both by the سطوح تفصیلی management pages
 * (`features/level-tafsils`) and, read-only, to populate the سطح تفصیلی picker on the «ارتباط
 * معین با گروه تفصیلی» tab. It lives here rather than in the feature folder precisely because
 * of that second caller: one resource, one client, so the two can never drift.
 *
 * Capped at 7 levels by business rule (see above), so a single `.list()` call with a generous
 * page size is always the complete set — no pagination needed for the lookup use.
 */
export const levelTafsilsApi = createResourceApi<
  LevelTafsilDto,
  LevelTafsilWritePayload,
  LevelTafsilWritePayload
>('level-tafsils');
