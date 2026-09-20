import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
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
import { identityGroupsApi, identitySubGroupsApi } from './api';
import type { IdentitySubGroupDto } from '../../types/identity';
import {
  getIdentitySubGroupKindLabel,
  getIdentitySubGroupTypeLabel,
  IDENTITY_SUB_GROUP_KIND_FIXED,
} from '../../types/legacyEnums';

const PAGE_SIZE = 20;

/**
 * زیرگروه‌های یک گروه شناسنامه — `GET /api/identity-sub-groups?identityGroupId=…`.
 *
 * Scoped to one group by route rather than by a filter the user picks: a زیرگروه only means
 * anything inside its group, and the شناسنامه form reads exactly this list (narrowed further to
 * the ثابت ones).
 */
export function IdentitySubGroupsListPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<IdentitySubGroupDto | null>(null);

  const groupQuery = useQuery({
    queryKey: ['identity-groups', groupId],
    queryFn: () => identityGroupsApi.getById(groupId as string),
    enabled: Boolean(groupId),
  });

  const query = useQuery({
    queryKey: ['identity-sub-groups', groupId, pageNumber, PAGE_SIZE],
    queryFn: () => identitySubGroupsApi.list({ pageNumber, pageSize: PAGE_SIZE, identityGroupId: groupId }),
    placeholderData: (previous) => previous,
    enabled: Boolean(groupId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => identitySubGroupsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['identity-sub-groups'] });
      notify('زیرگروه حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const rows = query.data?.items ?? [];

  const columns: DataTableColumn<IdentitySubGroupDto>[] = [
    { key: 'identySubGroupsCode', header: 'کد', render: (row) => <MonoCode value={row.identySubGroupsCode} /> },
    {
      key: 'subgrpsDesc',
      header: 'شرح زیرگروه',
      render: (row) =>
        row.subgrpsDesc ?? (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      key: 'fixed',
      header: 'نوع زیرگروه',
      render: (row) => (
        <Chip
          size="small"
          color={row.fixed === IDENTITY_SUB_GROUP_KIND_FIXED ? 'primary' : 'default'}
          label={getIdentitySubGroupKindLabel(row.fixed)}
        />
      ),
    },
    { key: 'subgrpsType', header: 'نوع مقدار', render: (row) => getIdentitySubGroupTypeLabel(row.subgrpsType) },
    { key: 'subgrpsLen', header: 'طول', render: (row) => toPersianDigits(row.subgrpsLen) },
    { key: 'sumFlag', header: 'جمع‌پذیر', render: (row) => (row.sumFlag ? 'بله' : 'خیر') },
    { key: 'year', header: 'سال مالی', render: (row) => (row.year ? toPersianDigits(row.year) : '—') },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton
              size="small"
              aria-label="ویرایش"
              component={RouterLink}
              to={`/base/identity-groups/${groupId}/sub-groups/${row.id}/edit`}
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

  const groupLabel = groupQuery.data?.identityGroupsDesc ?? '…';

  return (
    <section>
      <PageHeader
        eyebrow="تعریف ویژگی"
        icon={<ListAltOutlinedIcon />}
        title={`زیرگروه‌های ${groupLabel}`}
        description="زیرگروه ثابت یک مقدار روی خودِ شناسنامه می‌گیرد؛ زیرگروه متغیر به‌ازای هر ردیف سند مقدار می‌گیرد."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="text"
              startIcon={<ArrowBackOutlinedIcon />}
              component={RouterLink}
              to="/base/identity-groups"
            >
              بازگشت به گروه‌ها
            </Button>
            <Button
              variant="contained"
              startIcon={<AddOutlinedIcon />}
              component={RouterLink}
              to={`/base/identity-groups/${groupId}/sub-groups/new`}
            >
              افزودن زیرگروه
            </Button>
          </Stack>
        }
      />

      <ListToolbar summary={query.data ? `${toPersianDigits(query.data.totalCount)} زیرگروه` : ''} />

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage="هنوز زیرگروهی برای این گروه ثبت نشده است."
            emptyAction={
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to={`/base/identity-groups/${groupId}/sub-groups/new`}
              >
                افزودن زیرگروه
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
        title="حذف زیرگروه"
        description="آیا از حذف این زیرگروه مطمئن هستید؟ مقادیر ثبت‌شدهٔ آن در شناسنامه‌ها حذف نمی‌شوند."
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
