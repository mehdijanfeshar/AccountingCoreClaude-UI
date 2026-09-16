import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ListToolbar } from '../../components/ListToolbar';
import { toPersianDigits } from '../../lib/format/numbers';
import { attribForAccountCodesApi } from './api';
import type { AttribForAccountCodeDto } from '../../types/attribForAccountCode';
import { getAttribFlagLabel, getAttribSumLabel } from '../../types/legacyEnums';

const PAGE_SIZE = 20;

export function AttribForAccountCodesListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AttribForAccountCodeDto | null>(null);

  const query = useQuery({
    queryKey: ['attrib-for-account-codes', pageNumber, PAGE_SIZE],
    queryFn: () => attribForAccountCodesApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => attribForAccountCodesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attrib-for-account-codes'] });
      notify('ویژگی حذف شد.');
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
    return items.filter((row) => (row.year ?? '').toLowerCase().includes(needle));
  }, [query.data, filter]);

  const columns: DataTableColumn<AttribForAccountCodeDto>[] = [
    { key: 'year', header: 'سال مالی', render: (row) => row.year ?? '—' },
    { key: 'lenAtr', header: 'طول ویژگی (LenAtr)', render: (row) => toPersianDigits(row.lenAtr) },
    { key: 'attribBoxNo', header: 'شماره جعبه', render: (row) => toPersianDigits(row.attribBoxNo) },
    {
      key: 'flag',
      header: 'نوع مقدار',
      render: (row) => <Chip size="small" color="primary" label={getAttribFlagLabel(row.flag)} />,
    },
    {
      key: 'attribSum',
      header: 'جمع‌پذیری',
      render: (row) => <Chip size="small" color="primary" label={getAttribSumLabel(row.attribSum)} />,
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton size="small" aria-label="ویرایش" component={RouterLink} to={`/base/attrib-for-account-codes/${row.id}/edit`}>
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
        icon={<TuneOutlinedIcon />}
        title="ویژگی"
        description="فهرست ویژگی‌های تعریف‌شده برای حساب‌های معین (TB_ATTRIBFORACCOUNTCODE)"
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            component={RouterLink}
            to="/base/attrib-for-account-codes/new"
          >
            افزودن ویژگی
          </Button>
        }
      />

      <ListToolbar
        search={filter}
        onSearchChange={setFilter}
        searchLabel="جستجو در همین صفحه (سال مالی)"
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
            emptyMessage={filter.trim() ? 'نتیجه‌ای برای این جستجو یافت نشد.' : 'هنوز ویژگی‌ای ثبت نشده است.'}
            emptyAction={
              filter.trim() ? (
                <Button size="small" variant="text" onClick={() => setFilter('')}>
                  پاک کردن جستجو
                </Button>
              ) : (
                <Button size="small" variant="outlined" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/attrib-for-account-codes/new">
                  افزودن ویژگی
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
        title="حذف ویژگی"
        description="آیا از حذف این ویژگی مطمئن هستید؟"
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
