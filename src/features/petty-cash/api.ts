import { apiClient } from '../../lib/api/client';
import type { CreateResponse } from '../../lib/api/createResourceApi';
import type { PagedResult } from '../../types/pagedResult';
import type {
  PettyCashAttachmentDto,
  PettyCashDocEventDto,
  PettyCashExpenseDocDetailDto,
  PettyCashExpenseDocDto,
  PettyCashFundDashboardDto,
  PettyCashFundDto,
  PettyCashFundLedgerDto,
  PettyCashFundReviewerDto,
  PettyCashLedgerRowType,
  PettyCashRefundDto,
  PettyCashReplenishmentDto,
  PettyCashReplenishmentListItemDto,
  PettyCashReplenishmentPreviewDto,
  PettyCashReplenishmentStateValue,
  PettyCashSettlementHistoryItemDto,
  PettyCashSettlementPeriodValue,
  PettyCashSettlementPreviewDto,
  PettyCashSettlementTafsiliDto,
  PettyCashStateCount,
} from '../../types/pettyCash';

/**
 * تنخواه و خزانه‌داری — بخش ۱ (`docs/tankhah-khazaneh-module.md` §۵) + تصمیم ۲۰۲۶-۰۹-۲۸ (تنخواه
 * جدول مستقل خودش، `TB_PC_FUND`، جداشده از `TB_REVOLVING_FUND`).
 *
 * Hand-written rather than `createResourceApi`, because neither resource fits its uniform
 * create/list/update/delete shape:
 *   - `funds` را می‌شد با `createResourceApi` ساخت، اما `list()` یک آرایهٔ خام برمی‌گرداند نه
 *     `PagedResult` — همین یک تفاوت برای دست‌نویس ماندن این resource کافی بود؛ create/update/remove
 *     دقیقاً همان الگوی POST {id}/update و POST {id}/delete را دنبال می‌کنند.
 *   - `expense-docs` needs a `state`-aware list response (`{ page, stateCounts }` rather than a
 *     bare `PagedResult`) and an extra `submit` action beyond create/update/delete.
 *
 * ⚠️ CLAUDE.md rule #1 still applies everywhere below: every write is `POST`, never `PUT`/`DELETE`.
 * Rule #2: `vahedCode` never appears in any payload/query here — every one of these endpoints is
 * `IVahedScoped` server-side (§۵), the same as the rest of the app; the axios interceptor already
 * attaches `X-Vahed-Code` from `SessionContext` to every request, so nothing module-specific is
 * needed for that here.
 */

/** Exact wire shape of `CreatePettyCashFundRequest`/`UpdatePettyCashFundRequest` (`PettyCashController.cs`). */
export interface PettyCashFundWritePayload {
  code: string;
  name: string;
  custodianUserId: string;
  custodianName: string | null;
  ceiling: number;
  perDocLimit: number;
  /** سقف اختیار تأیید نهایی نقش مدیر مالی — تکمیل بخش ۲ (۲۰۲۶-۰۹-۲۸)، الزامی و باید `> 0` باشد. */
  financeManagerApprovalLimit: number;
  alertThresholdPercent: number | null;
  accountCodeId: string | null;
  settlementPeriod: PettyCashSettlementPeriodValue | null;
  isActive: boolean;
  /**
   * بخش ۳-الف (۲۰۲۶-۰۹-۲۸) — چه نقشی مجاز به ثبت/حذف استرداد وجه این تنخواه است. پیش‌فرض سرور
   * «خزانه‌دار». `number`، نه `PettyCashRefundRecorderValue` — همان الگوی `evidenceType` روی
   * `ExpenseDocWritePayload`: مقدار فرم از یک Zod enum عمومی (`nonNullableEnumFieldSchema`) می‌آید.
   */
  refundRecorder: number;
}

