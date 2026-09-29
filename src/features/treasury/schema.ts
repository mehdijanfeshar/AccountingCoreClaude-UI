import { z } from 'zod';
import { enumFieldSchema, nonNullableEnumFieldSchema } from '../../lib/validation/enumFieldSchema';
import { TREASURY_PAYMENT_TYPE_OPTIONS, TREASURY_PAYMENT_METHOD_OPTIONS, TREASURY_ROLE_OPTIONS } from './treasuryPaymentRequestState';
import type { PaymentRequestWritePayload } from './api';
import type { PaymentRequestDto } from '../../types/treasury';

const PAYMENT_TYPE_VALUES = TREASURY_PAYMENT_TYPE_OPTIONS.map((o) => o.value);
const PAYMENT_METHOD_VALUES = TREASURY_PAYMENT_METHOD_OPTIONS.map((o) => o.value);
const TREASURY_ROLE_VALUES = TREASURY_ROLE_OPTIONS.map((o) => o.value);

/* ------------------------------------------------------------------------------------------- *
 * درخواست پرداخت (`TB_TR_PAYMENT_REQUEST`) — بخش ۴-الف
 * ------------------------------------------------------------------------------------------- */

/**
 * UX-presentation validation only — `CreatePaymentRequestCommandValidator` سمت سرور مرجع است.
 * `beneficiaryTafsiliId` عمداً اینجا نیست: در فهرست فیلدهای فرم درخواست‌شده نبود (تصمیم دامنه/محصول
 * دربارهٔ اینکه این تفصیلی از کجا انتخاب شود هنوز باز است)؛ روی هر ثبت `null` فرستاده می‌شود.
 */
export const paymentRequestFormSchema = z
  .object({
    beneficiaryName: z.string().trim().min(1, 'نام ذی‌نفع الزامی است').max(200, 'حداکثر ۲۰۰ کاراکتر است'),
    beneficiaryNationalId: z.string().trim().max(11, 'حداکثر ۱۱ رقم است').optional().or(z.literal('')),
    paymentType: nonNullableEnumFieldSchema(PAYMENT_TYPE_VALUES, 'نوع ذی‌نفع را انتخاب کنید'),
    invoiceRef: z.string().trim().max(100, 'حداکثر ۱۰۰ کاراکتر است').optional().or(z.literal('')),
    invoiceApproved: z.boolean(),
    expenseAccountId: z.string().trim().min(1, 'انتخاب حساب هزینه الزامی است'),
    expenseAccountLabel: z.string().nullable().optional(),
    costCenterTafsiliId: z.string().nullable().optional(),
    costCenterTafsiliLabel: z.string().nullable().optional(),
    amountBeforeTax: z.string().trim().min(1, 'مبلغ الزامی است').refine((v) => Number(v) > 0, 'باید بزرگ‌تر از صفر باشد'),
    vatPercent: z.string().optional().or(z.literal('')),
    vatAmount: z.string().optional().or(z.literal('')),
    insuranceDeductionPercent: z.string().optional().or(z.literal('')),
    insuranceDeductionAmount: z.string().optional().or(z.literal('')),
    dueDate: z.string().trim().min(1, 'تاریخ سررسید الزامی است'),
    paymentAccountId: z.string().trim().min(1, 'انتخاب حساب پرداخت الزامی است'),
    paymentAccountLabel: z.string().nullable().optional(),
    paymentMethod: enumFieldSchema(PAYMENT_METHOD_VALUES, 'روش پرداخت نامعتبر است'),
    description: z.string().trim().max(1000, 'حداکثر ۱۰۰۰ کاراکتر است').optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    if (values.invoiceRef && !values.invoiceApproved) {
      ctx.addIssue({
        code: 'custom',
        path: ['invoiceApproved'],
        message: 'با ثبت شمارهٔ فاکتور، تأیید فاکتور هم باید تیک بخورد',
      });
    }
  });

export type PaymentRequestFormValues = z.infer<typeof paymentRequestFormSchema>;

export function buildEmptyPaymentRequestFormValues(): PaymentRequestFormValues {
  return {
    beneficiaryName: '',
    beneficiaryNationalId: '',
    paymentType: TREASURY_PAYMENT_TYPE_OPTIONS[0].value,
    invoiceRef: '',
    invoiceApproved: false,
    expenseAccountId: '',
    expenseAccountLabel: null,
    costCenterTafsiliId: null,
    costCenterTafsiliLabel: null,
    amountBeforeTax: '',
    vatPercent: '',
    vatAmount: '',
    insuranceDeductionPercent: '',
    insuranceDeductionAmount: '',
    dueDate: '',
    paymentAccountId: '',
    paymentAccountLabel: null,
    paymentMethod: null,
    description: '',
  };
}

