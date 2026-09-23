import { apiClient } from '../../lib/api/client';
import { createResourceApi, type ListParams } from '../../lib/api/createResourceApi';
import type { PagedResult } from '../../types/pagedResult';
import type { VahedTypeDto } from '../../types/vahedType';
import type {
  CodingPermissionBulkPayload,
  CodingPermissionBulkResult,
  CodingPermissionDto,
  CodingPermissionReactivatePayload,
  CodingPermissionUpdatePayload,
} from '../../types/codingPermission';

/**
 * Server-side filters for the «دسترسی کدینگ حسابداری» list, mirroring
 * `GetWhiteAndBlackListsQuery`'s query-string parameters exactly.
 *
 * The four date parameters are **range bounds**, not equality: `from…` keeps rows whose stored
 * value is ≥ the argument and `to…` keeps rows whose value is ≤ it. They are compared as strings
 * server-side, which is correct because every value is zero-padded `YYYYMMDD` Jalali text. A value
 * that is not exactly 8 digits is rejected with a 400 rather than silently mis-filtering.
 *
 * ⚠️ There is deliberately no unit filter, and one must never be added: this table is an
 * organization-wide matrix keyed on unit **type** and has no `VAHEDCODE` column at all.
 */
export interface CodingPermissionListParams extends ListParams {
  accountCodeId?: string;
  vahedTypeId?: string;
  state?: number;
  fromAuthorizedDate?: string;
  toAuthorizedDate?: string;
  fromLimitationDate?: string;
  toLimitationDate?: string;
}

const resource = createResourceApi<
  CodingPermissionDto,
  never,
  CodingPermissionUpdatePayload,
  CodingPermissionListParams
>('white-and-black-lists');

export const codingPermissionsApi = {
  list: resource.list,
  getById: resource.getById,
  update: resource.update,
  remove: resource.remove,

  /**
   * The cartesian grant behind «افزودن دسترسی جدید»: every selected معین × every selected
   * نوع واحد, in one server transaction.
   *
   * Combinations that already exist are skipped rather than failing the call, and the result
   * reports both counts — re-granting something already granted is a normal user action, not an
   * error. The per-row `create` endpoint is deliberately not exposed here: this screen always
   * grants in bulk, and having two ways to create the same row invites them to drift.
   */
  createBulk(payload: CodingPermissionBulkPayload): Promise<CodingPermissionBulkResult> {
    return apiClient
      .post<CodingPermissionBulkResult>('/white-and-black-lists/bulk', payload)
      .then((res) => res.data);
  },

  /** «غیرفعال‌سازی» — moves the row to «غیرمجاز» and clears all four of its dates, server-side. */
  blacklist(id: string): Promise<{ id: string }> {
    // POST, never DELETE — see `createResourceApi`'s module docblock.
    return apiClient
      .post<{ id: string }>(`/white-and-black-lists/${id}/blacklist`)
      .then((res) => res.data);
  },

  /** «فعال سازی مجدد» — brings a blacklisted row back with a new state and date range. */
  reactivate(id: string, payload: CodingPermissionReactivatePayload): Promise<{ id: string }> {
    return apiClient
      .post<{ id: string }>(`/white-and-black-lists/${id}/reactivate`, payload)
      .then((res) => res.data);
  },
};

/**
 * `GET /api/vahed-types` — the 17 organizational unit types, unpaged by design (it is a fixed
 * lookup feeding a checkbox tree, and a page of a tree is not a thing).
 */
export const vahedTypesApi = {
  list(): Promise<VahedTypeDto[]> {
    return apiClient.get<VahedTypeDto[]>('/vahed-types').then((res) => res.data);
  },
};

export type { PagedResult };
