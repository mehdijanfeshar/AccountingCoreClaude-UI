import { apiClient } from '../../lib/api/client';

export interface SystemVoucherInboxItem {
  id: string;
  sysType: string | null;
  dateDoc: string | null;
  year: string | null;
  headDesc: string | null;
  createdDate: string | null;
  lineCount: number;
  debtor: number;
  creditor: number;
  voucherHeadId: string | null;
  voucherDocNum: string | null;
}

export interface SystemVoucherInboxLine {
  radif: number | null;
  moinCode: string | null;
  moinName: string | null;
  tafsilis: { level: number; code: string; name: string | null }[];
  description: string | null;
  debtor: number;
  creditor: number;
  error: string | null;
}

export interface SystemVoucherInboxDetail {
  head: SystemVoucherInboxItem;
  lines: SystemVoucherInboxLine[];
  canReceive: boolean;
}

/** دریافت اسناد از سایر سیستم‌ها — `api/system-voucher-inbox`. */
export const systemInboxApi = {
  list: (year: string, includeReceived: boolean) =>
    apiClient
      .get<SystemVoucherInboxItem[]>('/system-voucher-inbox', { params: { year, includeReceived } })
      .then((r) => r.data),
  get: (id: string) => apiClient.get<SystemVoucherInboxDetail>(`/system-voucher-inbox/${id}`).then((r) => r.data),
  receive: (id: string) =>
    apiClient
      .post<{ voucherHeadId: string; docNum: string }>(`/system-voucher-inbox/${id}/receive`)
      .then((r) => r.data),
};
