/**
 * Mirrors Accounting.Api's AccountCodeDto exactly (camelCase over the wire).
 * Do not add/remove/rename fields by guessing — re-derive from the
 * api-contract agent's OpenAPI output if this ever needs to change.
 */
export interface AccountCodeDto {
  id: string; // guid
  // TODO(backend risk #2): actually a multi-valued enum, typed boolean|null by a known backend bug
  typeCode: boolean | null;
  parentId: string | null;
  accCode: string | null;
  accCodeName: string | null;
  // TODO(backend risk #2): actually a multi-valued enum, typed boolean|null by a known backend bug
  typeActivity: boolean | null;
  sourceAndConsumeId: string | null;
  identyGroupsId: string | null;
  // TODO(backend risk #2): actually a multi-valued enum, typed boolean|null by a known backend bug
  typeAccCode: boolean | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
  moInforClose: string | null;
  typeAction: boolean | null;
}
