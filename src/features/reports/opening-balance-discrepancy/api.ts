import { apiClient } from '../../../lib/api/client';

/**
 * مغایرت افتتاحیه با ماندهٔ سال قبل (`GET /api/reports/opening-balance-discrepancy`) —
 * `IVahedScopedQuery` (هدر `X-Vahed-Code`، نه پارامتر). فقط `year` به‌عنوان query. ممکن است ۴۰۹
 * برگرداند (حساب رابط افتتاحیه تعریف‌نشده) — پیام در `ProblemDetails.detail`، نمایش با
 * `ErrorBanner` معمولی.
 */
export interface OpeningBalanceDiscrepancyRowDto {
  accCode: string;
  accName: string | null;
  identifier: string | null;
  openingAmount: number;
  priorYearBalance: number;
  difference: number;
}

export const openingBalanceDiscrepancyApi = {
  get(year: string): Promise<OpeningBalanceDiscrepancyRowDto[]> {
    return apiClient
      .get<OpeningBalanceDiscrepancyRowDto[]>('/reports/opening-balance-discrepancy', { params: { year } })
      .then((r) => r.data);
  },
};
