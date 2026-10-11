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
  // برنامهٔ مرجع (add-base-feature-group): کد و تفصیلی الزامی، کد فقط عدد. سقف ۳ = ستون اوراکل.
  identityGroupsCode: z
    .string()
    .trim()
    .min(1, 'کد گروه الزامی است')
    .regex(/^[0-9]+$/, 'کد گروه فقط عدد است')
    .max(3, 'کد گروه حداکثر ۳ رقم است'),
  /** ردیف سندی که این تفصیلی را در هر سطحی دارد فرم این ویژگی را می‌خواهد. */
  tafsiliId: z.string().min(1, 'انتخاب تفصیلی الزامی است'),
});

export type IdentityGroupFormValues = z.infer<typeof identityGroupFormSchema>;

export const emptyIdentityGroupFormValues: IdentityGroupFormValues = {
  identityGroupsDesc: '',
  identityGroupsCode: '',
  tafsiliId: '',
};

export function identityGroupDtoToFormValues(dto: IdentityGroupDto): IdentityGroupFormValues {
  return {
    identityGroupsDesc: dto.identityGroupsDesc ?? '',
    identityGroupsCode: dto.identityGroupsCode ?? '',
    tafsiliId: dto.tafsiliId ?? '',
  };
}

export function identityGroupFormValuesToPayload(values: IdentityGroupFormValues): IdentityGroupWritePayload {
  return {
    identityGroupsDesc: values.identityGroupsDesc,
    identityGroupsCode: values.identityGroupsCode || null,
    tafsiliId: values.tafsiliId || null,
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
  // SUBGRPS_LEN is Oracle NUMBER(2) — max 99 (the server validator enforces the same). The lower
  // bound is 1 because a zero-length value could never hold anything.
  // Plain z.number() with `valueAsNumber` at the register site, NOT z.coerce.number(): coerce
  // makes the schema's input and output types differ, which zodResolver cannot reconcile with
  // RHF's single TFieldValues. Note `tsc --noEmit` accepts the coerce form and only
  // `npm run build` (tsc -b) rejects it, so a typecheck alone does not catch this.
  subgrpsLen: z
    .number({ message: 'طول باید عدد باشد' })
    .int('طول باید عدد صحیح باشد')
    .min(1, 'طول حداقل ۱ است')
    .max(99, 'طول حداکثر ۹۹ است'),
  sumFlag: z.boolean(),
  // Non-nullable server-side, so no null branch here (unlike subgrpsType below).
  fixed: z
    .number({ message: 'نوع زیرگروه الزامی است' })
    .refine((v) => IDENTITY_SUB_GROUP_KIND_VALUES.includes(v), 'نوع زیرگروه نامعتبر است'),
  // برنامهٔ مرجع (add-base-feature): «حالت» و کد الزامی، کد فقط عدد؛ سقف ۲ = ستون اوراکل.
  subgrpsType: enumFieldSchema(IDENTITY_SUB_GROUP_TYPE_VALUES, 'حالت نامعتبر است').refine(
    // `: boolean` stops TS inferring a type predicate, which would narrow the output type and
    // break zodResolver's single TFieldValues (same issue as z.coerce above).
    (v): boolean => v !== null,
    'انتخاب حالت الزامی است',
  ),
  identySubGroupsCode: z
    .string()
    .trim()
    .min(1, 'کد ویژگی الزامی است')
    .regex(/^[0-9]+$/, 'کد ویژگی فقط عدد است')
    .max(2, 'کد ویژگی حداکثر ۲ رقم است'),
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
