/**
 * Design placeholder for the dynamic detail-account ("تفصیلی") field
 * mechanism used by the voucher entry form. NOT IMPLEMENTED YET — this
 * scaffold only proves out list-page end-to-end connectivity
 * (chart-of-accounts, voucher-heads); the voucher entry form with dynamic
 * tafsili fields is a later phase.
 *
 * ---- The 5-step flow (translated 1:1 from the old Angular app, adjusted
 * for the fact that `vahedCode` is no longer sent from the client) ----
 *
 * 1. User selects a "معین" (moin) account in the voucher line form.
 *
 * 2. `resetLevels()`: all seven possible tafsili levels are cleared and
 *    disabled before the new lookup resolves, so stale fields from a
 *    previously selected moin are never shown against the new one.
 *
 * 3. Fetch which of the 7 levels are active for this moin:
 *      GET TbAccountLinkLevel/GetLevelListdByAccountId?accountId={moinId}
 *    Returns an array of `{ id: levelId, code: 1..7 }`. The mere PRESENCE
 *    of a row for a given level means that level is both ALLOWED and
 *    REQUIRED — there is no separate `isRequired` column (this is the same
 *    mechanism documented as backend risk #12 in CLAUDE.md: "الزامی بودن
 *    تفصیلی" is encoded purely by row existence in
 *    `TB_ACCOUNT_LINK_LEVEL` / `TB_ACCOUNT_LINK_TAFSILGROUP`).
 *
 * 4. For each active level, fetch its dropdown options:
 *      GET TbAccountLinkTafsilGroup/Gettafsili?accountId={moinId}&levelId={levelId}&vahedCode={unit}
 *    ⚠️ The old Angular app passed `vahedCode` here. Our backend no longer
 *    accepts `vahedCode` as a client-supplied parameter anywhere (it is
 *    derived server-side from the token — VahedScopeBehavior, phase 19).
 *    Whether this lookup endpoint needs a unit parameter at all under the
 *    new scoping model is an open question for whoever implements this
 *    hook for real (see the `throw` below).
 *
 * 5. Render fields:
 *    - Levels 1–3 render inline inside the voucher line row form.
 *    - Levels 4–7 render behind a "لیست تفصیلی‌ها" modal; if none of 4–7
 *      are active, the modal shows "سطح تفصیلی بیشتری وجود ندارد" instead
 *      of an empty list.
 *    - Every active level's field is `required` (step 3's row-presence
 *      rule applies to UX validation only — see note below).
 *    - In the voucher lines grid, a tafsili level's column is only shown
 *      once at least one row actually has a value for it
 *      (`checkTafLevelField` in the old app) — preserve this UX to avoid
 *      a wall of mostly-empty columns.
 *
 * Special moin flags that further change the row form (also carried over):
 *    - `isBank` -> switches the row to the cheque-entry sub-flow.
 *    - `isAttribute` + `flag`: `flag === 'عدد'` -> numeric field, required;
 *      otherwise -> date field, required.
 *
 * ---- Why this throws instead of doing something ----
 *
 * As of this scaffold, Accounting.Api exposes NO equivalent of either
 * `TbAccountLinkLevel/GetLevelListdByAccountId` or
 * `TbAccountLinkTafsilGroup/Gettafsili`. The closest backend concept
 * (`TB_ACCOUNTCODE -> TB_ACCOUNT_LINK_TAFSILGROUP -> TB_TAFSIL_LINK_TAFSILGROUP
 * -> TB_TAFSILI`, documented in CLAUDE.md under "حل ابهام منبع حقیقت تفصیلی
 * مجاز") is known to exist in the domain/data model, but no Query/Endpoint
 * reading it has been built yet (tracked as open risk #12: "الزامی بودن
 * تفصیلی در کد ما پیاده نشده"). Building this hook against a guessed shape
 * would violate the "never hard-code/guess an API response" rule for this
 * role — so it intentionally throws until `api-contract` publishes the
 * real endpoint(s) and DTOs.
 */

export interface TafsiliLevel {
  levelId: string;
  code: number; // 1..7
}

export interface TafsiliOption {
  id: string;
  label: string;
}

export interface UseTafsiliLevelsResult {
  /** Levels 1-3: render inline in the voucher line row. */
  inlineLevels: TafsiliLevel[];
  /** Levels 4-7: render behind the "لیست تفصیلی‌ها" modal. */
  modalLevels: TafsiliLevel[];
  optionsByLevelId: Record<string, TafsiliOption[]>;
  isLoading: boolean;
  error: unknown;
}

/**
 * Future hook signature: given the selected "معین" (moin) account id,
 * resolves which of the 7 tafsili levels are active/required for it and
 * their dropdown options.
 *
 * @param moinAccountId - id of the selected معین account, or `null` before
 *   selection (mirrors `resetLevels()` from the old app: nothing is fetched
 *   and both level arrays are empty while this is `null`).
 */
export function useTafsiliLevels(_moinAccountId: string | null): UseTafsiliLevelsResult {
  throw new Error(
    'Not implemented: blocked on missing backend endpoints ' +
      '(no equivalent of TbAccountLinkLevel/GetLevelListdByAccountId or ' +
      'TbAccountLinkTafsilGroup/Gettafsili exists in Accounting.Api yet — ' +
      'see open risk #12 in CLAUDE.md and the TSDoc above).',
  );
}
