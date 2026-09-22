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
 * Hand-written rather than `createResourceApi<...>`, because `list` takes extra query params
 * (`voucherHeadId`/`year`) that do not fit the generic helper's plain `ListParams`. It now carries
 * `update`/`remove` as well — the voucher edit form needs to reconcile a head's lines, which means
 * changing some, adding others and removing the rest.
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
  /**
   * ⚠️ Leaving `tafsiliLinks` out of the payload is not the same as sending `[]`. The backend
   * leaves a line's existing links untouched when the field is absent, and soft-deletes every one
   * of them when it is an empty array. The edit form depends on that difference — do not
   * "normalise" an undefined into an empty list on the way out.
   */
  update(id: string, payload: Partial<CreateVoucherDetailPayload>): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/voucher-details/${id}/update`, payload)
      .then((res) => res.data);
  },
  remove(id: string): Promise<CreateResponse> {
    return apiClient
      .post<CreateResponse>(`/voucher-details/${id}/delete`, {})
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

export function isKnownDocLife(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && DOC_LIFE_OPTIONS.some((o) => o.value === value);
}

/**
 * ⚠️ Both "no value" and "a value outside the enum" read as «بدون وضعیت».
 *
 * They used to read as «تعیین‌نشده» and «نامشخص (۰)», which distinguished two things an
 * accountant can neither act on nor tell apart in meaning. DOCLIFE is a four-state ordinal
 * (یادداشت/موقت/بررسی‌شده/تأیید دائم); 0 exists only as an Oracle column DEFAULT and was
 * deliberately never given a meaning, and NULL is simply absent. To a reader both say the same
 * thing: this voucher has no usable state.
 *
 * The raw value is not thrown away — the list puts it in a tooltip, so anyone debugging can still
 * see whether a row is 0 or NULL without the column asserting that the difference matters.
 */
export function getDocLifeLabel(value: number | null | undefined): string {
  return DOC_LIFE_OPTIONS.find((o) => o.value === value)?.label ?? 'بدون وضعیت';
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

/**
 * Semantic colour per state, so the چیپ carries meaning rather than being uniformly blue:
 * یادداشت is a scratch note, موقت is in-flight, بررسی‌شده is checked but not final, تأیید دائم
 * is done. MUI severity names map onto exactly that progression.
 */
export function getDocLifeTone(value: number | null | undefined): 'default' | 'warning' | 'info' | 'success' {
  switch (value) {
    case 1:
      return 'default';
    case 2:
      return 'warning';
    case 3:
      return 'info';
    case 4:
      return 'success';
    default:
      return 'default';
  }
}

/**
 * وضعیت‌هایی که سند در آن‌ها قابل ویرایش و حذف است — یادداشت و موقت.
 *
 * ⚠️ **Mirrors `Accounting.Application.Common.Security.VoucherEditability`, it does not define
 * the rule.** The server enforces this independently and answers **409** with a Persian detail
 * for a locked voucher (phase 38). This copy exists only so the cartable can hide actions that
 * would fail — never as the enforcement point. If the two ever disagree, the server wins.
 *
 * Fails closed exactly like the server does: an absent or out-of-enum `DOCLIFE` (the Oracle
 * column has `DEFAULT 0`, which has no known meaning) counts as NOT editable.
 */
export const EDITABLE_DOC_LIFE_VALUES: readonly number[] = [1, 2];

export function isVoucherEditable(docLife: number | null | undefined): boolean {
  return docLife !== null && docLife !== undefined && EDITABLE_DOC_LIFE_VALUES.includes(docLife);
}

/**
 * معکوس سند — `POST /api/voucher-heads/{id}/reverse`.
 *
 * Creates a NEW draft voucher mirroring this one with بدهکار/بستانکار swapped; the source is
 * untouched. Allowed in **any** state, including تأیید دائم — that is the point of the operation,
 * and why it is not gated by `isVoucherEditable`. Returns the new voucher's id.
 */
export function reverseVoucher(id: string): Promise<string> {
  return apiClient
    .post<{ id: string }>(`/voucher-heads/${id}/reverse`)
    .then((res) => res.data.id);
}

/** مرتب‌سازی — range expressed either by شماره سند or by تاریخ سند. Mirrors `VoucherSortType`. */
export const VOUCHER_SORT_TYPE = { docNum: 1, docDate: 2 } as const;

export interface SortVouchersPayload {
  sortType: number;
  docNumFrom?: string | null;
  docNumTo?: string | null;
  dateDocFrom?: string | null;
  dateDocTo?: string | null;
  year: string;
}

/**
 * مرتب‌سازی اسناد — `POST /api/voucher-heads/sort`.
 *
 * Renumbers the selected range into تاریخ سند order. `vahedCode` is server-assigned; `year` is a
 * real parameter. Answers **409** if any voucher in the range is بررسی‌شده or تأیید دائم.
 * Returns how many were renumbered (0 for an empty range).
 */
export function sortVouchers(payload: SortVouchersPayload): Promise<number> {
  return apiClient
    .post<{ renumberedCount: number }>('/voucher-heads/sort', payload)
    .then((res) => res.data.renumberedCount);
}

/**
 * تأیید دائم — the terminal state. A voucher here cannot be edited, deleted, or moved to another
 * state; the only way to undo its effect is معکوس سند.
 *
 * Mirrors the server's rule (`VoucherStateChangeDeniedException`); it does not enforce it — the
 * API answers 409 regardless of what the UI shows.
 */
export const DOC_LIFE_ACCEPTED = 4;
