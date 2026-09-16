/**
 * Mirrors Accounting.Api's AttribForAccountCodeDto exactly (camelCase over the wire).
 *
 * Phase 27: `flag`/`attribSum`/`controlId` moved from a buggy `bool`/`bool|null` wire shape to
 * real integer enums (`AttribFlag`: 1=عدد, 2=تاریخ — non-nullable; `AttribSum`: 1=جمع‌پذیر,
 * 2=جمع‌ناپذیر — non-nullable; `AttribControl`: 1=غیرصفر, 2=تاریخ — nullable). Value/label
 * tables: `../types/legacyEnums.ts`.
 *
 * `attribBoxNo` is NOT an enum — it is the attribute's plain box number (`short`,
 * `InclusiveBetween(0, 9)` server-side; the bound comes from the column's physical `NUMBER(1)`
 * width, not a known business rule). It was previously mis-typed as `boolean` here.
 *
 * `lenAtr`'s business meaning is still NOT documented anywhere in the backend.
 */
export interface AttribForAccountCodeDto {
  id: string; // guid
  accountCodeId: string;
  attribBoxNo: number; // 0..9
  flag: number;
  lenAtr: number; // byte (0-255)
  attribSum: number;
  controlId: number | null;
  vahedCode: string;
  year: string;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean | null;
}
