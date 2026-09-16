import { createResourceApi } from '../../lib/api/createResourceApi';
import type { CheckBookDto } from '../../types/checkBook';

/**
 * Exact wire shape of `CreateCheckBookCommand` (create, minus server-assigned `VahedCode`) /
 * `UpdateCheckBookRequest` (update) — both share this field set.
 * See backend/src/Accounting.Application/CheckBooks/Commands/CreateCheckBook/CreateCheckBookCommand.cs
 * and backend/src/Accounting.Api/Controllers/CheckBooksController.cs (UpdateCheckBookRequest).
 */
export interface CheckBookWritePayload {
  accountId: string;
  checkBookTitle: string | null;
  checkBookDate: string;
  fromCheckNumber: string;
  toCheckNumber: string;
  checkTypeId: string | null;
  // Phase 27: real nullable-integer enum on the wire — see `../../types/legacyEnums.ts`.
  checkBookType: number | null;
  serial: string | null;
}

export const checkBooksApi = createResourceApi<CheckBookDto, CheckBookWritePayload, CheckBookWritePayload>(
  'check-books',
);
