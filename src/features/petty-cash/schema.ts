import { z } from 'zod';
import { enumFieldSchema, nonNullableEnumFieldSchema } from '../../lib/validation/enumFieldSchema';
import { EVIDENCE_TYPE_OPTIONS, SETTLEMENT_PERIOD_OPTIONS } from './pettyCashDocState';
import type { ExpenseDocWritePayload } from './api';
import type { PettyCashExpenseDocDetailDto, PettyCashFundSettingsDto } from '../../types/pettyCash';

const EVIDENCE_TYPE_VALUES = EVIDENCE_TYPE_OPTIONS.map((o) => o.value);
const SETTLEMENT_PERIOD_VALUES = SETTLEMENT_PERIOD_OPTIONS.map((o) => o.value);

/* ------------------------------------------------------------------------------------------- *
 * تعریف تنخواه — تنظیمات (`TB_PC_FUND_SETTING`)
 * ------------------------------------------------------------------------------------------- */

/** UX-presentation validation only — the backend command is the real authority. */
export const fundSettingsFormSchema = z.object({
  custodianUserId: z.string().trim().max(10, 'حداکثر ۱۰ کاراکتر است').optional().or(z.literal('')),
  custodianName: z.string().trim().max(200, 'حداکثر ۲۰۰ کاراکتر است').optional().or(z.literal('')),
  perDocLimit: z.string().optional().or(z.literal('')),
  alertThresholdPercent: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || (Number(v) >= 0 && Number(v) <= 100), 'باید عددی بین ۰ تا ۱۰۰ باشد'),
  // نه هزینه‌کرد نه ترمیم به این ستون وابسته نیستند؛ نبودِ آن (پیش‌فرض) یعنی «هنوز تعیین نشده».
  settlementPeriod: enumFieldSchema(SETTLEMENT_PERIOD_VALUES, 'دورهٔ تسویه نامعتبر است'),
});

export type FundSettingsFormValues = z.infer<typeof fundSettingsFormSchema>;

export function buildEmptyFundSettingsFormValues(): FundSettingsFormValues {
  return {
    custodianUserId: '',
    custodianName: '',
    perDocLimit: '',
    alertThresholdPercent: '',
    settlementPeriod: null,
  };
}

export function fundSettingsDtoToFormValues(dto: PettyCashFundSettingsDto | null): FundSettingsFormValues {
  if (!dto) return buildEmptyFundSettingsFormValues();
  return {
    custodianUserId: dto.custodianUserId ?? '',
    custodianName: dto.custodianName ?? '',
    perDocLimit: dto.perDocLimit != null ? String(dto.perDocLimit) : '',
    alertThresholdPercent: dto.alertThresholdPercent != null ? String(dto.alertThresholdPercent) : '',
    settlementPeriod: dto.settlementPeriod ?? null,
  };
}

export function fundSettingsFormValuesToPayload(values: FundSettingsFormValues): PettyCashFundSettingsDto {
  return {
    custodianUserId: values.custodianUserId?.trim() ? values.custodianUserId.trim() : null,
    custodianName: values.custodianName?.trim() ? values.custodianName.trim() : null,
    perDocLimit: values.perDocLimit ? Number(values.perDocLimit) : null,
    alertThresholdPercent: values.alertThresholdPercent ? Number(values.alertThresholdPercent) : null,
    settlementPeriod: values.settlementPeriod,
  };
}

/* ------------------------------------------------------------------------------------------- *
 * ثبت صورت‌هزینه (`TB_PC_EXPENSE_DOC`)
 * ------------------------------------------------------------------------------------------- */

/**
 * UX-presentation validation only, mirroring the server rules in spec §۴ as closely as a
 * not-yet-built backend allows. The rules that depend on OTHER records (per-doc limit, cash
 * balance, duplicate vendor+invoice, fiscal-year match) are NOT enforced here — those need data
 * this schema cannot see and are shown as the «کنترل‌های لحظه‌ای» hints in the form instead. The
 * server is the only authority for all of them; its ProblemDetails is always surfaced on submit.
 */