export const pettyCashFundsApi = {
  /** `GET /api/petty-cash/funds` — bare array, not a `PagedResult` (few enough rows per unit). */
  list(): Promise<PettyCashFundDto[]> {
    return apiClient.get<PettyCashFundDto[]>('/petty-cash/funds').then((res) => res.data);
  },
  getById(fundId: string): Promise<PettyCashFundDto> {
    return apiClient.get<PettyCashFundDto>(`/petty-cash/funds/${fundId}`).then((res) => res.data);
  },
  create(payload: PettyCashFundWritePayload): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/petty-cash/funds', payload).then((res) => res.data);
  },
  // Intentionally POST, never PUT — see module docblock.
  update(fundId: string, payload: PettyCashFundWritePayload): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/funds/${fundId}/update`, payload)
      .then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. 409 when the fund still has non-deleted صورت‌هزینه rows.
  remove(fundId: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/petty-cash/funds/${fundId}/delete`).then((res) => res.data);
  },
};

export interface ExpenseDocListParams {
  pageNumber?: number;
  pageSize?: number;
  /** Exact-match single state, mirroring the `docLife` filter on `voucher-heads` — no OR support
   * server-side. See `PettyCashCartablePage` for how the combined «در جریان» tab works around it. */
  state?: number;
  fundId?: string;
  search?: string;
}

export interface ExpenseDocListResult {
  page: PagedResult<PettyCashExpenseDocDto>;
  stateCounts: PettyCashStateCount[];
}

/**
 * Exact wire shape of the create/update expense-doc command (spec §۵, §۳ `TB_PC_EXPENSE_DOC`).
 * `submit` only exists on create — filing an already-created draft goes through the separate
 * `POST {id}/submit` endpoint instead, which is why it is not part of `update`'s payload either.
 */
export interface ExpenseDocWritePayload {
  fundId: string;
  expenseId: string;
  /** Legacy `YYYYMMDD`. */
  registerDate: string;
  /** Fiscal year selected in the session (`SessionContext.financialYear`), like voucher entry. */
  year: string;
  vendorName: string;
  vendorNationalId: string | null;
  invoiceNo: string;
  /** Legacy `YYYYMMDD`. */
  invoiceDate: string;
  evidenceType: number;
  amountBeforeTax: number;
  vatAmount: number;
  description: string;
}

export const pettyCashExpenseDocsApi = {
  list(params: ExpenseDocListParams): Promise<ExpenseDocListResult> {
    return apiClient
      .get<ExpenseDocListResult>('/petty-cash/expense-docs', { params })
      .then((res) => res.data);
  },
  getById(id: string): Promise<PettyCashExpenseDocDetailDto> {
    return apiClient
      .get<PettyCashExpenseDocDetailDto>(`/petty-cash/expense-docs/${id}`)
      .then((res) => res.data);
  },
  create(payload: ExpenseDocWritePayload & { submit: boolean }): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/petty-cash/expense-docs', payload).then((res) => res.data);
  },
  // Intentionally POST, never PUT — see module docblock.
  update(id: string, payload: ExpenseDocWritePayload): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${id}/update`, payload)
      .then((res) => res.data);
  },
  /** ارسال برای بررسی — Draft/Returned → PendingReview. Separate from `update` on purpose (spec §۵). */
  submit(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/petty-cash/expense-docs/${id}/submit`).then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. Only a Draft may be deleted (409 otherwise).
  remove(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/petty-cash/expense-docs/${id}/delete`).then((res) => res.data);
  },
  /** بخش ۲ — جدید → در انتظار بررسی. بدون بدنه؛ فقط یک `TB_PC_REVIEWER` فعالِ غیرِ سازندهٔ سند مجاز است. */
  startReview(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/petty-cash/expense-docs/${id}/start-review`).then((res) => res.data);
  },
  /**
   * تکمیل بخش ۲ (۲۰۲۶-۰۹-۲۸) — «تأیید کنترل» توسط بازرس، گام اول تأیید دومرحله‌ای. وضعیت سند
   * تغییر نمی‌کند؛ فقط `verifiedByUserId`/`verifiedDate` ست می‌شود.
   */
  verify(id: string, note?: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${id}/verify`, { note: note?.trim() || null })
      .then((res) => res.data);
  },
  /** بخش ۲ — «تأیید نهایی»، در انتظار بررسی → تأییدشده. فقط پس از `verify`. */
  approve(id: string, note?: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${id}/approve`, { note: note?.trim() || null })
      .then((res) => res.data);
  },
  /**
   * بخش ۲ — در انتظار بررسی → برگشتی، با یک یا چند دلیل، مهلت اصلاح و توضیح برای تنخواه‌دار —
   * هر سه الزامی (تصمیم ۲۰۲۶-۰۹-۲۸، صفحهٔ ۸ پاورپوینت؛ `ReturnPettyCashExpenseDocCommandValidator`
   * سمت سرور با ۴۰۰ همین را اجرا می‌کند).
   */
  returnDoc(id: string, payload: PettyCashReturnPayload): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${id}/return`, {
        reasonCodes: payload.reasonCodes,
        deadline: payload.deadline,
        note: payload.note.trim(),
      })
      .then((res) => res.data);
  },
  /**
   * بخش ۲ — در انتظار بررسی → ردشده (پایانی، بدون ترمیم). `note` («دلیل رد») الزامی است
   * (۲۰۲۶-۰۹-۲۸؛ `RejectPettyCashExpenseDocCommandValidator` سمت سرور با ۴۰۰ همین را اجرا می‌کند).
   */
  reject(id: string, note: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${id}/reject`, { note: note.trim() })
      .then((res) => res.data);
  },
  /**
   * بخش ۲ — تأیید گروهی، تمام‌یا‌هیچ. شکست هر یک از شناسه‌ها کل عملیات را با ۴۰۹ برمی‌گرداند و
   * body آن یک extension به‌نام `failedIds: [{ id, reason }]` دارد — به‌جای اضافه‌کردن یک shape
   * جدید فقط برای این مورد، فراخوان همان `ApiError` را می‌گیرد و `error.problem?.failedIds` را
   * می‌خواند (`ApiError.problem` دقیقاً برای همین‌جور extensionهای ad hoc نگه داشته می‌شود).
   */
  bulkApprove(ids: string[]): Promise<BulkApproveResult> {
    return apiClient
      .post<BulkApproveResult>('/petty-cash/expense-docs/bulk-approve', { ids })
      .then((res) => res.data);
  },
};

