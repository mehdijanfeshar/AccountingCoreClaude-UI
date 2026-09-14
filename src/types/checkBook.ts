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
  // TODO(backend risk #2): NUMBER(1) typed boolean|null by a known backend bug, unverified enum.
  checkBookType: boolean | null;
  serial: string | null;
  createdDate: string;
  updatedDate: string | null;
  addUserId: string;
  changeUserId: string | null;
  isDeleted: boolean;
}
