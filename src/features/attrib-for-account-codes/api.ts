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
  // Plain box number (0..9), NOT an enum — see `../../types/attribForAccountCode.ts`.
  attribBoxNo: number;
  // Phase 27: real integer enums on the wire — see `../../types/legacyEnums.ts`.
  // `flag`/`attribSum` are non-nullable on the backend; `controlId` is nullable.
  flag: number;
  lenAtr: number;
  attribSum: number;
  controlId: number | null;
  year: string;
}

export const attribForAccountCodesApi = createResourceApi<
  AttribForAccountCodeDto,
  AttribForAccountCodeWritePayload,
  AttribForAccountCodeWritePayload
>('attrib-for-account-codes');
