import { z } from 'zod';
import type { BankAccountWritePayload } from './api';
import type { BankAccountDto } from '../../types/bankAccount';

/** UX-presentation validation only, mirroring `CreateBankAccountCommandValidator`. */
export const bankAccountFormSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .min(1, 'شماره حساب الزامی است')
    .max(15, 'شماره حساب حداکثر ۱۵ کاراکتر است'),
  accountHolder: z
    .string()
    .trim()
    .min(1, 'صاحب حساب الزامی است')
    .max(80, 'صاحب حساب حداکثر ۸۰ کاراکتر است'),
  cardNumber: z.string().trim().max(16, 'حداکثر ۱۶ کاراکتر است').optional().or(z.literal('')),
  shebaNumber: z.string().trim().max(50, 'حداکثر ۵۰ کاراکتر است').optional().or(z.literal('')),
  firstAmount: z.string().optional().or(z.literal('')),
  accountCodeId: z.string().nullable(),
  accountCodeLabel: z.string().nullable().optional(),
  accountOpeningDate: z.string().trim().max(8, 'حداکثر ۸ کاراکتر است').optional().or(z.literal('')),
  // Driven by TafsiliLevelFields from the selected معین's active levels; no syntactic rule to
  // apply here beyond shape (the backend validates ids, and requiredness is a known open item).
  tafsiliLinks: z.array(z.object({ levelId: z.string(), tafsiliId: z.string(), label: z.string().optional() })),
});

export type BankAccountFormValues = z.infer<typeof bankAccountFormSchema>;

export const emptyBankAccountFormValues: BankAccountFormValues = {
  accountNumber: '',
  accountHolder: '',
  cardNumber: '',
  shebaNumber: '',
  firstAmount: '',
  accountCodeId: null,
  accountCodeLabel: null,
  accountOpeningDate: '',
  tafsiliLinks: [],
};

export function bankAccountDtoToFormValues(dto: BankAccountDto, accountCodeLabel: string | null): BankAccountFormValues {
  return {
    accountNumber: dto.accountNumber ?? '',
    accountHolder: dto.accountHolder ?? '',
    cardNumber: dto.cardNumber ?? '',
    shebaNumber: dto.shebaNumber ?? '',
    firstAmount: dto.firstAmount != null ? String(dto.firstAmount) : '',
    accountCodeId: dto.accountCodeId,
    accountCodeLabel,
    accountOpeningDate: dto.accountOpeningDate ?? '',
    // Labels are resolved lazily by TafsiliLevelFields — the DTO carries ids only.
    tafsiliLinks: dto.tafsiliLinks.map((link) => ({ levelId: link.levelId, tafsiliId: link.tafsiliId })),
  };
}

/**
 * `bankId`/`branchId`/`accountTypeId`/`checkFile` deliberately NOT exposed as form fields — no
 * lookup endpoint exists for the first three, and no upload UI was specced for the fourth.
 * Always sent as `null`. Documented as an open item, not guessed at.
 */
export function bankAccountFormValuesToPayload(values: BankAccountFormValues): BankAccountWritePayload {
  return {
    accountNumber: values.accountNumber.trim(),
    accountHolder: values.accountHolder.trim(),
    cardNumber: values.cardNumber?.trim() ? values.cardNumber.trim() : null,
    shebaNumber: values.shebaNumber?.trim() ? values.shebaNumber.trim() : null,
    firstAmount: values.firstAmount ? Number(values.firstAmount) : null,
    bankId: null,
    branchId: null,
    accountTypeId: null,
    accountCodeId: values.accountCodeId,
    checkFile: null,
    accountOpeningDate: values.accountOpeningDate?.trim() ? values.accountOpeningDate.trim() : null,
    tafsiliLinks: values.tafsiliLinks.map((link) => ({ tafsiliId: link.tafsiliId, levelId: link.levelId })),
  };
}
