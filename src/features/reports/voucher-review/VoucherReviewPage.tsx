import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JalaliDateField } from '../../../components/JalaliDateField';
import { MonoCode } from '../../../components/MonoCode';
import { Pagination } from '../../../components/Pagination';
import { StatTiles, type StatTile } from '../../../components/StatTiles';
import { BalanceBar } from '../_shared/BalanceBar';
import { useSession } from '../../../lib/session/SessionContext';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { sysTypesApi } from '../../../lib/api/sysTypesApi';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { DOC_LIFE_OPTIONS, getDocLifeLabel, getDocLifeTone } from '../../vouchers/api';
import { isVoucherBalanced } from '../../../types/voucherReview';
import { voucherReviewApi } from './api';
import { exportVoucherReviewToExcel, exportVoucherReviewToPdf } from './export';
import { VOUCHER_REVIEW_PRINT_STYLES } from './printStyles';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

/** Formats an amount with thousands separators in Persian digits. */
function amount(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US'));
}

/** Jalali YYYYMMDD → ۱۴۰۴/۰۲/۱۵. */
function jalali(value: string): string {
  if (value.length !== 8) return toPersianDigits(value || '—');
  return toPersianDigits(`${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`);
}

/**
 * مرور اسناد — `GET /api/reports/voucher-review`.
 *
 * <b>What makes this different from the کارتابل.</b> The cartable lists vouchers so you can work
 * on them; this lists them with both sides summed, so you can see whether they are sound. Nothing
 * server-side rejects an unbalanced voucher (the balance invariant was deliberately dropped with
 * the Rich model), which makes the «نامتوازن» tile the only control that exists for it — so it is
 * a tile, not a column buried on the right, and clicking it is not a filter but a signal to look.
 *
 * <b>Paged, and honest about it.</b> The three tiles read the server's whole-set figures, never a
 * sum of the visible page; the export and the printout say how many of the matching vouchers they
 * actually contain.
 */
