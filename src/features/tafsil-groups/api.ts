import { createResourceApi } from '../../lib/api/createResourceApi';
import type { TafsilGroupDto } from '../../types/tafsilGroup';

/**
 * Exact wire shape of `CreateTafsilGroupCommand` (create) / `UpdateTafsilGroupRequest`
 * (update) — both share the same three fields.
 * See backend/src/Accounting.Application/TafsilGroups/Commands/CreateTafsilGroup/CreateTafsilGroupCommand.cs
 * and backend/src/Accounting.Api/Controllers/TafsilGroupsController.cs (UpdateTafsilGroupRequest).
 */
export interface TafsilGroupWritePayload {
  tafsilGroupCode: string;
  tafsilGroupName: string;
  // Phase 27: real nullable-integer enum on the wire — see `../../types/legacyEnums.ts`.
  personType: number | null;
}

export const tafsilGroupsApi = createResourceApi<TafsilGroupDto, TafsilGroupWritePayload, TafsilGroupWritePayload>(
  'tafsil-groups',
);
