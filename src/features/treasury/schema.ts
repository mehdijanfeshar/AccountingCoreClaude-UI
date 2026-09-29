import { z } from 'zod';
import { enumFieldSchema, nonNullableEnumFieldSchema } from '../../lib/validation/enumFieldSchema';
import { TREASURY_PAYMENT_TYPE_OPTIONS, TREASURY_PAYMENT_METHOD_OPTIONS, TREASURY_ROLE_OPTIONS } from './treasuryPaymentRequestState';
import type { PaymentRequestTafsiliLinkInput, PaymentRequestWritePayload, ReceiptWritePayload, TransferWritePayload } from './api';
import type { PaymentRequestDto, ReceiptDto, TransferDto } from '../../types/treasury';

const PAYMENT_TYPE_VALUES = TREASURY_PAYMENT_TYPE_OPTIONS.map((o) => o.value);
const PAYMENT_METHOD_VALUES = TREASURY_PAYMENT_METHOD_OPTIONS.map((o) => o.value);
const TREASURY_ROLE_VALUES = TREASURY_ROLE_OPTIONS.map((o) => o.value);

/* ------------------------------------------------------------------------------------------- *
 * درخواست پرداخت (`TB_TR_PAYMENT_REQUEST`) — بخش ۴-الف
 * ------------------------------------------------------------------------------------------- */

/**
 * UX-presentation validation only — `CreatePaymentRequestCommandValidator` سمت سرور مرجع است.
 * `costCenterTafsilis` را همان کامپوننت مشترک `TafsiliLevelFields` می‌سازد (یک ردیف به‌ازای هر
 * سطح تفصیلی فعال حساب هزینه)؛ اینجا فقط شکل بررسی می‌شود، نه الزامی‌بودن هر سطح — همان‌طور که
 * `features/expenses/schema.ts` هم با همین کامپوننت این کار را می‌کند، مرجع «همهٔ سطوح الزامی‌اند»
 * ۴۰۰ سمت سرور است (`RequiredTafsiliLevelMissing`/`TafsiliLevelNotPermitted`).
 */
