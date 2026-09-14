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
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
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
import { bankAccountsApi } from './api';
import type { BankAccountDto } from '../../types/bankAccount';

const PAGE_SIZE = 20;

export function BankAccountsListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<BankAccountDto | null>(null);

  const query = useQuery({
    queryKey: ['bank-accounts', pageNumber, PAGE_SIZE],
    queryFn: () => bankAccountsApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bankAccountsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      notify('حساب بانکی حذف شد.');
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
        (row.accountNumber ?? '').toLowerCase().includes(needle) ||
        (row.accountHolder ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

  const columns: DataTableColumn<BankAccountDto>[] = [
    { key: 'accountNumber', header: 'شماره حساب', render: (row) => <MonoCode value={row.accountNumber} /> },
    { key: 'accountHolder', header: 'صاحب حساب', render: (row) => row.accountHolder ?? '—' },
    { key: 'shebaNumber', header: 'شماره شبا', render: (row) => row.shebaNumber ?? '—' },
    {
      key: 'firstAmount',
      header: 'مانده اولیه',
      render: (row) => (row.firstAmount != null ? formatThousands(row.firstAmount) : '—'),
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton size="small" aria-label="ویرایش" component={RouterLink} to={`/base/bank-accounts/${row.id}/edit`}>
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
        icon={<AccountBalanceOutlinedIcon />}
        title="بانک"
        description="فهرست حساب‌های بانکی (TB_ACCOUNT)"
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/bank-accounts/new">
            افزودن حساب بانکی
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
            emptyMessage={filter.trim() ? 'نتیجه‌ای برای این جستجو یافت نشد.' : 'هنوز حساب بانکی‌ای ثبت نشده است.'}
            emptyAction={
              filter.trim() ? (
                <Button size="small" variant="text" onClick={() => setFilter('')}>
                  پاک کردن جستجو
                </Button>
              ) : (
                <Button size="small" variant="outlined" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/bank-accounts/new">
                  افزودن حساب بانکی
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
        title="حذف حساب بانکی"
        description={pendingDelete ? `آیا از حذف حساب «${pendingDelete.accountNumber}» مطمئن هستید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
