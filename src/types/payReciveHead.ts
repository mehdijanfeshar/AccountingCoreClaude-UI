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
  // Phase 27: real nullable-integer enum on the wire (`PayRecivType`: 1=پرداخت, 2=دریافت, 3=همه)
  // — was a buggy `bool|null` under which value 3 was unreachable. Value/label table:
  // `../types/legacyEnums.ts`.
  payReciveType: number | null;
  vahedCode: string;
  year: string;
  voucherHeadId: string | null; // guid — the accounting voucher this document was turned into, if any
  createdDate: string;
  updatedDate: string | null;
  addUserId: string;
  changeUserId: string | null;
  isDeleted: boolean;
}
