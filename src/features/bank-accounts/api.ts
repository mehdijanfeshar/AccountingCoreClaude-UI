import { createResourceApi } from '../../lib/api/createResourceApi';
import type { BankAccountDto } from '../../types/bankAccount';

/**
 * Exact wire shape of `CreateBankAccountCommand` (create, minus server-assigned `VahedCode`) /
 * `UpdateBankAccountRequest` (update) — both share this field set.
 * See backend/src/Accounting.Application/BankAccounts/Commands/CreateBankAccount/CreateBankAccountCommand.cs
 * and backend/src/Accounting.Api/Controllers/BankAccountsController.cs (UpdateBankAccountRequest).
 *
 * `bankId`/`branchId`/`accountTypeId` have no backing lookup endpoint anywhere in this backend
 * (no Banks/BankBranches/AccountTypes controller exists) — always sent as `null` from this form,
 * same discipline as `sourceAndConsumeId`/`identyGroupsId` on the chart-of-accounts form.
 * `checkFile` (BLOB) is out of scope — no upload UI, always `null`.
 */
export interface BankAccountWritePayload {
  accountNumber: string;
  accountHolder: string;
  cardNumber: string | null;
  shebaNumber: string | null;
  firstAmount: number | null;
  bankId: string | null;
  branchId: string | null;
  accountTypeId: string | null;
  accountCodeId: string | null;
  checkFile: string | null;
  accountOpeningDate: string | null;
}

export const bankAccountsApi = createResourceApi<BankAccountDto, BankAccountWritePayload, BankAccountWritePayload>(
  'bank-accounts',
);
