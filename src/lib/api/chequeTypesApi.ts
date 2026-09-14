import { createResourceApi } from './createResourceApi';
import type { ChequeTypeLookupDto } from '../../types/chequeTypeLookup';

/**
 * Read-only slice of `api/cheque-types` used to populate the نوع دسته‌چک lookup on the
 * `CheckBookFormPage`. Full CRUD exists on the backend for the (46-field, print-layout-designer)
 * `TB_CHECK_TYPE` resource, but building that editor is out of scope here — only `.list()` is
 * ever called, and only for its `id`/`chequeTypeTitle` fields.
 */
export const chequeTypesApi = createResourceApi<ChequeTypeLookupDto>('cheque-types');
