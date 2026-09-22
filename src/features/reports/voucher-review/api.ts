import { apiClient } from '../../../lib/api/client';
import type { VoucherReviewParams, VoucherReviewResult } from '../../../types/voucherReview';

/**
 * `GET /api/reports/voucher-review` — مرور اسناد.
 *
 * Read-only and paged, unlike the matrix report: this is a list of individual vouchers, so a page
 * is a genuine subset. The set-wide figures (`totalDebtor`, `totalCreditor`, `unbalancedCount`)
 * come back alongside the page precisely so nothing on screen is ever a total of an arbitrary
 * slice.
 *
 * ⚠️ No `vahedCode` parameter. The unit travels on the `X-Vahed-Code` header set by the axios
 * interceptor (phase 37) and is validated server-side against the caller's own subtree.
 */
export const voucherReviewApi = {
  get({
    year,
    pageNumber,
    pageSize,
    fromVoucherNo,
    toVoucherNo,
    fromDate,
    toDate,
    fromAtfNo,
    toAtfNo,
    docLife,
    systemTypeId,
    description,
  }: VoucherReviewParams): Promise<VoucherReviewResult> {
    // Blank optionals are dropped rather than sent empty — the backend distinguishes an absent
    // bound from an empty one, and "" would silently narrow the report.
    const params: Record<string, string | number> = { year, pageNumber, pageSize };

    if (fromVoucherNo) params.fromVoucherNo = fromVoucherNo;
    if (toVoucherNo) params.toVoucherNo = toVoucherNo;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (fromAtfNo) params.fromAtfNo = fromAtfNo;
    if (toAtfNo) params.toAtfNo = toAtfNo;
    if (docLife !== undefined) params.docLife = docLife;
    if (systemTypeId) params.systemTypeId = systemTypeId;
    if (description) params.description = description;

    return apiClient
      .get<VoucherReviewResult>('/reports/voucher-review', { params })
      .then((res) => res.data);
  },
};
