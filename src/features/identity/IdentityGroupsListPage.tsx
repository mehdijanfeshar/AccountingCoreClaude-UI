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
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import { PageHeader } from '../../components/PageHeader';
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
 * تعریف ویژگی — گروه‌های شناسنامه (`GET /api/identity-groups`).
 *
 * A گروه شناسنامه is the top of the three-level شناسنامه structure: it owns a set of زیرگروه‌ها
 * (each ثابت or متغیر), and شناسنامه records are then issued against it.
 *
 * ⚠️ Not «حساب‌های شناسه‌دار» — see `../../types/identity.ts`.
 */
export function IdentityGroupsListPage() {
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
      notify('گروه شناسنامه حذف شد.');
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
          <Tooltip title="زیرگروه‌ها">
            <IconButton
              size="small"
              aria-label="زیرگروه‌ها"
              component={RouterLink}
              to={`/base/identity-groups/${row.id}/sub-groups`}
            >
              <ListAltOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="ویرایش">
            <IconButton
              size="small"
              aria-label="ویرایش"
              component={RouterLink}
              to={`/base/identity-groups/${row.id}/edit`}
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
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<AccountTreeOutlinedIcon />}
        title="تعریف ویژگی"
        description="گروه‌های شناسنامه و زیرگروه‌های هرکدام (TB_IDENTITYGROUP)"
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/identity-groups/new">
            افزودن گروه
          </Button>
        }
      />

      <ListToolbar
        search={filter}
        onSearchChange={setFilter}
        searchLabel="جستجو در همین صفحه (کد یا شرح)"
        summary={query.data ? `${toPersianDigits(query.data.totalCount)} گروه` : ''}
      />

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage={needle ? 'نتیجه‌ای برای این جستجو یافت نشد.' : 'هنوز گروه شناسنامه‌ای ثبت نشده است.'}
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
                  to="/base/identity-groups/new"
                >
                  افزودن گروه
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
        title="حذف گروه شناسنامه"
        description="آیا از حذف این گروه مطمئن هستید؟ زیرگروه‌ها و شناسنامه‌های وابسته به آن حذف نمی‌شوند."
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
