import { useMemo, useState, type SyntheticEvent } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { pettyCashExpenseDocsApi, pettyCashFundsApi } from './api';
import {
  getPettyCashStateColor,
  getPettyCashStateLabel,
  isExpenseDocDeletable,
  isExpenseDocEditable,
} from './pettyCashDocState';
import type { PettyCashExpenseDocDto, PettyCashStateCount } from '../../types/pettyCash';

const PAGE_SIZE = 20;

/**
 * تب‌های کارتابل، دقیقاً به ترتیب سند مرجع §۶: در جریان، جدید، در انتظار بررسی، برگشتی،
 * تأییدشده، ردشده، پیش‌نویس، همه.
 *
 * `'in-progress'` سه وضعیت را با هم می‌خواهد (۲+۳+۴)، در حالی که سرور طبق §۵ فقط یک `state` دقیق
 * را فیلتر می‌کند، نه OR چند وضعیت. به‌جای پیچیده‌کردن API یا صفحه‌بندی سراسری روی سه کوئری جدا،
 * سادهٔ کار این شد: سه کوئری با `pageSize` سقف (۲۰۰، همان سقف واقعی بک‌اند) موازی گرفته و merge
 * می‌شوند، و صفحه‌بندی این تب فقط روی همان نتیجهٔ merge‌شده سمت کلاینت انجام می‌شود — نه یک
 * صفحه‌بندی واقعی سرور مثل بقیهٔ تب‌ها. برای حجم واقعی این تنخواه‌ها (چند صد سند در جریان در هر
 * واحد) این کفایت می‌کند؛ اگر یک‌ روز این عدد خیلی بزرگ شد، راه‌حل درست یک پارامتر `states=2,3,4`
 * روی سرور است، نه اینجا.
 */
type StatusTab = 'in-progress' | '2' | '3' | '4' | '5' | '6' | '1' | '';

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'in-progress', label: 'در جریان' },
  { value: '2', label: 'جدید' },
  { value: '3', label: 'در انتظار بررسی' },
  { value: '4', label: 'برگشتی' },
  { value: '5', label: 'تأییدشده' },
  { value: '6', label: 'ردشده' },
  { value: '1', label: 'پیش‌نویس' },
  { value: '', label: 'همه' },
];

const IN_PROGRESS_STATES = [2, 3, 4];
const MAX_PAGE_SIZE = 200;

function sumCounts(counts: PettyCashStateCount[] | undefined, states: number[]): number | undefined {
  if (!counts) return undefined;
  return counts.filter((c) => states.includes(c.state)).reduce((total, c) => total + c.count, 0);
}

/**
 * کارتابل تنخواه — ص ۵. بررسی/تأیید/رد و تأیید گروهی خارج از این بخش‌اند (بخش ۲ سند مرجع) —
 * این کارتابل فقط می‌بیند و مسیر ویرایش/حذف/ساخت را باز می‌کند.
 */
