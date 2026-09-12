import { z } from 'zod';
import type { TafsilGroupWritePayload } from './api';
import type { TafsilGroupDto } from '../../types/tafsilGroup';
import { booleanToTriState, triStateToBoolean, type TriStateValue } from '../../components/TriStateToggle';

/**
 * UX-presentation validation only, mirroring `CreateTafsilGroupCommandValidator` /
 * the update path's implicit rules (both purely syntactic).
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
  personType: z.enum(['true', 'false', '']),
});

export type TafsilGroupFormValues = z.infer<typeof tafsilGroupFormSchema>;

export const emptyTafsilGroupFormValues: TafsilGroupFormValues = {
  tafsilGroupCode: '',
  tafsilGroupName: '',
  personType: '',
};

export function tafsilGroupDtoToFormValues(dto: TafsilGroupDto): TafsilGroupFormValues {
  return {
    tafsilGroupCode: dto.tafsilGroupCode ?? '',
    tafsilGroupName: dto.tafsilGroupName ?? '',
    personType: booleanToTriState(dto.personType),
  };
}

export function tafsilGroupFormValuesToPayload(values: TafsilGroupFormValues): TafsilGroupWritePayload {
  return {
    tafsilGroupCode: values.tafsilGroupCode.trim(),
    tafsilGroupName: values.tafsilGroupName.trim(),
    personType: triStateToBoolean(values.personType as TriStateValue),
  };
}
