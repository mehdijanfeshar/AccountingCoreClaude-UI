import { z } from 'zod';
import type { AttribForAccountCodeWritePayload } from './api';
import type { AttribForAccountCodeDto } from '../../types/attribForAccountCode';
import { booleanToTriState, triStateToBoolean, type TriStateValue } from '../../components/TriStateToggle';

/**
 * UX-presentation validation only, mirroring `CreateAttribForAccountCodeCommandValidator`
 * (which itself has no rules on the boolean/byte fields beyond their CLR type — see api.ts doc).
 */
export const attribForAccountCodeFormSchema = z.object({
  accountCodeId: z.string().min(1, 'انتخاب حساب معین الزامی است'),
  accountCodeLabel: z.string().nullable().optional(),
  year: z.string().trim().min(1, 'سال مالی الزامی است').max(4, 'حداکثر ۴ کاراکتر است'),
  attribBoxNo: z.boolean(),
  flag: z.boolean(),
  lenAtr: z
    .string()
    .trim()
    .min(1, 'طول ویژگی الزامی است')
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    }, 'باید عددی بین ۰ تا ۲۵۵ باشد'),
  attribSum: z.boolean(),
  controlId: z.enum(['true', 'false', '']),
});

export type AttribForAccountCodeFormValues = z.infer<typeof attribForAccountCodeFormSchema>;

export function buildEmptyAttribForAccountCodeFormValues(defaultYear: string): AttribForAccountCodeFormValues {
  return {
    accountCodeId: '',
    accountCodeLabel: null,
    year: defaultYear,
    attribBoxNo: false,
    flag: false,
    lenAtr: '0',
    attribSum: false,
    controlId: '',
  };
}

export function attribForAccountCodeDtoToFormValues(
  dto: AttribForAccountCodeDto,
  accountCodeLabel: string | null,
): AttribForAccountCodeFormValues {
  return {
    accountCodeId: dto.accountCodeId,
    accountCodeLabel,
    year: dto.year ?? '',
    attribBoxNo: dto.attribBoxNo,
    flag: dto.flag,
    lenAtr: String(dto.lenAtr),
    attribSum: dto.attribSum,
    controlId: booleanToTriState(dto.controlId),
  };
}

export function attribForAccountCodeFormValuesToPayload(
  values: AttribForAccountCodeFormValues,
): AttribForAccountCodeWritePayload {
  return {
    accountCodeId: values.accountCodeId,
    attribBoxNo: values.attribBoxNo,
    flag: values.flag,
    lenAtr: Number(values.lenAtr),
    attribSum: values.attribSum,
    controlId: triStateToBoolean(values.controlId as TriStateValue),
    year: values.year.trim(),
  };
}