export const expenseDocFormSchema = z
  .object({
    fundId: z.string().trim().min(1, 'انتخاب تنخواه الزامی است'),
    registerDate: z.string().optional().or(z.literal('')),
    vendorName: z.string().trim().min(1, 'نام فروشنده الزامی است').max(200, 'حداکثر ۲۰۰ کاراکتر است'),
    vendorNationalId: z
      .string()
      .trim()
      .max(11, 'حداکثر ۱۱ رقم است')
      .optional()
      .or(z.literal('')),
    invoiceNo: z.string().trim().min(1, 'شماره فاکتور الزامی است').max(50, 'حداکثر ۵۰ کاراکتر است'),
    invoiceDate: z.string().trim().min(1, 'تاریخ فاکتور الزامی است'),
    evidenceType: nonNullableEnumFieldSchema(EVIDENCE_TYPE_VALUES, 'نوع مدرک را انتخاب کنید'),
    description: z.string().trim().min(1, 'شرح هزینه الزامی است').max(1000, 'حداکثر ۱۰۰۰ کاراکتر است'),
    expenseId: z.string().trim().min(1, 'انتخاب حساب هزینه الزامی است'),
    amountBeforeTax: z.string().trim().min(1, 'مبلغ قبل از مالیات الزامی است'),
    vatAmount: z.string().optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    const before = Number(values.amountBeforeTax || 0);
    const vat = Number(values.vatAmount || 0);
    if (values.vatAmount && (vat < 0 || vat > before)) {
      ctx.addIssue({
        code: 'custom',
        path: ['vatAmount'],
        message: 'ارزش افزوده باید بین صفر و مبلغ قبل از مالیات باشد',
      });
    }
  });

export type ExpenseDocFormValues = z.infer<typeof expenseDocFormSchema>;

export function buildEmptyExpenseDocFormValues(defaultRegisterDate: string): ExpenseDocFormValues {
  return {
    fundId: '',
    registerDate: defaultRegisterDate,
    vendorName: '',
    vendorNationalId: '',
    invoiceNo: '',
    invoiceDate: '',
    evidenceType: EVIDENCE_TYPE_OPTIONS[0].value,
    description: '',
    expenseId: '',
    amountBeforeTax: '',
    vatAmount: '',
  };
}

export function expenseDocDtoToFormValues(dto: PettyCashExpenseDocDetailDto): ExpenseDocFormValues {
  return {
    fundId: dto.fundId ?? '',
    registerDate: dto.registerDate ?? '',
    vendorName: dto.vendorName ?? '',
    vendorNationalId: dto.vendorNationalId ?? '',
    invoiceNo: dto.invoiceNo ?? '',
    invoiceDate: dto.invoiceDate ?? '',
    evidenceType: (dto.evidenceType ?? EVIDENCE_TYPE_OPTIONS[0].value) as ExpenseDocFormValues['evidenceType'],
    description: dto.description ?? '',
    expenseId: dto.expenseId ?? '',
    amountBeforeTax: dto.amountBeforeTax != null ? String(dto.amountBeforeTax) : '',
    vatAmount: dto.vatAmount != null ? String(dto.vatAmount) : '',
  };
}

export function expenseDocFormValuesToPayload(values: ExpenseDocFormValues, year: string): ExpenseDocWritePayload {
  return {
    year,
    fundId: values.fundId,
    expenseId: values.expenseId,
    registerDate: values.registerDate?.trim() || '',
    vendorName: values.vendorName.trim(),
    vendorNationalId: values.vendorNationalId?.trim() ? values.vendorNationalId.trim() : null,
    invoiceNo: values.invoiceNo.trim(),
    invoiceDate: values.invoiceDate.trim(),
    evidenceType: values.evidenceType,
    amountBeforeTax: Number(values.amountBeforeTax || 0),
    vatAmount: Number(values.vatAmount || 0),
    description: values.description.trim(),
  };
}
