import { createResourceApi } from './createResourceApi';
import type { LevelTafsilDto } from '../../types/levelTafsil';

/**
 * Read-only slice of `api/level-tafsils` used to populate the سطح تفصیلی picker on the «ارتباط
 * معین با گروه تفصیلی» tab. Capped at 7 levels by business rule, so a single `.list()` call
 * with a generous page size is always the complete set — no further pagination needed.
 */
export const levelTafsilsApi = createResourceApi<LevelTafsilDto>('level-tafsils');
