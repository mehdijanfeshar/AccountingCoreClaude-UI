/** Mirrors Accounting.Api's ExpenseDto exactly (camelCase over the wire). */
export interface ExpenseDto {
  id: string; // guid
  expenseCode: string | null;
  expenseName: string | null;
  description: string | null;
  defaultAmount: number | null;
  expenseGroupId: string | null;
  accountCodeId: string | null;
  vahedCode: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
