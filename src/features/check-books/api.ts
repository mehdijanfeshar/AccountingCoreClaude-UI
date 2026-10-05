import { createResourceApi } from '../../lib/api/createResourceApi';
import { apiClient } from '../../lib/api/client';
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

/** یک برگ چک در «اوراق چک» دسته‌چک — `ChequeLeafDto`. `paperDescription` = بابت. */
export interface ChequeLeafDto {
  checkId: string;
  chequeNo: string;
  chequeDate: string | null;
  payTo: string | null;
  paperDescription: string | null;
  isCanceled: boolean;
  isPrinted: boolean;
  voucherHeadId: string | null;
  voucherNumber: string | null;
  voucherDate: string | null;
  amount: number | null;
  approvalState: 1 | 2 | 3 | 4 | null;
}

export const checkBookLeavesApi = {
  list: (checkBookId: string) =>
    apiClient.get<ChequeLeafDto[]>(`/check-books/${checkBookId}/leaves`).then((r) => r.data),
  /** ساخت برگ‌های جاافتادهٔ دسته‌چک‌های قدیمی؛ تعداد برگ تازه. */
  generate: (checkBookId: string) =>
    apiClient.post<number>(`/check-books/${checkBookId}/generate-leaves`).then((r) => r.data),
};
