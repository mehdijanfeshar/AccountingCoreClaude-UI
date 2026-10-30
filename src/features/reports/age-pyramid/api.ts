import { apiClient } from '../../../lib/api/client';

/**
 * هرم سنی (`GET /api/reports/age-pyramid`) — `IVahedScopedQuery`: بدون پارامتر `vahedCode`،
 * دامنهٔ واحد روی هدر `X-Vahed-Code` می‌رود (اینترسپتور axios، از `SessionContext`). `year`
 * واقعاً پارامتر query است.
 *
 * ⚠️ `accountIds` با `URLSearchParams` دستی (نه آرایهٔ معمولی در `params` اکسیوس) — چون
 * `[FromQuery] List<Guid>` در بک‌اند فقط کلید تکرارشده را می‌شناسد.
 *
 * شکل پاسخ (۲۰۲۶-۱۰-۲۹، بازطراحی‌شده — نسخهٔ قبلی فقط مانده یک‌ساله بود): برای هر (معین شناسه‌دار،
 * شناسه) که سنش در سال گزارش به ۱۰ سال رسیده، سال شروع و ماندهٔ تجمعی هر سال از شروع تا سال گزارش.
 */
export interface AgePyramidYearBalanceDto {
  year: string;
  balance: number;
}

export interface AgePyramidRowDto {
  accCode: string;
  accName: string | null;
  identifier: string;
  startYear: string;
  age: number;
  yearly: AgePyramidYearBalanceDto[];
}

export interface AgePyramidFilter {
  year: string;
  accountIds?: string[];
  fromIdentifier?: string;
  toIdentifier?: string;
}

export const agePyramidApi = {
  get(filter: AgePyramidFilter): Promise<AgePyramidRowDto[]> {
    const params = new URLSearchParams();
    params.set('year', filter.year);
    (filter.accountIds ?? []).forEach((id) => params.append('accountIds', id));
    if (filter.fromIdentifier) params.set('fromIdentifier', filter.fromIdentifier);
    if (filter.toIdentifier) params.set('toIdentifier', filter.toIdentifier);
    return apiClient.get<AgePyramidRowDto[]>('/reports/age-pyramid', { params }).then((r) => r.data);
  },
};
