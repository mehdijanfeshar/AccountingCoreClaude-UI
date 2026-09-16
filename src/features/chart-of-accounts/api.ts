import { createResourceApi } from '../../lib/api/createResourceApi';
import { apiClient } from '../../lib/api/client';
import type { AccountCodeDto } from '../../types/accountCode';
import type { TafsiliLevelDto, TafsiliLookupItemDto } from '../../types/tafsili';
import type { PagedResult } from '../../types/pagedResult';

/**
 * Exact wire shape of `CreateAccountCodeCommand` (create) / `UpdateAccountCodeRequest`
 * (update) — both share the same field set (update omits only `id`, which travels in the
 * route instead). Deliberately NOT `Partial<AccountCodeDto>`: the Dto also carries
 * server-only fields (`id`, `createdDate`, `updatedDate`, `addUserId`, `changeUserId`,
 * `isDeleted`) that must never be sent back on a write.
 *
 * See backend/src/Accounting.Application/Accounts/Commands/CreateAccountCode/CreateAccountCodeCommand.cs
 * and backend/src/Accounting.Api/Controllers/AccountCodesController.cs (UpdateAccountCodeRequest).
 */
export interface AccountCodeWritePayload {
  // Phase 25/26: real nullable-integer enum on the wire — see `./accountCodeEnums.ts` for the
  // value/label tables and `AccountCodeDto` (types/accountCode.ts) for the matching comment.
  typeCode: number | null;
  parentId: string | null;
  accCode: string;
  accCodeName: string;
  typeActivity: number | null;
  sourceAndConsumeId: string | null;
  identyGroupsId: string | null;
  typeAccCode: number | null;
  moInforClose: string | null;
  typeAction: number | null;
}

export const accountCodesApi = createResourceApi<AccountCodeDto, AccountCodeWritePayload, AccountCodeWritePayload>(
  'account-codes',
);

/**
 * Phase 20-b dynamic تفصیلی endpoints, nested under a معین's id. See
 * backend/src/Accounting.Api/Controllers/AccountCodesController.cs
 * (`GetTafsiliLevels` / `GetTafsiliLevelItems` actions).
 */
export const tafsiliApi = {
  /** Bare array (never paginated — at most 7 levels), 200 with `[]` for an unknown/levelless account. */
  getLevels(accountCodeId: string): Promise<TafsiliLevelDto[]> {
    return apiClient
      .get<TafsiliLevelDto[]>(`/account-codes/${accountCodeId}/tafsili-levels`)
      .then((res) => res.data);
  },

  /**
   * Paged, server-searched تفصیلی items for one (معین, level) pair. `search` uses the
   * backend's own digit-vs-name heuristic — never re-filter client-side.
   */
  getLevelItems(
    accountCodeId: string,
    levelId: string,
    params: { search?: string; pageNumber: number; pageSize: number },
  ): Promise<PagedResult<TafsiliLookupItemDto>> {
    return apiClient
      .get<PagedResult<TafsiliLookupItemDto>>(
        `/account-codes/${accountCodeId}/tafsili-levels/${levelId}/items`,
        { params },
      )
      .then((res) => res.data);
  },
};