export function VoucherReviewPage() {
  const { financialYear, unitLabel, isConfigured } = useSession();
  const notify = useNotify();
  const navigate = useNavigate();

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // Draft vs applied: typing in a filter must not fire a query per keystroke. The query key reads
  // only from `applied`.
  const emptyDraft = {
    fromVoucherNo: '',
    toVoucherNo: '',
    fromDate: '',
    toDate: '',
    fromAtfNo: '',
    toAtfNo: '',
    docLife: '' as string,
    systemTypeId: '' as string,
    description: '',
  };
  const [draft, setDraft] = useState(emptyDraft);
  const [applied, setApplied] = useState(emptyDraft);

  const sysTypes = useQuery({ queryKey: ['sys-types'], queryFn: sysTypesApi.list });

  const report = useQuery({
    queryKey: ['voucher-review', financialYear, pageNumber, pageSize, applied],
    queryFn: () =>
      voucherReviewApi.get({
        year: financialYear,
        pageNumber,
        pageSize,
        fromVoucherNo: applied.fromVoucherNo || undefined,
        toVoucherNo: applied.toVoucherNo || undefined,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        fromAtfNo: applied.fromAtfNo || undefined,
        toAtfNo: applied.toAtfNo || undefined,
        docLife: applied.docLife === '' ? undefined : Number(applied.docLife),
        systemTypeId: applied.systemTypeId || undefined,
        description: applied.description || undefined,
      }),
    enabled: isConfigured,
  });

  const rows = useMemo(() => report.data?.items ?? [], [report.data]);
  const totalDebtor = report.data?.totalDebtor ?? 0;
  const totalCreditor = report.data?.totalCreditor ?? 0;
  const unbalanced = report.data?.unbalancedCount ?? 0;
  const totalCount = report.data?.totalCount ?? 0;

  const tiles: StatTile[] = [
    { key: 'count', label: 'تعداد سند', value: totalCount, tone: 'primary' },
    { key: 'debtor', label: 'جمع بدهکار', value: amount(totalDebtor), tone: 'info' },
    { key: 'creditor', label: 'جمع بستانکار', value: amount(totalCreditor), tone: 'warning' },
    {
      key: 'unbalanced',
      label: 'سند نامتوازن',
      value: unbalanced,
      tone: unbalanced === 0 ? 'success' : 'error',
      hint:
        unbalanced === 0
          ? 'بدهکار و بستانکار همهٔ اسناد برابر است'
          : 'در این اسناد بدهکار و بستانکار برابر نیست',
    },
  ];

  const context = {
    year: financialYear,
    fromDate: applied.fromDate,
    toDate: applied.toDate,
    unitLabel,
    totalDebtor,
    totalCreditor,
    unbalancedCount: unbalanced,
    totalCount,
    exportedCount: rows.length,
  };

  async function handleExcel() {
    try {
      await exportVoucherReviewToExcel(rows, context);
    } catch (error) {
      notify({
        message: error instanceof Error ? error.message : 'ساخت فایل اکسل با خطا مواجه شد.',
        severity: 'error',
      });
    }
  }

  function applyFilters() {
    // Any filter change invalidates the current page number: page 7 of the old result set is
    // meaningless against the new one, and landing on an empty page reads as "no data".
    setPageNumber(1);
    setApplied(draft);
  }

  const hasDraftFilters = Object.values(draft).some((v) => v !== '');
  const hasAppliedFilters = Object.values(applied).some((v) => v !== '');

  return (
    <section>
      <style>{VOUCHER_REVIEW_PRINT_STYLES}</style>

      <Box className="voucher-review-no-print">
        <PageHeader
          eyebrow="گزارش‌ها"
          icon={<ManageSearchOutlinedIcon />}
          title="مرور اسناد"
          description="فهرست اسناد با جمع بدهکار و بستانکار هر سند — برای یافتن سند نامتوازن."
          actions={
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<FileDownloadOutlinedIcon />}
                onClick={handleExcel}
                disabled={rows.length === 0}
              >
                خروجی اکسل
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintOutlinedIcon />}
                onClick={exportVoucherReviewToPdf}
                disabled={rows.length === 0}
              >
                چاپ / PDF
              </Button>
            </Stack>
          }
        />

        {!isConfigured && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2">
              برای دیدن گزارش، ابتدا سال مالی را از نوار بالای صفحه انتخاب کنید.
            </Typography>
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              فیلترها
            </Typography>
            {hasAppliedFilters && <Chip size="small" color="primary" label="فیلتر فعال" />}
            <Button
              size="small"
              variant="text"
              startIcon={<TuneOutlinedIcon />}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? 'بستن' : 'نمایش'}
            </Button>
          </Stack>

          <Collapse in={filtersOpen}>
            <Stack spacing={2} sx={{ pt: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <JalaliDateField
                  label="از تاریخ"
                  value={draft.fromDate}
                  onChange={(v) => setDraft((d) => ({ ...d, fromDate: v }))}
                  size="small"
                />
                <JalaliDateField
                  label="تا تاریخ"
                  value={draft.toDate}
                  onChange={(v) => setDraft((d) => ({ ...d, toDate: v }))}
                  size="small"
                />
                <TextField
                  size="small"
                  label="از شمارهٔ سند"
                  value={draft.fromVoucherNo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, fromVoucherNo: toLatinDigits(e.target.value) }))
                  }
                  slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="تا شمارهٔ سند"
                  value={draft.toVoucherNo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, toVoucherNo: toLatinDigits(e.target.value) }))
                  }
                  slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
                  fullWidth
                />
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  size="small"
                  label="از شماره عطف"
                  value={draft.fromAtfNo}
                  onChange={(e) => setDraft((d) => ({ ...d, fromAtfNo: e.target.value }))}
                  slotProps={{ htmlInput: { maxLength: 15 } }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="تا شماره عطف"
                  value={draft.toAtfNo}
                  onChange={(e) => setDraft((d) => ({ ...d, toAtfNo: e.target.value }))}
                  slotProps={{ htmlInput: { maxLength: 15 } }}
                  fullWidth
                />
                <TextField
                  select
                  size="small"
                  label="وضعیت سند"
                  value={draft.docLife}
                  onChange={(e) => setDraft((d) => ({ ...d, docLife: e.target.value }))}
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value="">همه</MenuItem>
                  {DOC_LIFE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="نوع سند"
                  value={draft.systemTypeId}
                  onChange={(e) => setDraft((d) => ({ ...d, systemTypeId: e.target.value }))}
                  sx={{ minWidth: 190 }}
                >
                  <MenuItem value="">همه</MenuItem>
                  {(sysTypes.data ?? []).map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.sysName}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  size="small"
                  label="شرح سند شامل"
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  slotProps={{ htmlInput: { maxLength: 250 } }}
                  fullWidth
                />
              </Stack>

              <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<FilterAltOffOutlinedIcon />}
                  disabled={!hasDraftFilters && !hasAppliedFilters}
                  onClick={() => {
                    setDraft(emptyDraft);
                    setApplied(emptyDraft);
                    setPageNumber(1);
                  }}
                >
                  پاک کردن
                </Button>
                <Button size="small" variant="contained" onClick={applyFilters}>
                  اعمال فیلتر
                </Button>
              </Stack>
            </Stack>
          </Collapse>
        </Paper>

        <StatTiles tiles={tiles} isLoading={report.isLoading} />

        {/* Whether the set balances is the whole point of this screen, so it gets a shape and not
            only two numbers sitting in separate tiles. Screen-only: the print root below carries
            the table, which is where a printed report's totals belong. */}
        <BalanceBar debtor={totalDebtor} creditor={totalCreditor} hasRows={rows.length > 0} />

        {report.isError && <ErrorBanner error={report.error} />}
      </Box>

      <Box id="voucher-review-print-root">
        {/* Printed-only heading: on screen the PageHeader already says all of this, but the sheet
            has to state which slice of the report it is — it holds one page, not everything. */}
        <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
          <Typography variant="h2">مرور اسناد</Typography>
          <Typography variant="body2">
            واحد: {unitLabel || '—'} | سال مالی: {toPersianDigits(financialYear || '—')} |{' '}
            {toPersianDigits(rows.length)} سند از {toPersianDigits(totalCount)} سند
          </Typography>
        </Box>

        <Paper variant="outlined">
          <Box
            className="voucher-review-no-print"
            sx={{ p: 1.5, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}
          >
            <TextField
              select
              size="small"
              label="تعداد در صفحه"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageNumber(1);
              }}
              sx={{ width: 140 }}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {toPersianDigits(option)}
                </MenuItem>
              ))}
            </TextField>
            {totalCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                {toPersianDigits(totalCount)} سند
              </Typography>
            )}
          </Box>

          {/* Bounded height with its own scrollbar — otherwise a large page scrolls the whole
              document and carries the sticky header and the totals row out of view. */}
          <TableContainer sx={{ overflowX: "auto", maxHeight: "60vh" }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 56 }} className="voucher-review-no-print" />
                  <TableCell sx={{ width: 110 }}>شماره سند</TableCell>
                  <TableCell sx={{ width: 120 }}>تاریخ</TableCell>
                  <TableCell sx={{ width: 120 }}>شماره عطف</TableCell>
                  <TableCell sx={{ width: 140 }}>نوع سند</TableCell>
                  <TableCell sx={{ width: 110 }}>وضعیت</TableCell>
                  <TableCell>شرح</TableCell>
                  <TableCell align="left">بدهکار</TableCell>
                  <TableCell align="left">بستانکار</TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {report.isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!report.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                      {!isConfigured
                        ? 'سال مالی انتخاب نشده است.'
                        : 'برای این بازه، سندی ثبت نشده است.'}
                    </TableCell>
                  </TableRow>
                )}

                {!report.isLoading &&
                  rows.map((row) => {
                    const balanced = isVoucherBalanced(row);
                    return (
                      <TableRow
                        key={row.id}
                        hover
                        sx={
                          balanced
                            ? undefined
                            : {
                                // An unbalanced voucher is the one thing this report exists to
                                // surface, so it is marked on the row itself rather than left for
                                // the reader to spot by comparing two columns.
                                backgroundColor: (theme) => alpha(theme.palette.error.main, 0.06),
                              }
                        }
                      >
                        <TableCell className="voucher-review-no-print">
                          <Tooltip title="نمایش سند">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/operation/vouchers/${row.id}/view`)}
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                            <MonoCode value={row.voucherNumber} />
                            {!balanced && (
                              <Tooltip title="بدهکار و بستانکار این سند برابر نیست">
                                <WarningAmberOutlinedIcon color="error" sx={{ fontSize: 16 }} />
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell>{jalali(row.voucherDate)}</TableCell>
                        <TableCell>{row.atfNo || '—'}</TableCell>
                        <TableCell>{row.systemName || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={getDocLifeLabel(row.docLife)}
                            color={getDocLifeTone(row.docLife)}
                          />
                        </TableCell>
                        <TableCell>{row.description || '—'}</TableCell>
                        <TableCell align="left">{amount(row.debtor)}</TableCell>
                        <TableCell align="left">{amount(row.creditor)}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>

              {rows.length > 0 && (
                <TableBody>
                  <TableRow
                    sx={{
                      '& td': {
                        fontWeight: 700,
                        borderTop: (theme) => `2px solid ${alpha(theme.palette.text.primary, 0.35)}`,
                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    {/* Labelled as the whole filtered set, because that is what the server sent —
                        a footer that silently summed the page would misread as the grand total. */}
                    <TableCell colSpan={7}>جمع کل ({toPersianDigits(totalCount)} سند)</TableCell>
                    <TableCell align="left">{amount(totalDebtor)}</TableCell>
                    <TableCell align="left">{amount(totalCreditor)}</TableCell>
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      <Box className="voucher-review-no-print">
        <Pagination
          pageNumber={pageNumber}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPageNumber}
        />
      </Box>
    </section>
  );
}
