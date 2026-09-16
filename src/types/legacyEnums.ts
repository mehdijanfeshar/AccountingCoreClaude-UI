/**
 * Shared option/label tables for the Legacy `NUMBER(1)` columns that phase 27 moved from a
 * buggy `bool|null` wire shape to real nullable-integer enums, mirroring the pattern
 * `features/chart-of-accounts/accountCodeEnums.ts` established in phase 25/26.
 *
 * Covers fields spread across multiple independent features (`tafsilis`, `tafsil-groups`,
 * `check-books`, `pay-recive-heads`, `attrib-for-account-codes`) — kept here, not duplicated
 * per-feature, because `PersonTypes` is shared by two features verbatim and `تاریخ` appears as
 * a label in two unrelated enums (`AttribFlag`/`AttribControl`).
 *
 * JSON keys did NOT change — only the value type (now a raw integer, or `null` where the
 * backend allows it). Labels below are copied verbatim from the backend enum XML docs
 * (`Accounting.Domain.ValueObjects.TafsiliActiveState` / `PersonTypes` / `Owners` /
 * `VahedCategory` / `CheckType` / `PayRecivType` / `AttribFlag` / `AttribSum` / `AttribControl`)
 * — do not re-derive them from any other reference project.
 */

export interface LegacyEnumOption<TValue extends number> {
  value: TValue;
  label: string;
}

export const TAFSILI_ACTIVE_STATE_OPTIONS = [
  { value: 1, label: 'فعال' },
  { value: 2, label: 'غیرفعال' },
] as const satisfies readonly LegacyEnumOption<number>[];

export const PERSON_TYPE_OPTIONS = [
  { value: 1, label: 'حقیقی' },
  { value: 2, label: 'حقوقی' },
  { value: 3, label: 'سایر' },
] as const satisfies readonly LegacyEnumOption<number>[];

/**
 * ⚠️ The Oracle column comment on `TB_TAFSILI.OWNER` says the opposite (`2=setad 1=vahed`) and
 * is stale/wrong. The project owner explicitly confirmed `1=سراسری`/`2=داخلی` is correct
 * (2026-09-16) — do NOT "fix" this back to match the column comment.
 */
export const OWNER_OPTIONS = [
  { value: 1, label: 'سراسری' },
  { value: 2, label: 'داخلی' },
] as const satisfies readonly LegacyEnumOption<number>[];

export const VAHED_CATEGORY_OPTIONS = [
  { value: 1, label: 'بیمه' },
  { value: 2, label: 'درمان' },
  { value: 3, label: 'همه' },
] as const satisfies readonly LegacyEnumOption<number>[];

export const CHECK_TYPE_OPTIONS = [
  { value: 1, label: 'چک صوری' },
  { value: 2, label: 'چک واقعی' },
] as const satisfies readonly LegacyEnumOption<number>[];

export const PAY_RECIV_TYPE_OPTIONS = [
  { value: 1, label: 'پرداخت' },
  { value: 2, label: 'دریافت' },
  { value: 3, label: 'همه' },
] as const satisfies readonly LegacyEnumOption<number>[];

/** Non-nullable on the backend. */
export const ATTRIB_FLAG_OPTIONS = [
  { value: 1, label: 'عدد' },
  { value: 2, label: 'تاریخ' },
] as const satisfies readonly LegacyEnumOption<number>[];

/** Non-nullable on the backend. */
export const ATTRIB_SUM_OPTIONS = [
  { value: 1, label: 'جمع‌پذیر' },
  { value: 2, label: 'جمع‌ناپذیر' },
] as const satisfies readonly LegacyEnumOption<number>[];

/** Nullable on the backend (unlike `AttribFlag`/`AttribSum` above). */
export const ATTRIB_CONTROL_OPTIONS = [
  { value: 1, label: 'غیرصفر' },
  { value: 2, label: 'تاریخ' },
] as const satisfies readonly LegacyEnumOption<number>[];

