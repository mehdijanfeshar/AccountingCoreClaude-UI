import { z } from 'zod';
import { enumFieldSchema, nonNullableEnumFieldSchema } from '../../lib/validation/enumFieldSchema';
import { EVIDENCE_TYPE_OPTIONS, SETTLEMENT_PERIOD_OPTIONS } from './pettyCashDocState';
import type { ExpenseDocWritePayload, PettyCashFundWritePayload } from './api';
import type {
  PettyCashExpenseDocDetailDto,
  PettyCashFundDto,
  PettyCashSettlementPeriodValue,
} from '../../types/pettyCash';

const EVIDENCE_TYPE_VALUES = EVIDENCE_TYPE_OPTIONS.map((o) => o.value);
const SETTLEMENT_PERIOD_VALUES = SETTLEMENT_PERIOD_OPTIONS.map((o) => o.value);

/* ------------------------------------------------------------------------------------------- *
 * تعریف تنخواه — ساخت/ویرایش (`TB_PC_FUND`، ۲۰۲۶-۰۹-۲۸: جدول مستقل خودِ این ماژول)
 * ------------------------------------------------------------------------------------------- */

/** UX-presentation validation only — `CreatePettyCashFundCommandValidator` سمت سرور مرجع است. */
export const fundFormSchema = z
  .object({
    code: z.string().trim().min(1, 'کد الزامی است').max(20, 'حداکثر ۲۰ کاراکتر است'),
    name: z.string().trim().min(1, 'عنوان الزامی است').max(200, 'حداکثر ۲۰۰ کاراکتر است'),
    custodianUserId: z.string().trim().min(1, 'کد کاربری تنخواه‌دار الزامی است').max(50, 'حداکثر ۵۰ کاراکتر است'),
    custodianName: z.string().trim().max(200, 'حداکثر ۲۰۰ کاراکتر است').optional().or(z.literal('')),
    ceiling: z.string().trim().min(1, 'سقف تنخواه الزامی است'),
    perDocLimit: z.string().trim().min(1, 'سقف هر سند الزامی است'),
    alertThresholdPercent: z
      .string()
      .optional()
      .or(z.literal(''))
      .refine((v) => !v || (Number(v) >= 0 && Number(v) <= 100), 'باید عددی بین ۰ تا ۱۰۰ باشد'),
    accountCodeId: z.string().nullable().optional(),
    accountCodeLabel: z.string().nullable().optional(),
    // نه هزینه‌کرد نه ترمیم به این ستون وابسته نیستند؛ نبودِ آن (پیش‌فرض) یعنی «هنوز تعیین نشده».
    settlementPeriod: enumFieldSchema(SETTLEMENT_PERIOD_VALUES, 'دورهٔ تسویه نامعتبر است'),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const ceiling = Number(values.ceiling || 0);
    const perDocLimit = Number(values.perDocLimit || 0);
    if (values.perDocLimit && perDocLimit > ceiling) {
      ctx.addIssue({
        code: 'custom',
        path: ['perDocLimit'],
        message: 'سقف هر سند نباید از سقف تنخواه بیشتر باشد',
      });
    }
  });

export type FundFormValues = z.infer<typeof fundFormSchema>;

export function buildEmptyFundFormValues(): FundFormValues {
  return {
    code: '',
    name: '',
    custodianUserId: '',
    custodianName: '',
    ceiling: '',
    perDocLimit: '',
    alertThresholdPercent: '',
    accountCodeId: null,
    accountCodeLabel: null,
    settlementPeriod: null,
    isActive: true,
  };
}

export function fundDtoToFormValues(dto: PettyCashFundDto, accountCodeLabel: string | null): FundFormValues {
  return {
    code: dto.code ?? '',
    name: dto.name ?? '',
    custodianUserId: dto.custodianUserId ?? '',
    custodianName: dto.custodianName ?? '',
    ceiling: dto.ceiling != null ? String(dto.ceiling) : '',
    perDocLimit: dto.perDocLimit != null ? String(dto.perDocLimit) : '',
    alertThresholdPercent: dto.alertThresholdPercent != null ? String(dto.alertThresholdPercent) : '',
    accountCodeId: dto.accountCodeId ?? null,
    accountCodeLabel,
    settlementPeriod: dto.settlementPeriod ?? null,
    isActive: dto.isActive,
  };
}

export function fundFormValuesToPayload(values: FundFormValues): PettyCashFundWritePayload {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    custodianUserId: values.custodianUserId.trim(),
    custodianName: values.custodianName?.trim() ? values.custodianName.trim() : null,
    ceiling: Number(values.ceiling || 0),
    perDocLimit: Number(values.perDocLimit || 0),
    alertThresholdPercent: values.alertThresholdPercent ? Number(values.alertThresholdPercent) : null,
    accountCodeId: values.accountCodeId ?? null,
    settlementPeriod: values.settlementPeriod as PettyCashSettlementPeriodValue | null,
    isActive: values.isActive,
  };
}

/* ------------------------------------------------------------------------------------------- *
 * بخش ۲ — بررسی‌کنندگان تنخواه (`TB_PC_REVIEWER`)
 * ------------------------------------------------------------------------------------------- */

/** UX-presentation validation only — `UpsertPettyCashFundReviewerCommandValidator` سمت سرور مرجع است. */
export const reviewerFormSchema = z.object({
  reviewerUserId: z.string().trim().min(1, 'کد کاربری الزامی است').max(50, 'حداکثر ۵۰ کاراکتر است'),
  reviewerName: z.string().trim().max(200, 'حداکثر ۲۰۰ کاراکتر است').optional().or(z.literal('')),
});

export type ReviewerFormValues = z.infer<typeof reviewerFormSchema>;

export function buildEmptyReviewerFormValues(): ReviewerFormValues {
  return { reviewerUserId: '', reviewerName: '' };
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
