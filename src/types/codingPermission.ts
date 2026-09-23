/**
 * Wire shapes for «دسترسی کدینگ حسابداری» — which kinds of organizational unit may use a given
 * حساب معین.
 *
 * Backed by `TB_WHITEANDBLACKLIST`. Mirrors
 * `backend/src/Accounting.Application/WhiteAndBlackLists/Queries/WhiteAndBlackListDto.cs` and the
 * request/response records at the bottom of `Accounting.Api/Controllers/WhiteAndBlackListsController.cs`.
 *
 * ⚠️ Two things about this table that shape the UI and must not be "simplified" away:
 *
 * 1. **The permission is keyed on unit TYPE, not on an individual unit.** A row says
 *    "بیمارستان‌ها may use معین X", not "بیمارستان معیری may". The organization-wide matrix is
 *    the point; there is no per-unit column and nothing scopes this table to the caller's unit.
 *
 * 2. **(معین, نوع واحد) is NOT unique.** Oracle's `UK_WHITEANDBLACKLIST` covers
 *    `(ACCOUNTCODE_ID, VAHEDTYPE_ID, FROMAUTHORIZEDDATE, TOAUTHORIZEDDATE)`, so the same pair may
 *    legitimately appear several times with different date windows — and on live data 291 pairs
 *    already do. Never key a list, a map or a React `key` on the pair alone; use `id`.
 */

/** `Accounting.Domain.ValueObjects.WhiteBlackListState`. */
export const CODING_PERMISSION_STATE = {
  /** مجاز به ثبت دستی و سیستمی. */
  Allowed: 1,
  /**
   * فقط مجاز به ثبت سیستمی — a user may not post an article to this معین by hand; only a
   * system-generated voucher (افتتاحیه/اختتامیه and similar) may. Confirmed by the project owner,
   * 2026-09-23.
   */
  SystemOnly: 2,
  /** به‌طور کلی غیرمجاز. */
  Blacklisted: 3,
} as const;

export type CodingPermissionState =
  (typeof CODING_PERMISSION_STATE)[keyof typeof CODING_PERMISSION_STATE];

export const CODING_PERMISSION_STATE_OPTIONS = [
  { value: CODING_PERMISSION_STATE.Allowed, label: 'مجاز کردن' },
  { value: CODING_PERMISSION_STATE.SystemOnly, label: 'محدود کردن (ثبت سیستمی)' },
] as const;

const STATE_LABELS: Record<number, string> = {
  [CODING_PERMISSION_STATE.Allowed]: 'مجاز',
  [CODING_PERMISSION_STATE.SystemOnly]: 'فقط سیستمی',
  [CODING_PERMISSION_STATE.Blacklisted]: 'غیرمجاز',
};

export function getCodingPermissionStateLabel(state: number | null | undefined): string {
  if (state == null) return '—';
  return STATE_LABELS[state] ?? `نامشخص (${state})`;
}

/** `WhiteAndBlackListDto`. The last five fields are display-only projections from JOINs. */
export interface CodingPermissionDto {
  id: string;
  accountCodeId: string;
  vahedTypeId: string | null;
  createdDate: string;
  updatedDate: string | null;
  addUserId: string;
  changeUserId: string | null;
  isDeleted: boolean | null;
  /** `YYYYMMDD` Jalali text. Populated only while the row is «مجاز». */
  fromAuthorizedDate: string | null;
  toAuthorizedDate: string | null;
  /** `YYYYMMDD` Jalali text. Populated only while the row is «فقط سیستمی». */
  fromLimitationDate: string | null;
  toLimitationDate: string | null;
  state: number | null;
  accCode: string | null;
  accCodeName: string | null;
  vahedTypeCode: string | null;
  vahedTypeName: string | null;
  vahedTypeParentCode: string | null;
}

/** `CreateWhiteAndBlackListsBulkRequest` — the cartesian grant behind «افزودن دسترسی جدید». */
export interface CodingPermissionBulkPayload {
  accountCodeIds: string[];
  vahedTypeIds: string[];
  /** `YYYYMMDD`, or null. Which column pair it lands in is decided by `state`, server-side. */
  fromDate: string | null;
  toDate: string | null;
  state: CodingPermissionState;
}

/** `CreateWhiteAndBlackListsBulkResult`. */
export interface CodingPermissionBulkResult {
  created: number;
  skipped: number;
  createdIds: string[];
}

/** `ReactivateWhiteAndBlackListRequest` — «فعال سازی مجدد». */
export interface CodingPermissionReactivatePayload {
  state: CodingPermissionState;
  fromDate: string | null;
  toDate: string | null;
}

/** `UpdateWhiteAndBlackListRequest` — the per-row edit. Takes all four dates, unlike the bulk grant. */
export interface CodingPermissionUpdatePayload {
  accountCodeId: string;
  vahedTypeId: string | null;
  fromAuthorizedDate: string | null;
  toAuthorizedDate: string | null;
  fromLimitationDate: string | null;
  toLimitationDate: string | null;
  state: number | null;
}
