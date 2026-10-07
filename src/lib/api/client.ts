import axios, { type AxiosInstance } from 'axios';
import { ApiError } from './apiError';
import type { ProblemDetails } from '../../types/problemDetails';
import { getToken, notifyUnauthorized } from '../auth/tokenStore';
import { getRequestedUnitCode } from '../session/unitScopeStore';

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

  // The unit the user picked in «تغییر سال مالی و واحد». Sent as a header rather than a body or
  // query field so it applies uniformly to every endpoint without changing a single request
  // contract — the backend deliberately keeps `vahedCode` out of its DTOs.
  //
  // ⚠️ This is a REQUEST, not a grant. The server validates it against the caller's own subtree
  // on every request and answers 403 for a unit they may not act as. Omitting it is always safe:
  // the server then falls back to the user's own unit from the token.
  const requestedUnit = getRequestedUnitCode();
  // A request that already names a unit (e.g. opening another unit's voucher from a multi-unit report)
  // keeps it — the server still validates it the same way.
  if (requestedUnit && !config.headers.has('X-Vahed-Code')) {
    config.headers.set('X-Vahed-Code', requestedUnit);
  }

  return config;
});

/**
 * A request made with `responseType: 'blob'` (attachment download) still gets its ERROR body back
 * as a `Blob` from axios — the responseType applies uniformly regardless of status code. Without
 * this, a 403/404 ProblemDetails on a download would arrive as an opaque, unreadable `Blob`
 * instead of the real title/detail. Only kicks in for the blob case; every other request's
 * `error.response.data` is already the parsed ProblemDetails object.
 */
async function readProblemBody(error: import('axios').AxiosError): Promise<ProblemDetails | undefined> {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      return text ? (JSON.parse(text) as ProblemDetails) : undefined;
    } catch {
      return undefined;
    }
  }
  return data as ProblemDetails | undefined;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0;
      const problem = await readProblemBody(error);

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
