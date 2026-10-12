import { apiClient } from '../../lib/api/client';

export type AuditAction = 'Insert' | 'Update' | 'Delete' | 'Restore';

export interface AuditLogDto {
  id: string;
  /** UTC */
  changeDate: string | null;
  actionType: AuditAction | string;
  tableName: string;
  tableTitle: string;
  recordId: string;
  recordLabel: string | null;
  /** سرسندِ ردیف (برای تاریخچهٔ کامل سند). */
  parentId: string | null;
  columnName: string | null;
  oldValue: string | null;
  newValue: string | null;
  /** کد ملی */
  userId: string;
  userFullName: string | null;
  vahedCode: string | null;
  year: string | null;
  ipAddress: string | null;
  operationId: string | null;
}

export interface AuditLogPage {
  items: AuditLogDto[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export interface AuditTableDto {
  table: string;
  title: string;
}

export interface AuditLogFilters {
  /** ISO لحظهٔ شروع (شامل) */
  fromDate?: string;
  /** ISO لحظهٔ پایان (ناشامل) */
  toDate?: string;
  userId?: string;
  tableName?: string;
  actionType?: string;
  recordId?: string;
  operationId?: string;
  search?: string;
  /** 0 = فقط واحد جاری، 1 = واحد و زیرمجموعه */
  unitScope: 0 | 1;
  pageNumber: number;
  pageSize: number;
}

/** لاگ تغییرات — فقط خواندن؛ سرور فقط به نقش مدیر مالی پاسخ می‌دهد. */
export const auditLogApi = {
  search(filters: AuditLogFilters): Promise<AuditLogPage> {
    return apiClient.get<AuditLogPage>('/audit-logs', { params: filters }).then((res) => res.data);
  },
  tables(): Promise<AuditTableDto[]> {
    return apiClient.get<AuditTableDto[]>('/audit-logs/tables').then((res) => res.data);
  },
};