export type TafsiliActiveStateValue = (typeof TAFSILI_ACTIVE_STATE_OPTIONS)[number]['value'];
export type PersonTypeValue = (typeof PERSON_TYPE_OPTIONS)[number]['value'];
export type OwnerValue = (typeof OWNER_OPTIONS)[number]['value'];
export type VahedCategoryValue = (typeof VAHED_CATEGORY_OPTIONS)[number]['value'];
export type CheckTypeValue = (typeof CHECK_TYPE_OPTIONS)[number]['value'];
export type PayRecivTypeValue = (typeof PAY_RECIV_TYPE_OPTIONS)[number]['value'];
export type AttribFlagValue = (typeof ATTRIB_FLAG_OPTIONS)[number]['value'];
export type AttribSumValue = (typeof ATTRIB_SUM_OPTIONS)[number]['value'];
export type AttribControlValue = (typeof ATTRIB_CONTROL_OPTIONS)[number]['value'];

export const TAFSILI_ACTIVE_STATE_VALUES: readonly number[] = TAFSILI_ACTIVE_STATE_OPTIONS.map((o) => o.value);
export const PERSON_TYPE_VALUES: readonly number[] = PERSON_TYPE_OPTIONS.map((o) => o.value);
export const OWNER_VALUES: readonly number[] = OWNER_OPTIONS.map((o) => o.value);
export const VAHED_CATEGORY_VALUES: readonly number[] = VAHED_CATEGORY_OPTIONS.map((o) => o.value);
export const CHECK_TYPE_VALUES: readonly number[] = CHECK_TYPE_OPTIONS.map((o) => o.value);
export const PAY_RECIV_TYPE_VALUES: readonly number[] = PAY_RECIV_TYPE_OPTIONS.map((o) => o.value);
export const ATTRIB_FLAG_VALUES: readonly number[] = ATTRIB_FLAG_OPTIONS.map((o) => o.value);
export const ATTRIB_SUM_VALUES: readonly number[] = ATTRIB_SUM_OPTIONS.map((o) => o.value);
export const ATTRIB_CONTROL_VALUES: readonly number[] = ATTRIB_CONTROL_OPTIONS.map((o) => o.value);

/**
 * Renders a value from one of the option lists above to its Persian label.
 * - `null`/`undefined` -> "تعیین‌نشده" (not set).
 * - Any value outside the option list -> "نامشخص (<value>)" instead of throwing — Legacy data
 *   predating this enum's introduction (or a future out-of-range write) must still render
 *   safely, not crash the list/form.
 */
function labelFromOptions<TValue extends number>(
  options: readonly LegacyEnumOption<TValue>[],
  value: number | null | undefined,
): string {
  if (value === null || value === undefined) return 'تعیین‌نشده';
  const match = options.find((o) => o.value === value);
  return match ? match.label : `نامشخص (${value})`;
}

export function getTafsiliActiveStateLabel(value: number | null | undefined): string {
  return labelFromOptions(TAFSILI_ACTIVE_STATE_OPTIONS, value);
}

export function getPersonTypeLabel(value: number | null | undefined): string {
  return labelFromOptions(PERSON_TYPE_OPTIONS, value);
}

export function getOwnerLabel(value: number | null | undefined): string {
  return labelFromOptions(OWNER_OPTIONS, value);
}

export function getVahedCategoryLabel(value: number | null | undefined): string {
  return labelFromOptions(VAHED_CATEGORY_OPTIONS, value);
}

export function getCheckTypeLabel(value: number | null | undefined): string {
  return labelFromOptions(CHECK_TYPE_OPTIONS, value);
}

export function getPayRecivTypeLabel(value: number | null | undefined): string {
  return labelFromOptions(PAY_RECIV_TYPE_OPTIONS, value);
}

export function getAttribFlagLabel(value: number | null | undefined): string {
  return labelFromOptions(ATTRIB_FLAG_OPTIONS, value);
}

export function getAttribSumLabel(value: number | null | undefined): string {
  return labelFromOptions(ATTRIB_SUM_OPTIONS, value);
}

export function getAttribControlLabel(value: number | null | undefined): string {
  return labelFromOptions(ATTRIB_CONTROL_OPTIONS, value);
}
