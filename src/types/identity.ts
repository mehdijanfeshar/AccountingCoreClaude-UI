/**
 * Mirrors the Accounting.Api DTOs of the شناسنامه family exactly (camelCase over the wire).
 *
 * ⚠️ **شناسنامه is not «حساب‌های شناسه‌دار».** The backend table names invite that confusion:
 * `TB_IDENTITY*` is شناسنامه, while حساب‌های شناسه‌دار is `TB_ATTRIBFORACCOUNTCODE` and lives in
 * `./attribForAccountCode.ts`. See docs/centralaccount-business-reference.md §۲۵ in the backend
 * repo.
 *
 * The shape is three levels:
 *   گروه شناسنامه (IdentityGroup)  → زیرگروه‌ها (IdentitySubGroup) → شناسنامه (IdentityHead)
 * A subgroup is either **ثابت** (one value per شناسنامه, carried here as `fixItems`) or **متغیر**
 * (one value per voucher line — `TB_IDENTITYDETAIL`, which has no endpoint and is not modelled
 * here at all).
 */

export interface IdentityGroupDto {
  id: string; // guid
  identityGroupsDesc: string;
  identityGroupsCode: string | null;
  tafsiliId: string | null;
  vahedCode: string;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean;
}

export interface IdentitySubGroupDto {
  id: string; // guid
  identyGroupsId: string;
  subgrpsDesc: string;
  subgrpsLen: number;
  sumFlag: boolean;
  /** `IdentitySubGroupKind`: 1=ثابت, 2=متغیر — see `./legacyEnums.ts`. Non-nullable. */
  fixed: number;
  /** `IdentitySubGroupType`: 1=تاریخ, 2=حروف فارسی, 3=عدد, 4=حروف لاتین. Nullable. */
  subgrpsType: number | null;
  identySubGroupsCode: string | null;
  vahedCode: string;
  year: string;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean;
}

/** One fixed value of a شناسنامه — the value recorded for a single ثابت subgroup. */
export interface IdentityHeadFixItemDto {
  id: string; // guid
  identitySubGroupId: string;
  /** Denormalized `subgrpsDesc`, so a form can label the field without a second fetch. */
  identitySubGroupDesc: string | null;
  value: string | null;
}

export interface IdentityHeadDto {
  id: string; // guid
  identityGroupId: string;
  /** Denormalized group description, so a list row reads without a second fetch. */
  identityGroupDesc: string | null;
  /** Assigned server-side on create; never sent by the client. */
  serial: number;
  fixItems: IdentityHeadFixItemDto[];
  vahedCode: string;
  year: string;
  createdDate: string | null;
  updatedDate: string | null;
  addUserId: string | null;
  changeUserId: string | null;
  isDeleted: boolean;
}
