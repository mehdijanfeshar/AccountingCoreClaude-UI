import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits } from '../../lib/format/numbers';
import { payReciveHeadsApi } from './api';
import type { PayReciveHeadDto } from '../../types/payReciveHead';

const PAGE_SIZE = 20;

export function PayReciveHeadsListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PayReciveHeadDto | null>(null);

  const query = useQuery({
    queryKey: ['pay-recive-heads', pageNumber, PAGE_SIZE],
    queryFn: () => payReciveHeadsApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => payReciveHeadsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pay-recive-heads'] });
      notify('سند دریافت و پرداخت حذف شد.');
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
        (row.payReciveCode ?? '').toLowerCase().includes(needle) ||
        (row.payReciveDescription ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

  const columns: DataTableColumn<PayReciveHeadDto>[] = [
    { key: 'payReciveCode', header: 'شماره سند', render: (row) => <MonoCode value={row.payReciveCode} /> },
    { key: 'payReciveDate', header: 'تاریخ', render: (row) => formatLegacyJalaliDate(row.payReciveDate) },
    { key: 'payReciveDescription', header: 'شرح', render: (row) => row.payReciveDescription ?? '—' },
    { key: 'year', header: 'سال مالی', render: (row) => (row.year ? toPersianDigits(row.year) : '—') },
    {
      key: 'payReciveType',
      header: 'PayReciveType',
      render: (row) =>
        row.payReciveType === null ? (
          <Typography variant="body2" color="text.disabled">
            تعیین‌نشده
          </Typography>
        ) : (
          <Chip size="small" variant="outlined" label={row.payReciveType ? 'بله' : 'خیر'} />
        ),
    },
    {
      key: 'voucherHeadId',
      header: 'سند حسابداری',
      render: (row) =>
        row.voucherHeadId ? (
          <Chip size="small" color="success" variant="outlined" label="صادر شده" />
        ) : (
          <Typography variant="body2" color="text.disabled">
            صادر نشده
          </Typography>
        ),
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton
              size="small"
              component={RouterLink}
              to={`/operation/pay-recive-heads/${row.id}/edit`}
              aria-label={`ویرایش سند ${row.payReciveCode}`}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton
              size="small"
              color="error"
              onClick={() => setPendingDelete(row)}
              aria-label={`حذف سند ${row.payReciveCode}`}
            >
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
        icon={<SwapHorizOutlinedIcon />}
        title="دریافت و پرداخت"
        description="فهرست سرسند اسناد دریافت و پرداخت (TB_PAYRECIVHEAD) — فقط سرسند؛ ردیف‌های تفصیلی این نسخه پشتیبانی نمی‌شود."
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            component={RouterLink}
            to="/operation/pay-recive-heads/new"
          >
            سند جدید
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
            emptyMessage="هنوز سند دریافت و پرداختی ثبت نشده است."
            emptyAction={
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/operation/pay-recive-heads/new"
              >
                افزودن اولین سند
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
        title="حذف سند"
        description={pendingDelete ? `آیا از حذف سند «${pendingDelete.payReciveCode}» مطمئن هستید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
