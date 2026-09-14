import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tafsiliApi } from '../../features/chart-of-accounts/api';
import type { TafsiliLevelDto } from '../../types/tafsili';

/**
 * Dynamic detail-account ("تفصیلی") field mechanism used by the voucher entry form.
 *
 * ---- The 5-step flow (translated 1:1 from the old Angular app; step 4's shape changed
 * once the phase 20-b endpoints landed — see the note on `optionsByLevelId` below) ----
 *
 * 1. User selects a "معین" (moin) account in the voucher line form.
 *
 * 2. Selecting a different موین must clear every previously rendered تفصیلی field before
 *    the new lookup resolves, so stale fields from the old موین are never shown against the
 *    new one — the caller (`VoucherLineRow`) is responsible for this reset because it owns
 *    the selected values, not this hook; this hook only reports which levels are active.
 *
 * 3. Fetch which of the (up to) 7 levels are active for this موین:
 *      GET /api/account-codes/{accountCodeId}/tafsili-levels
 *    Returns a bare array of `{ levelId, code, levelName, isRequired }`. `isRequired` is
 *    always `true` — mere presence of a level here means BOTH allowed and required (see
 *    `TafsiliLevelDto` doc). This is CLAUDE.md open risk #12 ("الزامی بودن تفصیلی")
 *    resolved for READING; ENFORCING it is still only done here as UX validation (see
 *    `voucherEntrySchema.ts`) — the backend write path still accepts an incomplete set of
 *    تفصیلی links, so risk #12 remains open server-side.
 *
 * 4. Unlike the old Angular app (and the placeholder this hook used to be), item OPTIONS
 *    for each level are NOT preloaded into a flat `optionsByLevelId` map — the real backend
 *    endpoint (`GET .../tafsili-levels/{levelId}/items`) is paginated and server-searched
 *    (can be hundreds of rows per level), so eagerly fetching every level's full option list
 *    up front would defeat the point of that pagination. Callers fetch a level's options
 *    on demand via the sibling `useTafsiliLevelItems` hook (async, debounced search),
 *    typically from inside a `TafsiliItemSelect` rendered once per active level.
 *
 * 5. Render fields:
 *    - Levels 1–3 render inline inside the voucher line row form.
 *    - Levels 4–7 render behind a "لیست تفصیلی‌ها" modal; if none of 4–7 are active, the
 *      modal shows "سطح تفصیلی بیشتری وجود ندارد" instead of an empty list.
 *    - In the voucher lines grid, a تفصیلی level's column is only shown once at least one
 *      row actually has a value for it (`checkTafLevelField` in the old app) — preserved in
 *      `VoucherEntryPage`'s summary table to avoid a wall of mostly-empty columns.
 *
 * `isBank`/`isAttribute` row-form special cases from the old app (cheque sub-flow, numeric
 * vs. date "شناسه" field) are NOT ported here — `AccountCodeDto` carries no equivalent flag
 * in this backend's contract, and inventing one would be guessing a shape. Tracked as an
 * open item in the phase completion report, not silently dropped.
 */

export interface UseTafsiliLevelsResult {
  /** Levels 1-3, sorted ascending: render inline in the voucher line row. */
  inlineLevels: TafsiliLevelDto[];
  /** Levels 4-7, sorted ascending: render behind the "لیست تفصیلی‌ها" modal. */
  modalLevels: TafsiliLevelDto[];
  /** Every active level (inline + modal), sorted ascending — convenience for validation. */
  allLevels: TafsiliLevelDto[];
  isLoading: boolean;
  error: unknown;
}

const EMPTY: TafsiliLevelDto[] = [];

/**
 * Given the selected "معین" (moin) account id, resolves which of the up to 7 تفصیلی levels
 * are active/required for it.
 *
 * @param moinAccountId - id of the selected معین account, or `null` before selection
 *   (mirrors `resetLevels()` from the old app: nothing is fetched and every level array is
 *   empty while this is `null`).
 */
export function useTafsiliLevels(moinAccountId: string | null): UseTafsiliLevelsResult {
  const query = useQuery({
    queryKey: ['tafsili-levels', moinAccountId],
    queryFn: () => tafsiliApi.getLevels(moinAccountId as string),
    enabled: moinAccountId !== null,
  });

  // Memoized on `query.data`'s reference (stable across re-renders unless an actual refetch
  // happens) so callers can safely put `allLevels`/`inlineLevels`/`modalLevels` in a
  // `useEffect` dependency array without it firing on every unrelated re-render.
  return useMemo(() => {
    const levels = query.data ?? EMPTY;
    const sorted = [...levels].sort((a, b) => a.code - b.code);
    return {
      inlineLevels: sorted.filter((level) => level.code >= 1 && level.code <= 3),
      modalLevels: sorted.filter((level) => level.code >= 4),
      allLevels: sorted,
      isLoading: query.isLoading,
      error: query.error,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isLoading, query.error]);
}
