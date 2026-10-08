import { apiClient } from '../../lib/api/client';
import type { PagedResult } from '../../types/pagedResult';

/** InterfaceType: ۱ = رابط افتتاحیه، ۲ = رابط اختتامیه. */
export type InterfaceType = 1 | 2;

export interface AccountCodeInterfaceDto {
  id: string;
  type: InterfaceType;
  accountCodeId: string;
  isDeleted: boolean;
}

export interface AccountExceptionDto {
  id: string;
  accountCoeId: string;
  vahedTypeId: string;
  isDeleted: boolean;
}

/** RabetAccountLevel: ۲ = کل، ۳ = معین. */
export interface RabetClosingDto {
  id: string;
  year: string | null;
  vahedTypeId: string;
  vahedTypeName: string | null;
  level: 2 | 3 | null;
  accountId: string | null;
  accCode: string | null;
  accName: string | null;
  rabetId: string | null;
  rabetCode: string | null;
  rabetName: string | null;
  title: string | null;
}

export interface CreateRabetClosingsPayload {
  year: string;
  vahedTypeIds: string[];
  accountIds: string[];
  rabetAccountId: string;
  title: string;
}

export const interfacesApi = {
  list: () =>
    apiClient
      .get<PagedResult<AccountCodeInterfaceDto>>('/account-code-interfaces', { params: { pageNumber: 1, pageSize: 200 } })
      .then((r) => r.data.items.filter((i) => !i.isDeleted)),
  create: (type: InterfaceType, accountCodeId: string) =>
    apiClient.post('/account-code-interfaces', { type, accountCodeId }).then((r) => r.data),
  remove: (id: string) => apiClient.post(`/account-code-interfaces/${id}/delete`).then((r) => r.data),
};

export const exceptionsApi = {
  list: () =>
    apiClient
      .get<PagedResult<AccountExceptionDto>>('/account-exceptions', { params: { pageNumber: 1, pageSize: 200 } })
      .then((r) => r.data.items.filter((i) => !i.isDeleted)),
  create: (accountCoeId: string, vahedTypeId: string) =>
    apiClient.post('/account-exceptions', { accountCoeId, vahedTypeId }).then((r) => r.data),
  remove: (id: string) => apiClient.post(`/account-exceptions/${id}/delete`).then((r) => r.data),
};

export const rabetClosingsApi = {
  list: (year: string) => apiClient.get<RabetClosingDto[]>('/rabet-closings', { params: { year } }).then((r) => r.data),
  create: (payload: CreateRabetClosingsPayload) =>
    apiClient.post<{ created: number }>('/rabet-closings', payload).then((r) => r.data),
  remove: (id: string) => apiClient.post(`/rabet-closings/${id}/delete`).then((r) => r.data),
};

/** TB_RABET: حساب رابط اعلامیه. نوع با کد TB_RABET_TYPE: ۱ صادره، ۲ رسیده، ۳ صادرهٔ درآمد. */
export interface RabetDto {
  id: string;
  rabetTypeId: string | null;
  accountCodeId: string | null;
  isDeleted: boolean | null;
}

export interface RabetTypeDto {
  id: string;
  code: string | null;
  title: string | null;
}

/** برچسب از کد، نه از عنوان ذخیره‌شده (عنوان نوع ۱ با معنایش نمی‌خواند، ریسک #۳۱). */
export const ELAM_RABET_LABEL: Record<string, string> = {
  '1': 'اعلامیهٔ صادره',
  '2': 'اعلامیهٔ رسیده',
  '3': 'اعلامیهٔ صادرهٔ درآمد',
};

export const rabetsApi = {
  types: () => apiClient.get<RabetTypeDto[]>('/rabets/types').then((r) => r.data),
  list: () =>
    apiClient
      .get<PagedResult<RabetDto>>('/rabets', { params: { pageNumber: 1, pageSize: 200 } })
      .then((r) => r.data.items.filter((i) => i.isDeleted !== true)),
  create: (rabetTypeId: string, accountCodeId: string) =>
    apiClient.post('/rabets', { rabetTypeId, accountCodeId }).then((r) => r.data),
  remove: (id: string) => apiClient.post(`/rabets/${id}/delete`).then((r) => r.data),
};
