import { apiClient } from '../../../lib/api/client';
import type { MatrixParams, MatrixResult } from '../../../types/matrixReport';

/**
 * `GET /api/reports/matrix` — گزارش ماتریسی.
 *
 * Read-only and unpaged, for the same reason as مرور حساب‌ها: half of an aggregate is not a
 * smaller answer, it is a wrong one. What *is* bounded server-side is the **column** count, because
 * the column set is data-dependent — see `columnsTruncated` on the result, which the page must
 * surface rather than swallow.
 *
 * ⚠️ No `vahedCode` parameter. The unit travels on the `X-Vahed-Code` header set by the axios
 * interceptor (phase 37) and is validated server-side against the caller's own subtree.
 */
export const matrixReportApi = {
  get({
    year,
    rowDimension,
    columnDimension,
    fromDate,
    toDate,
    docLife,
    systemTypeId,
    rowCodeFilter,
    columnCodeFilter,
  }: MatrixParams): Promise<MatrixResult> {
    // Blank optionals are dropped rather than sent empty — the backend distinguishes an absent
    // bound from an empty one, and "" would silently narrow the report.
    const params: Record<string, string | number> = { year, rowDimension, columnDimension };

    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (docLife !== undefined) params.docLife = docLife;
    if (systemTypeId) params.systemTypeId = systemTypeId;
    if (rowCodeFilter) params.rowCodeFilter = rowCodeFilter;
    if (columnCodeFilter) params.columnCodeFilter = columnCodeFilter;

    return apiClient
      .get<MatrixResult>('/reports/matrix', { params })
      .then((res) => res.data);
  },
};
