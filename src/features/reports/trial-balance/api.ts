import { apiClient } from '../../../lib/api/client';
import type {
  TrialBalanceParams,
  TrialBalanceRow,
  TrialBalanceVariant,
} from '../../../types/trialBalance';

/**
 * `GET /api/reports/trial-balance-{4|6|8}`.
 *
 * Deliberately not built on `createResourceApi`: that helper exists to keep every CRUD resource on
 * the project's `POST {id}/update` / `POST {id}/delete` convention, and these are read-only reports
 * with no write side at all. They also return a bare array rather than a `PagedResult`, because the
 * backend aggregates one row per account code at the requested level.
 *
 * The three endpoints take identical parameters and differ only in how many columns each row
 * carries, so one function covers them — 6 is 4 plus opening figures, 8 is 6 plus cumulative
 * totals. Callers narrow the result with the row type they ask for.
 *
 * ⚠️ No `vahedCode` is sent, here or anywhere else in this app: the server imposes the caller's own
 * unit from the token. `year` really is a query parameter.
 */
export const trialBalanceApi = {
  get(
    variant: TrialBalanceVariant,
    { year, fromDate, toDate, level, docLife, filters }: TrialBalanceParams,
  ): Promise<TrialBalanceRow[]> {
    // Empty optional filters are dropped rather than sent blank: the backend distinguishes an
    // absent fromDate from an empty one, and sending "" would silently narrow the report.
    const params: Record<string, string | number> = { year, level };

    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (docLife !== undefined) params.docLife = docLife;

    // ASP.NET binds a List<SearchParam> from indexed query-string keys, so the clauses are spread
    // out rather than serialised: filters[0].property=code&filters[0].operator=6&…
    filters?.forEach((filter, i) => {
      params[`filters[${i}].property`] = filter.property;
      params[`filters[${i}].operator`] = filter.operator;
      params[`filters[${i}].value`] = filter.value;
    });

    return apiClient
      .get<TrialBalanceRow[]>(`/reports/trial-balance-${variant}`, { params })
      .then((res) => res.data);
  },
};
