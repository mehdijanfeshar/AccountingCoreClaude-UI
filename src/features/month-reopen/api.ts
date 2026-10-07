import { apiClient } from '../../lib/api/client';

/** برگشت صورتحساب ماه — `api/month-reopen` (بک‌اند DDL 073). */
export interface MonthReopenDto {
  id: string;
  vahedCode: string;
  year: string;
  month: number;
  seq: number;
  reason: string | null;
  issuedBy: string;
  issuedDate: string;
  failedAttempts: number;
  usedBy: string | null;
  usedDate: string | null;
  revertedCount: number | null;
  status: 'Open' | 'Used' | 'Voided';
}

export interface IssueMonthReopenResult {
  code: string;
  seq: number;
  unitCode: string;
  year: string;
  month: number;
  reused: boolean;
}

export const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const;

export const MONTH_REOPEN_STATUS_LABEL: Record<MonthReopenDto['status'], string> = {
  Open: 'صادرشده، استفاده نشده',
  Used: 'استفاده‌شده',
  Voided: 'باطل (ورود نادرست)',
};

/** صورتحساب ماه — `api/month-close` (DDL 074). RESULT: 1=صورتحساب شد، 2=رد شد. */
export interface MonthCloseLogDto {
  id: string;
  batchId: string;
  vahedCode: string;
  vahedName: string | null;
  year: string;
  month: number;
  result: 1 | 2;
  acceptedCount: number;
  pendingVouchers: number;
  pendingElams: number;
  reason: string | null;
  userId: string;
  createdDate: string;
}

export interface MonthCloseSummaryDto {
  batchId: string;
  targetUnits: number;
  closedUnits: number;
  rejectedUnits: number;
  alreadyClosedUnits: number;
  idleUnits: number;
  acceptedVouchers: number;
  rows: MonthCloseLogDto[];
}

/** UnitCategory بک‌اند: 1=بیمه‌ای، 2=درمانی، 3=ستادی. */
export const UNIT_CATEGORY_OPTIONS = [
  { value: 2, label: 'درمانی' },
  { value: 1, label: 'بیمه‌ای' },
  { value: 3, label: 'ستادی' },
] as const;

export const monthCloseApi = {
  close(body: { year: string; month: number; unitCategory: number | null; unitCode: string | null }): Promise<MonthCloseSummaryDto> {
    return apiClient.post<MonthCloseSummaryDto>('/month-close', body).then((res) => res.data);
  },
  log(year: string, month?: number, unitCode?: string): Promise<MonthCloseLogDto[]> {
    return apiClient
      .get<MonthCloseLogDto[]>('/month-close/log', { params: { year, month, unitCode } })
      .then((res) => res.data);
  },
};

export const monthReopenApi = {
  access(): Promise<{ canIssue: boolean; canApply: boolean }> {
    return apiClient.get('/month-reopen/access').then((res) => res.data);
  },
  units(): Promise<{ vahedCode: string; vahedName: string }[]> {
    return apiClient.get('/month-reopen/units').then((res) => res.data);
  },
  log(year: string): Promise<MonthReopenDto[]> {
    return apiClient.get<MonthReopenDto[]>('/month-reopen', { params: { year } }).then((res) => res.data);
  },
  issue(unitCode: string, year: string, month: number, reason: string | null): Promise<IssueMonthReopenResult> {
    return apiClient
      .post<IssueMonthReopenResult>(`/month-reopen/${unitCode}/issue`, { year, month, reason })
      .then((res) => res.data);
  },
  apply(year: string, month: number, code: string): Promise<{ revertedCount: number }> {
    return apiClient.post('/month-reopen/apply', { year, month, code }).then((res) => res.data);
  },
};
