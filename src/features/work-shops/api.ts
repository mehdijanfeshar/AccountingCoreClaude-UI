import { createResourceApi } from '../../lib/api/createResourceApi';
import type { WorkShopDto } from '../../types/workShop';

/**
 * Exact wire shape of `CreateWorkShopCommand` (create, minus server-assigned `VahedCode`) /
 * `UpdateWorkShopRequest` (update).
 * See backend/src/Accounting.Application/WorkShops/Commands/CreateWorkShop/CreateWorkShopCommand.cs
 * and backend/src/Accounting.Api/Controllers/WorkShopsController.cs (UpdateWorkShopRequest).
 * `checkFile` (BLOB) is out of scope — no upload UI, always `null`.
 */
export interface WorkShopWritePayload {
  accountCodeId: string;
  branchId: string | null;
  workShopName: string;
  workShopCode: string;
  isActive: boolean;
  checkFile: string | null;
  /**
   * Full replacement set of تفصیلی assignments — replace semantics: links omitted here are
   * soft-deleted server-side. Driven by the معین's active levels (see TafsiliLevelFields).
   */
  tafsiliLinks: { tafsiliId: string; levelId: string }[];
}

export const workShopsApi = createResourceApi<WorkShopDto, WorkShopWritePayload, WorkShopWritePayload>('work-shops');
