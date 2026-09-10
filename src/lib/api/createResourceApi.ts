import { apiClient } from './client';
import type { PagedResult } from '../../types/pagedResult';

/**
 * Generic CRUD helper matching the single uniform pattern used by every
 * resource in Accounting.Api. This is the ONLY place resource URLs get
 * built — do it here, not ad hoc in feature code, so nobody can
 * accidentally write a `PUT`/`DELETE` call.
 *
 * ⚠️ `PUT` and `DELETE` HTTP verbs are forbidden on this backend by
 * explicit product decision. The uniform pattern is:
 *   POST   /api/{resource}             -> create,          201 { id }
 *   GET    /api/{resource}?pageNumber&pageSize[&...extra] -> PagedResult<TDto>
 *   GET    /api/{resource}/{id}        -> TDto | 404
 *   POST   /api/{resource}/{id}/update -> update (soft),   200 { id }
 *   POST   /api/{resource}/{id}/delete -> soft delete,     200 { id }, idempotent
 *
 * A couple of resources (`pre-describs`, `vahed-infos`) intentionally have
 * no delete endpoint — callers simply should not invoke `.remove()` for
 * those; this helper still exposes it uniformly since misuse would just
 * surface as a 404/405 from the backend, not a wrong verb.
 */

export interface CreateResponse {
  id: string;
}

export interface ListParams {
  pageNumber?: number;
  pageSize?: number;
}

export function createResourceApi<
  TDto,
  TCreate = Partial<TDto>,
  TUpdate = Partial<TDto>,
  TListParams extends ListParams = ListParams,
>(resourcePath: string) {
  return {
    list(params: TListParams): Promise<PagedResult<TDto>> {
      return apiClient
        .get<PagedResult<TDto>>(`/${resourcePath}`, { params })
        .then((res) => res.data);
    },

    getById(id: string): Promise<TDto> {
      return apiClient.get<TDto>(`/${resourcePath}/${id}`).then((res) => res.data);
    },

    create(payload: TCreate): Promise<CreateResponse> {
      return apiClient
        .post<CreateResponse>(`/${resourcePath}`, payload)
        .then((res) => res.data);
    },

    update(id: string, payload: TUpdate): Promise<CreateResponse> {
      // Intentionally POST, never PUT — see module docblock.
      return apiClient
        .post<CreateResponse>(`/${resourcePath}/${id}/update`, payload)
        .then((res) => res.data);
    },

    remove(id: string): Promise<CreateResponse> {
      // Intentionally POST, never DELETE — see module docblock.
      // Soft delete, idempotent on the backend.
      return apiClient
        .post<CreateResponse>(`/${resourcePath}/${id}/delete`)
        .then((res) => res.data);
    },
  };
}
