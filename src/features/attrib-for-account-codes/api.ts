import { createResourceApi, type ListParams } from '../../lib/api/createResourceApi';
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

/**
 * Server-side filters for the "حساب‌های شناسه‌دار" list, mirroring
 * `GetAttribForAccountCodesQuery`'s query-string parameters exactly.
 *
 * ⚠️ There is deliberately no unit (`vahedCode`) filter, and one must never be added: the
 * backend takes the caller's unit from the token. See rule 2 in `CLAUDE.md`.
 *
 * `moinCodeFrom`/`moinCodeTo` are compared as plain strings server-side, which is correct
 * because a معین code is always exactly 6 digits. An inverted range is rejected with a 400
 * rather than silently returning nothing.
 */
export interface AttribForAccountCodeListParams extends ListParams {
  moinCodeFrom?: string;
  moinCodeTo?: string;
  attribSum?: number;
  flag?: number;
  year?: string;
}

export const attribForAccountCodesApi = createResourceApi<
  AttribForAccountCodeDto,
  AttribForAccountCodeWritePayload,
  AttribForAccountCodeWritePayload,
  AttribForAccountCodeListParams
>('attrib-for-account-codes');