export interface PettyCashReturnPayload {
  reasonCodes: number[];
  deadline: string;
  /** «توضیح برای تنخواه‌دار» — الزامی (۲۰۲۶-۰۹-۲۸). */
  note: string;
}

export interface BulkApproveResult {
  ids: string[];
}

/** شکل هر عضو extension `failedIds` روی ۴۰۹ `bulk-approve` — `GlobalExceptionHandler` سمت سرور. */
export interface BulkApproveFailure {
  id: string;
  reason: string;
}

/** بخش ۲ — بررسی‌کنندگان تنخواه (`TB_PC_REVIEWER`)، RBAC مخصوص این ماژول. */
export const pettyCashFundReviewersApi = {
  list(fundId: string): Promise<PettyCashFundReviewerDto[]> {
    return apiClient
      .get<PettyCashFundReviewerDto[]>(`/petty-cash/funds/${fundId}/reviewers`)
      .then((res) => res.data);
  },
  /**
   * Upsert کلیدی روی `(fundId, reviewerUserId, role)` است، نه `id` — تکمیل بخش ۲ (۲۰۲۶-۰۹-۲۸):
   * یک کاربر می‌تواند روی یک تنخواه بیش از یک نقش داشته باشد. فراخوانی دوباره با همان سه‌تایی نام
   * را به‌روزرسانی (یا رکورد نرم‌حذف‌شده را فعال) می‌کند؛ تغییر کد کاربری یا نقش همیشه رکورد جدید
   * می‌سازد. به همین دلیل امضای این تابع `id` نمی‌گیرد.
   */
  upsert(
    fundId: string,
    payload: { reviewerUserId: string; reviewerName: string | null; role: number },
  ): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/funds/${fundId}/reviewers`, payload)
      .then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. Soft-delete.
  remove(fundId: string, id: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/funds/${fundId}/reviewers/${id}/delete`)
      .then((res) => res.data);
  },
};

/** بایت‌های حداکثری یک پیوست — همان سقف سرور (۴۰۰ فراتر از این)؛ اینجا فقط برای رد سریع سمت UX. */
export const PETTY_CASH_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * بخش ۲-ب — پیوست فایل به صورت‌هزینه (`docs/tankhah-khazaneh-module.md`، تصمیم‌های بخش ۲، پیوست).
 * افزودن/حذف فقط برای مالک سند و فقط در وضعیت پیش‌نویس/برگشتی — قاعدهٔ واقعی سمت سرور است (۴۰۹/۴۰۳
 * روی خطا)؛ اینجا هیچ تصمیمی گرفته نمی‌شود.
 */
