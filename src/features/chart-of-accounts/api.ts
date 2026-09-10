import { createResourceApi } from '../../lib/api/createResourceApi';
import type { AccountCodeDto } from '../../types/accountCode';

export const accountCodesApi = createResourceApi<AccountCodeDto>('account-codes');
