import { z } from 'zod';
import type { AccountCodeWritePayload } from './api';
import type { AccountCodeDto } from '../../types/accountCode';
import { booleanToTriState, triStateToBoolean, type TriStateValue } from './TriStateToggle';

/**
 * UX-presentation validation only, mirroring `CreateAccountCodeCommandValidator` /
 * `UpdateAccountCodeCommandValidator` (both purely syntactic — see their XML docs: hierarchy
 * rules and required-detail were deliberately discarded server-side and must NOT be
 * re-invented here). `parentId`/`sourceAndConsumeId`/`identyGroupsId` are plain nullable
 * guid strings — no format assertion beyond "picked from a real row via the picker dialog".
 */
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
  typeCode: z.enum(['true', 'false', '']),
  typeActivity: z.enum(['true', 'false', '']),
  typeAccCode: z.enum(['true', 'false', '']),
  typeAction: z.enum(['true', 'false', '']),
});

export type AccountCodeFormValues = z.infer<typeof accountCodeFormSchema>;

export const emptyAccountCodeFormValues: AccountCodeFormValues = {
  accCode: '',
  accCodeName: '',
  parentId: null,
  parentLabel: null,
  moInforClose: '',
  typeCode: '',
  typeActivity: '',
  typeAccCode: '',
  typeAction: '',
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
    typeCode: booleanToTriState(dto.typeCode),
    typeActivity: booleanToTriState(dto.typeActivity),
    typeAccCode: booleanToTriState(dto.typeAccCode),
    typeAction: booleanToTriState(dto.typeAction),
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
    typeCode: triStateToBoolean(values.typeCode as TriStateValue),
    typeActivity: triStateToBoolean(values.typeActivity as TriStateValue),
    typeAccCode: triStateToBoolean(values.typeAccCode as TriStateValue),
    typeAction: triStateToBoolean(values.typeAction as TriStateValue),
    sourceAndConsumeId: null,
    identyGroupsId: null,
  };
}