export const pettyCashAttachmentsApi = {
  /** متادیتای پیوست‌ها — هرگز بایت فایل. */
  list(expenseDocId: string): Promise<PettyCashAttachmentDto[]> {
    return apiClient
      .get<PettyCashAttachmentDto[]>(`/petty-cash/expense-docs/${expenseDocId}/attachments`)
      .then((res) => res.data);
  },
  /**
   * `multipart/form-data`. Content-Type را دستی ست نمی‌کنیم — axios/مرورگر خودش boundary درست
   * فرم‌دیتا را می‌سازد؛ ست دستی آن باعث گم‌شدن boundary و شکست کل درخواست می‌شود.
   */
  upload(expenseDocId: string, file: File, attachName?: string): Promise<CreateResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (attachName?.trim()) {
      formData.append('attachName', attachName.trim());
    }
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${expenseDocId}/attachments`, formData)
      .then((res) => res.data);
  },
  /**
   * بایت‌ها را به‌صورت blob می‌گیرد و با یک لینک موقت ذخیره می‌کند — نه یک لینک مستقیم `<a href>`،
   * چون آن راه هدر `Authorization`/`X-Vahed-Code` را از دست می‌دهد و سرور با ۴۰۱ رد می‌کند.
   */
  async download(expenseDocId: string, attachmentId: string, fallbackFileName: string): Promise<void> {
    const response = await apiClient.get<Blob>(
      `/petty-cash/expense-docs/${expenseDocId}/attachments/${attachmentId}/download`,
      { responseType: 'blob' },
    );
    const fileName = extractContentDispositionFileName(response.headers['content-disposition']) ?? fallbackFileName;
    downloadBlob(response.data, fileName);
  },
  /**
   * صفحهٔ بررسی (ص ۷) — بایت‌ها را برای پیش‌نمایش inline (`<img>`/`<iframe>`) به‌صورت blob می‌گیرد،
   * بدون کلیک ساختگی/دانلود فایل. لینک مستقیم `<a href>` اینجا هم کار نمی‌کند (هدر `Authorization`/
   * `X-Vahed-Code` را از دست می‌دهد)؛ فراخوان مسئول `URL.revokeObjectURL` روی خروجی است.
   */
  async getBlob(expenseDocId: string, attachmentId: string): Promise<{ blob: Blob; contentType: string | null }> {
    const response = await apiClient.get<Blob>(
      `/petty-cash/expense-docs/${expenseDocId}/attachments/${attachmentId}/download`,
      { responseType: 'blob' },
    );
    return { blob: response.data, contentType: (response.headers['content-type'] as string | undefined) ?? null };
  },
  // Intentionally POST, never DELETE — see module docblock. Soft-delete.
  remove(expenseDocId: string, attachmentId: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${expenseDocId}/attachments/${attachmentId}/delete`)
      .then((res) => res.data);
  },
};

