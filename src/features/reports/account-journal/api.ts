import { apiClient } from '../../../lib/api/client';
import type { AccountJournalParams, AccountJournalResult } from '../../../types/accountJournal';

/**
 * `GET /api/reports/account-journal` — دفتر روزنامه.
 *
 * Read-only and paged, with the totals of the whole filtered set returned alongside the page. A
 * journal is read in long runs, so its page sizes are larger than the other reports'.
 *
 * ⚠️ No `vahedCode` parameter — see `voucherReviewApi` for the header contract.
 */
export const accountJournalApi = {
  get({
    year,
    pageNumber,
    pageSize,
    fromVoucherNo,
    toVoucherNo,
    fromDate,
    toDate,
    fromAccountCode,
    toAccountCode,
    docLife,
    description,
  }: AccountJournalParams): Promise<AccountJournalResult> {
    const params: Record<string, string | number> = { year, pageNumber, pageSize };

    if (fromVoucherNo) params.fromVoucherNo = fromVoucherNo;
    if (toVoucherNo) params.toVoucherNo = toVoucherNo;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    if (fromAccountCode) params.fromAccountCode = fromAccountCode;
    if (toAccountCode) params.toAccountCode = toAccountCode;
    if (docLife !== undefined) params.docLife = docLife;
    if (description) params.description = description;

    return apiClient
      .get<AccountJournalResult>('/reports/account-journal', { params })
      .then((res) => res.data);
  },
};
