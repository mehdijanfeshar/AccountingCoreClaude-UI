import { apiClient } from '../../lib/api/client';
import type { CreateResponse } from '../../lib/api/createResourceApi';
import type { PagedResult } from '../../types/pagedResult';
import type { TafsiliLookupItemDto } from '../../types/tafsili';
import type {
  ApprovalCartableItemDto,
  PaymentRequestDto,
  PaymentRequestListResult,
  PaymentRequestStateValue,
  TreasuryRoleDto,
  TreasurySettingDto,
} from '../../types/treasury';

/**
 * خزانه‌داری، بخش ۴-الف — درخواست پرداخت + کارتابل تأیید (`docs/tankhah-khazaneh-module.md` §۱۰).
 * دست‌نویس، هم‌الگوی `features/petty-cash/api.ts`: هیچ‌کدام از این منابع با شکل یکنواخت
 * `createResourceApi` جور در نمی‌آیند (`payment-requests` یک `{ page, stateCounts }` برمی‌گرداند نه
 * `PagedResult` خام، و اقدامات submit/approve/return/reject/bulk-approve فراتر از CRUD‌اند؛
 * `settings`/`roles` هم شکل مخصوص خودشان را دارند).
 *
 * ⚠️ CLAUDE.md rule #1: هر نوشتن فقط `POST` است، هرگز `PUT`/`DELETE`. Rule #2: `vahedCode` اینجا
 * هرگز در بدنه/query نمی‌آید — همان الگوی بقیهٔ برنامه، هدر `X-Vahed-Code` را axios interceptor
 * خودش از `SessionContext` اضافه می‌کند؛ `year` واقعاً یک پارامتر بدنه/query است.
 */

/* ------------------------------------------------------------------------------------------- *
 * تنظیمات خزانه
 * ------------------------------------------------------------------------------------------- */

