import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListToolbar } from '../../components/ListToolbar';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toPersianDigits } from '../../lib/format/numbers';
import { identityGroupsApi } from './api';
import type { IdentityGroupDto } from '../../types/identity';

const PAGE_SIZE = 20;

/**
 * تب «گروه ویژگی» — `TB_IDENTITYGROUP`.
 *
 * Top of the three-level ویژگی structure: a group owns a set of اجزا (each ثابت or متغیر), and
 * ویژگی‌های ثبت‌شده are then issued against it.
 *
 * No `PageHeader` of its own — the parent `FeaturesPage` owns it, same as the کدینگ tabs.
 */
export function IdentityGroupsTab({ onOpenParts }: { onOpenParts: (groupId: string) => void }) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filter, setFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<IdentityGroupDto | null>(null);

  const query = useQuery({
    queryKey: ['identity-groups', pageNumber, PAGE_SIZE],
    queryFn: () => identityGroupsApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => identityGroupsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['identity-groups'] });
      notify('گروه ویژگی حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const items = query.data?.items ?? [];
  const needle = filter.trim().toLowerCase();
  const rows = needle
    ? items.filter(
        (row) =>
          (row.identityGroupsDesc ?? '').toLowerCase().includes(needle) ||
          (row.identityGroupsCode ?? '').toLowerCase().includes(needle),
      )
    : items;

  const columns: DataTableColumn<IdentityGroupDto>[] = [
    { key: 'identityGroupsCode', header: 'کد گروه', render: (row) => <MonoCode value={row.identityGroupsCode} /> },
    {
      key: 'identityGroupsDesc',
      header: 'شرح گروه',
      render: (row) =>
        row.identityGroupsDesc ?? (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="اجزای این گروه">
            <IconButton size="small" aria-label="اجزای این گروه" onClick={() => onOpenParts(row.id)}>
              <ListAltOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="ویرایش">
            <IconButton
              size="small"
              aria-label="ویرایش"
              component={RouterLink}
              to={`/base/features/groups/${row.id}/edit`}
            >
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
    <>
      <ListToolbar
        search={filter}
        onSearchChange={setFilter}
        searchLabel="جستجو در همین صفحه (کد یا شرح)"
        summary={query.data ? `${toPersianDigits(query.data.totalCount)} گروه` : ''}
      >
        <Button
          size="small"
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          component={RouterLink}
          to="/base/features/groups/new"
        >
          افزودن گروه ویژگی
        </Button>
      </ListToolbar>

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage={needle ? 'نتیجه‌ای برای این جستجو یافت نشد.' : 'هنوز گروه ویژگی‌ای ثبت نشده است.'}
            emptyAction={
              needle ? (
                <Button size="small" variant="text" onClick={() => setFilter('')}>
                  پاک کردن جستجو
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddOutlinedIcon />}
                  component={RouterLink}
                  to="/base/features/groups/new"
                >
                  افزودن گروه ویژگی
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
        title="حذف گروه ویژگی"
        description="آیا از حذف این گروه مطمئن هستید؟ اجزا و ویژگی‌های ثبت‌شدهٔ وابسته به آن حذف نمی‌شوند."
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </>
  );
}
