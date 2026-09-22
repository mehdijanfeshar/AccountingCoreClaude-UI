import { apiClient } from './client';
import type { YearDto } from '../../types/session';

/** `GET /api/years` — financial years, newest first. Bare array, never paginated. */
export const yearsApi = {
  getAll(): Promise<YearDto[]> {
    return apiClient.get<YearDto[]>('/years').then((res) => res.data);
  },
};
