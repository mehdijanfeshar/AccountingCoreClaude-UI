import { createResourceApi } from '../../lib/api/createResourceApi';
import type { ExpenseDto } from '../../types/expense';

/**
 * Exact wire shape of `CreateExpenseCommand` (create, minus server-assigned `VahedCode`) /
 * `UpdateExpenseRequest` (update).
 * See backend/src/Accounting.Application/Expenses/Commands/CreateExpense/CreateExpenseCommand.cs
 * and backend/src/Accounting.Api/Controllers/ExpensesController.cs (UpdateExpenseRequest).
 *
 * `expenseGroupId` has no backing lookup endpoint anywhere in this backend (no ExpenseGroups
 * controller exists) — always sent as `null` from this form, same discipline as the omitted
 * FKs on the chart-of-accounts/bank-account forms.
 */
export interface ExpenseWritePayload {
  expenseCode: string;
  expenseName: string;
  description: string | null;
  defaultAmount: number | null;
  expenseGroupId: string | null;
  accountCodeId: string | null;
}

export const expensesApi = createResourceApi<ExpenseDto, ExpenseWritePayload, ExpenseWritePayload>('expenses');
