/**
 * Deliberately partial mirror of Accounting.Api's `ChequeTypeDto` — that DTO carries 46 fields
 * (a full cheque print-layout template: fonts, pixel offsets, printer margins for every field on
 * the cheque). None of that is relevant to picking a cheque type by name for `CheckBook.checkTypeId`,
 * so only the two fields this app actually reads are modeled here. A JSON response with the other
 * 44 fields still deserializes fine against this narrower shape (unread fields are simply ignored).
 */
export interface ChequeTypeLookupDto {
  id: string; // guid
  chequeTypeTitle: string | null;
}
