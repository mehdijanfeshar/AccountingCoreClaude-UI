import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import { DataTable, type DataTableColumn } from './DataTable';
import { Pagination } from './Pagination';
import { ErrorBanner } from './ErrorBanner';
import { accountCodesApi } from '../features/chart-of-accounts/api';
import type { AccountCodeDto } from '../types/accountCode';

const PAGE_SIZE = 10;

interface AccountCodePickerDialogProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (account: AccountCodeDto) => void;
  /** Excludes a row from being selectable (e.g. an account cannot be its own parent). */
  excludeId?: string;
  /**
   * Optional extra restriction on which fetched rows are selectable (e.g. by `accCode.length` to
   * scope the picker to one کدینگ level — see `AccountCodeLevelTab.tsx`). Applied client-side on
   * top of whatever page is currently loaded, same honesty caveat as the free-text filter below:
   * it narrows the CURRENT page's rows, it does not ask the server for a different page.
   */
  filterRows?: (account: AccountCodeDto) => boolean;
}

/**
 * Shared paginated picker for `TB_ACCOUNTCODE` rows — used both for "کد حساب والد" on the
 * chart-of-accounts form and for "حساب معین" on a voucher line. Never accepts a raw guid
 * text input per task spec.
 *
 * ⚠️ `GET /api/account-codes` (`GetAccountCodesQuery`) has NO `search` query parameter in
 * the real backend contract — only `pageNumber`/`pageSize`. The text field below therefore
 * filters ONLY the rows already loaded on the current page; it is not a server-side search
 * and is explicitly labelled as such so it doesn't look broken. Do not "fix" this by
 * guessing a `search` param the backend doesn't accept.
 */
export function AccountCodePickerDialog({
  open,
  title = 'انتخاب حساب',
  onClose,
  onSelect,
  excludeId,
  filterRows,
}: AccountCodePickerDialogProps) {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageFilter, setPageFilter] = useState('');

  const query = useQuery({
    queryKey: ['account-codes-picker', pageNumber],
    queryFn: () => accountCodesApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    enabled: open,
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    let filtered = items.filter((row) => row.id !== excludeId);
    if (filterRows) {
      filtered = filtered.filter(filterRows);
    }
    if (!pageFilter.trim()) return filtered;
    const needle = pageFilter.trim().toLowerCase();
    return filtered.filter(
      (row) =>
        (row.accCode ?? '').toLowerCase().includes(needle) ||
        (row.accCodeName ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, excludeId, filterRows, pageFilter]);

  const columns: DataTableColumn<AccountCodeDto>[] = [
    { key: 'accCode', header: 'کد حساب', render: (row) => row.accCode ?? '—' },
    { key: 'accCodeName', header: 'عنوان حساب', render: (row) => row.accCodeName ?? '—' },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            onSelect(row);
            onClose();
          }}
        >
          انتخاب
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            label="فیلتر در صفحه جاری"
            helperText="این فیلتر فقط روی موارد همین صفحه اعمال می‌شود (بک‌اند جستجوی سمت سرور ندارد)."
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
          />
        </Box>

        {query.isError && <ErrorBanner error={query.error} />}

        {!query.isError && (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.id}
              isLoading={query.isLoading}
              emptyMessage="هیچ حسابی یافت نشد."
            />
            {query.data && (
              <Pagination
                pageNumber={query.data.pageNumber}
                pageSize={query.data.pageSize}
                totalCount={query.data.totalCount}
                onPageChange={setPageNumber}
              />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
