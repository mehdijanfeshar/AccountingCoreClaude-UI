import { apiClient } from './client';
import type { SysTypeDto } from '../../types/sysType';

/**
 * `GET /api/sys-types` — the نوع سند lookup. Deliberately NOT built on `createResourceApi`:
 * this endpoint returns a bare array rather than a `PagedResult` (a handful of fixed rows), and
 * it is read-only — there is no create/update/delete to expose.
 */
export const sysTypesApi = {
  list(): Promise<SysTypeDto[]> {
    return apiClient.get<SysTypeDto[]>('/sys-types').then((res) => res.data);
  },
};
