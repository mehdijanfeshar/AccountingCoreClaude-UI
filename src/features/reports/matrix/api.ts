import { apiClient } from '../../../lib/api/client';
import type { MatrixReportParams, MatrixReportResult } from '../../../types/matrixReport';

/**
 * `GET /api/reports/matrix` — گزارش ماتریسی (تلفیقی).
 *
 * Read-only and unpaged: the backend aggregates one row per code at the requested level, and a
 * partial aggregate report would not add up to anything real. Slicing rows for display is the
 * page's business, done over the full set it already holds.
 *
 * ⚠️ No `vahedCode` parameter. The unit travels on the `X-Vahed-Code` header set by the axios
 * interceptor (phase 37) and is validated server-side against the caller's own subtree.
 */
export const matrixReportApi = {
  get({
    year,
    level,
    scope,
    fromDate,
    toDate,
    fromVoucherNo,
    toVoucherNo,
    docLife,
    systemTypeId,
  }: MatrixReportParams): Promise<MatrixReportResult> {
    // Blank optionals are dropped rather than sent empty — the backend distinguishes an absent
    // bound from an empty one, and "" would silently narrow the report.
    const params: Record<string, string | number> = { year, level };

    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (fromVoucherNo) params.fromVoucherNo = fromVoucherNo;
    if (toVoucherNo) params.toVoucherNo = toVoucherNo;
    if (docLife !== undefined) params.docLife = docLife;
    if (systemTypeId) params.systemTypeId = systemTypeId;

    // ASP.NET binds a List<MatrixReportScopeItem> from indexed query-string keys, so the path is
    // spread out rather than serialised — the same convention the trial balance uses for its
    // filters: scope[0].level=1&scope[0].code=1&…
    scope?.forEach((step, i) => {
      params[`scope[${i}].level`] = step.level;
      params[`scope[${i}].code`] = step.code;
    });

    return apiClient
      .get<MatrixReportResult>('/reports/matrix', { params })
      .then((res) => res.data);
  },
};
