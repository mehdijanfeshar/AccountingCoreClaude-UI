/**
 * Mirrors Accounting.Api's AttribForAccountCodeDto exactly (camelCase over the wire). The
 * business meaning of `attribBoxNo`/`flag`/`lenAtr`/`attribSum`/`controlId` is NOT documented
 * anywhere in the backend (candidates for the project's known bool/enum scaffolding bug) — see
 * `schema.ts` in this feature for how they're labelled in the UI.
 */
export interface AttribForAccountCodeDto {
  id: string; // guid
  accountCodeId: string;
  attribBoxNo: boolean;
  flag: boolean;
  lenAtr: number; // byte (0-255)
  attribSum: boolean;
  controlId: boolean | null;
  vahedCode: string;
  year: string;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
