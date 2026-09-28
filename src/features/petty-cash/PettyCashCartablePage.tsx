import { useMemo, useState, type SyntheticEvent } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { pettyCashExpenseDocsApi, pettyCashFundsApi, type BulkApproveFailure } from './api';
import {
  PETTY_CASH_DOC_STATE,
  getPettyCashStateColor,
  getPettyCashStateLabel,
  isExpenseDocDeletable,
  isExpenseDocEditable,
} from './pettyCashDocState';
import { getBulkApproveFailureReasonLabel } from './pettyCashReturnReason';
import { PettyCashReviewDialogs, type PettyCashApprovalAction } from './PettyCashReviewDialogs';
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
 * کارتابل تنخواه — ص ۵ + بخش ۲ (بررسی/تأیید/برگشت/رد و تأیید گروهی). ساخت/ویرایش/حذف پیش‌نویس هم
 * همین‌جا مسیرش باز می‌شود؛ فقط خودِ فرم (`ExpenseDocFormPage`) جداست.
 */
export function PettyCashCartablePage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [statusTab, setStatusTab] = useState<StatusTab>('in-progress');
  const [search, setSearch] = useState('');
  const [fundFilter, setFundFilter] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PettyCashExpenseDocDto | null>(null);

  // بخش ۲ — انتخاب چندتایی برای «تأیید گروهی» (فقط ردیف‌های «در انتظار بررسی»).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproveFailures, setBulkApproveFailures] = useState<BulkApproveFailure[] | null>(null);

  // تأیید/رد تک‌سندی و برگشت — دیالوگ‌های مشترک `PettyCashReviewDialogs`؛ این صفحه فقط تعیین
  // می‌کند کدام سند هدف است.
  const [actionTarget, setActionTarget] = useState<{ doc: PettyCashExpenseDocDto; action: PettyCashApprovalAction } | null>(
    null,
  );
  const [returnTarget, setReturnTarget] = useState<PettyCashExpenseDocDto | null>(null);

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function handleTabChange(_event: SyntheticEvent, value: StatusTab) {
    setStatusTab(value);
    setPageNumber(1);
    clearSelection();
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
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

  const startReviewMutation = useMutation({
    mutationFn: (id: string) => pettyCashExpenseDocsApi.startReview(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-expense-docs'] });
      notify('بررسی سند آغاز شد.');
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'شروع بررسی با خطا مواجه شد.', severity: 'error' });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => pettyCashExpenseDocsApi.bulkApprove(ids),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-expense-docs'] });
      notify(`${toPersianDigits(result.ids.length)} سند تأیید شد.`);
      clearSelection();
      setBulkApproveFailures(null);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        const failures = (error.problem?.failedIds as BulkApproveFailure[] | undefined) ?? [];
        setBulkApproveFailures(failures);
        return;
      }
      notify({ message: error instanceof Error ? error.message : 'تأیید گروهی با خطا مواجه شد.', severity: 'error' });
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
    {
      key: 'select',
      header: '',
      width: 40,
      render: (row) => {
        if (row.state !== PETTY_CASH_DOC_STATE.pendingReview) return null;
        // تأیید گروهی = تأیید نهایی؛ فقط روی اسناد کنترل‌شده توسط بازرس فعال است (تکمیل بخش ۲،
        // ۲۰۲۶-۰۹-۲۸) — بقیه چک‌باکسشان غیرفعال است تا کاربر بی‌جهت با ۴۰۹ `not-verified` مواجه نشود.
        const checkbox = (
          <Checkbox
            size="small"
            aria-label="انتخاب برای تأیید گروهی"
            checked={selectedIds.has(row.id)}
            disabled={!row.verifiedByUserId}
            onChange={(event) => toggleSelected(row.id, event.target.checked)}
          />
        );
        return row.verifiedByUserId ? (
          checkbox
        ) : (
          <Tooltip title="هنوز کنترل بازرس انجام نشده است">
            <span>{checkbox}</span>
          </Tooltip>
        );
      },
    },
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
      render: (row) => (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Chip size="small" color={getPettyCashStateColor(row.state)} label={getPettyCashStateLabel(row.state)} />
          {row.state === PETTY_CASH_DOC_STATE.pendingReview && row.verifiedByUserId && (
            <Tooltip title={`کنترل‌شده توسط ${row.verifiedByUserId}`}>
              <FactCheckOutlinedIcon fontSize="small" color="primary" />
            </Tooltip>
          )}
        </Stack>
      ),
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
        const isNew = row.state === PETTY_CASH_DOC_STATE.new;
        const isPendingReview = row.state === PETTY_CASH_DOC_STATE.pendingReview;
        // صفحهٔ بررسی (ص ۷) — «سند قبلی/بعدی» را از همین لیست فعلی جدول می‌سازد؛ صفحهٔ سند با
        // `location.state.reviewQueue` تشخیص می‌دهد از کارتابل باز شده و ناوبری قبلی/بعدی را نشان می‌دهد.
        const reviewQueueState = { reviewQueue: rows.map((r) => r.id) };
        return (
          <Stack direction="row" spacing={0.5}>
            {editable ? (
              <Tooltip title="ویرایش">
                <IconButton
                  size="small"
                  aria-label="ویرایش"
                  component={RouterLink}
                  to={`/treasury/petty-cash/expense-docs/${row.id}/edit`}
                  state={reviewQueueState}
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
                  state={reviewQueueState}
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
            {isNew && (
              <Tooltip title="شروع بررسی">
                <IconButton
                  size="small"
                  color="primary"
                  aria-label="شروع بررسی"
                  onClick={() => startReviewMutation.mutate(row.id)}
                  disabled={startReviewMutation.isPending}
                >
                  <FactCheckOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isPendingReview && (
              <>
                {row.verifiedByUserId ? (
                  <Tooltip title="تأیید نهایی">
                    <IconButton
                      size="small"
                      color="success"
                      aria-label="تأیید نهایی"
                      onClick={() => setActionTarget({ doc: row, action: 'approve' })}
                    >
                      <CheckCircleOutlineOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title="تأیید کنترل">
                    <IconButton
                      size="small"
                      color="primary"
                      aria-label="تأیید کنترل"
                      onClick={() => setActionTarget({ doc: row, action: 'verify' })}
                    >
                      <FactCheckOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="برگشت">
                  <IconButton size="small" color="warning" aria-label="برگشت" onClick={() => setReturnTarget(row)}>
                    <KeyboardReturnOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="رد">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="رد"
                    onClick={() => setActionTarget({ doc: row, action: 'reject' })}
                  >
                    <CancelOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
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
        description="صورت‌هزینه‌ها بر اساس وضعیت — شروع بررسی، تأیید، برگشت، رد و تأیید گروهی از همین کارتابل."
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
              clearSelection();
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
                clearSelection();
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

          {selectedIds.size > 0 && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <Chip
                size="small"
                color="primary"
                label={`${toPersianDigits(selectedIds.size)} سند در انتظار بررسی انتخاب شده`}
              />
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<DoneAllOutlinedIcon />}
                onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
                disabled={bulkApproveMutation.isPending}
              >
                {bulkApproveMutation.isPending ? 'در حال تأیید…' : 'تأیید گروهی'}
              </Button>
              <Button size="small" variant="text" color="inherit" onClick={clearSelection}>
                لغو انتخاب
              </Button>
            </Stack>
          )}

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
            onPageChange={(page) => {
              setPageNumber(page);
              clearSelection();
            }}
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

      {/* بخش ۲ — تأیید/رد/برگشت، دیالوگ‌های مشترک با نوار اقدام خود سند (`ExpenseDocFormPage`). */}
      <PettyCashReviewDialogs
        approveRejectTarget={actionTarget}
        onCloseApproveReject={() => setActionTarget(null)}
        returnTarget={returnTarget}
        onCloseReturn={() => setReturnTarget(null)}
      />

      {/*
       * بخش ۲ — شکست تأیید گروهی (۴۰۹). تمام‌یا‌هیچ: هیچ سندی تأیید نشده، پس این فقط اطلاع‌رسانی
       * دلیل رد هر سند است؛ دکمهٔ «تلاش مجدد» اسناد ناموفق را از انتخاب حذف و بقیه را دوباره
       * می‌فرستد.
       */}
      <Dialog open={bulkApproveFailures !== null} onClose={() => setBulkApproveFailures(null)} maxWidth="sm" fullWidth>
        <DialogTitle>تأیید گروهی ناموفق بود</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            هیچ‌کدام از اسناد انتخاب‌شده تأیید نشدند. دلیل هر سند:
          </Typography>
          <Stack spacing={1}>
            {bulkApproveFailures?.map((failure) => (
              <Stack key={failure.id} direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2">
                  {rows.find((r) => r.id === failure.id)?.docNumber ?? failure.id}
                </Typography>
                <Typography variant="body2" color="error.main">
                  {getBulkApproveFailureReasonLabel(failure.reason)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkApproveFailures(null)} color="inherit">
            بستن
          </Button>
          <Button
            variant="contained"
            disabled={bulkApproveMutation.isPending}
            onClick={() => {
              const failedIdSet = new Set((bulkApproveFailures ?? []).map((f) => f.id));
              const remaining = Array.from(selectedIds).filter((id) => !failedIdSet.has(id));
              setSelectedIds(new Set(remaining));
              setBulkApproveFailures(null);
              if (remaining.length > 0) bulkApproveMutation.mutate(remaining);
            }}
          >
            حذف اسناد ناموفق و تلاش مجدد
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
