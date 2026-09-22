/** Mirrors Accounting.Api's `AccountJournalRowDto` — `GET /api/reports/account-journal`. */
export interface AccountJournalRow {
  voucherNumber: string;
  /** Jalali `YYYYMMDD`. */
  voucherDate: string;
  /** کد معین. */
  accountCode: string;
  accountName: string;
  /** شرح ردیف — the line's own description, not the voucher's. */
  description: string;
  /** Raw `DOCLIFE` ordinal (1..4). */
  docLife: number | null;
  debtor: number;
  creditor: number;
}

/**
 * Mirrors `AccountJournalResultDto`. Paging fields match `PagedResult<T>` so the shared
 * `Pagination` component reads it unchanged; the totals cover the whole filtered set, which is the
 * only sum a journal can meaningfully report.
 */
export interface AccountJournalResult {
  items: AccountJournalRow[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalDebtor: number;
  totalCreditor: number;
}

export interface AccountJournalParams {
  year: string;
  pageNumber: number;
  pageSize: number;
  fromVoucherNo?: string;
  toVoucherNo?: string;
  fromDate?: string;
  toDate?: string;
  fromAccountCode?: string;
  toAccountCode?: string;
  docLife?: number;
  description?: string;
}
