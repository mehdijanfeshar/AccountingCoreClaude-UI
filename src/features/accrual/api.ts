import { apiClient } from '../../lib/api/client';
import type { AccrualCancelResult, AccrualFilter, AccrualRunResult, AccrualSchedule, AccrualVoucherSchedule } from './types';

/**
 * حسابداری تعهدی (فاز ۶۶). واحد فقط از هدر X-Vahed-Code (client)، هرگز در بدنه/query.
 * خطاهای اجرا/لغو (۴۰۹ با متن فارسی) پرتاب می‌شوند و داخل خود دیالوگ (ConfirmDialog.error) دیده می‌شوند.
 */
export const accrualApi = {
  schedules: async (filter: AccrualFilter = {}) =>
    (await apiClient.get<AccrualSchedule[]>('/accrual/schedules', {
      params: { state: filter.state, kind: filter.kind, from: filter.from || undefined, to: filter.to || undefined },
    })).data,
  byVoucher: async (voucherId: string) =>
    (await apiClient.get<AccrualVoucherSchedule>(`/accrual/schedules/by-voucher/${voucherId}`)).data,
  run: async (id: string) => (await apiClient.post<AccrualRunResult>(`/accrual/schedules/${id}/run`)).data,
  cancel: async (id: string, reason: string) =>
    (await apiClient.post<AccrualCancelResult>(`/accrual/schedules/${id}/cancel`, { reason })).data,
};
