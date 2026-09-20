import { z } from 'zod';
import type { IdentityGroupWritePayload, IdentitySubGroupWritePayload } from './api';
import type { IdentityGroupDto, IdentitySubGroupDto } from '../../types/identity';
import { enumFieldSchema } from '../../lib/validation/enumFieldSchema';
import {
  IDENTITY_SUB_GROUP_KIND_VALUES,
  IDENTITY_SUB_GROUP_TYPE_VALUES,
} from '../../types/legacyEnums';

/**
 * UX-presentation validation only, mirroring the backend validators (which are themselves purely
 * syntactic — Legacy enforces very little here).
 */

// --- گروه شناسنامه ---------------------------------------------------------------------------

export const identityGroupFormSchema = z.object({
  identityGroupsDesc: z
    .string()
    .trim()
    .min(1, 'شرح گروه الزامی است')
    .max(100, 'شرح گروه حداکثر ۱۰۰ کاراکتر است'),
  identityGroupsCode: z.string().trim().max(10, 'کد گروه حداکثر ۱۰ کاراکتر است'),
});

export type IdentityGroupFormValues = z.infer<typeof identityGroupFormSchema>;

export const emptyIdentityGroupFormValues: IdentityGroupFormValues = {
  identityGroupsDesc: '',
  identityGroupsCode: '',
};

export function identityGroupDtoToFormValues(dto: IdentityGroupDto): IdentityGroupFormValues {
  return {
    identityGroupsDesc: dto.identityGroupsDesc ?? '',
    identityGroupsCode: dto.identityGroupsCode ?? '',
  };
}

export function identityGroupFormValuesToPayload(values: IdentityGroupFormValues): IdentityGroupWritePayload {
  return {
    identityGroupsDesc: values.identityGroupsDesc,
    identityGroupsCode: values.identityGroupsCode || null,
    // Not exposed in the form: the reference app does not set it here either, and inventing a
    // تفصیلی picker for it would be guessing at a business rule nobody has stated.
    tafsiliId: null,
  };
}

// --- زیرگروه شناسنامه ------------------------------------------------------------------------

export const identitySubGroupFormSchema = z.object({
  identyGroupsId: z.string().trim().min(1, 'گروه شناسنامه الزامی است'),
  subgrpsDesc: z
    .string()
    .trim()
    .min(1, 'شرح زیرگروه الزامی است')
    .max(100, 'شرح زیرگروه حداکثر ۱۰۰ کاراکتر است'),
  // TB_IDENTITYSUBGRP.SUBGRPS_LEN is a byte, so 0..255 is the physical ceiling. The lower bound
  // is 1 because a zero-length value could never hold anything.
  // Plain z.number() with `valueAsNumber` at the register site, NOT z.coerce.number(): coerce
  // makes the schema's input and output types differ, which zodResolver cannot reconcile with
  // RHF's single TFieldValues. Note `tsc --noEmit` accepts the coerce form and only
  // `npm run build` (tsc -b) rejects it, so a typecheck alone does not catch this.
  subgrpsLen: z
    .number({ message: 'طول باید عدد باشد' })
    .int('طول باید عدد صحیح باشد')
    .min(1, 'طول حداقل ۱ است')
    .max(255, 'طول حداکثر ۲۵۵ است'),
  sumFlag: z.boolean(),
  // Non-nullable server-side, so no null branch here (unlike subgrpsType below).
  fixed: z
    .number({ message: 'نوع زیرگروه الزامی است' })
    .refine((v) => IDENTITY_SUB_GROUP_KIND_VALUES.includes(v), 'نوع زیرگروه نامعتبر است'),
  subgrpsType: enumFieldSchema(IDENTITY_SUB_GROUP_TYPE_VALUES, 'نوع مقدار نامعتبر است'),
  identySubGroupsCode: z.string().trim().max(10, 'کد زیرگروه حداکثر ۱۰ کاراکتر است'),
  year: z.string().trim().min(1, 'سال مالی الزامی است').max(4, 'سال مالی حداکثر ۴ کاراکتر است'),
});

export type IdentitySubGroupFormValues = z.infer<typeof identitySubGroupFormSchema>;

export function emptyIdentitySubGroupFormValues(
  identyGroupsId: string,
  year: string,
): IdentitySubGroupFormValues {
  return {
    identyGroupsId,
    subgrpsDesc: '',
    subgrpsLen: 1,
    sumFlag: false,
    fixed: 1,
    subgrpsType: null,
    identySubGroupsCode: '',
    year,
  };
}

export function identitySubGroupDtoToFormValues(dto: IdentitySubGroupDto): IdentitySubGroupFormValues {
  return {
    identyGroupsId: dto.identyGroupsId,
    subgrpsDesc: dto.subgrpsDesc ?? '',
    subgrpsLen: dto.subgrpsLen,
    sumFlag: dto.sumFlag,
    fixed: dto.fixed,
    subgrpsType: dto.subgrpsType,
    identySubGroupsCode: dto.identySubGroupsCode ?? '',
    year: dto.year ?? '',
  };
}

export function identitySubGroupFormValuesToPayload(
  values: IdentitySubGroupFormValues,
): IdentitySubGroupWritePayload {
  return {
    identyGroupsId: values.identyGroupsId,
    subgrpsDesc: values.subgrpsDesc,
    subgrpsLen: values.subgrpsLen,
    sumFlag: values.sumFlag,
    fixed: values.fixed,
    subgrpsType: values.subgrpsType,
    identySubGroupsCode: values.identySubGroupsCode || null,
    year: values.year,
  };
}
