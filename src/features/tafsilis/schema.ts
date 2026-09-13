import { z } from 'zod';
import type { TafsiliWritePayload } from './api';
import type { TafsiliDto } from '../../types/tafsiliMaster';
import { booleanToTriState, triStateToBoolean, type TriStateValue } from '../../components/TriStateToggle';

/**
 * UX-presentation validation only, mirroring `CreateTafsiliCommandValidator`.
 *
 * `isActive`/`personType`/`owner`/`vahedType` are all modeled as tri-state (not a plain Switch)
 * — `IsActive` specifically is documented backend-side as a `bool?` that may actually carry a
 * third raw value (candidate for the project's known bool/enum scaffolding bug: see
 * `GetTafsiliLevelItemsQuery` XML doc, "our ISACTIVE is a bool? that may hold the value 2"), so a
 * confident on/off Switch would misrepresent data this column might already contain.
 */
/** `Accounting.Domain.ValueObjects.VahedCategory`: 1=بیمه, 2=درمان, 3=همه — '' means "تعیین نشده". */
export const TAFSIL_GROUP_LINK_VAHED_TYPE_OPTIONS = ['', '1', '2', '3'] as const;
export type TafsilGroupLinkVahedTypeValue = (typeof TAFSIL_GROUP_LINK_VAHED_TYPE_OPTIONS)[number];

export const tafsiliFormSchema = z.object({
  tafsiliCode: z.string().trim().min(1, 'کد تفصیلی الزامی است').max(15, 'حداکثر ۱۵ کاراکتر است'),
  tafsiliName: z.string().trim().min(1, 'عنوان تفصیلی الزامی است').max(200, 'حداکثر ۲۰۰ کاراکتر است'),
  tafsilDesc: z.string().trim().max(200, 'حداکثر ۲۰۰ کاراکتر است').optional().or(z.literal('')),
  isActive: z.enum(['true', 'false', '']),
  personType: z.enum(['true', 'false', '']),
  owner: z.enum(['true', 'false', '']),
  vahedType: z.enum(['true', 'false', '']),
  tafsilGroupIds: z.array(z.string()),
  tafsilGroupLinkVahedType: z.enum(TAFSIL_GROUP_LINK_VAHED_TYPE_OPTIONS),
});

export type TafsiliFormValues = z.infer<typeof tafsiliFormSchema>;

export const emptyTafsiliFormValues: TafsiliFormValues = {
  tafsiliCode: '',
  tafsiliName: '',
  tafsilDesc: '',
  isActive: 'true',
  personType: '',
  owner: '',
  vahedType: '',
  tafsilGroupIds: [],
  tafsilGroupLinkVahedType: '',
};

export function tafsiliDtoToFormValues(dto: TafsiliDto): TafsiliFormValues {
  return {
    tafsiliCode: dto.tafsiliCode ?? '',
    tafsiliName: dto.tafsiliName ?? '',
    tafsilDesc: dto.tafsilDesc ?? '',
    isActive: booleanToTriState(dto.isActive),
    personType: booleanToTriState(dto.personType),
    owner: booleanToTriState(dto.owner),
    vahedType: booleanToTriState(dto.vahedType),
    tafsilGroupIds: dto.tafsilGroupIds,
    // Write-only: the API never reports back an existing link's own VAHEDTYPE (it can differ
    // per group and isn't retroactively changed by this form — see backend phase 24 docs), so
    // editing always starts blank ("تعیین نشده") rather than guessing a value to preselect.
    tafsilGroupLinkVahedType: '',
  };
}

export function tafsiliFormValuesToPayload(values: TafsiliFormValues): TafsiliWritePayload {
  return {
    tafsiliCode: values.tafsiliCode.trim(),
    tafsiliName: values.tafsiliName.trim(),
    tafsilDesc: values.tafsilDesc?.trim() ? values.tafsilDesc.trim() : null,
    isActive: triStateToBoolean(values.isActive as TriStateValue),
    personType: triStateToBoolean(values.personType as TriStateValue),
    owner: triStateToBoolean(values.owner as TriStateValue),
    vahedType: triStateToBoolean(values.vahedType as TriStateValue),
    tafsilGroupIds: values.tafsilGroupIds,
    tafsilGroupLinkVahedType: values.tafsilGroupLinkVahedType ? Number(values.tafsilGroupLinkVahedType) : null,
  };
}
