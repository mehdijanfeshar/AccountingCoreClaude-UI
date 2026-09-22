/** Mirrors Accounting.Api's `VoucherReviewRowDto` — `GET /api/reports/voucher-review`. */
export interface VoucherReviewRow {
  id: string;
  voucherNumber: string;
  systemName: string;
  atfNo: string;
  description: string;
  /** Raw `DOCLIFE` ordinal (1..4); use `getDocLifeLabel` to render it. */
  docLife: number | null;
  /** Jalali `YYYYMMDD`. */
  voucherDate: string;
  year: string;
  /**
   * جمع بدهکار سند — a gross total, not a net balance. When this differs from `creditor` the
   * voucher does not balance, which is the whole point of the report.
   */
  debtor: number;
  creditor: number;
}

/**
 * Mirrors `VoucherReviewResultDto`. The paging fields match `PagedResult<T>` deliberately so the
 * shared `Pagination` component reads it unchanged; the three set-wide figures are the reason it
 * is a distinct type.
 */
export interface VoucherReviewResult {
  items: VoucherReviewRow[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  /** Across every matching voucher, not just this page. */
  totalDebtor: number;
  totalCreditor: number;
  /** How many matching vouchers have بدهکار ≠ بستانکار — counted server-side over the whole set. */
  unbalancedCount: number;
}

export interface VoucherReviewParams {
  year: string;
  pageNumber: number;
  pageSize: number;
  fromVoucherNo?: string;
  toVoucherNo?: string;
  fromDate?: string;
  toDate?: string;
  fromAtfNo?: string;
  toAtfNo?: string;
  docLife?: number;
  systemTypeId?: string;
  description?: string;
}

/** A voucher balances when both sides are equal. Kept here so the grid and the export agree. */
export function isVoucherBalanced(row: VoucherReviewRow): boolean {
  return row.debtor === row.creditor;
}
