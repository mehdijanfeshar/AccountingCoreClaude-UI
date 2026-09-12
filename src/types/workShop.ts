/** Mirrors Accounting.Api's WorkShopDto exactly (camelCase over the wire). `checkFile` (BLOB) is
 * deliberately absent — the backend DTO does not stream it back either. */
export interface WorkShopDto {
  id: string; // guid
  accountCodeId: string;
  branchId: string | null;
  workShopName: string | null;
  workShopCode: string | null;
  vahedCode: string | null;
  isActive: boolean;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
