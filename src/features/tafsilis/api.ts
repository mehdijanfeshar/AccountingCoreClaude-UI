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
  isActive: boolean | null;
  personType: boolean | null;
  owner: boolean | null;
  vahedType: boolean | null;
  tafsilGroupIds: string[];
}

export const tafsilisApi = createResourceApi<TafsiliDto, TafsiliWritePayload, TafsiliWritePayload>('tafsilis');
