/**
 * Mirrors Accounting.Api's phase 20-b dynamic تفصیلی endpoints exactly
 * (camelCase over the wire). Backing Query/DTO source (read-only reference,
 * do not guess from here):
 *   backend/src/Accounting.Application/AccountCodes/Queries/GetTafsiliLevels/TafsiliLevelDto.cs
 *   backend/src/Accounting.Application/AccountCodes/Queries/GetTafsiliLevelItems/TafsiliLookupItemDto.cs
 */

/**
 * One "active" تفصیلی level configured for a معین (`TB_ACCOUNTCODE`).
 * `isRequired` is ALWAYS `true` by construction — the backend has no
 * "allowed but optional" state in this schema (mere row existence in
 * `TB_ACCOUNT_LINK_LEVEL` means both allowed AND required). Kept in the
 * contract anyway so this fact is explicit rather than re-derived here.
 */
export interface TafsiliLevelDto {
  levelId: string; // guid — TB_LEVEL_TAFSIL.ID
  code: number; // 1..7 — parsed TB_LEVEL_TAFSIL.LEVEL_CODE
  levelName: string;
  isRequired: boolean;
}

/** One selectable تفصیلی item for a (معین, level) pair — a page item of GetTafsiliLevelItems. */
export interface TafsiliLookupItemDto {
  id: string; // guid — TB_TAFSILI.ID
  tafsiliCode: string | null;
  tafsiliName: string | null;
  /** `"{tafsiliCode} - {tafsiliName}"`, composed server-side — show this verbatim in dropdowns. */
  label: string;
}
