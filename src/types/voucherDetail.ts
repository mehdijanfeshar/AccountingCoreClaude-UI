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
}
