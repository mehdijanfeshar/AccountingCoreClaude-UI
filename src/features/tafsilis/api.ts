import { createResourceApi } from '../../lib/api/createResourceApi';
import type { TafsiliDto } from '../../types/tafsiliMaster';

/**
 * Exact wire shape of `CreateTafsiliCommand` (create, minus server-assigned `VahedCode`) /
 * `UpdateTafsiliRequest` (update) — both share this field set, including the embedded
 * گروه‌تفصیلی link set (`tafsilGroupIds`), which the backend reconciles against
 * `TB_TAFSIL_LINK_TAFSILGROUP` as a side effect of this same write — never a separate call.
 * See backend/src/Accounting.Application/Tafsilis/Commands/CreateTafsili/CreateTafsiliCommand.cs
 * and backend/src/Accounting.Api/Controllers/TafsilisController.cs (UpdateTafsiliRequest).
 */
export interface TafsiliWritePayload {
  tafsiliCode: string;
  tafsiliName: string;
  tafsilDesc: string | null;
  // Phase 27: real nullable-integer enums on the wire — see `../../types/legacyEnums.ts`.
  isActive: number | null;
  personType: number | null;
  owner: number | null;
  vahedType: number | null;
  tafsilGroupIds: string[];
  /**
   * Visibility scope (`Accounting.Domain.ValueObjects.VahedCategory`: 1=بیمه, 2=درمان, 3=همه)
   * stamped onto every NEWLY-created `TB_TAFSIL_LINK_TAFSILGROUP` row for `tafsilGroupIds`.
   * `null` (default) means "only my own unit" — see `CreateTafsiliCommand.TafsilGroupLinkVahedType`
   * XML doc (phase 24) for why this exists: without it, تفصیلی items added via this form were
   * invisible to every other unit's voucher-entry تفصیلی lookup.
   */
  tafsilGroupLinkVahedType: number | null;
}

export const tafsilisApi = createResourceApi<TafsiliDto, TafsiliWritePayload, TafsiliWritePayload>('tafsilis');
