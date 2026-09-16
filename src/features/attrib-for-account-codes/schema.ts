import { z } from 'zod';
import type { AttribForAccountCodeWritePayload } from './api';
import type { AttribForAccountCodeDto } from '../../types/attribForAccountCode';
import { enumFieldSchema, nonNullableEnumFieldSchema } from '../../lib/validation/enumFieldSchema';
import { ATTRIB_CONTROL_VALUES, ATTRIB_FLAG_VALUES, ATTRIB_SUM_VALUES } from '../../types/legacyEnums';

/**
 * UX-presentation validation only, mirroring `CreateAttribForAccountCodeCommandValidator`.
 *
 * Phase 27:
 * - `flag` moved from `bool` to a real NON-nullable integer enum (`AttribFlag`: 1=عدد, 2=تاریخ).
 * - `attribSum` moved from `bool` to a real NON-nullable integer enum (`AttribSum`: 1=جمع‌پذیر,
 *   2=جمع‌ناپذیر).
 * - `controlId` moved from a tri-state `bool|null` to a real NULLABLE integer enum
 *   (`AttribControl`: 1=غیرصفر, 2=تاریخ).
 * - `attribBoxNo` moved from `bool` to a plain integer (NOT an enum) — the attribute's box
 *   number. Backend type is `short` with a validator rule `InclusiveBetween(0, 9)` (the bound
 *   comes from the column's physical `NUMBER(1)` width, not a known business rule). Kept as a
 *   string form field (Legacy digit-string convention used throughout this codebase — see
 *   `lenAtr` immediately below) and converted to `number` only in the payload.
 *
 * `lenAtr`'s business meaning is still NOT documented anywhere in the backend.
 */
export const attribForAccountCodeFormSchema = z.object({
  accountCodeId: z.string().min(1, 'انتخاب حساب معین الزامی است'),
  accountCodeLabel: z.string().nullable().optional(),
  year: z.string().trim().min(1, 'سال مالی الزامی است').max(4, 'حداکثر ۴ کاراکتر است'),
  attribBoxNo: z
    .string()
    .trim()
    .min(1, 'شماره جعبه الزامی است')
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 9;
    }, 'باید عددی بین ۰ تا ۹ باشد'),
  flag: nonNullableEnumFieldSchema(ATTRIB_FLAG_VALUES, 'Flag نامعتبر است'),
  lenAtr: z
    .string()
    .trim()
    .min(1, 'طول ویژگی الزامی است')
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    }, 'باید عددی بین ۰ تا ۲۵۵ باشد'),
  attribSum: nonNullableEnumFieldSchema(ATTRIB_SUM_VALUES, 'AttribSum نامعتبر است'),
  controlId: enumFieldSchema(ATTRIB_CONTROL_VALUES, 'ControlId نامعتبر است'),
});

export type AttribForAccountCodeFormValues = z.infer<typeof attribForAccountCodeFormSchema>;

export function buildEmptyAttribForAccountCodeFormValues(defaultYear: string): AttribForAccountCodeFormValues {
  return {
    accountCodeId: '',
    accountCodeLabel: null,
    year: defaultYear,
    attribBoxNo: '0',
    flag: 1,
    lenAtr: '0',
    attribSum: 1,
    controlId: null,
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
    attribBoxNo: String(dto.attribBoxNo),
    flag: dto.flag,
    lenAtr: String(dto.lenAtr),
    attribSum: dto.attribSum,
    controlId: dto.controlId,
  };
}

export function attribForAccountCodeFormValuesToPayload(
  values: AttribForAccountCodeFormValues,
): AttribForAccountCodeWritePayload {
  return {
    accountCodeId: values.accountCodeId,
    attribBoxNo: Number(values.attribBoxNo),
    flag: values.flag,
    lenAtr: Number(values.lenAtr),
    attribSum: values.attribSum,
    controlId: values.controlId,
    year: values.year.trim(),
  };
}