/** «گردش عملیات» — تاریخچهٔ کامل یک صورت‌هزینه (`docs/tankhah-khazaneh-module.md` §۵). */
export const pettyCashDocEventsApi = {
  list(expenseDocId: string): Promise<PettyCashDocEventDto[]> {
    return apiClient
      .get<PettyCashDocEventDto[]>(`/petty-cash/expense-docs/${expenseDocId}/events`)
      .then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * بخش ۳-الف (۲۰۲۶-۰۹-۲۸) — ترمیم/شارژ، استرداد وجه، داشبورد، گزارش گردش
 * (`docs/tankhah-khazaneh-module.md` §۹).
 * ------------------------------------------------------------------------------------------- */

/** Exact wire shape of `CreatePettyCashReplenishmentRequest` (`PettyCashController.cs`). */
export interface PettyCashReplenishmentWritePayload {
  fundId: string;
  sourceBankAccountId: string;
  /** `number`, not `PettyCashPaymentMethodValue` — همان الگوی `refundRecorder` بالا. */
  paymentMethod: number;
  /** Legacy `YYYYMMDD`. */
  registerDate: string;
  /** سال مالی جلسه — همان الگوی `ExpenseDocWritePayload.year`. */
  year: string;
  note: string | null;
  submit: boolean;
}

export interface ReplenishmentListParams {
  pageNumber?: number;
  pageSize?: number;
  fundId?: string;
  state?: PettyCashReplenishmentStateValue;
}

export const pettyCashReplenishmentsApi = {
  /**
   * پیش‌نمایش ترمیم بعدی برای یک تنخواه — همان مبلغ/خطوط/اسنادی که `create` اگر همین الان
   * فراخوانی شود می‌سازد. `404` اگر تنخواه وجود نداشته باشد.
   */
  preview(fundId: string): Promise<PettyCashReplenishmentPreviewDto> {
    return apiClient
      .get<PettyCashReplenishmentPreviewDto>(`/petty-cash/funds/${fundId}/replenishment-preview`)
      .then((res) => res.data);
  },
  list(params: ReplenishmentListParams): Promise<PagedResult<PettyCashReplenishmentListItemDto>> {
    return apiClient
      .get<PagedResult<PettyCashReplenishmentListItemDto>>('/petty-cash/replenishments', { params })
      .then((res) => res.data);
  },
  getById(id: string): Promise<PettyCashReplenishmentDto> {
    return apiClient.get<PettyCashReplenishmentDto>(`/petty-cash/replenishments/${id}`).then((res) => res.data);
  },
  /** می‌سازد و — در همان لحظه — هر صورت‌هزینهٔ تأییدشدهٔ منتظر ترمیم را لینک می‌کند. ۴۰۹ اگر هیچ صورت‌هزینه‌ای برای ترمیم نیست. */
  create(payload: PettyCashReplenishmentWritePayload): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/petty-cash/replenishments', payload).then((res) => res.data);
  },
  /** Draft → PendingFinanceManager. بدون بدنه. */
  submit(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/petty-cash/replenishments/${id}/submit`).then((res) => res.data);
  },
  /** PendingFinanceManager → PendingTreasurer. فقط نقش FinanceManager همان تنخواه، ≠ ایجادکننده. */
  approve(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/petty-cash/replenishments/${id}/approve`).then((res) => res.data);
  },
  /** در هر دو وضعیت Pending → Rejected؛ لینک‌های اسناد نرم‌حذف می‌شوند تا دوباره قابل ترمیم باشند. */
  reject(id: string, note?: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/replenishments/${id}/reject`, { note: note?.trim() || null })
      .then((res) => res.data);
  },
  /**
   * PendingTreasurer → Paid. فقط نقش Treasurer همان تنخواه، ≠ تأییدکننده. ⚠️ موقت — سند GL اینجا
   * صادر نمی‌شود؛ اجرای پرداخت واقعی به بخش خزانه (بخش ۴+) تعلق دارد.
   */
  recordPayment(id: string, paidDate?: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/replenishments/${id}/record-payment`, { paidDate: paidDate || null })
      .then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. Only a Draft may be deleted.
  remove(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/petty-cash/replenishments/${id}/delete`).then((res) => res.data);
  },
};

export interface PettyCashRefundWritePayload {
  fundId: string;
  amount: number;
  /** Legacy `YYYYMMDD`. */
  refundDate: string;
  reason: string | null;
}

/** استرداد وجه (`TB_PC_REFUND`) — مجاز بودن کاربر را `TB_PC_FUND.REFUND_RECORDER` تعیین می‌کند (۴۰۳ در غیر این صورت). */
export const pettyCashRefundsApi = {
  list(fundId: string): Promise<PettyCashRefundDto[]> {
    return apiClient.get<PettyCashRefundDto[]>(`/petty-cash/funds/${fundId}/refunds`).then((res) => res.data);
  },
  create(payload: PettyCashRefundWritePayload): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/petty-cash/refunds', payload).then((res) => res.data);
  },
  // Intentionally POST, never DELETE — see module docblock. Soft-delete.
  remove(id: string): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>(`/petty-cash/refunds/${id}/delete`).then((res) => res.data);
  },
};

/** داشبورد تنخواه (صفحهٔ ۴ پاورپوینت) — `GET /api/petty-cash/funds/{fundId}/dashboard`. */
export const pettyCashDashboardApi = {
  get(fundId: string): Promise<PettyCashFundDashboardDto> {
    return apiClient.get<PettyCashFundDashboardDto>(`/petty-cash/funds/${fundId}/dashboard`).then((res) => res.data);
  },
};

export interface PettyCashLedgerParams {
  /** شمسی YYYYMMDD. */
  from?: string;
  /** شمسی YYYYMMDD. */
  to?: string;
  type?: PettyCashLedgerRowType;
}

/** گزارش گردش تنخواه (صفحهٔ ۱۱ پاورپوینت) — `GET /api/petty-cash/funds/{fundId}/ledger?from=&to=&type=`. */
export const pettyCashLedgerApi = {
  get(fundId: string, params: PettyCashLedgerParams): Promise<PettyCashFundLedgerDto> {
    return apiClient
      .get<PettyCashFundLedgerDto>(`/petty-cash/funds/${fundId}/ledger`, { params })
      .then((res) => res.data);
  },
};

/* ------------------------------------------------------------------------------------------- *
 * بخش ۳-ب (۲۰۲۶-۰۹-۲۸) — تفصیلی(های) حساب معین تنخواه، تسویهٔ دوره و صدور سند حسابداری
 * (`docs/tankhah-khazaneh-module.md` §۹).
 * ------------------------------------------------------------------------------------------- */

/** تفصیلی(های) حساب معین تنخواه (`TB_PC_FUND_LINK_TAFSILI`) — بخش ۳-ب. */
export const pettyCashFundTafsilisApi = {
  list(fundId: string): Promise<PettyCashSettlementTafsiliDto[]> {
    return apiClient
      .get<PettyCashSettlementTafsiliDto[]>(`/petty-cash/funds/${fundId}/tafsilis`)
      .then((res) => res.data);
  },
  /** جایگزینی کامل — آرایهٔ خالی/`null` یعنی همهٔ ردیف‌های موجود نرم‌حذف شوند. */
  upsert(fundId: string, tafsilis: { tafsiliId: string; levelId: string }[]): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/funds/${fundId}/tafsilis`, { tafsilis })
      .then((res) => res.data);
  },
};

