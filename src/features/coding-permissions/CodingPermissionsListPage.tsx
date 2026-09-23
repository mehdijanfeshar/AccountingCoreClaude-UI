import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import LockPersonOutlinedIcon from '@mui/icons-material/LockPersonOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListToolbar } from '../../components/ListToolbar';
import { JalaliDateField } from '../../components/JalaliDateField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toPersianDigits } from '../../lib/format/numbers';
import { CodingPermissionCreateDialog } from './CodingPermissionCreateDialog';
import { CodingPermissionReactivateDialog } from './CodingPermissionReactivateDialog';
import { codingPermissionsApi, vahedTypesApi } from './api';
import {
  CODING_PERMISSION_STATE,
  getCodingPermissionStateLabel,
  type CodingPermissionDto,
  type CodingPermissionState,
} from '../../types/codingPermission';
import { getVahedSectionLabel } from '../../types/vahedType';

const PAGE_SIZE = 20;

interface Filters {
  vahedTypeId: string;
  state: string;
  fromAuthorizedDate: string;
  toAuthorizedDate: string;
  fromLimitationDate: string;
  toLimitationDate: string;
}

const EMPTY_FILTERS: Filters = {
  vahedTypeId: '',
  state: '',
  fromAuthorizedDate: '',
  toAuthorizedDate: '',
  fromLimitationDate: '',
  toLimitationDate: '',
};

/** Shows a `YYYYMMDD` Jalali value as `YYYY/MM/DD`, or an em dash when the column is null. */
function formatJalali(value: string | null) {
  if (!value || value.length !== 8) return '—';
  return toPersianDigits(`${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`);
}

/**
 * «دسترسی کدینگ حسابداری» — `GET /api/white-and-black-lists`.
 *
 * Which kinds of organizational unit may use a given حساب معین. Backed by
 * `TB_WHITEANDBLACKLIST`; see `types/codingPermission.ts` for the two properties of that table
 * that shape this page.
 *
 * Every filter is applied **server-side** across all pages, so the toolbar's count is the true
 * match count rather than "matches on the current page".
 *
 * ⚠️ **This matrix is stored but not yet enforced.** Nothing in the voucher write path consults
 * it today — that was the project owner's explicit decision on 2026-09-23, to configure first and
 * enforce in a later phase. The reference system has the same gap (recorded in
 * `docs/centralaccount-business-reference.md` §17-8), so the numbers this screen writes currently
 * describe intent, not an enforced rule. Do not describe it to users as a block until that lands.
 */
