import { createResourceApi, type CreateResponse, type ListParams } from '../../lib/api/createResourceApi';
import { apiClient } from '../../lib/api/client';
import type { PagedResult } from '../../types/pagedResult';
import type { VoucherHeadDto } from '../../types/voucherHead';
import type { VoucherDetailDto } from '../../types/voucherDetail';

/**
 * ⚠️ No `vahedCode` here on purpose — GET /api/voucher-heads does not (and
 * must not) accept it; the backend derives the organizational unit scope
 * server-side from the caller's token (VahedScopeBehavior, phase 19).
 */
export interface VoucherHeadListParams extends ListParams {
  year?: string;
  /** Inclusive DOC_NUM range. Compared numerically server-side despite being a string column. */
  docNumFrom?: string;
  docNumTo?: string;
  /** Inclusive DATE_DOC range, Legacy `YYYYMMDD` strings. */
  dateDocFrom?: string;
  dateDocTo?: string;
  /** نوع سند — `TB_SYSTYPE.ID`, see `sysTypesApi`. */
  systemTypeId?: string;
  /**
   * وضعیت سند — `DocLife`: 1=یادداشت, 2=موقت, 3=بررسی‌شده, 4=تأیید دائم.
   *
   * ⚠️ Exact match server-side, not ">=". A کارتابل tab asks which vouchers are in *this*
   * state right now, so one that has moved on leaves the tab it came from.
   */
  docLife?: number;
}

/**
 * Exact wire shape of `CreateVoucherHeadCommand` MINUS `vahedCode` (server-assigned,
 * `[JsonIgnore]`) and MINUS `initialDetails` — this feature deliberately never uses
 * `initialDetails` because `CreateVoucherHeadDetailInput` has no `tafsiliLinks` field (see
 * the "critical contract finding" in the task brief / completion report): every line is
 * always created afterwards via a separate `POST /api/voucher-details` call instead.
 *
 * See backend/src/Accounting.Application/Vouchers/Commands/CreateVoucherHead/CreateVoucherHeadCommand.cs
 */
export interface CreateVoucherHeadPayload {
  docNum: string;
  dateDoc: string;
  /** `DocLife`: 1=یادداشت, 2=موقت, 3=بررسی‌شده, 4=تأیید دائم. Was wrongly typed `boolean` until the backend `bool`→enum fix. */
  docLife: number | null;
  headDesc: string | null;
  apendix: string | null;
  systemTypeId: string | null;
  flagState: number | null;
  year: string;
  isAutomatic: boolean | null;
  sndVahedCode: string | null;
  parentHeadId: string | null;
  attachFileName: string | null;
  atfNum: string | null;
}

/**
 * Exact wire shape of `CreateVoucherDetailCommand` MINUS `vahedCode` (server-assigned,
 * `[JsonIgnore]`). See
 * backend/src/Accounting.Application/Vouchers/Commands/CreateVoucherDetail/CreateVoucherDetailCommand.cs
 */
export interface CreateVoucherDetailPayload {
  voucherHeadId: string;
  accountId: string | null;
  receiptId: string | null;
  checkId: string | null;
  lowLevelCodeId: string | null;
  etebarId: string | null;
  description: string | null;
  radif: number | null;
  debtor: number | null;
  creditor: number | null;
  year: string | null;
  tafsiliLinks: { tafsiliId: string; levelId: string }[] | null;
}

export const voucherHeadsApi = createResourceApi<
  VoucherHeadDto,
  CreateVoucherHeadPayload,
  Partial<CreateVoucherHeadPayload>,
  VoucherHeadListParams
>('voucher-heads');

/**
 * Deliberately only `create`/`list` here, not the full `createResourceApi<...>` helper —
 * this feature (voucher entry) never needs `getById`/`update`/`remove` on
 * `voucher-details`, and `list` takes extra query params (`voucherHeadId`/`year`) that don't
 * fit the generic helper's plain `ListParams`. A future feature needing the rest of the CRUD
 * surface can still add it via `createResourceApi` without conflicting with this object.
 */
export const voucherDetailsApi = {
  create(payload: CreateVoucherDetailPayload): Promise<CreateResponse> {
    return apiClient.post<CreateResponse>('/voucher-details', payload).then((res) => res.data);
  },
  list(params: ListParams & { voucherHeadId?: string; year?: string }): Promise<PagedResult<VoucherDetailDto>> {
    return apiClient
      .get<PagedResult<VoucherDetailDto>>('/voucher-details', { params })
      .then((res) => res.data);
  },
};

/** وضعیت سند — mirrors `Accounting.Domain.ValueObjects.DocLife`. */
export const DOC_LIFE_OPTIONS = [
  { value: 1, label: 'یادداشت' },
  { value: 2, label: 'موقت' },
  { value: 3, label: 'بررسی‌شده' },
  { value: 4, label: 'تأیید دائم' },
] as const;

export type DocLifeValue = (typeof DOC_LIFE_OPTIONS)[number]['value'];

export function getDocLifeLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'تعیین‌نشده';
  return DOC_LIFE_OPTIONS.find((o) => o.value === value)?.label ?? `نامشخص (${value})`;
}

/**
 * انتقال وضعیت — `POST /api/voucher-heads/change-state`.
 *
 * Batch and all-or-nothing: an unknown or deleted id rejects the whole request with a 404 and
 * nothing moves. Deliberately NOT part of the update payload — changing what a voucher says and
 * changing how final it is are separate operations server-side too.
 */
export function changeVoucherState(voucherHeadIds: string[], newState: number): Promise<void> {
  return apiClient
    .post('/voucher-heads/change-state', { voucherHeadIds, newState })
    .then(() => undefined);
}
