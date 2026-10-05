import { apiClient } from '../../lib/api/client';

/**
 * کارت حساب جاری (عملیات) — `api/bank-cards`، روی جدول `TB_BANKCARTDETAIL` سیستم قدیم.
 * واریز بانک = `deposit`، برداشت = `withdrawal`. واحد روی هدر `X-Vahed-Code`.
 */

/** 1 چک صوری (اعلامیهٔ بانک)، 2 چک واقعی، 3 فیش، 4 حواله. */
export type CheckReceiptType = 1 | 2 | 3 | 4;

export const CHECK_RECEIPT_TYPE_OPTIONS: { value: CheckReceiptType; label: string }[] = [
  { value: 2, label: 'چک' },
  { value: 3, label: 'فیش' },
  { value: 4, label: 'حواله' },
  { value: 1, label: 'اعلامیهٔ بانک (چک صوری)' },
];

export interface BankCardRowDto {
  id: string;
  date: string | null;
  month: string | null;
  number: string | null;
  type: CheckReceiptType | null;
  deposit: number;
  withdrawal: number;
  isReconciled: boolean;
  checkId: string | null;
  receiptId: string | null;
}

export interface BankCardDto {
  bankAccountId: string;
  accountNumber: string;
  year: string;
  month: string;
  rows: BankCardRowDto[];
  totalDeposit: number;
  totalWithdrawal: number;
  reconciledCount: number;
}

export interface BankCardBookItemDto {
  voucherDetailId: string;
  voucherHeadId: string;
  voucherNumber: string | null;
  voucherDate: string | null;
  number: string | null;
  description: string | null;
  debit: number;
  credit: number;
}

export interface BankCardReconciliationDto {
  bankAccountId: string;
  accountNumber: string;
  accountHolder: string | null;
  year: string;
  month: string;
  toDate: string;
  bookBalance: number;
  bankOnlyDeposits: BankCardRowDto[];
  bankOnlyWithdrawals: BankCardRowDto[];
  bookOnlyDeposits: BankCardBookItemDto[];
  bookOnlyPayments: BankCardBookItemDto[];
}

export interface BankCardRowPayload {
  year: string;
  bankAccountId: string;
  date: string;
  number: string | null;
  type: CheckReceiptType;
  isDeposit: boolean;
  amount: number;
}

export const bankCardsApi = {
  get: (bankAccountId: string, year: string, month: string) =>
    apiClient.get<BankCardDto>('/bank-cards', { params: { bankAccountId, year, month } }).then((r) => r.data),
  reconciliation: (bankAccountId: string, year: string, month: string) =>
    apiClient
      .get<BankCardReconciliationDto>('/bank-cards/reconciliation', { params: { bankAccountId, year, month } })
      .then((r) => r.data),
  createRow: (body: BankCardRowPayload) => apiClient.post<string>('/bank-cards/rows', body).then((r) => r.data),
  updateRow: (id: string, body: BankCardRowPayload) =>
    apiClient.post(`/bank-cards/rows/${id}/update`, { id, ...body }).then(() => undefined),
  deleteRow: (id: string) => apiClient.post(`/bank-cards/rows/${id}/delete`).then(() => undefined),
  unreconcileRow: (id: string) => apiClient.post(`/bank-cards/rows/${id}/unreconcile`).then(() => undefined),
  importDisk: (bankAccountId: string, year: string, month: string, file: File) => {
    const form = new FormData();
    form.append('bankAccountId', bankAccountId);
    form.append('year', year);
    form.append('month', month);
    form.append('file', file);
    return apiClient.post<{ imported: number; skipped: number }>('/bank-cards/import', form).then((r) => r.data);
  },
  reconcile: (bankAccountId: string, year: string, month: string) =>
    apiClient
      .post<{ matched: number; remaining: number }>('/bank-cards/reconcile', { bankAccountId, year, month })
      .then((r) => r.data),
};
