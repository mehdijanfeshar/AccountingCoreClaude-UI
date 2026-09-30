import { apiClient } from '../../lib/api/client';
import type { CreateResponse } from '../../lib/api/createResourceApi';
import type { PagedResult } from '../../types/pagedResult';
import type { TafsiliLookupItemDto } from '../../types/tafsili';
import type {
  ApprovalCartableItemDto,
  BankAccountBalanceDto,
  BankStatementAutoMatchResult,
  BankStatementBookLineDto,
  BankStatementDto,
  BankStatementLineResolutionTypeValue,
  BankStatementListResult,
  BankStatementStateValue,
  PaymentRequestAccountingDto,
  PaymentRequestDto,
  PaymentRequestListResult,
  PaymentRequestStateValue,
  ReceiptAccountingDto,
  ReceiptDto,
  ReceiptListResult,
  ReceiptStateValue,
  TransferAccountingDto,
  TransferDto,
  TransferListResult,
  TransferStateValue,
  TreasuryDashboardDto,
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
  /**
   * ایجاد یا جایگزینی کامل. فقط نقش FinanceManager همان واحد. سه فیلد `...AccountId` — بخش ۴-ب
   * (۲۰۲۶-۰۹-۲۹) — ۴۰۴ اگر مقدار داشته باشند ولی حساب معین موردنظر وجود نداشته باشد.
   */
  upsert(payload: {
    ceoApprovalThreshold: number;
    bulkApproveLimit: number;
    beneficiaryTafsilGroupId: string | null;
    payablesAccountId: string | null;
    vatCreditAccountId: string | null;
    insurancePayableAccountId: string | null;
    /** بخش ۴-ج (۲۰۲۶-۰۹-۲۹). */
    receivablesAccountId: string | null;
    customerTafsilGroupId: string | null;
    dailyTransferLimit: number | null;
    /** بخش ۴-د (۲۰۲۶-۰۹-۲۹). */
    bankFeeAccountId: string | null;
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
  /** بخش ۴-ب — فقط `ReadyForExecution` + `Suspended` («اجرای پرداخت»)، بی‌اثر از `state`. */
  forExecution?: boolean;
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
  /**
   * بخش ۴-ب — ثبت پرداخت واقعاً انجام‌شده در بانک (بدون یکپارچگی بانکی). سند «پرداخت» صادر و
   * Legacy `TB_PAYRECIVHEAD/DETAIL` نوشته می‌شود. فقط خزانه‌دار، ≠ ثبت‌کنندهٔ درخواست، فقط از
   * «آمادهٔ اجرا». `paidDate` — Legacy `YYYYMMDD`.
   */
  execute(
    id: string,
    payload: { bankReference: string; paidDate: string; destinationIban: string | null; paymentMethod: number | null },
  ): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/payment-requests/${id}/execute`, payload).then((res) => res.data);
  },
  /** بخش ۴-ب — تعلیق موقت. دلیل اجباری. فقط خزانه‌دار، فقط از «آمادهٔ اجرا». */
  suspend(id: string, reason: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/treasury/payment-requests/${id}/suspend`, { reason: reason.trim() })
      .then((res) => res.data);
  },
  /** بخش ۴-ب — رفع تعلیق. بدون بدنه. فقط خزانه‌دار، فقط از «معلق». */
  resume(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/payment-requests/${id}/resume`).then((res) => res.data);
  },
  /** بخش ۴-ب — سند «شناسایی بدهی»/«پرداخت» (اگر صادر شده باشند) + کد Legacy PayReciv. */
  getAccounting(id: string): Promise<PaymentRequestAccountingDto> {
    return apiClient
      .get<PaymentRequestAccountingDto>(`/treasury/payment-requests/${id}/accounting`)
      .then((res) => res.data);
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

/* ------------------------------------------------------------------------------------------- *
 * بخش ۴-ج — دریافت وجه
 * ------------------------------------------------------------------------------------------- */

export interface ReceiptListParams {
  pageNumber?: number;
  pageSize?: number;
  state?: ReceiptStateValue;
  search?: string;
}

/** Exact wire shape of `CreateTreasuryReceiptRequest`/`UpdateTreasuryReceiptRequest` (`TreasuryController.cs`). */
export interface ReceiptWritePayload {
  payerTafsiliId: string;
  amount: number;
  bankAccountId: string;
  receiptMethod: number;
  /** Legacy `YYYYMMDD`. */
  receiptDate: string;
  bankReference: string;
  invoiceRef: string | null;
  description: string | null;
}

export const receiptsApi = {
  list(params: ReceiptListParams): Promise<ReceiptListResult> {
    return apiClient.get<ReceiptListResult>('/treasury/receipts', { params }).then((res) => res.data);
  },
  getById(id: string): Promise<ReceiptDto> {
    return apiClient.get<ReceiptDto>(`/treasury/receipts/${id}`).then((res) => res.data);
  },
  /** پیش‌نویس می‌سازد، یا — اگر `register` باشد — بلافاصله ثبت می‌کند (صدور سند GL + Legacy PayReciv). */
  create(payload: ReceiptWritePayload & { year: string; register: boolean }): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/treasury/receipts', payload).then((res) => res.data);
  },
  // Intentionally POST, never PUT — see module docblock. فقط پیش‌نویس.
  update(id: string, payload: ReceiptWritePayload): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/receipts/${id}/update`, payload).then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. فقط پیش‌نویس.
  remove(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/receipts/${id}/delete`).then((res) => res.data);
  },
  /** صدور سند GL موقت «دریافت» + Legacy TB_PAYRECIVHEAD/DETAIL. فقط خزانه‌دار، فقط از پیش‌نویس. */
  register(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/receipts/${id}/register`).then((res) => res.data);
  },
  /** لغو. فقط پیش‌نویس. */
  cancel(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/receipts/${id}/cancel`).then((res) => res.data);
  },
  /** سند GL «دریافت» (اگر صادر شده باشد) + کد Legacy PayReciv. */
  getAccounting(id: string): Promise<ReceiptAccountingDto> {
    return apiClient.get<ReceiptAccountingDto>(`/treasury/receipts/${id}/accounting`).then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * بخش ۴-ج — انتقال وجه
 * ------------------------------------------------------------------------------------------- */

export interface TransferListParams {
  pageNumber?: number;
  pageSize?: number;
  state?: TransferStateValue;
  search?: string;
}

/** Exact wire shape of `CreateTransferRequest`/`UpdateTransferRequest` (`TreasuryController.cs`). */
export interface TransferWritePayload {
  sourceBankAccountId: string;
  destBankAccountId: string;
  amount: number;
  /** Legacy `YYYYMMDD`. */
  transferDate: string;
  transferMethod: number;
  reason: string;
}

export const transfersApi = {
  list(params: TransferListParams): Promise<TransferListResult> {
    return apiClient.get<TransferListResult>('/treasury/transfers', { params }).then((res) => res.data);
  },
  getById(id: string): Promise<TransferDto> {
    return apiClient.get<TransferDto>(`/treasury/transfers/${id}`).then((res) => res.data);
  },
  /** همیشه پیش‌نویس می‌سازد — بر خلاف درخواست پرداخت/دریافت وجه، `create` گزینهٔ ارسال بلافاصله ندارد. */
  create(payload: TransferWritePayload & { year: string }): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/treasury/transfers', payload).then((res) => res.data);
  },
  // Intentionally POST, never PUT — see module docblock. فقط پیش‌نویس یا برگشتی.
  update(id: string, payload: TransferWritePayload): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/transfers/${id}/update`, payload).then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. فقط پیش‌نویس یا برگشتی.
  remove(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/transfers/${id}/delete`).then((res) => res.data);
  },
  /** پیش‌نویس/برگشتی → در انتظار اقدام خزانه‌دار. بدون بدنه. */
  submit(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/treasury/transfers/${id}/submit`).then((res) => res.data);
  },
  /** تأیید — دو کنترل مسدودکننده (موجودی مبدأ، سقف روزانه)، سپس صدور سند GL موقت. فقط خزانه‌دار. */
  approve(id: string, bankReference: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/treasury/transfers/${id}/approve`, { bankReference: bankReference.trim() })
      .then((res) => res.data);
  },
  /** بازگشت به ثبت‌کننده برای اصلاح. دلیل اجباری. */
  returnTransfer(id: string, reason: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/treasury/transfers/${id}/return`, { reason: reason.trim() })
      .then((res) => res.data);
  },
  /** رد پایانی. دلیل اجباری. */
  reject(id: string, reason: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/treasury/transfers/${id}/reject`, { reason: reason.trim() })
      .then((res) => res.data);
  },
  /** سند GL «انتقال» (اگر صادر شده باشد). */
  getAccounting(id: string): Promise<TransferAccountingDto> {
    return apiClient.get<TransferAccountingDto>(`/treasury/transfers/${id}/accounting`).then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * بخش ۴-ج — موجودی حساب بانکی + تفصیلی مشتریان
 * ------------------------------------------------------------------------------------------- */

export const bankAccountBalanceApi = {
  /** موجودی فعلی (سال شمسی جاری) یک حساب بانکی — برای «موجودی فعلی/پس از انتقال» فرم انتقال وجه. */
  get(bankAccountId: string): Promise<BankAccountBalanceDto> {
    return apiClient.get<BankAccountBalanceDto>(`/treasury/bank-accounts/${bankAccountId}/balance`).then((res) => res.data);
  },
};

export interface CustomerTafsilisParams {
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const customerTafsilisApi = {
  /**
   * فقط تفصیلی‌های عضو گروه تفصیلی مشتریانِ تعریف‌شده در `TreasurySettingDto.customerTafsilGroupId`
   * — صفحهٔ خالی (نه خطا) اگر واحد هنوز گروهی تعریف نکرده.
   */
  list(params: CustomerTafsilisParams): Promise<PagedResult<TafsiliLookupItemDto>> {
    return apiClient
      .get<PagedResult<TafsiliLookupItemDto>>('/treasury/customer-tafsilis', { params })
      .then((res) => res.data);
  },
};

/** شکل هر عضو extension `failedIds` روی ۴۰۹ `bulk-approve` — `GlobalExceptionHandler` سمت سرور. */
export interface BulkApproveFailure {
  id: string;
  reason: string;
}

/* ------------------------------------------------------------------------------------------- *
 * بخش ۴-د — صورت‌حساب بانک و مغایرت‌گیری (`docs/tankhah-khazaneh-module.md` §۱۰)
 * ------------------------------------------------------------------------------------------- */

export interface BankStatementListParams {
  pageNumber?: number;
  pageSize?: number;
  bankAccountId?: string;
  state?: BankStatementStateValue;
}

/** Exact wire shape of `CreateBankStatementRequest`/`UpdateBankStatementRequest` (`TreasuryController.cs`). */
export interface BankStatementWritePayload {
  bankAccountId: string;
  /** Legacy `YYYYMMDD`. */
  fromDate: string;
  /** Legacy `YYYYMMDD`. */
  toDate: string;
  closingBalance: number;
  description: string | null;
}

/** Exact wire shape of `BankStatementLineRequest` — دقیقاً یکی از `withdrawal`/`deposit` باید > ۰ باشد. */
export interface BankStatementLineWritePayload {
  /** Legacy `YYYYMMDD`. */
  lineDate: string;
  bankReference: string | null;
  description: string | null;
  withdrawal: number;
  deposit: number;
  balance: number | null;
}

/** Response body for statement-level write actions — `BankStatementIdResponse`. */
export interface BankStatementIdResponse {
  id: string;
}

/** Response body for line-level write actions — `BankStatementLineIdResponse`. */
export interface BankStatementLineIdResponse {
  statementId: string;
  lineId: string;
}

/** Response body for `import` — `ImportBankStatementResponse`. */
export interface ImportBankStatementResponse {
  id: string;
  importedCount: number;
}

/**
 * خزانه‌داری، بخش ۴-د — مغایرت‌گیری بانکی. دست‌نویس، هم‌الگوی بقیهٔ این فایل: `statements` هم
 * `{ page, stateCounts }` برمی‌گرداند نه `PagedResult` خام، و اقدامات close/reopen/auto-match/
 * import/match/unmatch/resolve/unresolve فراتر از CRUD‌اند.
 *
 * ⚠️ CLAUDE.md rule #1: هر نوشتن فقط `POST` است، هرگز `PUT`/`DELETE`.
 */
export const bankStatementsApi = {
  list(params: BankStatementListParams): Promise<BankStatementListResult> {
    return apiClient.get<BankStatementListResult>('/treasury/statements', { params }).then((res) => res.data);
  },
  getById(id: string): Promise<BankStatementDto> {
    return apiClient.get<BankStatementDto>(`/treasury/statements/${id}`).then((res) => res.data);
  },
  create(payload: BankStatementWritePayload & { year: string }): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/treasury/statements', payload).then((res) => res.data);
  },
  // Intentionally POST, never PUT — see module docblock. فقط باز.
  update(id: string, payload: BankStatementWritePayload): Promise<BankStatementIdResponse> {
    return apiClient.post<BankStatementIdResponse>(`/treasury/statements/${id}/update`, payload).then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. فقط باز.
  remove(id: string): Promise<BankStatementIdResponse> {
    return apiClient.post<BankStatementIdResponse>(`/treasury/statements/${id}/delete`).then((res) => res.data);
  },
  /** بستن صورت‌حساب — پس از آن فقط‌خواندنی می‌شود (قابل بازگشایی). */
  close(id: string): Promise<BankStatementIdResponse> {
    return apiClient.post<BankStatementIdResponse>(`/treasury/statements/${id}/close`).then((res) => res.data);
  },
  reopen(id: string): Promise<BankStatementIdResponse> {
    return apiClient.post<BankStatementIdResponse>(`/treasury/statements/${id}/reopen`).then((res) => res.data);
  },
  /** تطبیق خودکار ردیف‌های تطبیق‌نیافته با ردیف‌های دفتر — نتیجه: شمار تطبیق‌یافته/تطبیق‌نیافته. */
  autoMatch(id: string): Promise<BankStatementAutoMatchResult> {
    return apiClient.post<BankStatementAutoMatchResult>(`/treasury/statements/${id}/auto-match`).then((res) => res.data);
  },
  /**
   * `multipart/form-data`. تا وقتی `IBankStatementFileParser`ی ثبت نشده همیشه ۴۰۹ «قالب فایل
   * دیسکت بانک هنوز تعریف نشده است» می‌دهد — `ErrorBanner`/`notify` همان پیام سرور را نشان می‌دهد.
   * Content-Type دستی ست نمی‌شود — axios/مرورگر خودش boundary فرم‌دیتا را می‌سازد.
   */
  import(id: string, file: File): Promise<ImportBankStatementResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<ImportBankStatementResponse>(`/treasury/statements/${id}/import`, formData).then((res) => res.data);
  },
  /** افزودن دستی یک ردیف. فقط باز. */
  addLine(id: string, payload: BankStatementLineWritePayload): Promise<BankStatementLineIdResponse> {
    return apiClient.post<BankStatementLineIdResponse>(`/treasury/statements/${id}/lines`, payload).then((res) => res.data);
  },
  // Intentionally POST, never PUT — see module docblock. فقط باز.
  updateLine(id: string, lineId: string, payload: BankStatementLineWritePayload): Promise<BankStatementLineIdResponse> {
    return apiClient
      .post<BankStatementLineIdResponse>(`/treasury/statements/${id}/lines/${lineId}/update`, payload)
      .then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. فقط باز.
  removeLine(id: string, lineId: string): Promise<BankStatementLineIdResponse> {
    return apiClient
      .post<BankStatementLineIdResponse>(`/treasury/statements/${id}/lines/${lineId}/delete`)
      .then((res) => res.data);
  },
  /** تطبیق دستی یک ردیف با یک ردیف سند — `voucherDetailId` از `getBookCandidates`. */
  matchLine(id: string, lineId: string, voucherDetailId: string): Promise<BankStatementLineIdResponse> {
    return apiClient
      .post<BankStatementLineIdResponse>(`/treasury/statements/${id}/lines/${lineId}/match`, { voucherDetailId })
      .then((res) => res.data);
  },
  /** لغو تطبیق (خودکار یا دستی) — ردیف به تطبیق‌نیافته برمی‌گردد. */
  unmatchLine(id: string, lineId: string): Promise<BankStatementLineIdResponse> {
    return apiClient.post<BankStatementLineIdResponse>(`/treasury/statements/${id}/lines/${lineId}/unmatch`).then((res) => res.data);
  },
  /** رفع ردیف تطبیق‌نیافته: سند کارمزد بانکی (فقط برداشت)، اتصال به دریافت (فقط واریز)، یا نادیده‌گرفتن (یادداشت اجباری). */
  resolveLine(
    id: string,
    lineId: string,
    payload: { type: BankStatementLineResolutionTypeValue; receiptId: string | null; note: string | null },
  ): Promise<BankStatementLineIdResponse> {
    return apiClient
      .post<BankStatementLineIdResponse>(`/treasury/statements/${id}/lines/${lineId}/resolve`, payload)
      .then((res) => res.data);
  },
  /** برگرداندن رفع — برای سند کارمزد فقط وقتی سند هنوز موقت است، وگرنه ۴۰۹. */
  unresolveLine(id: string, lineId: string): Promise<BankStatementLineIdResponse> {
    return apiClient
      .post<BankStatementLineIdResponse>(`/treasury/statements/${id}/lines/${lineId}/unresolve`)
      .then((res) => res.data);
  },
  /** ردیف‌های دفتری تطبیق‌نیافتهٔ کاندید برای تطبیق دستی یک ردیف صورت‌حساب. */
  getBookCandidates(id: string, lineId: string): Promise<BankStatementBookLineDto[]> {
    return apiClient
      .get<BankStatementBookLineDto[]>(`/treasury/statements/${id}/book-candidates`, { params: { lineId } })
      .then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * بخش ۴-د — داشبورد خزانه
 * ------------------------------------------------------------------------------------------- */

export const treasuryDashboardApi = {
  get(): Promise<TreasuryDashboardDto> {
    return apiClient.get<TreasuryDashboardDto>('/treasury/dashboard').then((res) => res.data);
  },
};
