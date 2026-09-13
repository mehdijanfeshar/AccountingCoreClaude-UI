import { useQuery } from '@tanstack/react-query';
import { accountCodesApi } from './api';
import type { AccountCodeDto } from '../../types/accountCode';

const PAGE_SIZE = 200;
/** Safety cap — 25 pages × 200 rows = 5,000 rows scanned before giving up. */
const MAX_PAGES = 25;

export interface AllAccountCodesResult {
  items: AccountCodeDto[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** True when `totalCount` exceeded the safety cap — the list below is not the full dataset. */
  isTruncated: boolean;
  totalCount: number;
}

/**
 * Loads every page of `GET /api/account-codes` (there is no server-side level filter — see
 * `AccountCodeLevelTab.tsx` for why this is necessary) and concatenates them into one array,
 * capped at `MAX_PAGES` for safety. Cached under one shared query key so the گروه/کل/معین tabs
 * (each filtering this same array client-side by `accCode.length`) never triple-fetch.
 *
 * ⚠️ For a chart of accounts larger than `MAX_PAGES * PAGE_SIZE` rows, this deliberately stops
 * short and reports `isTruncated` rather than fetching an unbounded number of pages — callers
 * must show that flag to the user instead of silently presenting an incomplete list as complete.
 */
export function useAllAccountCodes(): AllAccountCodesResult {
  const query = useQuery({
    queryKey: ['account-codes', 'all'],
    queryFn: async () => {
      const items: AccountCodeDto[] = [];
      let totalCount = 0;
      let pageNumber = 1;

      while (pageNumber <= MAX_PAGES) {
        const page = await accountCodesApi.list({ pageNumber, pageSize: PAGE_SIZE });
        totalCount = page.totalCount;
        items.push(...page.items);
        if (items.length >= totalCount || page.items.length === 0) {
          break;
        }
        pageNumber += 1;
      }

      return { items, totalCount };
    },
  });

  const items = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isTruncated: totalCount > items.length,
    totalCount,
  };
}
