import { z } from 'zod';

/**
 * Shared Zod builder for a nullable integer-enum form field, mirroring the backend's
 * `.IsInEnum()` FluentValidation rule (no `.NotNull()`, so `null` stays valid). UX-presentation
 * validation only — see `features/chart-of-accounts/schema.ts` for the original instance of this
 * pattern (phase 25/26) and `types/legacyEnums.ts` for the option/value tables that feed it.
 */
export function enumFieldSchema(allowedValues: readonly number[], message: string) {
  return z
    .number()
    .refine((value) => allowedValues.includes(value), { message })
    .nullable();
}

/**
 * Same as `enumFieldSchema` but for the handful of Legacy columns that are non-nullable on the
 * backend (`AttribForAccountCode.Flag` / `AttribSum`) — the Select for these must not offer a
 * "not selected" option, and Zod must not allow `null` either.
 */
export function nonNullableEnumFieldSchema(allowedValues: readonly number[], message: string) {
  return z.number().refine((value) => allowedValues.includes(value), { message });
}
