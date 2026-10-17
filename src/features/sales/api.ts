import { apiClient } from '../../lib/api/client';
import { ApiError } from '../../lib/api/apiError';
import type {
  SalesCustomer,
  SalesDoc,
  SalesDocInput,
  SalesDocPage,
  SalesDocPreview,
  SalesDocResult,
  SalesDocStatus,
  SalesDocType,
  SalesItem,
  SalesRole,
  SalesSettings,
  SalesSetup,
  SalesUserRole,
  SalesVatRate,
  SalesWriteResult,
  SalesCheck,
} from './types';

/** 422 = کنترل‌های سرور؛ به نتیجه برمی‌گردد تا فرم پیام‌ها را نشان دهد. بقیهٔ خطاها پرتاب می‌شوند. */
async function write(request: Promise<{ data: SalesWriteResult }>): Promise<SalesWriteResult> {
  try {
    return (await request).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      const errors = Array.isArray(error.problem?.errors) ? (error.problem?.errors as unknown as string[]) : [error.title];
      return { success: false, id: null, errors };
    }
    throw error;
  }
}

async function docAction(request: Promise<{ data: SalesDocResult }>): Promise<SalesDocResult> {
  try {
    return (await request).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      const p = error.problem as unknown as { errors?: string[]; checks?: SalesCheck[] } | undefined;
      return { success: false, id: null, docNo: null, status: null, checks: p?.checks ?? [], errors: p?.errors ?? [error.title], voucherId: null, voucherNo: null };
    }
    throw error;
  }
}

export const salesApi = {
  setup: async () => (await apiClient.get<SalesSetup>('/sales/setup')).data,
  saveSetup: (settings: SalesSettings, accounts: { roleKey: string; accountId: string; tafsiliId: string | null }[] | null) =>
    write(apiClient.post<SalesWriteResult>('/sales/setup', { settings, accounts })),
  vatRates: async () => (await apiClient.get<SalesVatRate[]>('/sales/vat-rates')).data,
  saveVatRates: (rates: { fromDate: string; rate: number; note: string | null }[]) =>
    write(apiClient.post<SalesWriteResult>('/sales/vat-rates', { rates })),
  roles: async () => (await apiClient.get<SalesUserRole[]>('/sales/roles')).data,
  addRole: (userId: string, role: SalesRole) => write(apiClient.post<SalesWriteResult>('/sales/roles', { userId, role })),
  removeRole: async (id: string) => {
    await apiClient.post(`/sales/roles/${id}/delete`);
  },

  items: async (search?: string, activeOnly = false) =>
    (await apiClient.get<SalesItem[]>('/sales/items', { params: { search: search || undefined, activeOnly } })).data,
  saveItem: (id: string | null, item: Omit<SalesItem, 'id'>) =>
    write(id ? apiClient.post<SalesWriteResult>(`/sales/items/${id}/update`, item) : apiClient.post<SalesWriteResult>('/sales/items', item)),

  customers: async (search?: string) =>
    (await apiClient.get<SalesCustomer[]>('/sales/customers', { params: { search: search || undefined } })).data,
  saveCustomer: (id: string | null, c: Omit<SalesCustomer, 'id' | 'tafsiliCode' | 'name' | 'completeForMoadian'>) =>
    write(id ? apiClient.post<SalesWriteResult>(`/sales/customers/${id}/update`, c) : apiClient.post<SalesWriteResult>('/sales/customers', c)),

  docs: async (params: { type?: SalesDocType; status?: SalesDocStatus; customerId?: string; search?: string; page: number; pageSize: number }) =>
    (await apiClient.get<SalesDocPage>('/sales/docs', { params })).data,
  doc: async (id: string, year: string) => (await apiClient.get<SalesDoc>(`/sales/docs/${id}`, { params: { year } })).data,
  preview: async (id: string | null, input: SalesDocInput, year: string) =>
    (await apiClient.post<SalesDocPreview>('/sales/docs/preview', { id, input }, { params: { year } })).data,
  conversion: async (sourceId: string, target: SalesDocType) =>
    (await apiClient.get<SalesDocInput>(`/sales/docs/${sourceId}/convert`, { params: { target } })).data,
  save: (id: string | null, input: SalesDocInput, year: string) =>
    docAction(id
      ? apiClient.post<SalesDocResult>(`/sales/docs/${id}/update`, { input }, { params: { year } })
      : apiClient.post<SalesDocResult>('/sales/docs', { input }, { params: { year } })),
  submit: (id: string, year: string) => docAction(apiClient.post<SalesDocResult>(`/sales/docs/${id}/submit`, null, { params: { year } })),
  approve: (id: string, year: string) => docAction(apiClient.post<SalesDocResult>(`/sales/docs/${id}/approve`, null, { params: { year } })),
  reject: (id: string, reason: string | null) => docAction(apiClient.post<SalesDocResult>(`/sales/docs/${id}/reject`, { reason })),
  post: (id: string, year: string) => docAction(apiClient.post<SalesDocResult>(`/sales/docs/${id}/post`, null, { params: { year } })),
  void: (id: string) => docAction(apiClient.post<SalesDocResult>(`/sales/docs/${id}/void`)),
};