export function paymentRequestDtoToFormValues(
  dto: PaymentRequestDto,
  expenseAccountLabel: string | null,
  costCenterTafsiliLabel: string | null,
  paymentAccountLabel: string | null,
): PaymentRequestFormValues {
  return {
    beneficiaryName: dto.beneficiaryName ?? '',
    beneficiaryNationalId: dto.beneficiaryNationalId ?? '',
    paymentType: dto.paymentType,
    invoiceRef: dto.invoiceRef ?? '',
    invoiceApproved: dto.invoiceApproved,
    expenseAccountId: dto.expenseAccountId,
    expenseAccountLabel,
    costCenterTafsiliId: dto.costCenterTafsiliId,
    costCenterTafsiliLabel,
    amountBeforeTax: String(dto.amountBeforeTax ?? ''),
    vatPercent: dto.vatPercent != null ? String(dto.vatPercent) : '',
    vatAmount: dto.vatAmount != null ? String(dto.vatAmount) : '',
    insuranceDeductionPercent: dto.insuranceDeductionPercent != null ? String(dto.insuranceDeductionPercent) : '',
    insuranceDeductionAmount: dto.insuranceDeductionAmount != null ? String(dto.insuranceDeductionAmount) : '',
    dueDate: dto.dueDate ?? '',
    paymentAccountId: dto.paymentAccountId,
    paymentAccountLabel,
    paymentMethod: dto.paymentMethod,
    description: dto.description ?? '',
  };
}

export function paymentRequestFormValuesToPayload(values: PaymentRequestFormValues): PaymentRequestWritePayload {
  return {
    beneficiaryName: values.beneficiaryName.trim(),
    beneficiaryNationalId: values.beneficiaryNationalId?.trim() ? values.beneficiaryNationalId.trim() : null,
    // فرم فعلی این فیلد را نمی‌سازد — یک تصمیم دامنه/محصول باز است، نه یک مقدار حدسی.
    beneficiaryTafsiliId: null,
    paymentType: values.paymentType,
    invoiceRef: values.invoiceRef?.trim() ? values.invoiceRef.trim() : null,
    invoiceApproved: values.invoiceApproved,
    expenseAccountId: values.expenseAccountId,
    costCenterTafsiliId: values.costCenterTafsiliId ?? null,
    amountBeforeTax: Number(values.amountBeforeTax || 0),
    vatPercent: values.vatPercent ? Number(values.vatPercent) : null,
    vatAmount: values.vatAmount ? Number(values.vatAmount) : null,
    insuranceDeductionPercent: values.insuranceDeductionPercent ? Number(values.insuranceDeductionPercent) : null,
    insuranceDeductionAmount: values.insuranceDeductionAmount ? Number(values.insuranceDeductionAmount) : null,
    dueDate: values.dueDate.trim(),
    paymentAccountId: values.paymentAccountId,
    paymentMethod: values.paymentMethod,
    description: values.description?.trim() ? values.description.trim() : null,
  };
}

/** پیش‌نمایش سمت کلاینت فقط برای UX — محاسبهٔ نهایی و مرجع همیشه سمت سرور است. */
export function previewNetPayableAmount(values: {
  amountBeforeTax: string;
  vatAmount?: string;
  insuranceDeductionAmount?: string;
}): number {
  const before = Number(values.amountBeforeTax || 0);
  const vat = Number(values.vatAmount || 0);
  const insurance = Number(values.insuranceDeductionAmount || 0);
  return before + vat - insurance;
}

/* ------------------------------------------------------------------------------------------- *
 * تنظیمات خزانه (`TB_TR_SETTING`)
 * ------------------------------------------------------------------------------------------- */

export const treasurySettingFormSchema = z.object({
  ceoApprovalThreshold: z
    .string()
    .trim()
    .min(1, 'آستانهٔ تأیید مدیرعامل الزامی است')
    .refine((v) => Number(v) >= 0, 'باید عددی نامنفی باشد'),
  bulkApproveLimit: z
    .string()
    .trim()
    .min(1, 'سقف تأیید گروهی الزامی است')
    .refine((v) => Number(v) >= 0, 'باید عددی نامنفی باشد'),
});

export type TreasurySettingFormValues = z.infer<typeof treasurySettingFormSchema>;

export function buildEmptyTreasurySettingFormValues(): TreasurySettingFormValues {
  return { ceoApprovalThreshold: '', bulkApproveLimit: '' };
}

/* ------------------------------------------------------------------------------------------- *
 * نقش‌های خزانه (`TB_TR_ROLE`)
 * ------------------------------------------------------------------------------------------- */

export const treasuryRoleFormSchema = z.object({
  userId: z.string().trim().min(1, 'کد کاربری الزامی است').max(10, 'حداکثر ۱۰ کاراکتر است'),
  userName: z.string().trim().max(200, 'حداکثر ۲۰۰ کاراکتر است').optional().or(z.literal('')),
  role: nonNullableEnumFieldSchema(TREASURY_ROLE_VALUES, 'نقش را انتخاب کنید'),
});

export type TreasuryRoleFormValues = z.infer<typeof treasuryRoleFormSchema>;

export function buildEmptyTreasuryRoleFormValues(): TreasuryRoleFormValues {
  return { userId: '', userName: '', role: TREASURY_ROLE_OPTIONS[0].value };
}
