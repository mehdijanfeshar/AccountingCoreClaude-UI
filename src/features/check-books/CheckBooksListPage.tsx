import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { bankAccountsApi } from '../bank-accounts/api';
import { checkBooksApi } from './api';
import type { CheckBookDto } from '../../types/checkBook';

const PAGE_SIZE = 20;

export function CheckBooksListPage() {
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
    const items = query.data?.items ?? [];
    if (!filter.trim()) return items;
    const needle = filter.trim().toLowerCase();
    return items.filter(
      (row) =>
        (row.fromCheckNumber ?? '').toLowerCase().includes(needle) ||
        (row.toCheckNumber ?? '').toLowerCase().includes(needle) ||
        (row.checkBookTitle ?? '').toLowerCase().includes(needle) ||
        (row.serial ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

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
      render: (row) => `${row.fromCheckNumber} تا ${row.toCheckNumber}`,
    },
    { key: 'checkBookDate', header: 'تاریخ صدور', render: (row) => row.checkBookDate ?? '—' },
    { key: 'serial', header: 'سریال', render: (row) => row.serial ?? '—' },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton size="small" component={RouterLink} to={`/operation/check-books/${row.id}/edit`}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton size="small" color="error" onClick={() => setPendingDelete(row)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<BookOutlinedIcon />}
        title="دسته‌چک"
        description="فهرست دسته‌چک‌های صادرشده برای حساب‌های بانکی (TB_CHECKBOOK)"
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/operation/check-books/new">
            افزودن دسته‌چک
          </Button>
        }
      />

      <Box sx={{ mb: 2, maxWidth: 320 }}>
        <TextField
          fullWidth
          size="small"
          label="جستجو در همین صفحه"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
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
            emptyMessage="هیچ دسته‌چکی یافت نشد."
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
    </section>
  );
}
