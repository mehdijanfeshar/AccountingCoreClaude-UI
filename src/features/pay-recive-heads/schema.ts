import { z } from 'zod';
import type { PayReciveHeadWritePayload } from './api';
import type { PayReciveHeadDto } from '../../types/payReciveHead';
import { booleanToTriState, triStateToBoolean, type TriStateValue } from '../../components/TriStateToggle';

/** UX-presentation validation only, mirroring `CreatePayReciveHeadCommandValidator`. */
export const payReciveHeadFormSchema = z.object({
  payReciveCode: z.string().trim().min(1, 'شماره سند الزامی است').max(5, 'حداکثر ۵ کاراکتر است'),
  payReciveDate: z.string().trim().min(1, 'تاریخ سند الزامی است').max(8, 'حداکثر ۸ کاراکتر است'),
  payReciveDescription: z
    .string()
    .trim()
    .min(1, 'شرح سند الزامی است')
    .max(250, 'حداکثر ۲۵۰ کاراکتر است'),
  payReciveType: z.enum(['true', 'false', '']),
  year: z.string().trim().min(1, 'سال مالی الزامی است').max(4, 'حداکثر ۴ کاراکتر است'),
  // Read-only pass-through — see the XML doc on `PayReciveHeadFormPage` for why this has no picker.
  voucherHeadId: z.string().nullable(),
});

export type PayReciveHeadFormValues = z.infer<typeof payReciveHeadFormSchema>;

export const emptyPayReciveHeadFormValues: PayReciveHeadFormValues = {
  payReciveCode: '',
  payReciveDate: '',
  payReciveDescription: '',
  payReciveType: '',
  year: '',
  voucherHeadId: null,
};

export function payReciveHeadDtoToFormValues(dto: PayReciveHeadDto): PayReciveHeadFormValues {
  return {
    payReciveCode: dto.payReciveCode ?? '',
    payReciveDate: dto.payReciveDate ?? '',
    payReciveDescription: dto.payReciveDescription ?? '',
    payReciveType: booleanToTriState(dto.payReciveType),
    year: dto.year ?? '',
    voucherHeadId: dto.voucherHeadId,
  };
}

export function payReciveHeadFormValuesToPayload(values: PayReciveHeadFormValues): PayReciveHeadWritePayload {
  return {
    payReciveCode: values.payReciveCode.trim(),
    payReciveDate: values.payReciveDate.trim(),
    payReciveDescription: values.payReciveDescription.trim(),
    payReciveType: triStateToBoolean(values.payReciveType as TriStateValue),
    year: values.year.trim(),
    voucherHeadId: values.voucherHeadId,
  };
}
