import { apiClient } from './client';
import type { AccessibleUnitDto, CurrentUserDto } from '../../types/session';

/**
 * `GET /api/me` and `GET /api/me/accessible-units` — who the caller is, and which organizational
 * units they may act as.
 *
 * Neither takes a parameter, deliberately: the subject is always the bearer of the token. Both
 * return bare arrays/objects, never a PagedResult, so `createResourceApi` does not fit.
 */
export const meApi = {
  getCurrentUser(): Promise<CurrentUserDto> {
    return apiClient.get<CurrentUserDto>('/me').then((res) => res.data);
  },

  /**
   * The caller's own unit plus its descendant subtree — or every unit, when the caller is
   * headquarters. Small by construction, so it is never paginated.
   */
  getAccessibleUnits(): Promise<AccessibleUnitDto[]> {
    return apiClient.get<AccessibleUnitDto[]>('/me/accessible-units').then((res) => res.data);
  },
};
