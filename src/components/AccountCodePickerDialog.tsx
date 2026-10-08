import { useEffect, useMemo, useState } from 'react';
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
import { toLatinDigits } from '../lib/format/numbers';
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
   * top of whatever page is currently loaded (the text search below, unlike this, is server-side):
   * it narrows the CURRENT page's rows, it does not ask the server for a different page.
   */
  filterRows?: (account: AccountCodeDto) => boolean;
}

/**
 * Shared paginated picker for `TB_ACCOUNTCODE` rows — used both for "کد حساب والد" on the
 * chart-of-accounts form and for "حساب معین" on a voucher line. Never accepts a raw guid
 * text input per task spec.
 *
 * The search box queries the server (`GET /api/account-codes?search=`) across the whole chart:
 * a code that starts with the text, or a title that contains it. It used to filter only the
 * loaded page, so «3030» on page 1 of 15 found nothing even when the account existed.
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
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');

  // A short pause before asking the server, so typing «3030» is one request, not four.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(toLatinDigits(searchText.trim()));
      setPageNumber(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const query = useQuery({
    queryKey: ['account-codes-picker', pageNumber, pageSize, search],
    queryFn: () => accountCodesApi.list({ pageNumber, pageSize, search: search || undefined }),
    enabled: open,
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    let filtered = items.filter((row) => row.id !== excludeId);
    if (filterRows) {
      filtered = filtered.filter(filterRows);
    }
    return filtered;
  }, [query.data, excludeId, filterRows]);

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
            autoFocus
            label="جستجوی کد یا عنوان حساب"
            helperText="در همهٔ حساب‌ها جستجو می‌شود: کدی که با این عدد شروع شود، یا عنوانی که این متن را داشته باشد."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </Box>

        {query.isError && <ErrorBanner error={query.error} />}

        {!query.isError && (
          <>
            <DataTable
              pageable={false}
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.id}
              isLoading={query.isLoading}
              emptyMessage={search ? `حسابی با «${searchText.trim()}» پیدا نشد.` : 'هیچ حسابی یافت نشد.'}
            />
            {query.data && (
              <Pagination
                pageNumber={query.data.pageNumber}
                pageSize={pageSize}
                totalCount={query.data.totalCount}
                onPageChange={setPageNumber}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageNumber(1);
        }}
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
