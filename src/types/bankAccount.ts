/**
 * Mirrors Accounting.Api's BankAccountDto exactly (camelCase over the wire). `checkFile` (BLOB)
 * is deliberately absent — the backend DTO does not stream it back either.
 */
export interface BankAccountDto {
  id: string; // guid
  accountNumber: string | null;
  accountHolder: string | null;
  cardNumber: string | null;
  shebaNumber: string | null;
  firstAmount: number | null;
  bankId: string | null;
  branchId: string | null;
  accountTypeId: string | null;
  accountCodeId: string | null;
  vahedCode: string | null;
  accountOpeningDate: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
