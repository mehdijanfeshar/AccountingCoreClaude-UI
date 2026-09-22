import { useEffect, useState, type SyntheticEvent } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { JalaliDateField } from '../../components/JalaliDateField';
import { PageHeader } from '../../components/PageHeader';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import SortOutlinedIcon from '@mui/icons-material/SortOutlined';
import PublishedWithChangesOutlinedIcon from '@mui/icons-material/PublishedWithChangesOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { sysTypesApi } from '../../lib/api/sysTypesApi';
import { useSession } from '../../lib/session/SessionContext';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { StatTiles, type StatTile, type StatTileTone } from '../../components/StatTiles';
import {
  changeVoucherState,
  DOC_LIFE_ACCEPTED,
  DOC_LIFE_OPTIONS,
  getDocLifeLabel,
  getDocLifeTone,
  isKnownDocLife,
  isVoucherEditable,
  reverseVoucher,
  voucherHeadsApi,
} from './api';
import { SortVouchersDialog } from './SortVouchersDialog';
import type { VoucherHeadDto } from '../../types/voucherHead';

const PAGE_SIZE = 20;

/** `''` is the «همه» tab; the others are a `DocLife` value as a string. */
type StatusTab = '' | '1' | '2' | '3' | '4';

/** Tile tone per state — same progression as the chips, minus the chip's neutral. */
const DOC_LIFE_TILE_TONES: Record<number, StatTileTone> = {
  1: 'primary',
  2: 'warning',
  3: 'info',
  4: 'success',
};

interface Filters {
  year: string;
  docNumFrom: string;
  docNumTo: string;
  dateDocFrom: string;
  dateDocTo: string;
  systemTypeId: string;
}

const EMPTY_FILTERS: Omit<Filters, 'year'> = {
  docNumFrom: '',
  docNumTo: '',
  dateDocFrom: '',
  dateDocTo: '',
  systemTypeId: '',
};

/**
 * Compact Jalali filter field. Thin wrapper over the shared `JalaliDateField` — the parsing rule
 * (and the bug it fixes) lives there, in one place.
 */
function DateFilterField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <JalaliDateField
      label={label}
      value={value}
      onChange={onChange}
      size="small"
      fullWidth={false}
      sx={{ width: 168 }}
    />
  );
}

/**
 * کارتابل اسناد — `GET /api/voucher-heads`.
 *
 * Every filter here is applied **server-side** across all pages (year, DOC_NUM range, DATE_DOC
 * range, نوع سند), so the row count in the toolbar is the true match count, not "matches on this
 * page". The organizational unit is deliberately absent: it is not caller-controllable — the
 * backend scopes every query to the caller's own unit (CLAUDE.md IDOR risk #1).
 */
