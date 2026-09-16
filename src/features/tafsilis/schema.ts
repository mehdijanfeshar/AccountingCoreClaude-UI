import { z } from 'zod';
import type { TafsiliWritePayload } from './api';
import type { TafsiliDto } from '../../types/tafsiliMaster';
import { enumFieldSchema } from '../../lib/validation/enumFieldSchema';
import {
  OWNER_VALUES,
  PERSON_TYPE_VALUES,
  TAFSILI_ACTIVE_STATE_VALUES,
  VAHED_CATEGORY_VALUES,
} from '../../types/legacyEnums';

/**
 * UX-presentation validation only, mirroring `CreateTafsiliCommandValidator`.
 *
 * Phase 27: `isActive`/`personType`/`owner`/`vahedType` moved from a buggy `bool|null` wire
 * shape to real nullable-integer enums (`TafsiliActiveState`/`PersonTypes`/`Owners`/
 * `VahedCategory`) — each accepts `null` plus only the values documented in
 * `../../types/legacyEnums.ts`, matching the backend's `.IsInEnum()` (no `.NotNull()`, so `null`
 * stays valid).
 */
/** `Accounting.Domain.ValueObjects.VahedCategory`: 1=بیمه, 2=درمان, 3=همه — '' means "تعیین نشده". */
export const TAFSIL_GROUP_LINK_VAHED_TYPE_OPTIONS = ['', '1', '2', '3'] as const;
export type TafsilGroupLinkVahedTypeValue = (typeof TAFSIL_GROUP_LINK_VAHED_TYPE_OPTIONS)[number];

export const tafsiliFormSchema = z.object({
  tafsiliCode: z.string().trim().min(1, 'کد تفصیلی الزامی است').max(15, 'حداکثر ۱۵ کاراکتر است'),
  tafsiliName: z.string().trim().min(1, 'عنوان تفصیلی الزامی است').max(200, 'حداکثر ۲۰۰ کاراکتر است'),
  tafsilDesc: z.string().trim().max(200, 'حداکثر ۲۰۰ کاراکتر است').optional().or(z.literal('')),
  isActive: enumFieldSchema(TAFSILI_ACTIVE_STATE_VALUES, 'وضعیت فعال بودن نامعتبر است'),
  personType: enumFieldSchema(PERSON_TYPE_VALUES, 'نوع شخص نامعتبر است'),
  owner: enumFieldSchema(OWNER_VALUES, 'مالکیت نامعتبر است'),
  vahedType: enumFieldSchema(VAHED_CATEGORY_VALUES, 'نوع واحد نامعتبر است'),
  tafsilGroupIds: z.array(z.string()),
  tafsilGroupLinkVahedType: z.enum(TAFSIL_GROUP_LINK_VAHED_TYPE_OPTIONS),
});

export type TafsiliFormValues = z.infer<typeof tafsiliFormSchema>;

export const emptyTafsiliFormValues: TafsiliFormValues = {
  tafsiliCode: '',
  tafsiliName: '',
  tafsilDesc: '',
  isActive: 1,
  personType: null,
  owner: null,
  vahedType: null,
  tafsilGroupIds: [],
  tafsilGroupLinkVahedType: '',
};

export function tafsiliDtoToFormValues(dto: TafsiliDto): TafsiliFormValues {
  return {
    tafsiliCode: dto.tafsiliCode ?? '',
    tafsiliName: dto.tafsiliName ?? '',
    tafsilDesc: dto.tafsilDesc ?? '',
    isActive: dto.isActive,
    personType: dto.personType,
    owner: dto.owner,
    vahedType: dto.vahedType,
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
    isActive: values.isActive,
    personType: values.personType,
    owner: values.owner,
    vahedType: values.vahedType,
    tafsilGroupIds: values.tafsilGroupIds,
    tafsilGroupLinkVahedType: values.tafsilGroupLinkVahedType ? Number(values.tafsilGroupLinkVahedType) : null,
  };
}