export function PettyCashCartablePage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [statusTab, setStatusTab] = useState<StatusTab>('in-progress');
  const [search, setSearch] = useState('');
  const [fundFilter, setFundFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PettyCashExpenseDocDto | null>(null);

  function handleTabChange(_event: SyntheticEvent, value: StatusTab) {
    setStatusTab(value);
    setPageNumber(1);
  }

  const fundsQuery = useQuery({ queryKey: ['petty-cash-funds'], queryFn: () => pettyCashFundsApi.list() });
  const funds = fundsQuery.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pettyCashExpenseDocsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-expense-docs'] });
      notify('صورت‌هزینه حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  // Single-state tabs (and «همه») — real server-side pagination + the stateCounts breakdown that
  // drives every tab's badge, regardless of which tab issued the request (spec §۵: the response
  // always carries the full breakdown).
  const singleStateQuery = useQuery({
    queryKey: ['petty-cash-expense-docs', 'single', pageNumber, PAGE_SIZE, statusTab, search, fundFilter],
    queryFn: () =>
      pettyCashExpenseDocsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        state: statusTab && statusTab !== 'in-progress' ? Number(statusTab) : undefined,
        search: search || undefined,
        fundId: fundFilter || undefined,
      }),
    enabled: statusTab !== 'in-progress',
    placeholderData: (previous) => previous,
  });

  // «در جریان» — three parallel single-state calls merged client-side; see the type's docblock.
  const inProgressQueries = useQueries({
    queries: IN_PROGRESS_STATES.map((state) => ({
      queryKey: ['petty-cash-expense-docs', 'in-progress', state, search, fundFilter],
      queryFn: () =>
        pettyCashExpenseDocsApi.list({
          pageNumber: 1,
          pageSize: MAX_PAGE_SIZE,
          state,
          search: search || undefined,
          fundId: fundFilter || undefined,
        }),
      enabled: statusTab === 'in-progress',
    })),
  });

  const inProgressLoading = statusTab === 'in-progress' && inProgressQueries.some((q) => q.isLoading);
  const inProgressError = statusTab === 'in-progress' ? inProgressQueries.find((q) => q.isError)?.error : undefined;
  const inProgressRows = useMemo(() => {
    if (statusTab !== 'in-progress') return [];
    const merged = inProgressQueries.flatMap((q) => q.data?.page.items ?? []);
    // Newest first, mirroring the newest-first convention used across the app's cartables.
    return [...merged].sort((a, b) => (b.registerDate ?? '').localeCompare(a.registerDate ?? ''));
  }, [inProgressQueries, statusTab]);
  const inProgressTotal = inProgressRows.length;
  const inProgressPageRows = inProgressRows.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);

  // stateCounts for the tab badges: any response carries the full breakdown (spec §۵), so grab it
  // from whichever query actually ran.
  const stateCounts =
    statusTab === 'in-progress' ? inProgressQueries[0]?.data?.stateCounts : singleStateQuery.data?.stateCounts;

  const rows = statusTab === 'in-progress' ? inProgressPageRows : singleStateQuery.data?.page.items ?? [];
  const totalCount = statusTab === 'in-progress' ? inProgressTotal : singleStateQuery.data?.page.totalCount ?? 0;
  const isLoading = statusTab === 'in-progress' ? inProgressLoading : singleStateQuery.isLoading;
  const isError = statusTab === 'in-progress' ? Boolean(inProgressError) : singleStateQuery.isError;
  const error = statusTab === 'in-progress' ? inProgressError : singleStateQuery.error;

  const columns: DataTableColumn<PettyCashExpenseDocDto>[] = [
    { key: 'docNumber', header: 'سند', render: (row) => <MonoCode value={row.docNumber} /> },
    { key: 'registerDate', header: 'تاریخ', render: (row) => formatLegacyJalaliDate(row.registerDate) },
    { key: 'fundName', header: 'تنخواه', render: (row) => row.fundName ?? '—' },
    { key: 'description', header: 'شرح', render: (row) => row.description ?? '—' },
    { key: 'vendorName', header: 'فروشنده', render: (row) => row.vendorName ?? '—' },
    {
      key: 'totalAmount',
      header: 'مبلغ (ریال)',
      align: 'end',
      render: (row) => (row.totalAmount != null ? formatThousands(row.totalAmount) : '—'),
    },
    {
      key: 'state',
      header: 'وضعیت',
      render: (row) => <Chip size="small" color={getPettyCashStateColor(row.state)} label={getPettyCashStateLabel(row.state)} />,
    },
    {
      key: 'age',
      header: 'عمر',
      render: (row) =>
        row.ageDays == null ? (
          '—'
        ) : (
          <Box component="span" sx={{ color: row.ageDays > 5 ? 'error.main' : 'text.primary', fontWeight: row.ageDays > 5 ? 700 : 400 }}>
            {toPersianDigits(row.ageDays)} روز
          </Box>
        ),
    },
    {
      key: 'rowActions',
      header: 'اقدام',
      render: (row) => {
        const editable = isExpenseDocEditable(row.state);
        const deletable = isExpenseDocDeletable(row.state);
        return (
          <Stack direction="row" spacing={0.5}>
            {editable ? (
              <Tooltip title="ویرایش">
                <IconButton
                  size="small"
                  aria-label="ویرایش"
                  component={RouterLink}
                  to={`/treasury/petty-cash/expense-docs/${row.id}/edit`}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="نمایش">
                <IconButton
                  size="small"
                  aria-label="نمایش"
                  component={RouterLink}
                  to={`/treasury/petty-cash/expense-docs/${row.id}/edit`}
                >
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {deletable && (
              <Tooltip title="حذف">
                <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(row)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<ReceiptLongOutlinedIcon />}
        accentColor="secondary"
        title="کارتابل تنخواه"
        description="صورت‌هزینه‌ها بر اساس وضعیت — بررسی، تأیید و رد در بخش بعدی این ماژول اضافه می‌شود."
        actions={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddOutlinedIcon />}
            component={RouterLink}
            to="/treasury/petty-cash/expense-docs/new"
          >
            ثبت صورت‌هزینه جدید
          </Button>
        }
      />

      <Paper variant="outlined" sx={{ mb: 3, px: 1, borderRadius: 2 }}>
        <Tabs value={statusTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === ''
                ? stateCounts?.reduce((total, c) => total + c.count, 0)
                : tab.value === 'in-progress'
                  ? sumCounts(stateCounts, IN_PROGRESS_STATES)
                  : stateCounts?.find((c) => c.state === Number(tab.value))?.count;

            return (
              <Tab
                key={tab.value || 'all'}
                value={tab.value}
                label={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <span>{tab.label}</span>
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

      {isError && <ErrorBanner error={error} />}

      {!isError && (
        <>
          <ListToolbar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPageNumber(1);
            }}
            searchLabel="جستجو (فروشنده، شرح، شماره فاکتور)"
            summary={`${toPersianDigits(totalCount)} سند`}
          >
            <TextField
              select
              size="small"
              label="تنخواه"
              value={fundFilter}
              onChange={(event) => {
                setFundFilter(event.target.value);
                setPageNumber(1);
              }}
              sx={{ width: 200 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SavingsOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            >
              <MenuItem value="">همهٔ تنخواه‌ها</MenuItem>
              {funds.map((fund) => (
                <MenuItem key={fund.id} value={fund.id}>
                  {fund.name ?? fund.code}
                </MenuItem>
              ))}
            </TextField>
          </ListToolbar>

          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={isLoading}
            emptyMessage={search || fundFilter ? 'سندی با این فیلترها یافت نشد.' : 'در این تب هنوز سندی نیست.'}
            emptyAction={
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/treasury/petty-cash/expense-docs/new"
              >
                ثبت اولین صورت‌هزینه
              </Button>
            }
          />

          <Pagination
            pageNumber={pageNumber}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            onPageChange={setPageNumber}
          />
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف صورت‌هزینه"
        description={
          pendingDelete
            ? `سند «${pendingDelete.docNumber ?? '—'}» حذف می‌شود. ادامه می‌دهید؟`
            : undefined
        }
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
