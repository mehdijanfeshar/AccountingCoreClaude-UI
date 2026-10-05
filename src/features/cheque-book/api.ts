import { apiClient } from '../../lib/api/client';

/**
 * دفتر چک — `api/cheque-book`. کارتابل: صدور دستور پرداخت ⇐ تأیید رئیس حسابداری ⇐ تأیید مدیر واحد
 * (تاییدیه چک) ⇐ چاپ. واحد روی هدر `X-Vahed-Code`.
 */

/** 1 در انتظار رئیس حسابداری، 2 در انتظار مدیر واحد، 3 تأییدشده (تاییدیه)، 4 برگشت‌خورده. */
export type ChequeApprovalState = 1 | 2 | 3 | 4;

export const APPROVAL_META: Record<ChequeApprovalState, { label: string; color: 'warning' | 'info' | 'success' | 'error' }> = {
  1: { label: 'در انتظار رئیس حسابداری', color: 'warning' },
  2: { label: 'در انتظار مدیر واحد', color: 'info' },
  3: { label: 'تاییدیه صادر شد', color: 'success' },
  4: { label: 'برگشت‌خورده', color: 'error' },
};

/** 1 صدور دستور پرداخت، 2 تأیید رئیس حسابداری، 3 تأیید مدیر، 4 برگشت. */
export const APPROVAL_ACTION_LABEL: Record<number, string> = {
  1: 'صدور دستور پرداخت',
  2: 'تأیید رئیس حسابداری',
  3: 'تأیید مدیر واحد (تاییدیه چک)',
  4: 'برگشت',
};

export interface ChequeBookItemDto {
  checkId: string;
  voucherDetailId: string;
  voucherHeadId: string;
  chequeNo: string;
  chequeDate: string | null;
  payTo: string | null;
  paperDescription: string | null;
  lineDescription: string | null;
  amount: number;
  accountNumber: string | null;
  bankName: string | null;
  checkBookTitle: string | null;
  voucherNumber: string | null;
  voucherDate: string | null;
  docLife: number | null;
  isCanceled: boolean;
  isPrinted: boolean;
  approvalState: ChequeApprovalState | null;
  preparedBy: string | null;
  accountingBy: string | null;
  managerBy: string | null;
  approvalNote: string | null;
}

/** دسته‌چک صوری — `nextNumber` null = شماره‌ها تمام شده. */
export interface SoriChequeBookDto {
  checkBookId: string;
  checkBookTitle: string | null;
  bankAccountId: string;
  accountNumber: string | null;
  bankName: string | null;
  fromNumber: string;
  toNumber: string;
  nextNumber: string | null;
}

export interface AvailableChequeDto {
  checkId: string;
  chequeNo: string;
  checkBookTitle: string | null;
  bankAccountId: string;
  accountNumber: string | null;
  bankName: string | null;
}

export interface ChequeSummaryDto {
  checkId: string;
  chequeNo: string;
  payTo: string | null;
  chequeDate: string | null;
  description: string | null;
  isCanceled: boolean;
  isPrinted: boolean;
  isSori: boolean;
}

export interface ChequeApprovalEventDto {
  action: number;
  fromState: ChequeApprovalState | null;
  toState: ChequeApprovalState;
  userId: string;
  note: string | null;
  createdDate: string;
}

export interface ChequePrintDto {
  checkId: string;
  chequeNo: string;
  chequeDate: string | null;
  payTo: string | null;
  paperDescription: string | null;
  amount: number;
  accountNumber: string | null;
  bankName: string | null;
  chequeTypeId: string | null;
  chequeTypeTitle: string | null;
  width: number | null;
  height: number | null;
  marginTop: number | null;
  marginLeft: number | null;
  /** base64 */
  image: string | null;
}

export interface ChequeBookParams {
  year: string;
  pageNumber: number;
  pageSize: number;
  bankAccountId?: string;
  fromDate?: string;
  toDate?: string;
  canceled?: boolean;
  printed?: boolean;
  chequeNo?: string;
  amount?: number;
  description?: string;
  approvalState?: ChequeApprovalState;
  onlyUnissued?: boolean;
}

export const chequeBookApi = {
  list: (p: ChequeBookParams) => {
    const params = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ''));
    return apiClient
      .get<{ items: ChequeBookItemDto[]; totalCount: number; pageNumber: number; pageSize: number }>('/cheque-book', { params })
      .then((r) => r.data);
  },
  available: (accountCodeId: string | null, search: string) =>
    apiClient
      .get<AvailableChequeDto[]>('/cheque-book/available', {
        params: { ...(accountCodeId ? { accountCodeId } : {}), ...(search ? { search } : {}) },
      })
      .then((r) => r.data),
  /** دسته‌چک‌های صوری حساب‌های بانکی همین معین؛ شماره هنگام ثبت سند صادر می‌شود. */
  soriBooks: (accountCodeId: string | null) =>
    apiClient
      .get<SoriChequeBookDto[]>('/cheque-book/sori-books', { params: accountCodeId ? { accountCodeId } : {} })
      .then((r) => r.data),
  get: (checkId: string) => apiClient.get<ChequeSummaryDto>(`/cheque-book/${checkId}`).then((r) => r.data),
  events: (checkId: string) => apiClient.get<ChequeApprovalEventDto[]>(`/cheque-book/${checkId}/events`).then((r) => r.data),
  print: (checkId: string) => apiClient.get<ChequePrintDto>(`/cheque-book/${checkId}/print`).then((r) => r.data),
  markPrinted: (checkId: string) => apiClient.post(`/cheque-book/${checkId}/printed`).then(() => undefined),
  setCanceled: (checkId: string, canceled: boolean) =>
    apiClient.post(`/cheque-book/${checkId}/cancel`, null, { params: { canceled } }).then(() => undefined),
  approval: (action: 1 | 2 | 4, checkIds: string[], note: string | null) =>
    apiClient.post<number>('/cheque-book/approval', { action, checkIds, note }).then((r) => r.data),
};
