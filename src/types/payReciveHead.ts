/**
 * Mirrors Accounting.Api's PayReciveHeadDto exactly (camelCase over the wire) — `TB_PAYRECIVHEAD`
 * (سرسند دریافت و پرداخت). HEAD ONLY — carries no `TB_PAYRECIVDETAIL` rows/totals; see
 * backend/src/Accounting.Application/PayReciveHeads/Queries/PayReciveHeadDto.cs.
 */
export interface PayReciveHeadDto {
  id: string; // guid
  payReciveCode: string;
  payReciveDate: string;
  payReciveDescription: string;
  // CONFIRMED bool|null-should-be-enum (real values 1=پرداخت 2=دریافت 3=همه) — the third value is
  // unreachable through this API. Not re-typed here; a breaking API-contract change out of scope.
  payReciveType: boolean | null;
  vahedCode: string;
  year: string;
  voucherHeadId: string | null; // guid — the accounting voucher this document was turned into, if any
  createdDate: string;
  updatedDate: string | null;
  addUserId: string;
  changeUserId: string | null;
  isDeleted: boolean;
}
