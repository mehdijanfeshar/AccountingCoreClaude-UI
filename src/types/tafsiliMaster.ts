/**
 * Mirrors Accounting.Api's TafsiliDto exactly (camelCase over the wire) — the full CRUD record
 * for `TB_TAFSILI` (`api/tafsilis`). NOT the same as `TafsiliLookupItemDto`/`TafsiliLevelDto` in
 * `src/types/tafsili.ts`, which back the read-only voucher-entry دینامیک تفصیلی lookups.
 *
 * Phase 27: `isActive`/`personType`/`owner`/`vahedType` moved from a buggy `bool|null` wire shape
 * to real nullable-integer enums (`TafsiliActiveState`/`PersonTypes`/`Owners`/`VahedCategory`) —
 * value/label tables: `../types/legacyEnums.ts`. No `JsonStringEnumConverter` is registered, so
 * numbers travel as numbers, never as enum-name strings.
 */
export interface TafsiliDto {
  id: string; // guid
  tafsiliCode: string | null;
  tafsiliName: string | null;
  tafsilDesc: string | null;
  isActive: number | null;
  personType: number | null;
  owner: number | null;
  vahedType: number | null;
  vahedCode: string | null;
  tafsilGroupIds: string[];
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
