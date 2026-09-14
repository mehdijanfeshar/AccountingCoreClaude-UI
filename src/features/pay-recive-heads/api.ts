import { createResourceApi } from '../../lib/api/createResourceApi';
import type { PayReciveHeadDto } from '../../types/payReciveHead';

/**
 * Exact wire shape of `CreatePayReciveHeadCommand` (create, minus server-assigned `VahedCode`) /
 * `UpdatePayReciveHeadRequest` (update) — both share this field set.
 * See backend/src/Accounting.Application/PayReciveHeads/Commands/CreatePayReciveHead/CreatePayReciveHeadCommand.cs
 * and backend/src/Accounting.Api/Controllers/PayReciveHeadsController.cs (UpdatePayReciveHeadRequest).
 *
 * HEAD ONLY (deliberate, matches the backend) — carries no `TB_PAYRECIVDETAIL` rows.
 */
export interface PayReciveHeadWritePayload {
  payReciveCode: string;
  payReciveDate: string;
  payReciveDescription: string;
  payReciveType: boolean | null;
  year: string;
  voucherHeadId: string | null;
}

export const payReciveHeadsApi = createResourceApi<
  PayReciveHeadDto,
  PayReciveHeadWritePayload,
  PayReciveHeadWritePayload
>('pay-recive-heads');