export function VoucherHeadsListPage() {
  const { financialYear, isConfigured } = useSession();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [filters, setFilters] = useState<Filters>({ year: financialYear, ...EMPTY_FILTERS });
  const [statusTab, setStatusTab] = useState<StatusTab>('');
  const [pendingDelete, setPendingDelete] = useState<VoucherHeadDto | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingReverse, setPendingReverse] = useState<VoucherHeadDto | null>(null);
  const [sortDialogOpen, setSortDialogOpen] = useState(false);
  const [stateMenu, setStateMenu] = useState<{ anchor: HTMLElement; row: VoucherHeadDto } | null>(null);

  // The top-bar fiscal year seeds this page; changing it there resets the page's year filter.
  useEffect(() => {
    setFilters((previous) => ({ ...previous, year: financialYear }));
    setPageNumber(1);
  }, [financialYear]);

  // A selection only means anything within the tab it was made in — carrying it across a tab
  // change would let someone move vouchers they can no longer see.
  function handleTabChange(_event: SyntheticEvent, value: StatusTab) {
    setStatusTab(value);
    setSelectedIds([]);
    setPageNumber(1);
  }

  function toggleSelected(id: string) {
    setSelectedIds((previous) =>
      previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id],
    );
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => voucherHeadsApi.remove(id),
    onSuccess: async () => {
      // The head's lines and their تفصیلی links go with it — the backend cascades the soft delete
      // three levels down (phase 9), so nothing is left orphaned and there is nothing to clean up
      // from here.
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
      await queryClient.invalidateQueries({ queryKey: ['voucher-details'] });
      notify('سند حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'حذف سند با خطا مواجه شد.',
        severity: 'error',
      });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => reverseVoucher(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
      notify('سند معکوس ایجاد شد. سند جدید در وضعیت «یادداشت» است.');
      setPendingReverse(null);
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'ایجاد سند معکوس با خطا مواجه شد.',
        severity: 'error',
      });
    },
  });

  /** Single-row state change, from the per-row menu. */
  const rowStateMutation = useMutation({
    mutationFn: ({ id, newState }: { id: string; newState: number }) => changeVoucherState([id], newState),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
      notify(`سند به وضعیت «${getDocLifeLabel(variables.newState)}» منتقل شد.`);
      setStateMenu(null);
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'انتقال وضعیت با خطا مواجه شد.',
        severity: 'error',
      });
      setStateMenu(null);
    },
  });

  const changeStateMutation = useMutation({
    mutationFn: (newState: number) => changeVoucherState(selectedIds, newState),
    onSuccess: async (_data, newState) => {
      const moved = selectedIds.length;
      setSelectedIds([]);
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
      notify(`${toPersianDigits(moved)} سند به وضعیت «${getDocLifeLabel(newState)}» منتقل شد.`);
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'انتقال وضعیت با خطا مواجه شد.',
        severity: 'error',
      });
    },
  });

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPageNumber(1);
  }

  const sysTypesQuery = useQuery({
    queryKey: ['sys-types'],
    queryFn: () => sysTypesApi.list(),
    enabled: isConfigured,
  });
  const sysTypes = sysTypesQuery.data ?? [];

  // One count per state, so the tabs and tiles show real numbers instead of decoration.
  // `pageSize: 1` because only `totalCount` is read — four tiny requests, cached by React Query
  // and refetched together with the list after a state change.
  const countQueries = useQueries({
    queries: DOC_LIFE_OPTIONS.map((option) => ({
      queryKey: ['voucher-heads', 'count', filters.year, option.value],
      queryFn: () =>
        voucherHeadsApi.list({
          pageNumber: 1,
          pageSize: 1,
          year: filters.year || undefined,
          docLife: option.value,
        }),
      enabled: isConfigured,
      select: (page: { totalCount: number }) => page.totalCount,
    })),
  });

  const countsLoading = countQueries.some((q) => q.isLoading);
  const countByState = new Map<number, number | undefined>(
    DOC_LIFE_OPTIONS.map((option, index) => [option.value, countQueries[index]?.data]),
  );

  const query = useQuery({
    queryKey: ['voucher-heads', pageNumber, PAGE_SIZE, filters, statusTab],
    queryFn: () =>
      voucherHeadsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        year: filters.year || undefined,
        docNumFrom: filters.docNumFrom || undefined,
        docNumTo: filters.docNumTo || undefined,
        dateDocFrom: filters.dateDocFrom || undefined,
        dateDocTo: filters.dateDocTo || undefined,
        systemTypeId: filters.systemTypeId || undefined,
        // Applied server-side across all pages, so a tab's count is its true count.
        docLife: statusTab ? Number(statusTab) : undefined,
      }),
    placeholderData: (previous) => previous,
    enabled: isConfigured,
  });

  const sysTypeNameById = new Map(sysTypes.map((t) => [t.id, t.sysName ?? t.sysCode]));

  const columns: DataTableColumn<VoucherHeadDto>[] = [
    { key: 'docNum', header: 'شماره سند', render: (row) => <MonoCode value={row.docNum} /> },
    { key: 'dateDoc', header: 'تاریخ سند', render: (row) => formatLegacyJalaliDate(row.dateDoc) },
    { key: 'headDesc', header: 'شرح سند', render: (row) => row.headDesc ?? '—' },
    {
      key: 'systemType',
      header: 'نوع سند',
      render: (row) =>
        row.systemTypeId ? (
          (sysTypeNameById.get(row.systemTypeId) ?? '—')
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    { key: 'year', header: 'سال مالی', render: (row) => (row.year ? toPersianDigits(row.year) : '—') },
    {
      key: 'docLife',
      header: 'وضعیت',
      render: (row) =>
        isKnownDocLife(row.docLife) ? (
          <Chip size="small" color={getDocLifeTone(row.docLife)} label={getDocLifeLabel(row.docLife)} />
        ) : (
          // A voucher whose DOCLIFE is NULL or outside the enum has no state to colour. Giving it
          // a solid chip like the real states would dress up an unknown as a status; an outlined
          // muted one says "nothing here" without hiding the row. The raw value stays reachable in
          // the tooltip for whoever is trying to work out where these rows came from.
          <Tooltip title={`مقدار خام DOCLIFE: ${row.docLife === null ? 'NULL' : row.docLife}`}>
            <Chip
              size="small"
              variant="outlined"
              label={getDocLifeLabel(row.docLife)}
              sx={{ color: 'text.disabled', borderStyle: 'dashed' }}
            />
          </Tooltip>
        ),
    },
    {
      key: 'rowActions',
      header: 'عملیات',
      render: (row) => {
        // Two independent reasons a row offers view only:
        //   1. its state — only یادداشت/موقت may be changed. This mirrors the server's
        //      VoucherEditability; it does not enforce it. The API answers 409 for a locked
        //      voucher no matter what this column renders.
        //   2. the «همه» tab, which mixes states. Acting destructively from a list that is not
        //      filtered to a single state is how the wrong voucher gets deleted.
        const stateAllowsEditing = isVoucherEditable(row.docLife);
        const showWriteActions = stateAllowsEditing && statusTab !== '';

        // تأیید دائم is terminal — «دائم» is the point of the state, and the server refuses to
        // move it (409). The way to undo such a voucher is معکوس, not a state change. The «همه»
        // tab is excluded for the same reason the write actions are: it mixes states.
        const canChangeState = row.docLife !== DOC_LIFE_ACCEPTED && statusTab !== '';

        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="نمایش سند">
              <IconButton
                size="small"
                aria-label="نمایش سند"
                component={RouterLink}
                to={`/operation/vouchers/${row.id}/view`}
              >
                <VisibilityOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Per-row state change. The bulk bar below still moves many at once, but it only
                appears inside a status tab AND after a selection, which made the operation hard
                to find at all. */}
            {canChangeState && (
              <Tooltip title="تغییر وضعیت سند">
                <IconButton
                  size="small"
                  aria-label="تغییر وضعیت سند"
                  onClick={(e) => setStateMenu({ anchor: e.currentTarget, row })}
                >
                  <PublishedWithChangesOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {/* Reversal is offered in EVERY state, unlike edit/delete: it does not modify this
                voucher, it creates a new draft beside it — which is exactly how a finalized
                voucher is undone. */}
            <Tooltip title="معکوس سند">
              <IconButton
                size="small"
                aria-label="معکوس سند"
                onClick={() => setPendingReverse(row)}
                disabled={reverseMutation.isPending}
              >
                <SwapVertOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {showWriteActions && (
              <>
                <Tooltip title="ویرایش سند">
                  <IconButton
                    size="small"
                    aria-label="ویرایش سند"
                    component={RouterLink}
                    to={`/operation/vouchers/${row.id}/edit`}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="حذف سند">
                  <IconButton
                    size="small"
                    aria-label="حذف سند"
                    color="error"
                    onClick={() => setPendingDelete(row)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        );
      },
    },
  ];

  // The checkbox column exists only inside a status tab. «همه» mixes states, and a bulk move from
  // there would drag vouchers out of states the user was not looking at.
  const tableColumns: DataTableColumn<VoucherHeadDto>[] = statusTab
    ? [
        {
          key: 'select',
          header: '',
          render: (row) => (
            <Checkbox
              size="small"
              checked={selectedIds.includes(row.id)}
              onChange={() => toggleSelected(row.id)}
              slotProps={{ input: { 'aria-label': `انتخاب سند ${row.docNum ?? ''}` } }}
            />
          ),
        },
        ...columns,
      ]
    : columns;

  /** The states a selection can move to — every state except the tab it is already in. */
  const moveTargets = DOC_LIFE_OPTIONS.filter((option) => String(option.value) !== statusTab);

  // Every row in the تأیید دائم tab is terminal, so there is nothing to move and the server would
  // refuse the whole batch (409). Hiding the bar is clearer than offering buttons that all fail.
  const bulkMoveAvailable = statusTab !== '' && statusTab !== String(DOC_LIFE_ACCEPTED);

  /**
   * One tile per state. Each is also the filter for that state, so the number and the way to see
   * the rows behind it are the same control — clicking a tile switches to its tab.
   *
   * ⚠️ These count the fiscal year only, not the other filters: a tile is meant to answer "how
   * much work is waiting this year", which a چند-فیلتره count would quietly stop answering. The
   * toolbar's own count is the one that reflects every active filter.
   */
  const statTiles: StatTile[] = DOC_LIFE_OPTIONS.map((option) => ({
    key: String(option.value),
    label: `اسناد ${option.label}`,
    value: countByState.get(option.value) ?? null,
    // getDocLifeTone returns MUI *chip* colours, where یادداشت is the neutral `default`.
    // A tile has no neutral, so that one maps to `primary`.
    tone: DOC_LIFE_TILE_TONES[option.value],
    icon: <DescriptionOutlinedIcon fontSize="small" />,
    hint: filters.year ? `سال ${toPersianDigits(filters.year)}` : undefined,
    active: statusTab === String(option.value),
    onClick: () => {
      setStatusTab(String(option.value) as StatusTab);
      setSelectedIds([]);
      setPageNumber(1);
    },
  }));

  const hasExtraFilter = Boolean(
    filters.docNumFrom || filters.docNumTo || filters.dateDocFrom || filters.dateDocTo || filters.systemTypeId,
  );

  function clearFilters() {
    setFilters((previous) => ({ ...previous, ...EMPTY_FILTERS }));
    setPageNumber(1);
  }

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<DescriptionOutlinedIcon />}
        accentColor="secondary"
        title="کارتابل اسناد"
        description="اسناد بر اساس وضعیت — همهٔ فیلترها و تب‌ها روی کل اسناد واحد شما اعمال می‌شوند، نه فقط صفحهٔ جاری."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<SortOutlinedIcon />}
              onClick={() => setSortDialogOpen(true)}
              disabled={!isConfigured}
            >
              مرتب‌سازی اسناد
            </Button>
            <Button variant="contained" color="secondary" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/operation/vouchers/new">
              صدور سند جدید
            </Button>
          </Stack>
        }
      />

      {!isConfigured && (
        <Box
          role="status"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            py: 6,
            color: 'text.secondary',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <EventOutlinedIcon sx={{ fontSize: 32, opacity: 0.5 }} />
          <Typography variant="body2">برای مشاهدهٔ اسناد، ابتدا سال مالی را از نوار بالا انتخاب کنید.</Typography>
        </Box>
      )}

      {query.isError && <ErrorBanner error={query.error} />}

      {isConfigured && <StatTiles tiles={statTiles} isLoading={countsLoading} />}

      {isConfigured && (
        <Paper variant="outlined" sx={{ mb: 3, px: 1, borderRadius: 2 }}>
          <Tabs value={statusTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab value="" label="همه" />
            {DOC_LIFE_OPTIONS.map((option) => {
              const count = countByState.get(option.value);

              return (
                <Tab
                  key={option.value}
                  value={String(option.value)}
                  label={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <span>{option.label}</span>
                      {/*
                        The count tells the user where the work is before they click — but it is
                        information, not status. It used to be a filled status-coloured chip, and
                        in a tab strip that is the visual language of an unread badge: a bold green
                        «۲» reads as "two things need you", when it only means "two vouchers are in
                        this state". The state is already named by the tab next to it.

                        Every count now looks the same and only its weight changes — present when
                        there is something, receded when there is not. It keeps its shape at zero
                        rather than vanishing, so the tabs do not shift as the counts load.
                      */}
                      {count !== undefined && (
                        <Box
                          component="span"
                          sx={{
                            minWidth: 22,
                            px: 0.75,
                            borderRadius: 1,
                            fontSize: '0.7rem',
                            lineHeight: '18px',
                            textAlign: 'center',
                            fontVariantNumeric: 'tabular-nums',
                            bgcolor: count > 0 ? 'action.selected' : 'action.hover',
                            color: count > 0 ? 'text.secondary' : 'text.disabled',
                          }}
                        >
                          {toPersianDigits(count)}
                        </Box>
                      )}
                    </Stack>
                  }
                />
              );
            })}
          </Tabs>
        </Paper>
      )}

      {isConfigured && !query.isError && (
        <>
          <ListToolbar summary={query.data ? `${toPersianDigits(query.data.totalCount)} سند` : ''}>
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
              label="از شماره سند"
              value={filters.docNumFrom}
              onChange={(event) => setFilter('docNumFrom', toLatinDigits(event.target.value))}
              sx={{ width: 140 }}
              slotProps={{
                htmlInput: { maxLength: 10, inputMode: 'numeric' },
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
              label="تا شماره سند"
              value={filters.docNumTo}
              onChange={(event) => setFilter('docNumTo', toLatinDigits(event.target.value))}
              sx={{ width: 140 }}
              slotProps={{
                htmlInput: { maxLength: 10, inputMode: 'numeric' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <DateFilterField
              label="از تاریخ سند"
              value={filters.dateDocFrom}
              onChange={(value) => setFilter('dateDocFrom', value)}
            />
            <DateFilterField
              label="تا تاریخ سند"
              value={filters.dateDocTo}
              onChange={(value) => setFilter('dateDocTo', value)}
            />
            <TextField
              select
              size="small"
              label="نوع سند"
              value={filters.systemTypeId}
              onChange={(event) => setFilter('systemTypeId', event.target.value)}
              sx={{ width: 180 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <CategoryOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            >
              <MenuItem value="">همه</MenuItem>
              {sysTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.sysName ?? type.sysCode}
                </MenuItem>
              ))}
            </TextField>
            {hasExtraFilter && (
              <Button size="small" variant="text" startIcon={<FilterAltOffOutlinedIcon />} onClick={clearFilters}>
                پاک کردن فیلترها
              </Button>
            )}
          </ListToolbar>

          {bulkMoveAvailable && selectedIds.length > 0 && (
            <Paper
              variant="outlined"
              sx={{ mb: 2, p: 1.5, borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Typography variant="body2">
                {toPersianDigits(selectedIds.length)} سند انتخاب شده — انتقال به:
              </Typography>
              {moveTargets.map((target) => (
                <Button
                  key={target.value}
                  size="small"
                  variant="outlined"
                  disabled={changeStateMutation.isPending}
                  onClick={() => changeStateMutation.mutate(target.value)}
                >
                  {target.label}
                </Button>
              ))}
              <Box sx={{ flexGrow: 1 }} />
              <Button size="small" variant="text" onClick={() => setSelectedIds([])}>
                لغو انتخاب
              </Button>
            </Paper>
          )}

          <DataTable
            columns={tableColumns}
            rows={query.data?.items ?? []}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage={
              hasExtraFilter ? 'سندی با این فیلترها یافت نشد.' : 'برای این سال مالی هنوز سندی ثبت نشده است.'
            }
            emptyAction={
              hasExtraFilter ? (
                <Button size="small" variant="text" startIcon={<FilterAltOffOutlinedIcon />} onClick={clearFilters}>
                  پاک کردن فیلترها
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  startIcon={<AddOutlinedIcon />}
                  component={RouterLink}
                  to="/operation/vouchers/new"
                >
                  صدور اولین سند
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
        title="حذف سند"
        description={
          pendingDelete
            ? `سند شماره «${pendingDelete.docNum ?? '—'}» به همراه همهٔ ردیف‌ها و تفصیلی‌هایش حذف می‌شود. ادامه می‌دهید؟`
            : undefined
        }
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />

      <ConfirmDialog
        open={pendingReverse !== null}
        title="معکوس سند"
        confirmColor="primary"
        confirmLabel="ایجاد سند معکوس"
        description={
          pendingReverse
            ? `یک سند جدید در وضعیت «یادداشت» ساخته می‌شود که بدهکار و بستانکار سند شماره «${pendingReverse.docNum ?? '—'}» در آن جابه‌جا شده است. خودِ این سند تغییر نمی‌کند. ردیف‌های متصل به رسید یا چک منتقل نمی‌شوند.`
            : undefined
        }
        pending={reverseMutation.isPending}
        onCancel={() => setPendingReverse(null)}
        onConfirm={() => pendingReverse && reverseMutation.mutate(pendingReverse.id)}
      />

      <SortVouchersDialog
        open={sortDialogOpen}
        year={filters.year}
        onClose={() => setSortDialogOpen(false)}
      />

      <Menu
        anchorEl={stateMenu?.anchor ?? null}
        open={stateMenu !== null}
        onClose={() => setStateMenu(null)}
      >
        {DOC_LIFE_OPTIONS.map((option) => (
          <MenuItem
            key={option.value}
            // The voucher's current state is not a move.
            disabled={stateMenu?.row.docLife === option.value || rowStateMutation.isPending}
            onClick={() =>
              stateMenu && rowStateMutation.mutate({ id: stateMenu.row.id, newState: option.value })
            }
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </section>
  );
}
