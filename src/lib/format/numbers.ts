/**
 * Small, dependency-free helpers for Persian/Latin digit conversion and
 * thousands-grouping.
 *
 * Intended consumer: Task 2 (voucher entry / account coding forms) for
 * numeric and money fields.
 *
 * ⚠️ Hard rule (per task spec / CLAUDE.md): whatever gets SENT to the
 * backend must be plain Latin-digit text (e.g. "1234000"), never Persian
 * digits or grouping separators. Use `normalizeNumericInput` (or
 * `toLatinDigits`) before calling `setValue()` / building the request body —
 * `formatThousands` / `toPersianDigits` are DISPLAY-ONLY and must never be
 * fed back into a form value or API payload.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits in a string to plain
 * Latin digits. Everything else is left untouched.
 */
export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(ch);
    if (persianIndex !== -1) return String(persianIndex);
    const arabicIndex = ARABIC_DIGITS.indexOf(ch);
    return arabicIndex !== -1 ? String(arabicIndex) : ch;
  });
}

/** Converts plain Latin digits (0-9) in a string/number to Persian digits, for DISPLAY only. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/**
 * Cleans a user-typed numeric string down to Latin digits/sign/decimal
 * point only — the shape safe to hand to React Hook Form / zod / the API.
 * Does not round, group, or otherwise reformat the value.
 */
export function normalizeNumericInput(value: string): string {
  return toLatinDigits(value).replace(/[^\d.-]/g, '');
}

/**
 * Formats a number (or numeric string) with Persian digits and
 * thousands-grouping, for DISPLAY only (read-only table cells, inline
 * previews next to an input, etc).
 *
 * Never feed this output back into a form value or API payload — use
 * `normalizeNumericInput` / `toLatinDigits` for that direction instead.
 */
export function formatThousands(value: number | string): string {
  const numeric = typeof value === 'number' ? value : Number(toLatinDigits(value));
  if (Number.isNaN(numeric)) return String(value);
  return numeric.toLocaleString('fa-IR');
}
