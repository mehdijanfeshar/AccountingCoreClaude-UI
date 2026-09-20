import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListToolbar } from '../../components/ListToolbar';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toPersianDigits } from '../../lib/format/numbers';
import { identitySubGroupsApi } from './api';
import type { IdentityGroupDto, IdentitySubGroupDto } from '../../types/identity';
import {
  getIdentitySubGroupKindLabel,
  getIdentitySubGroupTypeLabel,
  IDENTITY_SUB_GROUP_KIND_FIXED,
} from '../../types/legacyEnums';

const PAGE_SIZE = 20;

/**
 * تب «اجزای ویژگی» — `TB_IDENTITYSUBGRP`.
 *
 * Always scoped to one گروه: a جزء means nothing outside its group, and it is the group that the
 * ویژگی entry form queries by. The group is picked here rather than taken from the route, because
 * this is now a tab rather than a page of its own.
 *
 * <b>ثابت vs متغیر matters a lot here:</b> a ثابت جزء gets one value on the ویژگی record itself;
 * a متغیر one is meant to get a value per voucher line — and that write path does not exist yet,
 * so a متغیر جزء can be defined but never filled. The tab says so rather than letting a user
 * discover it later.
 */
export function IdentitySubGroupsTab({
  groups,
  groupsLoading,
  selectedGroupId,
  onSelectGroup,
}: {
  groups: IdentityGroupDto[];
  groupsLoading: boolean;
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
}) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<IdentitySubGroupDto | null>(null);

  const query = useQuery({
    queryKey: ['identity-sub-groups', selectedGroupId, pageNumber, PAGE_SIZE],
    queryFn: () =>
      identitySubGroupsApi.list({ pageNumber, pageSize: PAGE_SIZE, identityGroupId: selectedGroupId }),
    placeholderData: (previous) => previous,
    enabled: Boolean(selectedGroupId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => identitySubGroupsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['identity-sub-groups'] });
      notify('جزء ویژگی حذف شد.');
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
      header: 'شرح جزء',
      render: (row) =>
        row.subgrpsDesc ?? (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      key: 'fixed',
      header: 'نوع',
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
              to={`/base/features/groups/${selectedGroupId}/parts/${row.id}/edit`}
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

  const hasVariableParts = rows.some((row) => row.fixed !== IDENTITY_SUB_GROUP_KIND_FIXED);

  return (
    <>
      <ListToolbar summary={query.data ? `${toPersianDigits(query.data.totalCount)} جزء` : ''}>
        <TextField
          select
          size="small"
          label="گروه ویژگی"
          value={selectedGroupId}
          onChange={(event) => {
            onSelectGroup(event.target.value);
            setPageNumber(1);
          }}
          disabled={groupsLoading}
          sx={{ width: 260 }}
        >
          {groups.map((group) => (
            <MenuItem key={group.id} value={group.id}>
              {group.identityGroupsDesc}
            </MenuItem>
          ))}
        </TextField>
        {selectedGroupId && (
          <Button
            size="small"
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            component={RouterLink}
            to={`/base/features/groups/${selectedGroupId}/parts/new`}
          >
            افزودن جزء
          </Button>
        )}
      </ListToolbar>

      {!groupsLoading && groups.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          ابتدا در تب «گروه ویژگی» یک گروه بسازید.
        </Alert>
      )}

      {!selectedGroupId && groups.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          یک گروه ویژگی انتخاب کنید تا اجزای آن نمایش داده شود.
        </Alert>
      )}

      {hasVariableParts && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          اجزای «متغیر» در فرم ثبت ویژگی نمایش داده نمی‌شوند؛ مقدار آن‌ها باید روی ردیف سند ثبت شود و آن مسیر هنوز ساخته نشده است.
        </Alert>
      )}

      {query.isError && <ErrorBanner error={query.error} />}

      {selectedGroupId && !query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage="هنوز جزئی برای این گروه ثبت نشده است."
            emptyAction={
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to={`/base/features/groups/${selectedGroupId}/parts/new`}
              >
                افزودن جزء
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
        title="حذف جزء ویژگی"
        description="آیا از حذف این جزء مطمئن هستید؟ مقادیر ثبت‌شدهٔ آن حذف نمی‌شوند."
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </>
  );
}
