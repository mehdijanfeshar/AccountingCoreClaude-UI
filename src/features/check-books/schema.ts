import { z } from 'zod';
import type { CheckBookWritePayload } from './api';
import type { CheckBookDto } from '../../types/checkBook';
import { enumFieldSchema } from '../../lib/validation/enumFieldSchema';
import { CHECK_TYPE_VALUES } from '../../types/legacyEnums';

/**
 * UX-presentation validation only, mirroring `CreateCheckBookCommandValidator`.
 *
 * Phase 27: `checkBookType` moved from a buggy `bool|null` wire shape to a real nullable-integer
 * enum (`CheckType`: 1=چک صوری, 2=چک واقعی — see `../../types/legacyEnums.ts`).
 */
export const checkBookFormSchema = z.object({
  accountId: z.string().min(1, 'انتخاب حساب بانکی الزامی است'),
  accountLabel: z.string().nullable().optional(),
  checkBookTitle: z.string().trim().max(100, 'حداکثر ۱۰۰ کاراکتر است').optional().or(z.literal('')),
  checkBookDate: z
    .string()
    .trim()
    .min(1, 'تاریخ صدور دسته‌چک الزامی است')
    .max(8, 'حداکثر ۸ کاراکتر است'),
  fromCheckNumber: z
    .string()
    .trim()
    .min(1, 'شماره اولین برگه چک الزامی است')
    .max(14, 'حداکثر ۱۴ کاراکتر است'),
  toCheckNumber: z
    .string()
    .trim()
    .min(1, 'شماره آخرین برگه چک الزامی است')
    .max(14, 'حداکثر ۱۴ کاراکتر است'),
  checkTypeId: z.string().nullable(),
  checkBookType: enumFieldSchema(CHECK_TYPE_VALUES, 'نوع دسته‌چک نامعتبر است'),
  serial: z.string().trim().max(20, 'حداکثر ۲۰ کاراکتر است').optional().or(z.literal('')),
});

export type CheckBookFormValues = z.infer<typeof checkBookFormSchema>;

export const emptyCheckBookFormValues: CheckBookFormValues = {
  accountId: '',
  accountLabel: null,
  checkBookTitle: '',
  checkBookDate: '',
  fromCheckNumber: '',
  toCheckNumber: '',
  checkTypeId: null,
  checkBookType: null,
  serial: '',
};

export function checkBookDtoToFormValues(dto: CheckBookDto, accountLabel: string | null): CheckBookFormValues {
  return {
    accountId: dto.accountId,
    accountLabel,
    checkBookTitle: dto.checkBookTitle ?? '',
    checkBookDate: dto.checkBookDate ?? '',
    fromCheckNumber: dto.fromCheckNumber ?? '',
    toCheckNumber: dto.toCheckNumber ?? '',
    checkTypeId: dto.checkTypeId,
    checkBookType: dto.checkBookType,
    serial: dto.serial ?? '',
  };
}

export function checkBookFormValuesToPayload(values: CheckBookFormValues): CheckBookWritePayload {
  return {
    accountId: values.accountId,
    checkBookTitle: values.checkBookTitle?.trim() ? values.checkBookTitle.trim() : null,
    checkBookDate: values.checkBookDate.trim(),
    fromCheckNumber: values.fromCheckNumber.trim(),
    toCheckNumber: values.toCheckNumber.trim(),
    checkTypeId: values.checkTypeId,
    checkBookType: values.checkBookType,
    serial: values.serial?.trim() ? values.serial.trim() : null,
  };
}