export const treasurySettingsApi = {
  /** ۴۰۴ اگر مدیر مالی هنوز تنظیمات را تعریف نکرده — فراخوان با `error.isNotFound` تشخیص می‌دهد. */
  get(): Promise<TreasurySettingDto> {
    return apiClient.get<TreasurySettingDto>('/treasury/settings').then((res) => res.data);
  },
  /** ایجاد یا جایگزینی کامل. فقط نقش FinanceManager همان واحد. */
  upsert(payload: {
    ceoApprovalThreshold: number;
    bulkApproveLimit: number;
    beneficiaryTafsilGroupId: string | null;
  }): Promise<TreasurySettingDto> {
    return apiClient.post<TreasurySettingDto>('/treasury/settings', payload).then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * نقش‌های خزانه
 * ------------------------------------------------------------------------------------------- */

export const treasuryRolesApi = {
  list(): Promise<TreasuryRoleDto[]> {
    return apiClient.get<TreasuryRoleDto[]>('/treasury/roles').then((res) => res.data);
  },
  /**
   * فقط نقش FinanceManager همان واحد — با استثنای bootstrap: اگر واحد هیچ FinanceManager فعالی
   * ندارد، هر کاربر احرازشدهٔ واحد می‌تواند نقش ثبت کند.
   */
  // `role` is a plain `number` (not the literal union) — same convention as `PaymentRequestWritePayload`.
  create(payload: { userId: string; userName: string | null; role: number }): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/treasury/roles', payload).then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. Soft-delete.
  remove(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/roles/${id}/delete`).then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * درخواست پرداخت
 * ------------------------------------------------------------------------------------------- */

export interface PaymentRequestListParams {
  pageNumber?: number;
  pageSize?: number;
  state?: PaymentRequestStateValue;
  search?: string;
}

/**
 * یک ردیف `costCenterTafsilis` روی بدنهٔ نوشتن — دقیقاً `PaymentRequestTafsiliLinkInput` سمت سرور
 * (`Accounting.Application.Treasury.Commands.Common`).
 */
export interface PaymentRequestTafsiliLinkInput {
  tafsiliId: string;
  levelId: string;
}

/**
 * Exact wire shape of `CreatePaymentRequestRequest`/`UpdatePaymentRequestRequest`
 * (`TreasuryController.cs`). `paymentType`/`paymentMethod` are plain `number` (not the literal
 * union `types/treasury.ts` uses for read DTOs) — same convention as
 * `ExpenseDocWritePayload.evidenceType`: the form's Zod enum field widens to `number`.
 *
 * اصلاح ۴-الف (۲۰۲۶-۰۹-۲۹): `costCenterTafsiliId` تک‌سطحی حذف و با `costCenterTafsilis` (یک ردیف
 * به‌ازای هر سطح تفصیلی الزامی حساب هزینه) جایگزین شد.
 */
export interface PaymentRequestWritePayload {
  beneficiaryName: string;
  beneficiaryNationalId: string | null;
  beneficiaryTafsiliId: string | null;
  paymentType: number;
  invoiceRef: string | null;
  invoiceApproved: boolean;
  expenseAccountId: string;
  costCenterTafsilis: PaymentRequestTafsiliLinkInput[];
  amountBeforeTax: number;
  vatPercent: number | null;
  vatAmount: number | null;
  insuranceDeductionPercent: number | null;
  insuranceDeductionAmount: number | null;
  /** Legacy `YYYYMMDD`. */
  dueDate: string;
  paymentAccountId: string;
  paymentMethod: number | null;
  description: string | null;
}

export const paymentRequestsApi = {
  list(params: PaymentRequestListParams): Promise<PaymentRequestListResult> {
    return apiClient.get<PaymentRequestListResult>('/treasury/payment-requests', { params }).then((res) => res.data);
  },
  getById(id: string): Promise<PaymentRequestDto> {
    return apiClient.get<PaymentRequestDto>(`/treasury/payment-requests/${id}`).then((res) => res.data);
  },
  /** پیش‌نویس می‌سازد، یا — اگر `submit` باشد — بلافاصله به مرحلهٔ تأیید مدیر واحد می‌فرستد. */
  create(payload: PaymentRequestWritePayload & { year: string; submit: boolean }): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/treasury/payment-requests', payload).then((res) => res.data);
  },
  // Intentionally POST, never PUT — see module docblock. فقط Draft/Returned و فقط ثبت‌کننده.
  update(id: string, payload: PaymentRequestWritePayload): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/payment-requests/${id}/update`, payload).then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. فقط Draft/Returned و فقط ثبت‌کننده.
  remove(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/payment-requests/${id}/delete`).then((res) => res.data);
  },
  /** Draft/Returned → PendingUnitManager. بدون بدنه. فقط ثبت‌کننده. */
  submit(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/payment-requests/${id}/submit`).then((res) => res.data);
  },
  /** یک مرحله جلو می‌برد. فقط نقش مرحلهٔ فعلی، ≠ ثبت‌کننده، ≠ تأییدکنندهٔ مرحلهٔ قبل. */
  approve(id: string, note?: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/treasury/payment-requests/${id}/approve`, { note: note?.trim() || null })
      .then((res) => res.data);
  },
  /** به ثبت‌کننده برای اصلاح برمی‌گرداند. دلیل اجباری. */
  returnRequest(id: string, reason: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/treasury/payment-requests/${id}/return`, { reason: reason.trim() })
      .then((res) => res.data);
  },
  /** رد پایانی. دلیل اجباری. */
  reject(id: string, reason: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/treasury/payment-requests/${id}/reject`, { reason: reason.trim() })
      .then((res) => res.data);
  },
  /**
   * تأیید گروهی — تمام‌یا‌هیچ. شکست یکی از شناسه‌ها کل عملیات را با ۴۰۹ برمی‌گرداند؛ body آن یک
   * extension به‌نام `failedIds: [{ id, reason }]` دارد — همان‌طور که `ApiError.problem` می‌خواند
   * (هم‌الگوی `pettyCashExpenseDocsApi.bulkApprove`).
   */
  bulkApprove(ids: string[]): Promise<{ ids: string[] }> {
    return apiClient.post<{ ids: string[] }>('/treasury/payment-requests/bulk-approve', { ids }).then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * کارتابل تأیید
 * ------------------------------------------------------------------------------------------- */

export interface ApprovalCartableParams {
  pageNumber?: number;
  pageSize?: number;
}

export const approvalCartableApi = {
  /** ادغام درخواست‌های پرداخت Pending* و ترمیم‌های تنخواهِ PendingTreasurer، قدیمی‌ترین اول. */
  list(params: ApprovalCartableParams): Promise<PagedResult<ApprovalCartableItemDto>> {
    return apiClient
      .get<PagedResult<ApprovalCartableItemDto>>('/treasury/approval-cartable', { params })
      .then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * تفصیلی ذی‌نفع (اصلاح ۴-الف، ۲۰۲۶-۰۹-۲۹)
 * ------------------------------------------------------------------------------------------- */

export interface BeneficiaryTafsilisParams {
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const beneficiaryTafsilisApi = {
  /**
   * فقط تفصیلی‌های عضو گروه تفصیلی ذی‌نفعِ تعریف‌شده در `TreasurySettingDto.beneficiaryTafsilGroupId`
   * — صفحهٔ خالی (نه خطا) اگر واحد هنوز گروهی تعریف نکرده.
   */
  list(params: BeneficiaryTafsilisParams): Promise<PagedResult<TafsiliLookupItemDto>> {
    return apiClient
      .get<PagedResult<TafsiliLookupItemDto>>('/treasury/beneficiary-tafsilis', { params })
      .then((res) => res.data);
  },
};

/** شکل هر عضو extension `failedIds` روی ۴۰۹ `bulk-approve` — `GlobalExceptionHandler` سمت سرور. */
export interface BulkApproveFailure {
  id: string;
  reason: string;
}
