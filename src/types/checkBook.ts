/**
 * Mirrors Accounting.Api's CheckBookDto exactly (camelCase over the wire) — `TB_CHECKBOOK`
 * (دسته‌چک). See backend/src/Accounting.Application/CheckBooks/Queries/CheckBookDto.cs.
 */
export interface CheckBookDto {
  id: string; // guid
  accountId: string; // guid — TB_ACCOUNT (bank account), NOT the chart-of-accounts node
  checkBookTitle: string | null;
  checkBookDate: string;
  fromCheckNumber: string;
  toCheckNumber: string;
  checkTypeId: string | null; // guid — TB_CHECK_TYPE
  vahedCode: string | null;
  // Phase 27: real nullable-integer enum on the wire (`CheckType`: 1=چک صوری, 2=چک واقعی) — was
  // a buggy `bool|null`. Value/label table: `../types/legacyEnums.ts`.
  checkBookType: number | null;
  serial: string | null;
  createdDate: string;
  updatedDate: string | null;
  addUserId: string;
  changeUserId: string | null;
  isDeleted: boolean;
}
