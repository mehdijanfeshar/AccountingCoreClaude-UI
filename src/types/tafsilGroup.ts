/**
 * Mirrors Accounting.Api's TafsilGroupDto exactly (camelCase over the wire). `personType`'s
 * real business meaning (legal vs. real person, or something else) is NOT documented anywhere
 * in the backend — see `schema.ts` in this feature for how it's surfaced in the UI.
 */
export interface TafsilGroupDto {
  id: string; // guid
  tafsilGroupCode: string | null;
  tafsilGroupName: string | null;
  personType: boolean | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
