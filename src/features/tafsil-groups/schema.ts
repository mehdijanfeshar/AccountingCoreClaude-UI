import { z } from 'zod';
import type { TafsilGroupWritePayload } from './api';
import type { TafsilGroupDto } from '../../types/tafsilGroup';
import { enumFieldSchema } from '../../lib/validation/enumFieldSchema';
import { PERSON_TYPE_VALUES } from '../../types/legacyEnums';

/**
 * UX-presentation validation only, mirroring `CreateTafsilGroupCommandValidator` /
 * the update path's implicit rules (both purely syntactic).
 *
 * Phase 27: `personType` moved from a buggy `bool|null` wire shape to a real nullable-integer
 * enum (`PersonTypes`: 1=حقیقی, 2=حقوقی, 3=سایر — shared with `tafsilis`, see
 * `../../types/legacyEnums.ts`).
 */
export const tafsilGroupFormSchema = z.object({
  tafsilGroupCode: z
    .string()
    .trim()
    .min(1, 'کد گروه الزامی است')
    .max(3, 'کد گروه حداکثر ۳ کاراکتر است'),
  tafsilGroupName: z
    .string()
    .trim()
    .min(1, 'عنوان گروه الزامی است')
    .max(200, 'عنوان گروه حداکثر ۲۰۰ کاراکتر است'),
  personType: enumFieldSchema(PERSON_TYPE_VALUES, 'نوع شخص نامعتبر است'),
});

export type TafsilGroupFormValues = z.infer<typeof tafsilGroupFormSchema>;

export const emptyTafsilGroupFormValues: TafsilGroupFormValues = {
  tafsilGroupCode: '',
  tafsilGroupName: '',
  personType: null,
};

export function tafsilGroupDtoToFormValues(dto: TafsilGroupDto): TafsilGroupFormValues {
  return {
    tafsilGroupCode: dto.tafsilGroupCode ?? '',
    tafsilGroupName: dto.tafsilGroupName ?? '',
    personType: dto.personType,
  };
}

export function tafsilGroupFormValuesToPayload(values: TafsilGroupFormValues): TafsilGroupWritePayload {
  return {
    tafsilGroupCode: values.tafsilGroupCode.trim(),
    tafsilGroupName: values.tafsilGroupName.trim(),
    personType: values.personType,
  };
}
