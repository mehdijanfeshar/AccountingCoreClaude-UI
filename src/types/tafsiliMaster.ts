/**
 * Mirrors Accounting.Api's TafsiliDto exactly (camelCase over the wire) — the full CRUD record
 * for `TB_TAFSILI` (`api/tafsilis`). NOT the same as `TafsiliLookupItemDto`/`TafsiliLevelDto` in
 * `src/types/tafsili.ts`, which back the read-only voucher-entry دینامیک تفصیلی lookups.
 */
export interface TafsiliDto {
  id: string; // guid
  tafsiliCode: string | null;
  tafsiliName: string | null;
  tafsilDesc: string | null;
  isActive: boolean | null;
  personType: boolean | null;
  owner: boolean | null;
  vahedType: boolean | null;
  vahedCode: string | null;
  tafsilGroupIds: string[];
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
