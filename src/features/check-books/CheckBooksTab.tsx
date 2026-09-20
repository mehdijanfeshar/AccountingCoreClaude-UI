import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits } from '../../lib/format/numbers';
import { bankAccountsApi } from '../bank-accounts/api';
import { checkBooksApi } from './api';
import type { CheckBookDto } from '../../types/checkBook';

const PAGE_SIZE = 20;

/**
 * تب «دسته‌چک» — `TB_CHECKBOOK`.
 *
 * Lives under بانک rather than عملیات because `ACCOUNT_ID` is a REQUIRED FK to `TB_ACCOUNT`: a
 * دسته‌چک cannot exist without the bank account it was issued for, so it was never a standalone
 * operation.
 *
 * ⚠️ The account filter is client-side. `GetCheckBooks` has no `accountId` parameter yet, so it
 * narrows the loaded page only and the toolbar count stays the unfiltered total — the banner
 * says so rather than letting the two numbers quietly disagree. Recorded in
 * `docs/open-decisions.md`.
 */
export function CheckBooksTab({
  accountFilter,
  onAccountFilterChange,
}: {
  accountFilter: string;
  onAccountFilterChange: (accountId: string) => void;
}) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CheckBookDto | null>(null);

  const query = useQuery({
    queryKey: ['check-books', pageNumber, PAGE_SIZE],
    queryFn: () => checkBooksApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const bankAccountsQuery = useQuery({
    queryKey: ['bank-accounts-lookup'],
    queryFn: () => bankAccountsApi.list({ pageNumber: 1, pageSize: 200 }),
  });

  const accountLabelById = useMemo(() => {
    const map = new Map<string, string>();
    (bankAccountsQuery.data?.items ?? []).forEach((a) =>
      map.set(a.id, `${a.accountNumber ?? ''} - ${a.accountHolder ?? ''}`),
    );
    return map;
  }, [bankAccountsQuery.data]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => checkBooksApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['check-books'] });
      notify('دسته‌چک حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const rows = useMemo(() => {
    let items = query.data?.items ?? [];

    if (accountFilter) {
      items = items.filter((row) => row.accountId === accountFilter);
    }

    if (!filter.trim()) return items;
    const needle = filter.trim().toLowerCase();
    return items.filter(
      (row) =>
        (row.fromCheckNumber ?? '').toLowerCase().includes(needle) ||
        (row.toCheckNumber ?? '').toLowerCase().includes(needle) ||
        (row.checkBookTitle ?? '').toLowerCase().includes(needle) ||
        (row.serial ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter, accountFilter]);

  const columns: DataTableColumn<CheckBookDto>[] = [
    {
      key: 'account',
      header: 'حساب بانکی',
      render: (row) => accountLabelById.get(row.accountId) ?? row.accountId,
    },
    { key: 'checkBookTitle', header: 'عنوان', render: (row) => row.checkBookTitle ?? '—' },
    {
      key: 'range',
      header: 'بازه شماره چک',
      render: (row) => (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <MonoCode value={row.fromCheckNumber} />
          <span>تا</span>
          <MonoCode value={row.toCheckNumber} />
        </Stack>
      ),
    },
    { key: 'checkBookDate', header: 'تاریخ صدور', render: (row) => formatLegacyJalaliDate(row.checkBookDate) },
    { key: 'serial', header: 'سریال', render: (row) => row.serial ?? '—' },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton
              size="small"
              component={RouterLink}
              to={`/base/bank/check-books/${row.id}/edit`}
              aria-label={`ویرایش دسته‌چک ${row.fromCheckNumber} تا ${row.toCheckNumber}`}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton
              size="small"
              color="error"
              onClick={() => setPendingDelete(row)}
              aria-label={`حذف دسته‌چک ${row.fromCheckNumber} تا ${row.toCheckNumber}`}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <ListToolbar
        search={filter}
        onSearchChange={setFilter}
        searchLabel="جستجو در همین صفحه"
        summary={query.data ? `${toPersianDigits(query.data.totalCount)} ردیف` : ''}
      >
        <TextField
          select
          size="small"
          label="حساب بانکی"
          value={accountFilter}
          onChange={(event) => onAccountFilterChange(event.target.value)}
          sx={{ width: 240 }}
        >
          <MenuItem value="">همه</MenuItem>
          {(bankAccountsQuery.data?.items ?? []).map((account) => (
            <MenuItem key={account.id} value={account.id}>
              {accountLabelById.get(account.id) ?? account.accountNumber}
            </MenuItem>
          ))}
        </TextField>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          component={RouterLink}
          to="/base/bank/check-books/new"
        >
          افزودن دسته‌چک
        </Button>
      </ListToolbar>

      {accountFilter && (
        <Alert severity="info" sx={{ mb: 2 }}>
          فیلتر حساب بانکی فقط روی ردیف‌های همین صفحه اعمال می‌شود؛ شمارندهٔ بالا کل ردیف‌هاست.
        </Alert>
      )}

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage="هنوز دسته‌چکی ثبت نشده است."
            emptyAction={
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/base/bank/check-books/new"
              >
                افزودن اولین دسته‌چک
              </Button>
            }
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف دسته‌چک"
        description={
          pendingDelete
            ? `آیا از حذف دسته‌چک «${pendingDelete.fromCheckNumber} تا ${pendingDelete.toCheckNumber}» مطمئن هستید؟`
            : undefined
        }
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </>
  );
}
