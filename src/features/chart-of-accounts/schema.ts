import { z } from 'zod';
import type { AccountCodeWritePayload } from './api';
import type { AccountCodeDto } from '../../types/accountCode';
import { TYPE_ACC_CODE_VALUES, TYPE_ACTION_VALUES, TYPE_ACTIVITY_VALUES, TYPE_CODE_VALUES } from './accountCodeEnums';

/**
 * UX-presentation validation only, mirroring `CreateAccountCodeCommandValidator` /
 * `UpdateAccountCodeCommandValidator` (both purely syntactic — see their XML docs: hierarchy
 * rules and required-detail were deliberately discarded server-side and must NOT be
 * re-invented here). `parentId`/`sourceAndConsumeId`/`identyGroupsId` are plain nullable
 * guid strings — no format assertion beyond "picked from a real row via the picker dialog".
 *
 * `typeCode`/`typeActivity`/`typeAccCode`/`typeAction` (phase 25/26): each accepts `null` plus
 * only the values documented in `accountCodeEnums.ts` — matching the backend's `.IsInEnum()`
 * (no `.NotNull()`, so `null` stays valid). `typeActivity` deliberately accepts its *entire*
 * 1..7 range regardless of this row's `typeCode` level: the reference project restricts group
 * rows to 1..3, but our own Legacy data already violates that rule (see CLAUDE.md risk #13),
 * and the backend validator intentionally does not enforce it either — the frontend must not
 * be stricter than the contract.
 */
function enumFieldSchema(allowedValues: readonly number[], message: string) {
  return z
    .number()
    .refine((value) => allowedValues.includes(value), { message })
    .nullable();
}

export const accountCodeFormSchema = z.object({
  accCode: z
    .string()
    .trim()
    .min(1, 'کد حساب الزامی است')
    .max(6, 'کد حساب حداکثر ۶ کاراکتر است'),
  accCodeName: z
    .string()
    .trim()
    .min(1, 'عنوان حساب الزامی است')
    .max(200, 'عنوان حساب حداکثر ۲۰۰ کاراکتر است'),
  parentId: z.string().nullable(),
  parentLabel: z.string().nullable().optional(),
  moInforClose: z
    .string()
    .trim()
    .max(6, 'حداکثر ۶ کاراکتر است')
    .optional()
    .or(z.literal('')),
  typeCode: enumFieldSchema(TYPE_CODE_VALUES, 'سطح کد حساب نامعتبر است'),
  typeActivity: enumFieldSchema(TYPE_ACTIVITY_VALUES, 'ماهیت حساب نامعتبر است'),
  typeAccCode: enumFieldSchema(TYPE_ACC_CODE_VALUES, 'نوع حساب نامعتبر است'),
  typeAction: enumFieldSchema(TYPE_ACTION_VALUES, 'کنترل خلاف ماهیت نامعتبر است'),
});

export type AccountCodeFormValues = z.infer<typeof accountCodeFormSchema>;

export const emptyAccountCodeFormValues: AccountCodeFormValues = {
  accCode: '',
  accCodeName: '',
  parentId: null,
  parentLabel: null,
  moInforClose: '',
  typeCode: null,
  typeActivity: null,
  typeAccCode: null,
  typeAction: null,
};

export function accountCodeDtoToFormValues(
  dto: AccountCodeDto,
  parentLabel: string | null,
): AccountCodeFormValues {
  return {
    accCode: dto.accCode ?? '',
    accCodeName: dto.accCodeName ?? '',
    parentId: dto.parentId,
    parentLabel,
    moInforClose: dto.moInforClose ?? '',
    typeCode: dto.typeCode,
    typeActivity: dto.typeActivity,
    typeAccCode: dto.typeAccCode,
    typeAction: dto.typeAction,
  };
}

/**
 * `sourceAndConsumeId`/`identyGroupsId` are deliberately NOT exposed as form fields (no
 * picker UI was specced for either lookup) — always sent as `null`. Documented as an open
 * item in the completion report rather than guessing a raw-guid text input for them.
 */
export function accountCodeFormValuesToPayload(values: AccountCodeFormValues): AccountCodeWritePayload {
  return {
    accCode: values.accCode.trim(),
    accCodeName: values.accCodeName.trim(),
    parentId: values.parentId,
    moInforClose: values.moInforClose?.trim() ? values.moInforClose.trim() : null,
    typeCode: values.typeCode,
    typeActivity: values.typeActivity,
    typeAccCode: values.typeAccCode,
    typeAction: values.typeAction,
    sourceAndConsumeId: null,
    identyGroupsId: null,
  };
}
