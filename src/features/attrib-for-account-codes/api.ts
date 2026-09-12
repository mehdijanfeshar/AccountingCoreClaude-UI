import { createResourceApi } from '../../lib/api/createResourceApi';
import type { AttribForAccountCodeDto } from '../../types/attribForAccountCode';

/**
 * Exact wire shape of `CreateAttribForAccountCodeCommand` (create, minus server-assigned
 * `VahedCode`) / `UpdateAttribForAccountCodeRequest` (update).
 * See backend/src/Accounting.Application/AttribForAccountCodes/Commands/CreateAttribForAccountCode/CreateAttribForAccountCodeCommand.cs
 * and backend/src/Accounting.Api/Controllers/AttribForAccountCodesController.cs.
 */
export interface AttribForAccountCodeWritePayload {
  accountCodeId: string;
  attribBoxNo: boolean;
  flag: boolean;
  lenAtr: number;
  attribSum: boolean;
  controlId: boolean | null;
  year: string;
}

export const attribForAccountCodesApi = createResourceApi<
  AttribForAccountCodeDto,
  AttribForAccountCodeWritePayload,
  AttribForAccountCodeWritePayload
>('attrib-for-account-codes');
