import { z } from 'zod';
import type { PayReciveHeadWritePayload } from './api';
import type { PayReciveHeadDto } from '../../types/payReciveHead';
import { enumFieldSchema } from '../../lib/validation/enumFieldSchema';
import { PAY_RECIV_TYPE_VALUES } from '../../types/legacyEnums';

/**
 * UX-presentation validation only, mirroring `CreatePayReciveHeadCommandValidator`.
 *
 * Phase 27: `payReciveType` moved from a buggy `bool|null` wire shape (under which value 3
 * "همه" was unreachable) to a real nullable-integer enum (`PayRecivType`: 1=پرداخت, 2=دریافت,
 * 3=همه — see `../../types/legacyEnums.ts`).
 */
export const payReciveHeadFormSchema = z.object({
  payReciveCode: z.string().trim().min(1, 'شماره سند الزامی است').max(5, 'حداکثر ۵ کاراکتر است'),
  payReciveDate: z.string().trim().min(1, 'تاریخ سند الزامی است').max(8, 'حداکثر ۸ کاراکتر است'),
  payReciveDescription: z
    .string()
    .trim()
    .min(1, 'شرح سند الزامی است')
    .max(250, 'حداکثر ۲۵۰ کاراکتر است'),
  payReciveType: enumFieldSchema(PAY_RECIV_TYPE_VALUES, 'نوع سند نامعتبر است'),
  year: z.string().trim().min(1, 'سال مالی الزامی است').max(4, 'حداکثر ۴ کاراکتر است'),
  // Read-only pass-through — see the XML doc on `PayReciveHeadFormPage` for why this has no picker.
  voucherHeadId: z.string().nullable(),
});

export type PayReciveHeadFormValues = z.infer<typeof payReciveHeadFormSchema>;

export const emptyPayReciveHeadFormValues: PayReciveHeadFormValues = {
  payReciveCode: '',
  payReciveDate: '',
  payReciveDescription: '',
  payReciveType: null,
  year: '',
  voucherHeadId: null,
};

export function payReciveHeadDtoToFormValues(dto: PayReciveHeadDto): PayReciveHeadFormValues {
  return {
    payReciveCode: dto.payReciveCode ?? '',
    payReciveDate: dto.payReciveDate ?? '',
    payReciveDescription: dto.payReciveDescription ?? '',
    payReciveType: dto.payReciveType,
    year: dto.year ?? '',
    voucherHeadId: dto.voucherHeadId,
  };
}

export function payReciveHeadFormValuesToPayload(values: PayReciveHeadFormValues): PayReciveHeadWritePayload {
  return {
    payReciveCode: values.payReciveCode.trim(),
    payReciveDate: values.payReciveDate.trim(),
    payReciveDescription: values.payReciveDescription.trim(),
    payReciveType: values.payReciveType,
    year: values.year.trim(),
    voucherHeadId: values.voucherHeadId,
  };
}