export interface FinalizePettyCashSettlementResult {
  periodId: string;
  voucherHeadId: string;
  voucherDocNum: string;
  settledDocCount: number;
}

/** تسویهٔ دوره — بخش ۳-ب (صفحهٔ ۱۰ پاورپوینت). */
export const pettyCashSettlementApi = {
  /** پیش‌نمایش دورهٔ جاریِ قابل‌بستن. `404` اگر تنخواه وجود نداشته باشد. */
  preview(fundId: string): Promise<PettyCashSettlementPreviewDto> {
    return apiClient
      .get<PettyCashSettlementPreviewDto>(`/petty-cash/funds/${fundId}/settlement`)
      .then((res) => res.data);
  },
  /** ذخیرهٔ شمارش صندوق دورهٔ جاری — دورهٔ Draft را در صورت نبود می‌سازد. بدون محدودیت نقش. */
  count(fundId: string, countedBalance: number): Promise<{ periodId: string }> {
    return apiClient
      .post<{ periodId: string }>(`/petty-cash/funds/${fundId}/settlement/count`, { countedBalance })
      .then((res) => res.data);
  },
  /**
   * صدور سند حسابداری و نهایی‌سازی دوره. فقط نقش حسابدار ارشد همان تنخواه، ≠ سازندهٔ اسناد
   * منظورشده. `acknowledgeInFlightTransfer` الزامی است اگر سند در جریان وجود دارد.
   */
  finalize(fundId: string, acknowledgeInFlightTransfer: boolean): Promise<FinalizePettyCashSettlementResult> {
    return apiClient
      .post<FinalizePettyCashSettlementResult>(`/petty-cash/funds/${fundId}/settlement/finalize`, {
        acknowledgeInFlightTransfer,
      })
      .then((res) => res.data);
  },
  /** تاریخچهٔ دوره‌های نهایی‌شده. */
  history(fundId: string): Promise<PettyCashSettlementHistoryItemDto[]> {
    return apiClient
      .get<PettyCashSettlementHistoryItemDto[]>(`/petty-cash/funds/${fundId}/settlements`)
      .then((res) => res.data);
  },
};

function extractContentDispositionFileName(headerValue: unknown): string | null {
  if (typeof headerValue !== 'string') return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // fall through to the plain filename below
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(headerValue);
  return plainMatch ? plainMatch[1] : null;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
