import { createResourceApi, type ListParams } from '../../lib/api/createResourceApi';
import type {
  IdentityGroupDto,
  IdentityHeadDto,
  IdentitySubGroupDto,
} from '../../types/identity';

/**
 * The three شناسنامه resources. See `../../types/identity.ts` for the shape and for why this is
 * NOT the same thing as حساب‌های شناسه‌دار.
 *
 * ⚠️ No resource here takes a `vahedCode` — the backend imposes the caller's own unit from the
 * token. Never add one (CLAUDE.md rule 2).
 */

// --- گروه شناسنامه ---------------------------------------------------------------------------

export interface IdentityGroupWritePayload {
  identityGroupsDesc: string;
  identityGroupsCode: string | null;
  tafsiliId: string | null;
}

export const identityGroupsApi = createResourceApi<
  IdentityGroupDto,
  IdentityGroupWritePayload,
  IdentityGroupWritePayload
>('identity-groups');

// --- زیرگروه شناسنامه ------------------------------------------------------------------------

export interface IdentitySubGroupWritePayload {
  identyGroupsId: string;
  subgrpsDesc: string;
  subgrpsLen: number;
  sumFlag: boolean;
  fixed: number;
  subgrpsType: number | null;
  identySubGroupsCode: string | null;
  year: string;
}

/**
 * `identityGroupId` + `kind` together are how the شناسنامه entry form asks for "the ثابت
 * subgroups of this group" — the one call that whole form is built on.
 */
export interface IdentitySubGroupListParams extends ListParams {
  identityGroupId?: string;
  kind?: number;
}

export const identitySubGroupsApi = createResourceApi<
  IdentitySubGroupDto,
  IdentitySubGroupWritePayload,
  IdentitySubGroupWritePayload,
  IdentitySubGroupListParams
>('identity-sub-groups');

// --- شناسنامه --------------------------------------------------------------------------------

/** One value travelling with its شناسنامه. Mirrors `IdentityHeadFixItemInput` server-side. */
export interface IdentityHeadFixItemInput {
  identitySubGroupId: string;
  value: string | null;
}

/**
 * Create carries the group, the year and every fixed value in one request — the head and its
 * values are persisted atomically server-side. `serial` is deliberately absent: the server
 * assigns it.
 */
export interface CreateIdentityHeadPayload {
  identityGroupId: string;
  year: string;
  fixItems: IdentityHeadFixItemInput[];
}

/**
 * Update replaces the value set (PUT-semantics — an omitted item is deleted). The group and the
 * serial are not editable, which is why neither appears here.
 */
export interface UpdateIdentityHeadPayload {
  fixItems: IdentityHeadFixItemInput[];
}

export interface IdentityHeadListParams extends ListParams {
  identityGroupId?: string;
  year?: string;
}

export const identityHeadsApi = createResourceApi<
  IdentityHeadDto,
  CreateIdentityHeadPayload,
  UpdateIdentityHeadPayload,
  IdentityHeadListParams
>('identity-heads');
