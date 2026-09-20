import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { ListToolbar } from '../../components/ListToolbar';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { attribForAccountCodesApi } from './api';
import type { AttribForAccountCodeDto } from '../../types/attribForAccountCode';
import {
  ATTRIB_FLAG_OPTIONS,
  ATTRIB_SUM_OPTIONS,
  getAttribFlagLabel,
  getAttribSumLabel,
} from '../../types/legacyEnums';

const PAGE_SIZE = 20;

/** A معین code is always exactly 6 digits — the backend validator rejects anything longer. */
const MOIN_CODE_LENGTH = 6;

interface Filters {
  year: string;
  moinCodeFrom: string;
  moinCodeTo: string;
  attribSum: string;
  flag: string;
}

const EMPTY_FILTERS: Omit<Filters, 'year'> = {
  moinCodeFrom: '',
  moinCodeTo: '',
  attribSum: '',
  flag: '',
};

/**
 * حساب‌های شناسه‌دار — `GET /api/attrib-for-account-codes`.
 *
 * This is the page the reference Angular app calls `base-identity-account`. It is backed by
 * `TB_ATTRIBFORACCOUNTCODE`: each row attaches an identification digit-group (شناسه) to one
 * حساب معین, so the معین is what this list is *about* — not an incidental detail.
 *
 * Every filter is applied **server-side** across all pages, so the toolbar's row count is the
 * true match count rather than "matches on the current page".
 *
 * ⚠️ The organizational unit is deliberately absent and must not be added: the backend scopes
 * every query to the caller's own unit from the token (CLAUDE.md IDOR risk #1). The reference
 * app did send it as a client-supplied search param.
 */
export function AttribForAccountCodesListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [pageNumber, setPageNumber] = useState(1);
  const [filters, setFilters] = useState<Filters>({ year: financialYear, ...EMPTY_FILTERS });
  const [pendingDelete, setPendingDelete] = useState<AttribForAccountCodeDto | null>(null);

  // The top-bar fiscal year seeds this page; changing it there resets the page's year filter.
  useEffect(() => {
    setFilters((previous) => ({ ...previous, year: financialYear }));
    setPageNumber(1);
  }, [financialYear]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPageNumber(1);
  }

  // An inverted range is a 400 from the backend, not an empty table. Catching it here keeps the
  // user out of an error banner for what is almost always a swapped pair of fields. Plain string
  // comparison is right: every معین code is the same 6-digit width.
  const rangeInverted =
    filters.moinCodeFrom.length > 0 &&
    filters.moinCodeTo.length > 0 &&
    filters.moinCodeFrom > filters.moinCodeTo;

  const query = useQuery({
    queryKey: ['attrib-for-account-codes', pageNumber, PAGE_SIZE, filters],
    queryFn: () =>
      attribForAccountCodesApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        year: filters.year || undefined,
        moinCodeFrom: filters.moinCodeFrom || undefined,
        moinCodeTo: filters.moinCodeTo || undefined,
        attribSum: filters.attribSum ? Number(filters.attribSum) : undefined,
        flag: filters.flag ? Number(filters.flag) : undefined,
      }),
    placeholderData: (previous) => previous,
    enabled: !rangeInverted,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => attribForAccountCodesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attrib-for-account-codes'] });
      notify('حساب شناسه‌دار حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const rows = query.data?.items ?? [];

  const columns: DataTableColumn<AttribForAccountCodeDto>[] = [
    { key: 'moinCode', header: 'کد معین', render: (row) => <MonoCode value={row.moinCode} /> },
    {
      key: 'moinName',
      header: 'عنوان معین',
      render: (row) =>
        row.moinName ?? (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    { key: 'attribBoxNo', header: 'شماره جعبه', render: (row) => toPersianDigits(row.attribBoxNo) },
    { key: 'lenAtr', header: 'طول شناسه', render: (row) => toPersianDigits(row.lenAtr) },
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
              to={`/base/attrib-for-account-codes/${row.id}/edit`}
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

  const hasExtraFilter = Boolean(filters.moinCodeFrom || filters.moinCodeTo || filters.attribSum || filters.flag);

  function clearFilters() {
    setFilters((previous) => ({ ...previous, ...EMPTY_FILTERS }));
    setPageNumber(1);
  }

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<BadgeOutlinedIcon />}
        title="حساب‌های شناسه‌دار"
        description="فهرست حساب‌های معین دارای شناسه — همهٔ فیلترها روی کل رکوردهای واحد شما اعمال می‌شوند، نه فقط صفحهٔ جاری."
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            component={RouterLink}
            to="/base/attrib-for-account-codes/new"
          >
            افزودن حساب شناسه‌دار
          </Button>
        }
      />

      <ListToolbar summary={query.data ? `${toPersianDigits(query.data.totalCount)} ردیف` : ''}>
        <TextField
          size="small"
          label="سال مالی"
          value={filters.year}
          onChange={(event) => setFilter('year', toLatinDigits(event.target.value))}
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
        <TextField
          size="small"
          label="از معین"
          value={filters.moinCodeFrom}
          onChange={(event) => setFilter('moinCodeFrom', toLatinDigits(event.target.value))}
          error={rangeInverted}
          sx={{ width: 140 }}
          slotProps={{
            htmlInput: { maxLength: MOIN_CODE_LENGTH, inputMode: 'numeric' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <TagOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          size="small"
          label="تا معین"
          value={filters.moinCodeTo}
          onChange={(event) => setFilter('moinCodeTo', toLatinDigits(event.target.value))}
          error={rangeInverted}
          helperText={rangeInverted ? "'تا معین' نباید کوچک‌تر از 'از معین' باشد." : undefined}
          sx={{ width: 140 }}
          slotProps={{
            htmlInput: { maxLength: MOIN_CODE_LENGTH, inputMode: 'numeric' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <TagOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label="نوع مقدار"
          value={filters.flag}
          onChange={(event) => setFilter('flag', event.target.value)}
          sx={{ width: 150 }}
        >
          <MenuItem value="">همه</MenuItem>
          {ATTRIB_FLAG_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={String(option.value)}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="جمع‌پذیری"
          value={filters.attribSum}
          onChange={(event) => setFilter('attribSum', event.target.value)}
          sx={{ width: 150 }}
        >
          <MenuItem value="">همه</MenuItem>
          {ATTRIB_SUM_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={String(option.value)}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        {hasExtraFilter && (
          <Button size="small" variant="text" startIcon={<FilterAltOffOutlinedIcon />} onClick={clearFilters}>
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
              rangeInverted
                ? 'بازهٔ معین معتبر نیست.'
                : hasExtraFilter
                  ? 'نتیجه‌ای برای این فیلترها یافت نشد.'
                  : 'هنوز حساب شناسه‌داری ثبت نشده است.'
            }
            emptyAction={
              hasExtraFilter || rangeInverted ? (
                <Button size="small" variant="text" startIcon={<FilterAltOffOutlinedIcon />} onClick={clearFilters}>
                  پاک کردن فیلترها
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddOutlinedIcon />}
                  component={RouterLink}
                  to="/base/attrib-for-account-codes/new"
                >
                  افزودن حساب شناسه‌دار
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
        title="حذف حساب شناسه‌دار"
        description="آیا از حذف این حساب شناسه‌دار مطمئن هستید؟"
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
