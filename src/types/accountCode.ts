/**
 * Mirrors Accounting.Api's AccountCodeDto exactly (camelCase over the wire).
 * Do not add/remove/rename fields by guessing — re-derive from the
 * api-contract agent's OpenAPI output if this ever needs to change.
 */
export interface AccountCodeDto {
  id: string; // guid
  // Phase 25/26: real nullable-integer enum on the wire (no JsonStringEnumConverter — raw
  // number, not a name string). Value/label tables:
  // `../features/chart-of-accounts/accountCodeEnums.ts`. Typed as plain `number` (not a
  // literal union) because pre-existing Legacy rows can carry a value outside the documented
  // option list — `getTypeCodeLabel` etc. handle that defensively.
  typeCode: number | null;
  parentId: string | null;
  accCode: string | null;
  accCodeName: string | null;
  // See `typeCode` comment above — same enum shape.
  typeActivity: number | null;
  sourceAndConsumeId: string | null;
  identyGroupsId: string | null;
  // See `typeCode` comment above — same enum shape.
  typeAccCode: number | null;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
  moInforClose: string | null;
  // See `typeCode` comment above — same enum shape.
  typeAction: number | null;
}
