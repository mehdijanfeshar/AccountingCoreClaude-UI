/**
 * Mirrors Accounting.Api's TafsilGroupDto exactly (camelCase over the wire).
 *
 * Phase 27: `personType` moved from a buggy `bool|null` wire shape to a real nullable-integer
 * enum (`PersonTypes`: 1=حقیقی, 2=حقوقی, 3=سایر) — same enum shared by `TafsiliDto.personType`.
 * Value/label table: `../types/legacyEnums.ts`.
 */
export interface TafsilGroupDto {
  id: string; // guid
  tafsilGroupCode: string | null;
  tafsilGroupName: string | null;
  personType: number | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
