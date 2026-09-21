/**
 * Mirrors Accounting.Api's VoucherDetailDto exactly (camelCase over the wire).
 * See backend/src/Accounting.Application/Vouchers/Queries/VoucherDetailDto.cs.
 */
export interface VoucherDetailDto {
  id: string;
  voucherHeadId: string | null;
  accountId: string | null;
  receiptId: string | null;
  checkId: string | null;
  lowLevelCodeId: string | null;
  etebarId: string | null;
  description: string | null;
  radif: number | null;
  debtor: number | null;
  creditor: number | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  vahedCode: string | null;
  year: string | null;
  isDeleted: boolean | null;
  /**
   * The line's active تفصیلی assignments, added to the read side when the edit form was built.
   * Never null: an empty array means "this line has none", which the form has to tell apart from
   * "unknown" — it sends an empty list to clear links, and omits the field entirely to leave them
   * untouched.
   */
  tafsiliLinks: {
    tafsiliId: string;
    levelId: string;
    tafsiliCode: string | null;
    tafsiliName: string | null;
    /** `"{code} - {name}"`, composed server-side — show verbatim, same as the lookup returns. */
    label: string;
  }[];
}
