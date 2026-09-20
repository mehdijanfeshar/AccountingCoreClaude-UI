/**
 * Mirrors Accounting.Api's VoucherHeadDto exactly (camelCase over the wire).
 * Do not add/remove/rename fields by guessing — re-derive from the
 * api-contract agent's OpenAPI output if this ever needs to change.
 *
 * Dates (`dateDoc`, `year`) are kept as plain strings on purpose: the
 * backend stores Jalali/Shamsi dates as `string`, not `DateTime`. Never
 * guess a date-parsing/formatting transform here.
 */
export interface VoucherHeadDto {
  id: string; // guid
  docNum: string | null;
  dateDoc: string | null;
  // TODO(backend risk #2): actually a multi-valued enum, typed boolean|null by a known backend bug
  /** `DocLife`: 1=یادداشت, 2=موقت, 3=بررسی‌شده, 4=تأیید دائم. Was wrongly typed `boolean` until the backend `bool`→enum fix. */
  docLife: number | null;
  headDesc: string | null;
  apendix: string | null;
  systemTypeId: string | null;
  flagState: number | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  vahedCode: string | null;
  year: string | null;
  isDeleted: boolean | null;
  attachFileName: string | null;
  atfNum: string | null;
  isAutomatic: boolean | null;
  sndVahedCode: string | null;
  parentHeadId: string | null;
  globalNumber: string | null;
}
