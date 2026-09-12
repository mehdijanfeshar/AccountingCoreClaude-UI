import { createResourceApi } from './createResourceApi';
import type { VahedInfoDto } from '../../types/vahedInfo';

/**
 * Read-only slice of `api/vahed-infos` used by `VahedInfoPickerDialog`. Full CRUD exists on the
 * backend but is out of scope here — only `.list()` is actually called.
 */
export const vahedInfosApi = createResourceApi<VahedInfoDto>('vahed-infos');