export function CodingPermissionsListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitial, setCreateInitial] = useState<
    { accountCodeIds: string[]; vahedTypeIds: string[]; fromDate: string | null; toDate: string | null; state: CodingPermissionState } | undefined
  >(undefined);
  const [pendingBlacklist, setPendingBlacklist] = useState<CodingPermissionDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CodingPermissionDto | null>(null);
  const [reactivating, setReactivating] = useState<CodingPermissionDto | null>(null);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPageNumber(1);
  }

  // An inverted range is a 400 from the backend, not an empty table. Catching it here keeps the
  // user out of an error banner for what is almost always a swapped pair of fields.
  const authorizedInverted =
    filters.fromAuthorizedDate.length === 8 &&
    filters.toAuthorizedDate.length === 8 &&
    filters.fromAuthorizedDate > filters.toAuthorizedDate;
  const limitationInverted =
    filters.fromLimitationDate.length === 8 &&
    filters.toLimitationDate.length === 8 &&
    filters.fromLimitationDate > filters.toLimitationDate;
  const rangeInverted = authorizedInverted || limitationInverted;

  const vahedTypesQuery = useQuery({
    queryKey: ['vahed-types'],
    queryFn: () => vahedTypesApi.list(),
    staleTime: 30 * 60 * 1000,
  });

  const query = useQuery({
    queryKey: ['coding-permissions', pageNumber, PAGE_SIZE, filters],
    queryFn: () =>
      codingPermissionsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        vahedTypeId: filters.vahedTypeId || undefined,
        state: filters.state ? Number(filters.state) : undefined,
        fromAuthorizedDate: filters.fromAuthorizedDate || undefined,
        toAuthorizedDate: filters.toAuthorizedDate || undefined,
        fromLimitationDate: filters.fromLimitationDate || undefined,
        toLimitationDate: filters.toLimitationDate || undefined,
      }),
    placeholderData: (previous) => previous,
    enabled: !rangeInverted,
  });

  const blacklistMutation = useMutation({
    mutationFn: (id: string) => codingPermissionsApi.blacklist(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coding-permissions'] });
      notify('کد معین برای این نوع واحد غیرفعال شد.');
      setPendingBlacklist(null);
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'غیرفعال‌سازی با خطا مواجه شد.',
        severity: 'error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => codingPermissionsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coding-permissions'] });
      notify('دسترسی حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.',
        severity: 'error',
      });
    },
  });

  const rows = query.data?.items ?? [];
  const vahedTypes = useMemo(() => vahedTypesQuery.data ?? [], [vahedTypesQuery.data]);

  function duplicate(row: CodingPermissionDto) {
    const isSystemOnly = row.state === CODING_PERMISSION_STATE.SystemOnly;
    setCreateInitial({
      accountCodeIds: [row.accountCodeId],
      vahedTypeIds: row.vahedTypeId ? [row.vahedTypeId] : [],
      // Reads back whichever pair the row's own state populated, so the copy starts from what the
      // user can actually see in the grid.
      fromDate: isSystemOnly ? row.fromLimitationDate : row.fromAuthorizedDate,
      toDate: isSystemOnly ? row.toLimitationDate : row.toAuthorizedDate,
      state: isSystemOnly ? CODING_PERMISSION_STATE.SystemOnly : CODING_PERMISSION_STATE.Allowed,
    });
    setCreateOpen(true);
  }

  const columns: DataTableColumn<CodingPermissionDto>[] = [
    { key: 'accCode', header: 'کد معین', render: (row) => <MonoCode value={row.accCode} /> },
    {
      key: 'accCodeName',
      header: 'عنوان معین',
      render: (row) =>
        row.accCodeName ?? (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    { key: 'section', header: 'بخش', render: (row) => getVahedSectionLabel(row.vahedTypeParentCode) },
    { key: 'vahedTypeName', header: 'نوع واحد', render: (row) => row.vahedTypeName ?? '—' },
    {
      key: 'state',
      header: 'وضعیت',
      render: (row) => (
        <Chip
          size="small"
          label={getCodingPermissionStateLabel(row.state)}
          color={
            row.state === CODING_PERMISSION_STATE.Allowed
              ? 'success'
              : row.state === CODING_PERMISSION_STATE.SystemOnly
                ? 'warning'
                : 'error'
          }
        />
      ),
    },
    { key: 'fromAuthorizedDate', header: 'از تاریخ مجاز', render: (row) => formatJalali(row.fromAuthorizedDate) },
    { key: 'toAuthorizedDate', header: 'تا تاریخ مجاز', render: (row) => formatJalali(row.toAuthorizedDate) },
    {
      key: 'fromLimitationDate',
      header: 'از تاریخ محدودیت',
      render: (row) => formatJalali(row.fromLimitationDate),
    },
    { key: 'toLimitationDate', header: 'تا تاریخ محدودیت', render: (row) => formatJalali(row.toLimitationDate) },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => {
        const isBlacklisted = row.state === CODING_PERMISSION_STATE.Blacklisted;
        return (
          <Stack direction="row" spacing={0.5}>
            {isBlacklisted ? (
              <Tooltip title="فعال کردن">
                <IconButton
                  size="small"
                  color="success"
                  aria-label="فعال کردن"
                  onClick={() => setReactivating(row)}
                >
                  <CheckCircleOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="غیرفعال کردن">
                <IconButton
                  size="small"
                  color="warning"
                  aria-label="غیرفعال کردن"
                  onClick={() => setPendingBlacklist(row)}
                >
                  <BlockOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="تکثیر">
              <IconButton size="small" aria-label="تکثیر" onClick={() => duplicate(row)}>
                <ContentCopyOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="حذف">
              <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(row)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        );
      },
    },
  ];

  const hasFilter = Object.values(filters).some((value) => value !== '');

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<LockPersonOutlinedIcon />}
        title="دسترسی کدینگ حسابداری"
        description="تعیین اینکه هر حساب معین را کدام نوع واحدهای سازمانی می‌توانند استفاده کنند."
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => {
              setCreateInitial(undefined);
              setCreateOpen(true);
            }}
          >
            افزودن دسترسی جدید
          </Button>
        }
      />

      <ListToolbar summary={query.data ? `${toPersianDigits(query.data.totalCount)} ردیف` : ''}>
        <TextField
          select
          size="small"
          label="نوع واحد"
          value={filters.vahedTypeId}
          onChange={(event) => setFilter('vahedTypeId', event.target.value)}
          sx={{ width: 180 }}
        >
          <MenuItem value="">همه</MenuItem>
          {vahedTypes.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.typeName ?? '—'}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="وضعیت"
          value={filters.state}
          onChange={(event) => setFilter('state', event.target.value)}
          sx={{ width: 150 }}
        >
          <MenuItem value="">همه</MenuItem>
          <MenuItem value={String(CODING_PERMISSION_STATE.Allowed)}>مجاز</MenuItem>
          <MenuItem value={String(CODING_PERMISSION_STATE.SystemOnly)}>فقط سیستمی</MenuItem>
          <MenuItem value={String(CODING_PERMISSION_STATE.Blacklisted)}>غیرمجاز</MenuItem>
        </TextField>

        <JalaliDateField
          label="از تاریخ مجاز"
          value={filters.fromAuthorizedDate}
          onChange={(value) => setFilter('fromAuthorizedDate', value)}
          size="small"
          error={authorizedInverted}
          sx={{ width: 160 }}
        />
        <JalaliDateField
          label="تا تاریخ مجاز"
          value={filters.toAuthorizedDate}
          onChange={(value) => setFilter('toAuthorizedDate', value)}
          size="small"
          error={authorizedInverted}
          helperText={authorizedInverted ? 'بازهٔ مجاز وارونه است.' : undefined}
          sx={{ width: 160 }}
        />
        <JalaliDateField
          label="از تاریخ محدودیت"
          value={filters.fromLimitationDate}
          onChange={(value) => setFilter('fromLimitationDate', value)}
          size="small"
          error={limitationInverted}
          sx={{ width: 170 }}
        />
        <JalaliDateField
          label="تا تاریخ محدودیت"
          value={filters.toLimitationDate}
          onChange={(value) => setFilter('toLimitationDate', value)}
          size="small"
          error={limitationInverted}
          helperText={limitationInverted ? 'بازهٔ محدودیت وارونه است.' : undefined}
          sx={{ width: 170 }}
        />

        {hasFilter && (
          <Button
            size="small"
            color="inherit"
            startIcon={<FilterAltOffOutlinedIcon />}
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPageNumber(1);
            }}
          >
            پاک کردن فیلترها
          </Button>
        )}
      </ListToolbar>

      {query.isError && <ErrorBanner error={query.error} />}

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        isLoading={query.isLoading}
        emptyMessage="هیچ دسترسی‌ای ثبت نشده است."
      />

      {query.data && (
        <Pagination
          pageNumber={query.data.pageNumber}
          pageSize={query.data.pageSize}
          totalCount={query.data.totalCount}
          onPageChange={setPageNumber}
        />
      )}

      <CodingPermissionCreateDialog
        open={createOpen}
        initial={createInitial}
        onClose={() => setCreateOpen(false)}
      />

      <CodingPermissionReactivateDialog row={reactivating} onClose={() => setReactivating(null)} />

      <ConfirmDialog
        open={pendingBlacklist !== null}
        title="غیرفعال کردن کد معین"
        description={
          'با غیرفعال‌سازی، این کد معین برای این نوع واحد به لیست سیاه می‌رود و هر چهار تاریخ آن پاک می‌شود. ' +
          'برای بازگرداندن باید دوباره بازهٔ تاریخ تعیین کنید.'
        }
        confirmLabel="بله، غیرفعال شود"
        confirmColor="error"
        pending={blacklistMutation.isPending}
        onConfirm={() => pendingBlacklist && blacklistMutation.mutate(pendingBlacklist.id)}
        onCancel={() => setPendingBlacklist(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف دسترسی"
        description={
          pendingDelete
            ? `دسترسی «${pendingDelete.accCode ?? '—'}» برای «${pendingDelete.vahedTypeName ?? '—'}» حذف شود؟`
            : undefined
        }
        confirmLabel="حذف"
        pending={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
