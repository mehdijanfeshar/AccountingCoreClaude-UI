import { apiClient } from '../../../lib/api/client';
import { ApiError } from '../../../lib/api/apiError';
import type { ReportKind } from './reportCatalog';

/** گزارش ذخیره‌شده (DDL 072) — `settingsJson` = {@link SavedReportSettings}. */
export interface SavedReportDto {
  id: string;
  code: string;
  title: string;
  description: string | null;
  keywords: string | null;
  reportKind: ReportKind;
  settingsJson: string;
  allowedVahedTypes: string[];
  isActive: boolean;
}

/** مقادیر ثابت هر پارامتر + پارامترهایی که هر بار از کاربر پرسیده می‌شوند. */
export interface SavedReportSettings {
  fixed: Record<string, string>;
  ask: string[];
}

export interface SavedReportPayload {
  code: string;
  title: string;
  description: string | null;
  keywords: string | null;
  reportKind: ReportKind;
  settingsJson: string;
  allowedVahedTypes: string[];
}

export interface SavedReportWriteResult {
  success: boolean;
  id: string | null;
  errors: string[];
}

export function parseSettings(json: string): SavedReportSettings {
  try {
    const s = JSON.parse(json) as Partial<SavedReportSettings>;
    return { fixed: s.fixed && typeof s.fixed === 'object' ? s.fixed : {}, ask: Array.isArray(s.ask) ? s.ask : [] };
  } catch {
    return { fixed: {}, ask: [] };
  }
}

/** 422 of create/update carries `errors: string[]` — returned as a result, not thrown. */
async function asWriteResult(request: Promise<{ data: SavedReportWriteResult }>): Promise<SavedReportWriteResult> {
  try {
    return (await request).data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      const errors = (error.problem as { errors?: unknown } | undefined)?.errors;
      return { success: false, id: null, errors: Array.isArray(errors) ? errors.map(String) : [error.message] };
    }
    throw error;
  }
}

export const savedReportsApi = {
  list: async () => (await apiClient.get<SavedReportDto[]>('/operations/reports')).data,
  definitions: async () => (await apiClient.get<SavedReportDto[]>('/operations/reports/definitions')).data,
  get: async (id: string) => (await apiClient.get<SavedReportDto>(`/operations/reports/${id}`)).data,
  create: (payload: SavedReportPayload) => asWriteResult(apiClient.post<SavedReportWriteResult>('/operations/reports', payload)),
  update: (id: string, payload: SavedReportPayload) =>
    asWriteResult(apiClient.post<SavedReportWriteResult>(`/operations/reports/${id}/update`, payload)),
  setActive: async (id: string, isActive: boolean) => {
    await apiClient.post(`/operations/reports/${id}/set-active`, { isActive });
  },
};
