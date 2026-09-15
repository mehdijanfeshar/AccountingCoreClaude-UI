import { z } from 'zod';
import type { RevolvingFundWritePayload } from './api';
import type { RevolvingFundDto } from '../../types/revolvingFund';

/** UX-presentation validation only, mirroring `CreateRevolvingFundCommandValidator`. */
export const revolvingFundFormSchema = z.object({
  code: z.string().trim().min(1, 'کد تنخواه الزامی است').max(2, 'کد تنخواه حداکثر ۲ کاراکتر است'),
  name: z.string().trim().min(1, 'عنوان تنخواه الزامی است').max(200, 'عنوان تنخواه حداکثر ۲۰۰ کاراکتر است'),
  description: z.string().trim().max(100, 'حداکثر ۱۰۰ کاراکتر است').optional().or(z.literal('')),
  defaultAmount: z.string().optional().or(z.literal('')),
  accountCodeId: z.string().nullable(),
  accountCodeLabel: z.string().nullable().optional(),
  year: z.string().trim().max(4, 'حداکثر ۴ کاراکتر است').optional().or(z.literal('')),
  // Driven by TafsiliLevelFields from the selected معین's active levels; nothing syntactic to
  // validate here beyond shape (the backend validates the ids).
  tafsiliLinks: z.array(z.object({ levelId: z.string(), tafsiliId: z.string(), label: z.string().optional() })),
});

export type RevolvingFundFormValues = z.infer<typeof revolvingFundFormSchema>;

export function buildEmptyRevolvingFundFormValues(defaultYear: string): RevolvingFundFormValues {
  return {
    code: '',
    name: '',
    description: '',
    defaultAmount: '',
    accountCodeId: null,
    accountCodeLabel: null,
    year: defaultYear,
    tafsiliLinks: [],
  };
}

export function revolvingFundDtoToFormValues(
  dto: RevolvingFundDto,
  accountCodeLabel: string | null,
): RevolvingFundFormValues {
  return {
    code: dto.code ?? '',
    name: dto.name ?? '',
    description: dto.description ?? '',
    defaultAmount: dto.defaultAmount != null ? String(dto.defaultAmount) : '',
    accountCodeId: dto.accountCodeId,
    accountCodeLabel,
    year: dto.year ?? '',
    // Labels are resolved lazily by TafsiliLevelFields — the DTO carries ids only.
    tafsiliLinks: dto.tafsiliLinks.map((link) => ({ levelId: link.levelId, tafsiliId: link.tafsiliId })),
  };
}

export function revolvingFundFormValuesToPayload(values: RevolvingFundFormValues): RevolvingFundWritePayload {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: values.description?.trim() ? values.description.trim() : null,
    defaultAmount: values.defaultAmount ? Number(values.defaultAmount) : null,
    accountCodeId: values.accountCodeId,
    year: values.year?.trim() ? values.year.trim() : null,
    tafsiliLinks: values.tafsiliLinks.map((link) => ({ tafsiliId: link.tafsiliId, levelId: link.levelId })),
  };
}
