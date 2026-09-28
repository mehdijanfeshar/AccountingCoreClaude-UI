import { apiClient } from '../../lib/api/client';
import type { CreateResponse } from '../../lib/api/createResourceApi';
import type { PagedResult } from '../../types/pagedResult';
import type {
  PettyCashAttachmentDto,
  PettyCashExpenseDocDetailDto,
  PettyCashExpenseDocDto,
  PettyCashFundDto,
  PettyCashFundReviewerDto,
  PettyCashSettlementPeriodValue,
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
  alertThresholdPercent: number | null;
  accountCodeId: string | null;
  settlementPeriod: PettyCashSettlementPeriodValue | null;
  isActive: boolean;
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
  /** بخش ۲ — در انتظار بررسی → تأییدشده. */
  approve(id: string, note?: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${id}/approve`, { note: note?.trim() || null })
      .then((res) => res.data);
  },
  /** بخش ۲ — در انتظار بررسی → برگشتی، با یک یا چند دلیل و مهلت اصلاح الزامی. */
  returnDoc(id: string, payload: PettyCashReturnPayload): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${id}/return`, {
        reasonCodes: payload.reasonCodes,
        deadline: payload.deadline,
        note: payload.note?.trim() || null,
      })
      .then((res) => res.data);
  },
  /** بخش ۲ — در انتظار بررسی → ردشده (پایانی، بدون ترمیم). */
  reject(id: string, note?: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${id}/reject`, { note: note?.trim() || null })
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
  note?: string;
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
   * Upsert کلیدی روی `(fundId, reviewerUserId)` است، نه `id` — فراخوانی دوباره با همان کد کاربری
   * نام را به‌روزرسانی (یا رکورد نرم‌حذف‌شده را فعال) می‌کند؛ کد کاربری متفاوت همیشه رکورد جدید
   * می‌سازد. به همین دلیل امضای این تابع `id` نمی‌گیرد.
   */
  upsert(fundId: string, payload: { reviewerUserId: string; reviewerName: string | null }): Promise<CreateResponse> {
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
  // Intentionally POST, never DELETE — see module docblock. Soft-delete.
  remove(expenseDocId: string, attachmentId: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/petty-cash/expense-docs/${expenseDocId}/attachments/${attachmentId}/delete`)
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
