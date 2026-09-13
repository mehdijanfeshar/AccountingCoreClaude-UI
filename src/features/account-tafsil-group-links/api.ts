import { apiClient } from '../../lib/api/client';
import type { AccountTafsilGroupLinkDto } from '../../types/accountTafsilGroupLink';

/**
 * Manual client for the parent-scoped "ارتباط معین با گروه تفصیلی" endpoints nested under
 * `AccountCodesController` (`api/account-codes/{accountCodeId}/tafsil-group-links...`) — NOT
 * built with `createResourceApi`, because these routes are scoped by a parent id, not a flat
 * `/api/{resource}` collection. `TB_ACCOUNT_LINK_TAFSILGROUP` is deliberately not an independent
 * resource — see the backend's `NoIndependentLinkTableWritePathTests` — so there is no bare
 * `api/account-tafsil-group-links` endpoint to call.
 */
export interface AccountTafsilGroupLinkWritePayload {
  levelId: string;
  tafsilGroupId: string;
}

export const accountTafsilGroupLinksApi = {
  list(accountCodeId: string): Promise<AccountTafsilGroupLinkDto[]> {
    return apiClient
      .get<AccountTafsilGroupLinkDto[]>(`/account-codes/${accountCodeId}/tafsil-group-links`)
      .then((res) => res.data);
  },

  create(accountCodeId: string, payload: AccountTafsilGroupLinkWritePayload): Promise<{ id: string }> {
    return apiClient
      .post<{ id: string }>(`/account-codes/${accountCodeId}/tafsil-group-links`, payload)
      .then((res) => res.data);
  },

  update(
    accountCodeId: string,
    linkId: string,
    payload: AccountTafsilGroupLinkWritePayload,
  ): Promise<{ id: string }> {
    return apiClient
      .post<{ id: string }>(`/account-codes/${accountCodeId}/tafsil-group-links/${linkId}/update`, payload)
      .then((res) => res.data);
  },

  remove(accountCodeId: string, linkId: string): Promise<{ id: string }> {
    return apiClient
      .post<{ id: string }>(`/account-codes/${accountCodeId}/tafsil-group-links/${linkId}/delete`)
      .then((res) => res.data);
  },
};
