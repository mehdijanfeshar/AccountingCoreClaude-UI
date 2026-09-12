import { createResourceApi } from '../../lib/api/createResourceApi';
import type { RevolvingFundDto } from '../../types/revolvingFund';

/**
 * Exact wire shape of `CreateRevolvingFundCommand` (create, minus server-assigned `VahedCode`) /
 * `UpdateRevolvingFundRequest` (update).
 * See backend/src/Accounting.Application/RevolvingFunds/Commands/CreateRevolvingFund/CreateRevolvingFundCommand.cs
 * and backend/src/Accounting.Api/Controllers/RevolvingFundsController.cs (UpdateRevolvingFundRequest).
 */
export interface RevolvingFundWritePayload {
  code: string;
  name: string;
  description: string | null;
  defaultAmount: number | null;
  accountCodeId: string | null;
  year: string | null;
}

export const revolvingFundsApi = createResourceApi<
  RevolvingFundDto,
  RevolvingFundWritePayload,
  RevolvingFundWritePayload
>('revolving-funds');
