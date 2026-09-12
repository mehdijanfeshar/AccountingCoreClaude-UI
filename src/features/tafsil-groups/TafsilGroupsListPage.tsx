import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { tafsilGroupsApi } from './api';
import type { TafsilGroupDto } from '../../types/tafsilGroup';

const PAGE_SIZE = 20;

/**
 * `true` = حقیقی (confirmed by project owner). `false`/`null` labels are provisional
 * (حقوقی/نامشخص) pending the owner's exact confirmation.
 */
function personTypeChip(value: boolean | null) {
  if (value === null) return <Chip size="small" variant="outlined" label="نامشخص" />;
  return <Chip size="small" color={value ? 'primary' : 'default'} label={value ? 'حقیقی' : 'حقوقی'} />;
}

export function TafsilGroupsListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<TafsilGroupDto | null>(null);

  const query = useQuery({
    queryKey: ['tafsil-groups', pageNumber, PAGE_SIZE],
    queryFn: () => tafsilGroupsApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tafsilGroupsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tafsil-groups'] });
      notify('گروه تفصیلی حذف شد.');
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
        (row.tafsilGroupCode ?? '').toLowerCase().includes(needle) ||
        (row.tafsilGroupName ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

  const columns: DataTableColumn<TafsilGroupDto>[] = [
    { key: 'tafsilGroupCode', header: 'کد گروه', render: (row) => row.tafsilGroupCode ?? '—' },
    { key: 'tafsilGroupName', header: 'عنوان گروه', render: (row) => row.tafsilGroupName ?? '—' },
    { key: 'personType', header: 'نوع شخص', render: (row) => personTypeChip(row.personType) },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton size="small" component={RouterLink} to={`/base/tafsil-groups/${row.id}/edit`}>
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
        eyebrow="اطلاعات پایه"
        icon={<CategoryOutlinedIcon />}
        title="گروه تفصیلی"
        description="فهرست گروه‌های تفصیلی (TB_TAFSIL_GROUP)"
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/tafsil-groups/new">
            افزودن گروه تفصیلی
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
            emptyMessage="هیچ گروه تفصیلی‌ای یافت نشد."
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
        title="حذف گروه تفصیلی"
        description={pendingDelete ? `آیا از حذف «${pendingDelete.tafsilGroupName ?? pendingDelete.tafsilGroupCode}» مطمئن هستید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
