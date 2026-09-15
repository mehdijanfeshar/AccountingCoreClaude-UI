import { z } from 'zod';
import type { ExpenseWritePayload } from './api';
import type { ExpenseDto } from '../../types/expense';

/** UX-presentation validation only, mirroring `CreateExpenseCommandValidator`. */
export const expenseFormSchema = z.object({
  expenseCode: z
    .string()
    .trim()
    .min(1, 'کد هزینه الزامی است')
    .max(2, 'کد هزینه حداکثر ۲ کاراکتر است'),
  expenseName: z
    .string()
    .trim()
    .min(1, 'عنوان هزینه الزامی است')
    .max(200, 'عنوان هزینه حداکثر ۲۰۰ کاراکتر است'),
  description: z.string().trim().max(100, 'حداکثر ۱۰۰ کاراکتر است').optional().or(z.literal('')),
  defaultAmount: z.string().optional().or(z.literal('')),
  accountCodeId: z.string().nullable(),
  accountCodeLabel: z.string().nullable().optional(),
  // Driven by TafsiliLevelFields from the selected معین's active levels; nothing syntactic to
  // validate here beyond shape (the backend validates the ids).
  tafsiliLinks: z.array(z.object({ levelId: z.string(), tafsiliId: z.string(), label: z.string().optional() })),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export const emptyExpenseFormValues: ExpenseFormValues = {
  expenseCode: '',
  expenseName: '',
  description: '',
  defaultAmount: '',
  accountCodeId: null,
  accountCodeLabel: null,
  tafsiliLinks: [],
};

export function expenseDtoToFormValues(dto: ExpenseDto, accountCodeLabel: string | null): ExpenseFormValues {
  return {
    expenseCode: dto.expenseCode ?? '',
    expenseName: dto.expenseName ?? '',
    description: dto.description ?? '',
    defaultAmount: dto.defaultAmount != null ? String(dto.defaultAmount) : '',
    accountCodeId: dto.accountCodeId,
    accountCodeLabel,
    // Labels are resolved lazily by TafsiliLevelFields — the DTO carries ids only.
    tafsiliLinks: dto.tafsiliLinks.map((link) => ({ levelId: link.levelId, tafsiliId: link.tafsiliId })),
  };
}

/** `expenseGroupId` deliberately NOT exposed — no lookup endpoint exists; always `null`. */
export function expenseFormValuesToPayload(values: ExpenseFormValues): ExpenseWritePayload {
  return {
    expenseCode: values.expenseCode.trim(),
    expenseName: values.expenseName.trim(),
    description: values.description?.trim() ? values.description.trim() : null,
    defaultAmount: values.defaultAmount ? Number(values.defaultAmount) : null,
    expenseGroupId: null,
    accountCodeId: values.accountCodeId,
    tafsiliLinks: values.tafsiliLinks.map((link) => ({ tafsiliId: link.tafsiliId, levelId: link.levelId })),
  };
}
