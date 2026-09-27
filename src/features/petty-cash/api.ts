import { apiClient } from '../../lib/api/client';
import type { CreateResponse } from '../../lib/api/createResourceApi';
import type { PagedResult } from '../../types/pagedResult';
import type {
  PettyCashExpenseDocDetailDto,
  PettyCashExpenseDocDto,
  PettyCashFundDto,
  PettyCashFundSettingsDto,
  PettyCashStateCount,
} from '../../types/pettyCash';

/**
 * تنخواه و خزانه‌داری — بخش ۱ (`docs/tankhah-khazaneh-module.md` §۵).
 *
 * Hand-written rather than `createResourceApi`, because neither resource fits its uniform
 * create/list/update/delete shape:
 *   - `funds` has no create/delete here at all — a fund's identity (code/name/سقف/حساب معین) is
 *     owned by the existing «تنخواه» base page (`features/revolving-funds`); this module only
 *     reads the list (with settings + balance joined in) and writes the settings sub-resource.
 *   - `expense-docs` needs a `state`-aware list response (`{ page, stateCounts }` rather than a
 *     bare `PagedResult`) and an extra `submit` action beyond create/update/delete.
 *
 * ⚠️ CLAUDE.md rule #1 still applies everywhere below: every write is `POST`, never `PUT`/`DELETE`.
 * Rule #2: `vahedCode` never appears in any payload/query here — every one of these endpoints is
 * `IVahedScoped` server-side (§۵), the same as the rest of the app; the axios interceptor already
 * attaches `X-Vahed-Code` from `SessionContext` to every request, so nothing module-specific is
 * needed for that here.
 */

export const pettyCashFundsApi = {
  /** `GET /api/petty-cash/funds` — bare array, not a `PagedResult` (few enough rows per unit). */
  list(): Promise<PettyCashFundDto[]> {
    return apiClient.get<PettyCashFundDto[]>('/petty-cash/funds').then((res) => res.data);
  },
  getSettings(fundId: string): Promise<PettyCashFundSettingsDto> {
    return apiClient
      .get<PettyCashFundSettingsDto>(`/petty-cash/funds/${fundId}/settings`)
      .then((res) => res.data);
  },
  /** Upsert — same endpoint whether this fund already has settings or not. */
  saveSettings(fundId: string, payload: PettyCashFundSettingsDto): Promise<PettyCashFundSettingsDto> {
    return apiClient
      .post<PettyCashFundSettingsDto>(`/petty-cash/funds/${fundId}/settings`, payload)
      .then((res) => res.data);
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
};