export const paymentRequestFormSchema = z
  .object({
    beneficiaryName: z.string().trim().min(1, 'نام ذی‌نفع الزامی است').max(200, 'حداکثر ۲۰۰ کاراکتر است'),
    beneficiaryNationalId: z.string().trim().max(11, 'حداکثر ۱۱ رقم است').optional().or(z.literal('')),
    beneficiaryTafsiliId: z.string().nullable().optional(),
    beneficiaryTafsiliLabel: z.string().nullable().optional(),
    paymentType: nonNullableEnumFieldSchema(PAYMENT_TYPE_VALUES, 'نوع ذی‌نفع را انتخاب کنید'),
    invoiceRef: z.string().trim().max(100, 'حداکثر ۱۰۰ کاراکتر است').optional().or(z.literal('')),
    invoiceApproved: z.boolean(),
    expenseAccountId: z.string().trim().min(1, 'انتخاب حساب هزینه الزامی است'),
    expenseAccountLabel: z.string().nullable().optional(),
    costCenterTafsilis: z.array(z.object({ levelId: z.string(), tafsiliId: z.string(), label: z.string().optional() })),
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
    beneficiaryTafsiliId: null,
    beneficiaryTafsiliLabel: null,
    paymentType: TREASURY_PAYMENT_TYPE_OPTIONS[0].value,
    invoiceRef: '',
    invoiceApproved: false,
    expenseAccountId: '',
    expenseAccountLabel: null,
    costCenterTafsilis: [],
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
  paymentAccountLabel: string | null,
): PaymentRequestFormValues {
  return {
    beneficiaryName: dto.beneficiaryName ?? '',
    beneficiaryNationalId: dto.beneficiaryNationalId ?? '',
    beneficiaryTafsiliId: dto.beneficiaryTafsiliId,
    beneficiaryTafsiliLabel:
      dto.beneficiaryTafsiliId != null ? `${dto.beneficiaryTafsiliCode ?? ''} - ${dto.beneficiaryTafsiliName ?? ''}` : null,
    paymentType: dto.paymentType,
    invoiceRef: dto.invoiceRef ?? '',
    invoiceApproved: dto.invoiceApproved,
    expenseAccountId: dto.expenseAccountId,
    expenseAccountLabel,
    // Labels arrive from the detail DTO directly (unlike `TafsiliLevelFields`'s own per-id lookup
    // fallback, which only exists for callers whose write DTO carries ids without labels).
    costCenterTafsilis: dto.costCenterTafsilis.map((link) => ({
      levelId: link.levelId,
      tafsiliId: link.tafsiliId,
      label: `${link.tafsiliCode ?? ''} - ${link.tafsiliName ?? ''}`,
    })),
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
  const costCenterTafsilis: PaymentRequestTafsiliLinkInput[] = values.costCenterTafsilis.map((link) => ({
    tafsiliId: link.tafsiliId,
    levelId: link.levelId,
  }));
  return {
    beneficiaryName: values.beneficiaryName.trim(),
    beneficiaryNationalId: values.beneficiaryNationalId?.trim() ? values.beneficiaryNationalId.trim() : null,
    beneficiaryTafsiliId: values.beneficiaryTafsiliId ?? null,
    paymentType: values.paymentType,
    invoiceRef: values.invoiceRef?.trim() ? values.invoiceRef.trim() : null,
    invoiceApproved: values.invoiceApproved,
    expenseAccountId: values.expenseAccountId,
    costCenterTafsilis,
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

/* ------------------------------------------------------------------------------------------- *
 * اجرای پرداخت — بخش ۴-ب (`ExecutePaymentRequestCommandValidator` مرجع)
 * ------------------------------------------------------------------------------------------- */

/** UX-presentation validation only — `ExecutePaymentRequestCommandValidator` سمت سرور مرجع است. */
export const executePaymentRequestFormSchema = z.object({
  bankReference: z.string().trim().min(1, 'شمارهٔ پیگیری/مرجع بانکی الزامی است').max(100, 'حداکثر ۱۰۰ کاراکتر است'),
  paidDate: z.string().trim().min(1, 'تاریخ پرداخت الزامی است'),
  // IR + 24 digits — دقیقاً هم‌الگوی `IbanPattern` سمت سرور، بدون checksum.
  destinationIban: z
    .string()
    .trim()
    .regex(/^IR\d{24}$/, 'شمارهٔ شبا باید به شکل IR و ۲۴ رقم باشد')
    .optional()
    .or(z.literal('')),
  paymentMethod: enumFieldSchema(PAYMENT_METHOD_VALUES, 'روش پرداخت نامعتبر است'),
});

export type ExecutePaymentRequestFormValues = z.infer<typeof executePaymentRequestFormSchema>;

export function buildEmptyExecutePaymentRequestFormValues(paidDate: string): ExecutePaymentRequestFormValues {
  return { bankReference: '', paidDate, destinationIban: '', paymentMethod: null };
}

export function executePaymentRequestFormValuesToPayload(values: ExecutePaymentRequestFormValues) {
  return {
    bankReference: values.bankReference.trim(),
    paidDate: values.paidDate.trim(),
    destinationIban: values.destinationIban?.trim() ? values.destinationIban.trim() : null,
    paymentMethod: values.paymentMethod,
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
  // اصلاح ۴-الف (۲۰۲۶-۰۹-۲۹) — اختیاری؛ `null` یعنی هنوز تعریف نشده.
  beneficiaryTafsilGroupId: z.string().nullable().optional(),
  // بخش ۴-ب (۲۰۲۶-۰۹-۲۹) — هر سه اختیاری؛ `null` یعنی هنوز تعریف نشده (صدور سند شناسایی بدهی با
  // ۴۰۹ رد می‌شود). `...Label` فقط برای نمایش در Autocomplete است، به سرور فرستاده نمی‌شود.
  payablesAccountId: z.string().nullable().optional(),
  payablesAccountLabel: z.string().nullable().optional(),
  vatCreditAccountId: z.string().nullable().optional(),
  vatCreditAccountLabel: z.string().nullable().optional(),
  insurancePayableAccountId: z.string().nullable().optional(),
  insurancePayableAccountLabel: z.string().nullable().optional(),
  // بخش ۴-ج (۲۰۲۶-۰۹-۲۹) — هر سه اختیاری؛ `null` یعنی هنوز تعریف نشده.
  receivablesAccountId: z.string().nullable().optional(),
  receivablesAccountLabel: z.string().nullable().optional(),
  customerTafsilGroupId: z.string().nullable().optional(),
  dailyTransferLimit: z.string().optional().or(z.literal('')),
});

export type TreasurySettingFormValues = z.infer<typeof treasurySettingFormSchema>;

export function buildEmptyTreasurySettingFormValues(): TreasurySettingFormValues {
  return {
    ceoApprovalThreshold: '',
    bulkApproveLimit: '',
    beneficiaryTafsilGroupId: null,
    payablesAccountId: null,
    payablesAccountLabel: null,
    vatCreditAccountId: null,
    vatCreditAccountLabel: null,
    insurancePayableAccountId: null,
    insurancePayableAccountLabel: null,
    receivablesAccountId: null,
    receivablesAccountLabel: null,
    customerTafsilGroupId: null,
    dailyTransferLimit: '',
  };
}

/* ------------------------------------------------------------------------------------------- *
 * دریافت وجه (`TB_TR_RECEIPT`) — بخش ۴-ج (`CreateReceiptCommandValidator` مرجع)
 * ------------------------------------------------------------------------------------------- */

/** UX-presentation validation only — `CreateReceiptCommandValidator` سمت سرور مرجع است. */
export const receiptFormSchema = z.object({
  payerTafsiliId: z.string().trim().min(1, 'انتخاب پرداخت‌کننده الزامی است'),
  payerTafsiliLabel: z.string().nullable().optional(),
  amount: z.string().trim().min(1, 'مبلغ الزامی است').refine((v) => Number(v) > 0, 'باید بزرگ‌تر از صفر باشد'),
  bankAccountId: z.string().trim().min(1, 'انتخاب حساب بانکی مقصد الزامی است'),
  bankAccountLabel: z.string().nullable().optional(),
  receiptMethod: nonNullableEnumFieldSchema(PAYMENT_METHOD_VALUES, 'روش دریافت را انتخاب کنید'),
  receiptDate: z.string().trim().min(1, 'تاریخ دریافت الزامی است'),
  bankReference: z.string().trim().min(1, 'شمارهٔ پیگیری/مرجع بانکی الزامی است').max(100, 'حداکثر ۱۰۰ کاراکتر است'),
  invoiceRef: z.string().trim().max(100, 'حداکثر ۱۰۰ کاراکتر است').optional().or(z.literal('')),
  description: z.string().trim().max(1000, 'حداکثر ۱۰۰۰ کاراکتر است').optional().or(z.literal('')),
});

export type ReceiptFormValues = z.infer<typeof receiptFormSchema>;

export function buildEmptyReceiptFormValues(receiptDate: string): ReceiptFormValues {
  return {
    payerTafsiliId: '',
    payerTafsiliLabel: null,
    amount: '',
    bankAccountId: '',
    bankAccountLabel: null,
    receiptMethod: TREASURY_PAYMENT_METHOD_OPTIONS[0].value,
    receiptDate,
    bankReference: '',
    invoiceRef: '',
    description: '',
  };
}

export function receiptDtoToFormValues(dto: ReceiptDto, bankAccountLabel: string | null): ReceiptFormValues {
  return {
    payerTafsiliId: dto.payerTafsiliId,
    payerTafsiliLabel: `${dto.payerTafsiliCode ?? ''} - ${dto.payerTafsiliName ?? ''}`,
    amount: String(dto.amount ?? ''),
    bankAccountId: dto.bankAccountId,
    bankAccountLabel,
    receiptMethod: dto.receiptMethod,
    receiptDate: dto.receiptDate ?? '',
    bankReference: dto.bankReference ?? '',
    invoiceRef: dto.invoiceRef ?? '',
    description: dto.description ?? '',
  };
}

export function receiptFormValuesToPayload(values: ReceiptFormValues): ReceiptWritePayload {
  return {
    payerTafsiliId: values.payerTafsiliId,
    amount: Number(values.amount || 0),
    bankAccountId: values.bankAccountId,
    receiptMethod: values.receiptMethod ?? TREASURY_PAYMENT_METHOD_OPTIONS[0].value,
    receiptDate: values.receiptDate.trim(),
    bankReference: values.bankReference.trim(),
    invoiceRef: values.invoiceRef?.trim() ? values.invoiceRef.trim() : null,
    description: values.description?.trim() ? values.description.trim() : null,
  };
}

/* ------------------------------------------------------------------------------------------- *
 * انتقال وجه (`TB_TR_TRANSFER`) — بخش ۴-ج (`CreateTransferCommandValidator` مرجع)
 * ------------------------------------------------------------------------------------------- */

/** UX-presentation validation only — `CreateTransferCommandValidator` سمت سرور مرجع است. */
export const transferFormSchema = z
  .object({
    sourceBankAccountId: z.string().trim().min(1, 'انتخاب حساب مبدأ الزامی است'),
    sourceBankAccountLabel: z.string().nullable().optional(),
    destBankAccountId: z.string().trim().min(1, 'انتخاب حساب مقصد الزامی است'),
    destBankAccountLabel: z.string().nullable().optional(),
    amount: z.string().trim().min(1, 'مبلغ الزامی است').refine((v) => Number(v) > 0, 'باید بزرگ‌تر از صفر باشد'),
    transferDate: z.string().trim().min(1, 'تاریخ انتقال الزامی است'),
    transferMethod: nonNullableEnumFieldSchema(PAYMENT_METHOD_VALUES, 'روش انتقال را انتخاب کنید'),
    reason: z.string().trim().min(1, 'دلیل انتقال الزامی است').max(1000, 'حداکثر ۱۰۰۰ کاراکتر است'),
  })
  .superRefine((values, ctx) => {
    if (values.sourceBankAccountId && values.destBankAccountId && values.sourceBankAccountId === values.destBankAccountId) {
      ctx.addIssue({ code: 'custom', path: ['destBankAccountId'], message: 'حساب مقصد نمی‌تواند با حساب مبدأ یکی باشد' });
    }
  });

export type TransferFormValues = z.infer<typeof transferFormSchema>;

export function buildEmptyTransferFormValues(transferDate: string): TransferFormValues {
  return {
    sourceBankAccountId: '',
    sourceBankAccountLabel: null,
    destBankAccountId: '',
    destBankAccountLabel: null,
    amount: '',
    transferDate,
    transferMethod: TREASURY_PAYMENT_METHOD_OPTIONS[0].value,
    reason: '',
  };
}

export function transferDtoToFormValues(
  dto: TransferDto,
  sourceBankAccountLabel: string | null,
  destBankAccountLabel: string | null,
): TransferFormValues {
  return {
    sourceBankAccountId: dto.sourceBankAccountId,
    sourceBankAccountLabel,
    destBankAccountId: dto.destBankAccountId,
    destBankAccountLabel,
    amount: String(dto.amount ?? ''),
    transferDate: dto.transferDate ?? '',
    transferMethod: dto.transferMethod,
    reason: dto.reason ?? '',
  };
}

export function transferFormValuesToPayload(values: TransferFormValues): TransferWritePayload {
  return {
    sourceBankAccountId: values.sourceBankAccountId,
    destBankAccountId: values.destBankAccountId,
    amount: Number(values.amount || 0),
    transferDate: values.transferDate.trim(),
    transferMethod: values.transferMethod ?? TREASURY_PAYMENT_METHOD_OPTIONS[0].value,
    reason: values.reason.trim(),
  };
}

/** UX-presentation validation only — `ApproveTransferCommandValidator` سمت سرور مرجع است. */
export const approveTransferFormSchema = z.object({
  bankReference: z.string().trim().min(1, 'شمارهٔ پیگیری/مرجع بانکی الزامی است').max(100, 'حداکثر ۱۰۰ کاراکتر است'),
});

export type ApproveTransferFormValues = z.infer<typeof approveTransferFormSchema>;

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
