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
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { toPersianDigits } from '../../lib/format/numbers';
import { formatThousands } from '../../lib/format/numbers';
import { expensesApi } from './api';
import type { ExpenseDto } from '../../types/expense';

const PAGE_SIZE = 20;

export function ExpensesListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ExpenseDto | null>(null);

  const query = useQuery({
    queryKey: ['expenses', pageNumber, PAGE_SIZE],
    queryFn: () => expensesApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      notify('هزینه حذف شد.');
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
        (row.expenseCode ?? '').toLowerCase().includes(needle) ||
        (row.expenseName ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

  const columns: DataTableColumn<ExpenseDto>[] = [
    { key: 'expenseCode', header: 'کد هزینه', render: (row) => <MonoCode value={row.expenseCode} /> },
    { key: 'expenseName', header: 'عنوان هزینه', render: (row) => row.expenseName ?? '—' },
    { key: 'description', header: 'توضیحات', render: (row) => row.description ?? '—' },
    {
      key: 'defaultAmount',
      header: 'مبلغ پیش‌فرض',
      render: (row) => (row.defaultAmount != null ? formatThousands(row.defaultAmount) : '—'),
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton size="small" aria-label="ویرایش" component={RouterLink} to={`/base/expenses/${row.id}/edit`}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(row)}>
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
        eyebrow="اطلاعات پایه"
        icon={<ReceiptLongOutlinedIcon />}
        title="هزینه"
        description="فهرست انواع هزینه (TB_EXPENCE)"
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/expenses/new">
            افزودن هزینه
          </Button>
        }
      />

      <ListToolbar
        search={filter}
        onSearchChange={setFilter}
        searchLabel="جستجو در همین صفحه"
        summary={query.data ? `${toPersianDigits(query.data.totalCount)} ردیف` : ''}
      />

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage={filter.trim() ? 'نتیجه‌ای برای این جستجو یافت نشد.' : 'هنوز هزینه‌ای ثبت نشده است.'}
            emptyAction={
              filter.trim() ? (
                <Button size="small" variant="text" onClick={() => setFilter('')}>
                  پاک کردن جستجو
                </Button>
              ) : (
                <Button size="small" variant="outlined" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/expenses/new">
                  افزودن هزینه
                </Button>
              )
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
        title="حذف هزینه"
        description={pendingDelete ? `آیا از حذف «${pendingDelete.expenseName ?? pendingDelete.expenseCode}» مطمئن هستید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
