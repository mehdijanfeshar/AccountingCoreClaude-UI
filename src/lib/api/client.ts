import axios, { type AxiosInstance } from 'axios';
import { ApiError } from './apiError';
import type { ProblemDetails } from '../../types/problemDetails';
import { getToken, notifyUnauthorized } from '../auth/tokenStore';

/**
 * Shared axios instance for the whole app.
 *
 * baseURL is relative ("/api" by default) on purpose: the Vite dev server
 * proxies /api to the real backend (see vite.config.ts) so the browser
 * never has to deal with CORS (the backend sets none) and no absolute
 * backend URL/secret ever needs to live in frontend code.
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0;
      const problem = error.response?.data as ProblemDetails | undefined;

      if (status === 401) {
        notifyUnauthorized();
      }

      const fallbackMessage =
        status === 0
          ? 'ارتباط با سرور برقرار نشد.'
          : `درخواست با خطا مواجه شد (کد ${status}).`;

      return Promise.reject(new ApiError(status, problem, fallbackMessage));
    }

    return Promise.reject(error);
  },
);
