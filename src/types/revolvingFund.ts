/** Mirrors Accounting.Api's RevolvingFundDto exactly (camelCase over the wire). */
export interface RevolvingFundDto {
  id: string; // guid
  code: string | null;
  name: string | null;
  description: string | null;
  defaultAmount: number | null;
  accountCodeId: string | null;
  vahedCode: string | null;
  year: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
