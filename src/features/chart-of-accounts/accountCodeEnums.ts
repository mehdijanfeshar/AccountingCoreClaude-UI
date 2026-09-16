/**
 * Single source of truth for the four `TB_ACCOUNTCODE` enum columns that phase 25/26 moved
 * from a buggy `bool|null` wire shape to real nullable-integer enums:
 * `typeCode` / `typeActivity` / `typeAccCode` / `typeAction`.
 *
 * JSON keys did NOT change — only the value type (now a raw integer, or `null`). The backend
 * does not register a `JsonStringEnumConverter`, so numbers travel as numbers, never as
 * enum-name strings. Labels below are copied verbatim from the backend enum XML docs
 * (`Accounting.Domain.ValueObjects.TypeCodes` / `TypeActivity` / `TypeAccCode` / `TypeAction`)
 * — do not re-derive them from any other reference project.
 *
 * ⚠️ `typeActivity` intentionally has 7 values, not 3 — and its Oracle column *comment* has
 * values 1/2 swapped and is wrong. The table below is confirmed against live Oracle data
 * (`1 = بدهکار`), per CLAUDE.md open risk #2 / backend `TypeActivity.cs` XML doc.
 */

export interface AccountCodeEnumOption<TValue extends number> {
  value: TValue;
  label: string;
}

export const TYPE_CODE_OPTIONS = [
  { value: 1, label: 'گروه' },
  { value: 2, label: 'کل' },
  { value: 3, label: 'معین' },
] as const satisfies readonly AccountCodeEnumOption<number>[];

export const TYPE_ACTIVITY_OPTIONS = [
  { value: 1, label: 'بدهکار' },
  { value: 2, label: 'بستانکار' },
  { value: 3, label: 'بدهکار-بستانکار' },
  { value: 4, label: 'بدهکار-طی دوره' },
  { value: 5, label: 'بستانکار-طی دوره' },
  { value: 6, label: 'بدهکار-پایان دوره' },
  { value: 7, label: 'بستانکار-پایان دوره' },
] as const satisfies readonly AccountCodeEnumOption<number>[];

export const TYPE_ACC_CODE_OPTIONS = [
  { value: 1, label: 'موقت' },
  { value: 2, label: 'دائم' },
] as const satisfies readonly AccountCodeEnumOption<number>[];

export const TYPE_ACTION_OPTIONS = [
  { value: 1, label: 'کنترل نشود' },
  { value: 2, label: 'اخطار دهد' },
  { value: 3, label: 'ثبت نشود' },
] as const satisfies readonly AccountCodeEnumOption<number>[];

export type TypeCodeValue = (typeof TYPE_CODE_OPTIONS)[number]['value'];
export type TypeActivityValue = (typeof TYPE_ACTIVITY_OPTIONS)[number]['value'];
export type TypeAccCodeValue = (typeof TYPE_ACC_CODE_OPTIONS)[number]['value'];
export type TypeActionValue = (typeof TYPE_ACTION_OPTIONS)[number]['value'];

export const TYPE_CODE_VALUES: readonly number[] = TYPE_CODE_OPTIONS.map((o) => o.value);
export const TYPE_ACTIVITY_VALUES: readonly number[] = TYPE_ACTIVITY_OPTIONS.map((o) => o.value);
export const TYPE_ACC_CODE_VALUES: readonly number[] = TYPE_ACC_CODE_OPTIONS.map((o) => o.value);
export const TYPE_ACTION_VALUES: readonly number[] = TYPE_ACTION_OPTIONS.map((o) => o.value);

/**
 * Renders a value from one of the four option lists above to its Persian label.
 * - `null`/`undefined` -> "تعیین‌نشده" (not set).
 * - Any value outside the option list -> "نامشخص (<value>)" instead of throwing — Legacy data
 *   predating this enum's introduction (or a future out-of-range write) must still render
 *   safely, not crash the list/form.
 */
function labelFromOptions<TValue extends number>(
  options: readonly AccountCodeEnumOption<TValue>[],
  value: number | null | undefined,
): string {
  if (value === null || value === undefined) return 'تعیین‌نشده';
  const match = options.find((o) => o.value === value);
  return match ? match.label : `نامشخص (${value})`;
}

export function getTypeCodeLabel(value: number | null | undefined): string {
  return labelFromOptions(TYPE_CODE_OPTIONS, value);
}

export function getTypeActivityLabel(value: number | null | undefined): string {
  return labelFromOptions(TYPE_ACTIVITY_OPTIONS, value);
}

export function getTypeAccCodeLabel(value: number | null | undefined): string {
  return labelFromOptions(TYPE_ACC_CODE_OPTIONS, value);
}

export function getTypeActionLabel(value: number | null | undefined): string {
  return labelFromOptions(TYPE_ACTION_OPTIONS, value);
}
