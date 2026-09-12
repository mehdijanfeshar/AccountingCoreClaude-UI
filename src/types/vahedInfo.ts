/**
 * Mirrors Accounting.Api's VahedInfoDto (camelCase over the wire). Only used here as a
 * read-only lookup source (`VahedInfoPickerDialog`) for `WorkShops.branchId` — no create/update
 * UI is built against this type in this phase.
 */
export interface VahedInfoDto {
  id: string; // guid
  vahedCode: string | null;
  vahedName: string | null;
  cityId: string | null;
  vahedTypeId: string | null;
  parentId: string | null;
}
