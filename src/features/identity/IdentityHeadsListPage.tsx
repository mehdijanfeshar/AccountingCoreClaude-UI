import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListToolbar } from '../../components/ListToolbar';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { identityGroupsApi, identityHeadsApi } from './api';
import type { IdentityHeadDto } from '../../types/identity';

const PAGE_SIZE = 20;

/** Group dropdown needs every group, not a page of them; units rarely have many. */
const GROUP_PAGE_SIZE = 200;

/**
 * شناسنامه‌ها — `GET /api/identity-heads`.
 *
 * Each row is one شناسنامه issued against a گروه, carrying the value of every ثابت زیرگروه of
 * that group. The متغیر values are not here: they live on voucher lines.
 *
 * Both filters are applied server-side across all pages, so the toolbar count is the true match
 * count. The organizational unit is deliberately absent — the backend scopes to the caller's own
 * unit from the token.
 */
export function IdentityHeadsListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [pageNumber, setPageNumber] = useState(1);
  const [year, setYear] = useState(financialYear);
  const [groupId, setGroupId] = useState('');
  const [pendingDelete, setPendingDelete] = useState<IdentityHeadDto | null>(null);

  useEffect(() => {
    setYear(financialYear);
    setPageNumber(1);
  }, [financialYear]);

  const groupsQuery = useQuery({
    queryKey: ['identity-groups', 'all'],
    queryFn: () => identityGroupsApi.list({ pageNumber: 1, pageSize: GROUP_PAGE_SIZE }),
  });
  const groups = groupsQuery.data?.items ?? [];

  const query = useQuery({
    queryKey: ['identity-heads', pageNumber, PAGE_SIZE, groupId, year],
    queryFn: () =>
      identityHeadsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        identityGroupId: groupId || undefined,
        year: year || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => identityHeadsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['identity-heads'] });
      notify('شناسنامه حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const rows = query.data?.items ?? [];

  const columns: DataTableColumn<IdentityHeadDto>[] = [
    { key: 'serial', header: 'سریال', render: (row) => toPersianDigits(row.serial) },
    {
      key: 'identityGroupDesc',
      header: 'گروه شناسنامه',
      render: (row) =>
        row.identityGroupDesc ?? (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      key: 'fixItems',
      header: 'مقادیر ثابت',
      render: (row) =>
        row.fixItems.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            بدون مقدار
          </Typography>
        ) : (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            {row.fixItems.map((item) => (
              <Chip
                key={item.id}
                size="small"
                variant="outlined"
                label={`${item.identitySubGroupDesc ?? '؟'}: ${item.value ?? '—'}`}
              />
            ))}
          </Stack>
        ),
    },
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
              to={`/base/identity-heads/${row.id}/edit`}
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

  const hasExtraFilter = Boolean(groupId);

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<BadgeOutlinedIcon />}
        title="شناسنامه‌ها"
        description="شناسنامه‌های صادرشده و مقادیر ثابت هرکدام — فیلترها روی کل رکوردهای واحد شما اعمال می‌شوند."
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/identity-heads/new">
            صدور شناسنامه
          </Button>
        }
      />

      <ListToolbar summary={query.data ? `${toPersianDigits(query.data.totalCount)} شناسنامه` : ''}>
        <TextField
          select
          size="small"
          label="گروه شناسنامه"
          value={groupId}
          onChange={(event) => {
            setGroupId(event.target.value);
            setPageNumber(1);
          }}
          sx={{ width: 220 }}
        >
          <MenuItem value="">همه</MenuItem>
          {groups.map((group) => (
            <MenuItem key={group.id} value={group.id}>
              {group.identityGroupsDesc}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="سال مالی"
          value={year}
          onChange={(event) => {
            setYear(toLatinDigits(event.target.value));
            setPageNumber(1);
          }}
          sx={{ width: 116 }}
          slotProps={{
            htmlInput: { maxLength: 4, inputMode: 'numeric' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <EventOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
        {hasExtraFilter && (
          <Button
            size="small"
            variant="text"
            startIcon={<FilterAltOffOutlinedIcon />}
            onClick={() => {
              setGroupId('');
              setPageNumber(1);
            }}
          >
            پاک کردن فیلترها
          </Button>
        )}
      </ListToolbar>

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage={
              hasExtraFilter ? 'نتیجه‌ای برای این فیلترها یافت نشد.' : 'هنوز شناسنامه‌ای صادر نشده است.'
            }
            emptyAction={
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/base/identity-heads/new"
              >
                صدور شناسنامه
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
        title="حذف شناسنامه"
        description="آیا از حذف این شناسنامه مطمئن هستید؟ مقادیر ثابت آن هم حذف می‌شوند."
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
