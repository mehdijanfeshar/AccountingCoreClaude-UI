import { useQuery } from '@tanstack/react-query';
import { tafsiliApi } from '../../features/chart-of-accounts/api';

const PAGE_SIZE = 20;

/**
 * Fetches one page of selectable تفصیلی items for a (معین, level) pair, server-searched and
 * server-paginated — see `GET /api/account-codes/{accountCodeId}/tafsili-levels/{levelId}/items`.
 * Never fetch every item up front (a level's items "می‌تواند صدها آیتم باشد" per task spec) —
 * callers must debounce `search` themselves (see `TafsiliItemSelect`).
 */
export function useTafsiliLevelItems(
  accountCodeId: string | null,
  levelId: string | null,
  search: string,
  pageNumber: number,
) {
  return useQuery({
    queryKey: ['tafsili-level-items', accountCodeId, levelId, search, pageNumber],
    queryFn: () =>
      tafsiliApi.getLevelItems(accountCodeId as string, levelId as string, {
        search: search.trim() ? search.trim() : undefined,
        pageNumber,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(accountCodeId) && Boolean(levelId),
    placeholderData: (previous) => previous,
  });
}
