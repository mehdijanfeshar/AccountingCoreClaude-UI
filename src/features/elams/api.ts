import { apiClient } from '../../lib/api/client';

/**
 * اعلامیه (عملیات) — `api/elams`. واحد روی هدر `X-Vahed-Code` می‌رود، نه در بدنه.
 * وضعیت‌ها (`webStat`) عین سیستم قدیم: ۱..۴ درآمد، ۵..۸ صادره، ۹..۱۰ رسیده.
 */

export type ElamKind = 1 | 2 | 3;
export const ELAM_KIND = { Sent: 1, Received: 2, Revenue: 3 } as const;

/** 1 بدهکار، 2 بستانکار. */
export type ElamCase = 1 | 2;
export const ELAM_CASE_OPTIONS: { value: ElamCase; label: string }[] = [
  { value: 1, label: 'بدهکار' },
  { value: 2, label: 'بستانکار' },
];

/** نوع اعلامیهٔ درآمد. */
export const REVENUE_TYPE_OPTIONS = [
  { value: 1, label: 'حق بیمهٔ کارکنان' },
  { value: 2, label: 'ذیحسابی' },
  { value: 3, label: 'سایر اعلامیهٔ صادرهٔ درآمد' },
];

export const WEB_STAT_META: Record<number, { label: string; color: 'default' | 'info' | 'warning' | 'primary' | 'success' }> = {
  1: { label: 'تهیه', color: 'default' },
  2: { label: 'صدور سند', color: 'info' },
  3: { label: 'تأیید اولیه', color: 'warning' },
  4: { label: 'تأیید نهایی و ارسال', color: 'success' },
  5: { label: 'تهیه', color: 'default' },
  6: { label: 'صدور سند', color: 'info' },
  7: { label: 'تأیید اولیه', color: 'warning' },
  8: { label: 'تأیید نهایی و ارسال', color: 'success' },
  9: { label: 'دریافت', color: 'default' },
  10: { label: 'تأیید دریافت و صدور سند', color: 'success' },
};

export interface ElamCartableItemDto {
  id: string;
  kind: ElamKind;
  serialNo: string | null;
  date: string | null;
  description: string | null;
  case: ElamCase | null;
  webStat: number | null;
  counterVahedCode: string | null;
  counterVahedName: string | null;
  dabirNo: string | null;
  dabirDate: string | null;
  amount: number;
  voucherHeadId: string | null;
  voucherNumber: string | null;
  voucherDate: string | null;
  voucherDescription: string | null;
  senderElamId: string | null;
  revenueType: number | null;
}

export interface ElamTafsiliViewDto {
  tafsiliId: string;
  levelId: string;
  levelCode: string | null;
  code: string | null;
  name: string | null;
}

export interface ElamDetailViewDto {
  id: string;
  accountId: string | null;
  accCode: string | null;
  accName: string | null;
  debtor: number;
  creditor: number;
  description: string | null;
  attribNo: string | null;
  tafsilis: ElamTafsiliViewDto[];
}

export interface ElamViewDto {
  head: ElamCartableItemDto;
  rabetCode: string | null;
  workshopCode: string | null;
  workshopName: string | null;
  workshopId: string | null;
  rcvNo: string | null;
  rcvDate: string | null;
  lastMonth: string | null;
  elamYear: string | null;
  peimanNo: string | null;
  payNo: string | null;
  canEdit: boolean;
  details: ElamDetailViewDto[];
}

export interface ElamUnitDto {
  vahedCode: string;
  vahedName: string;
}

export interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

export interface ElamDetailInput {
  accountId: string;
  amount: number;
  description: string | null;
  attribNo: string | null;
  tafsiliLinks: { tafsiliId: string; levelId: string }[];
}

export interface OtherElamPayload {
  year: string;
  date: string;
  description: string;
  case: ElamCase;
  counterVahedCode: string;
  dabirNo: string | null;
  dabirDate: string | null;
  details: ElamDetailInput[];
}

export interface RevenueElamPayload {
  year: string;
  date: string;
  description: string;
  revenueType: number;
  counterVahedCode: string;
  accountId: string;
  amount: number;
  detailDescription: string | null;
  workshopId: string | null;
  workshopCode: string | null;
  workshopName: string | null;
  debtNo: string | null;
  debtDate: string | null;
  lastMonth: string | null;
  elamYear: string | null;
  peimanNo: string | null;
  payNo: string | null;
}

export interface ElamCartableParams {
  year: string;
  kind: ElamKind;
  pageNumber: number;
  pageSize: number;
  serialFrom?: string;
  serialTo?: string;
  dateFrom?: string;
  dateTo?: string;
  dabirNo?: string;
  counterVahedCode?: string;
}

export const elamsApi = {
  cartable: (p: ElamCartableParams) => {
    const params: Record<string, string | number> = { year: p.year, kind: p.kind, pageNumber: p.pageNumber, pageSize: p.pageSize };
    for (const k of ['serialFrom', 'serialTo', 'dateFrom', 'dateTo', 'dabirNo', 'counterVahedCode'] as const) {
      if (p[k]) params[k] = p[k]!;
    }
    return apiClient.get<PagedResult<ElamCartableItemDto>>('/elams', { params }).then((r) => r.data);
  },
  get: (id: string) => apiClient.get<ElamViewDto>(`/elams/${id}`).then((r) => r.data),
  units: () => apiClient.get<ElamUnitDto[]>('/elams/units').then((r) => r.data),
  createOther: (body: OtherElamPayload) => apiClient.post<string>('/elams/other', body).then((r) => r.data),
  updateOther: (id: string, body: OtherElamPayload) =>
    apiClient.post(`/elams/other/${id}/update`, { id, ...body }).then(() => undefined),
  createRevenue: (body: RevenueElamPayload) => apiClient.post<string>('/elams/revenue', body).then((r) => r.data),
  updateRevenue: (id: string, body: RevenueElamPayload) =>
    apiClient.post(`/elams/revenue/${id}/update`, { id, ...body }).then(() => undefined),
  remove: (id: string) => apiClient.post(`/elams/${id}/delete`).then(() => undefined),
  issueVoucher: (id: string) =>
    apiClient.post<{ voucherHeadId: string; docNum: string }>(`/elams/${id}/voucher`).then((r) => r.data),
  confirmFirst: (id: string) => apiClient.post(`/elams/${id}/confirm-first`).then(() => undefined),
  confirmFinal: (id: string) =>
    apiClient.post<{ receivedElamId: string | null }>(`/elams/${id}/confirm-final`).then((r) => r.data),
};
