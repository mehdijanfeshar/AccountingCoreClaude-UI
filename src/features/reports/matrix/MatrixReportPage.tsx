import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import ListSubheader from '@mui/material/ListSubheader';
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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import UnfoldMoreOutlinedIcon from '@mui/icons-material/UnfoldMoreOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JalaliDateField } from '../../../components/JalaliDateField';
import { MonoCode } from '../../../components/MonoCode';
import { Pagination } from '../../../components/Pagination';
import { StatTiles, type StatTile } from '../../../components/StatTiles';
import { BalanceBar } from '../_shared/BalanceBar';
import { MagnitudeBarList } from '../_shared/MagnitudeBarList';
import { useSession } from '../../../lib/session/SessionContext';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { DOC_LIFE_OPTIONS } from '../../vouchers/api';
import { matrixReportApi } from './api';
import { exportMatrixToExcel, exportMatrixToPdf, sumMatrixRows } from './export';
import { MATRIX_REPORT_PRINT_STYLES } from './printStyles';
import {
  MATRIX_CODING_LEVELS,
  MATRIX_LEVEL,
  MATRIX_TAFSILI_LEVELS,
  matrixLevelLabel,
  nextMatrixLevel,
  type MatrixLevelValue,
  type MatrixScopeStep,
} from '../../../types/matrixReport';

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 200];

/** Formats an amount with thousands separators in Persian digits. */
function amount(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US'));
}

/**
 * گزارش ماتریسی (تلفیقی) — `GET /api/reports/matrix`.
 *
 * <b>This is a drill-down report, and that is the whole difference from تراز آزمایشی.</b> Listing
 * one level flat is something the trial balance already does. Here a row is a door: clicking it
 * appends a step to the path and re-asks the same question one level deeper — «معین‌های داخل این
 * کل», then «تفصیلی‌های داخل این معین», down through all seven تفصیلی levels. The breadcrumb is the
 * same mechanism read backwards; clicking a crumb drops every step after it.
 *
 * <b>Only levels that exist are offered.</b> The server returns `availableLevels` for the current
 * path and `hasChildren` per row, so the page never invites a drill-down that lands on an empty
 * table — a معین with no تفصیلی assignment is normal, not an error.
 *
 * <b>Paging is client-side, on purpose.</b> The report is unpaged over the wire because a partial
 * aggregate is a wrong answer rather than a smaller one; the rows are already in hand, so slicing
 * them for display costs nothing and no total is ever computed from a slice.
 */
export function MatrixReportPage() {
  const { financialYear, unitLabel, isConfigured } = useSession();
  const notify = useNotify();

  const [level, setLevel] = useState<MatrixLevelValue>(MATRIX_LEVEL.moin);
  const [scope, setScope] = useState<MatrixScopeStep[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);

  // Draft vs applied: typing in a filter must not fire a query per keystroke on a report this
  // expensive. The query key reads only from `applied`.
  const emptyDraft = {
    fromDate: '',
    toDate: '',
    fromVoucherNo: '',
    toVoucherNo: '',
    docLife: '' as string,
  };
  const [draft, setDraft] = useState(emptyDraft);
  const [applied, setApplied] = useState(emptyDraft);
  const [codeSearch, setCodeSearch] = useState('');

  const report = useQuery({
    queryKey: ['matrix-report', financialYear, level, scope, applied],
    queryFn: () =>
      matrixReportApi.get({
        year: financialYear,
        level,
        scope,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        fromVoucherNo: applied.fromVoucherNo || undefined,
        toVoucherNo: applied.toVoucherNo || undefined,
        docLife: applied.docLife === '' ? undefined : Number(applied.docLife),
      }),
    enabled: isConfigured,
  });

  const allRows = useMemo(() => report.data?.rows ?? [], [report.data]);
  const crumbs = useMemo(() => report.data?.scope ?? [], [report.data]);
  const availableLevels = useMemo(() => report.data?.availableLevels ?? [], [report.data]);

  // Client-side narrowing only — a convenience for finding a code inside a report already fetched,
  // never a substitute for the server-side filters above. The totals below deliberately follow
  // this filter so the figures always match the rows on screen.
  const rows = useMemo(() => {
    const needle = codeSearch.trim().toLowerCase();
    if (!needle) return allRows;
    return allRows.filter(
      (r) => r.code.toLowerCase().includes(needle) || (r.name ?? '').toLowerCase().includes(needle),
    );
  }, [allRows, codeSearch]);

  // Anything that changes which rows exist invalidates the current page — page 7 of the old set is
  // meaningless against the new one, and landing on an empty page reads as "no data".
  useEffect(() => {
    setPageNumber(1);
  }, [level, scope, applied, codeSearch, rowsPerPage]);

  const pagedRows = useMemo(
    () => rows.slice((pageNumber - 1) * rowsPerPage, pageNumber * rowsPerPage),
    [rows, pageNumber, rowsPerPage],
  );

  const totals = useMemo(() => sumMatrixRows(rows), [rows]);

  /**
   * Feeds the magnitude chart. Ranked on total turnover (بدهکار + بستانکار) rather than on the net
   * balance: a row that moved a large amount both ways and nets to zero is still one of the
   * busiest rows at this level, and ranking on the net would hide exactly those. Built from the
   * filtered row set, not the current page, so the chart describes the same set the totals do.
   */
  const topRows = useMemo(
    () => rows.map((r) => ({ key: r.code, code: r.code, name: r.name, value: r.debtor + r.creditor })),
    [rows],
  );
  const isBalanced = totals.debtor === totals.creditor;
  const childLevel = nextMatrixLevel(level);
  const canDrill = childLevel !== null && availableLevels.includes(childLevel);

  const scopeLabel = crumbs.map((c) => `${c.levelLabel} ${c.code}`).join(' ← ');

  const context = {
    level,
    year: financialYear,
    fromDate: applied.fromDate,
    toDate: applied.toDate,
    unitLabel,
    scopeLabel,
  };

  const tiles: StatTile[] = [
    { key: 'rows', label: 'تعداد ردیف', value: rows.length, tone: 'primary' },
    { key: 'debtor', label: 'جمع بدهکار', value: amount(totals.debtor), tone: 'info' },
    { key: 'creditor', label: 'جمع بستانکار', value: amount(totals.creditor), tone: 'warning' },
    {
      key: 'balance',
      label: isBalanced ? 'تراز' : 'اختلاف',
      value: amount(Math.abs(totals.debtor - totals.creditor)),
      tone: isBalanced ? 'success' : 'error',
      hint: isBalanced ? 'بدهکار و بستانکار برابرند' : 'بدهکار و بستانکار برابر نیستند',
    },
  ];

  /** از کل به جزء — append this row to the path and list the level below it. */
  function drillInto(code: string) {
    if (childLevel === null) return;
    setScope((current) => [...current, { level, code }]);
    setLevel(childLevel);
  }

  /**
   * از جزء به کل — jump to a crumb, dropping every step after it. `depth` is how many steps to
   * keep, so 0 is the top of the report.
   */
  function jumpTo(depth: number) {
    const kept = crumbs.slice(0, depth);
    setScope(kept.map((c) => ({ level: c.level, code: c.code })));
    setLevel(depth === 0 ? MATRIX_LEVEL.group : ((kept[depth - 1].level + 1) as MatrixLevelValue));
  }

  /**
   * Changing the level by hand keeps only the steps still shallower than it. Keeping a deeper step
   * would send a contradictory path the server rejects; clearing the whole path would silently
   * throw away where the user is.
   */
  function changeLevel(value: MatrixLevelValue) {
    setScope((current) => current.filter((s) => s.level < value));
    setLevel(value);
  }

  function isLevelDisabled(value: MatrixLevelValue): boolean {
    return report.isSuccess && value !== level && !availableLevels.includes(value);
  }

  async function handleExcel() {
    try {
      await exportMatrixToExcel(rows, context);
    } catch (error) {
      notify({
        message: error instanceof Error ? error.message : 'ساخت فایل اکسل با خطا مواجه شد.',
        severity: 'error',
      });
    }
  }

  const hasDraftFilters = Object.values(draft).some((v) => v !== '');
  const hasAppliedFilters = Object.values(applied).some((v) => v !== '');

  return (
    <section>
      <style>{MATRIX_REPORT_PRINT_STYLES}</style>

      <Box className="matrix-report-no-print">
        <PageHeader
          eyebrow="گزارش‌ها"
          icon={<GridOnOutlinedIcon />}
          title="گزارش ماتریسی"
          description="گردش اسناد در هر سطح — با پیمایش از کل به جزء و بازگشت از جزء به کل."
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
                onClick={exportMatrixToPdf}
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

        {/* The path, not the level picker, is this page's primary control — it is both where you
            are and how you get back. */}
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
          >
            <Button
              size="small"
              variant={crumbs.length === 0 ? 'contained' : 'text'}
              startIcon={<HomeOutlinedIcon />}
              onClick={() => jumpTo(0)}
            >
              کل واحد
            </Button>

            {crumbs.map((crumb, index) => (
              <Stack
                key={`${crumb.level}-${crumb.code}`}
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center' }}
              >
                <ChevronLeftOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                <Button size="small" variant="text" onClick={() => jumpTo(index + 1)}>
                  {crumb.levelLabel} {toPersianDigits(crumb.code)}
                  {crumb.name ? ` — ${crumb.name}` : ''}
                </Button>
              </Stack>
            ))}

            <ChevronLeftOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            <Chip size="small" color="primary" label={`سطح: ${matrixLevelLabel(level)}`} />

            <Box sx={{ flexGrow: 1 }} />

            {crumbs.length > 0 && (
              <Button
                size="small"
                variant="text"
                startIcon={<ArrowUpwardOutlinedIcon />}
                onClick={() => jumpTo(crumbs.length - 1)}
              >
                یک سطح بالاتر
              </Button>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { md: 'center' } }}
          >
            <Typography variant="subtitle2" sx={{ minWidth: 92 }}>
              سطح گزارش
            </Typography>

            {/* Levels with no data inside the current path are disabled rather than hidden —
                hiding them would make the picker change shape as you navigate, and «this level
                carries nothing here» is itself useful information. */}
            <ToggleButtonGroup
              value={MATRIX_CODING_LEVELS.some((o) => o.value === level) ? level : null}
              exclusive
              size="small"
              onChange={(_, value) => value && changeLevel(value)}
            >
              {MATRIX_CODING_LEVELS.map((option) => (
                <ToggleButton
                  key={option.value}
                  value={option.value}
                  sx={{ px: 2.5 }}
                  disabled={isLevelDisabled(option.value)}
                >
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

            {/* Seven تفصیلی levels would swamp the segmented control, so they live in a select —
                which also keeps «معین» and «تفصیلی ۴» from looking like the same kind of choice. */}
            <TextField
              select
              size="small"
              label="سطح تفصیلی"
              value={MATRIX_TAFSILI_LEVELS.some((o) => o.value === level) ? level : ''}
              onChange={(e) => changeLevel(Number(e.target.value) as MatrixLevelValue)}
              sx={{ minWidth: 190 }}
            >
              <ListSubheader>سطوح تفصیلی</ListSubheader>
              {MATRIX_TAFSILI_LEVELS.map((option) => (
                <MenuItem
                  key={option.value}
                  value={option.value}
                  disabled={isLevelDisabled(option.value)}
                >
                  {option.label}
                  {isLevelDisabled(option.value) && (
                    <Typography variant="caption" color="text.disabled" sx={{ mr: 1 }}>
                      (بدون داده)
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ flexGrow: 1 }} />

            <Button
              size="small"
              variant="text"
              startIcon={<TuneOutlinedIcon />}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              {filtersOpen ? 'بستن فیلترها' : 'فیلترها'}
            </Button>
          </Stack>
        </Paper>

        <Collapse in={filtersOpen}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Stack spacing={2}>
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
                  }}
                >
                  پاک کردن
                </Button>
                <Button size="small" variant="contained" onClick={() => setApplied(draft)}>
                  اعمال فیلتر
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Collapse>

        <StatTiles tiles={tiles} isLoading={report.isLoading} />

        {/* Screen-only: the printed report is the table. The two charts answer the questions the
            table makes you compute — does it balance, and which rows dominate. */}
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1.2fr)' },
            alignItems: 'start',
          }}
        >
          <BalanceBar debtor={totals.debtor} creditor={totals.creditor} hasRows={rows.length > 0} />
          <MagnitudeBarList
            title={`بزرگ‌ترین ردیف‌ها در سطح ${matrixLevelLabel(level)}`}
            caption="مجموع گردش بدهکار و بستانکار، بر اساس همین فیلترها"
            items={topRows}
          />
        </Box>

        {report.isError && <ErrorBanner error={report.error} />}
      </Box>

      <Box id="matrix-report-print-root">
        {/* Printed-only heading: on screen the PageHeader and breadcrumb already say all of this. */}
        <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
          <Typography variant="h2">گزارش ماتریسی — سطح {matrixLevelLabel(level)}</Typography>
          <Typography variant="body2">
            واحد: {unitLabel || '—'} | سال مالی: {toPersianDigits(financialYear || '—')}
            {scopeLabel ? ` | مسیر: ${scopeLabel}` : ''}
          </Typography>
        </Box>

        <Paper variant="outlined">
          <Box
            className="matrix-report-no-print"
            sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <TextField
              size="small"
              placeholder="جستجو در کد یا عنوان"
              value={codeSearch}
              onChange={(e) => setCodeSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <SearchOutlinedIcon fontSize="small" sx={{ mr: 0.75, color: 'action.active' }} />
                  ),
                },
              }}
              sx={{ width: 260 }}
            />
            <TextField
              select
              size="small"
              label="تعداد در صفحه"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              sx={{ width: 140 }}
            >
              {ROWS_PER_PAGE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {toPersianDigits(option)}
                </MenuItem>
              ))}
            </TextField>
            {rows.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {toPersianDigits(rows.length)} ردیف
              </Typography>
            )}
            {canDrill && (
              <Typography variant="caption" color="text.secondary">
                برای رفتن به سطح {matrixLevelLabel(childLevel!)} روی ردیف کلیک کنید
              </Typography>
            )}
          </Box>

          {/* A bounded height with its own scrollbar at every width — otherwise a long report
              scrolls the whole page and both the sticky header and the totals row leave view. */}
          <TableContainer sx={{ overflowX: 'auto', maxHeight: '60vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 140 }}>کد</TableCell>
                  <TableCell>عنوان</TableCell>
                  <TableCell align="left">بدهکار</TableCell>
                  <TableCell align="left">بستانکار</TableCell>
                  <TableCell align="left">مانده بدهکار</TableCell>
                  <TableCell align="left">مانده بستانکار</TableCell>
                  <TableCell className="matrix-report-no-print" sx={{ width: 56 }} />
                </TableRow>
              </TableHead>

              <TableBody>
                {report.isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!report.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                      {!isConfigured
                        ? 'سال مالی انتخاب نشده است.'
                        : codeSearch.trim()
                          ? 'نتیجه‌ای برای این جستجو یافت نشد.'
                          : 'برای این سطح و بازه، گردشی ثبت نشده است.'}
                    </TableCell>
                  </TableRow>
                )}

                {!report.isLoading &&
                  pagedRows.map((row) => {
                    const openable = canDrill && row.hasChildren;
                    return (
                      <TableRow
                        key={`${row.code}-${row.name}`}
                        hover
                        onClick={openable ? () => drillInto(row.code) : undefined}
                        sx={openable ? { cursor: 'pointer' } : undefined}
                      >
                        <TableCell>
                          <MonoCode value={row.code} />
                        </TableCell>
                        <TableCell>{row.name || '—'}</TableCell>
                        <TableCell align="left">{amount(row.debtor)}</TableCell>
                        <TableCell align="left">{amount(row.creditor)}</TableCell>
                        <TableCell align="left">{amount(row.debtorBalance)}</TableCell>
                        <TableCell align="left">{amount(row.creditorBalance)}</TableCell>
                        <TableCell className="matrix-report-no-print" align="center">
                          {openable && (
                            <Tooltip title={`نمایش سطح ${matrixLevelLabel(childLevel!)}`}>
                              <IconButton size="small">
                                <UnfoldMoreOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
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
                        position: 'sticky',
                        bottom: 0,
                      },
                    }}
                  >
                    {/* Covers every row of the current level and path, not the visible page — the
                        rows are all in hand, so this is never a sum of a slice. */}
                    <TableCell colSpan={2}>جمع کل ({toPersianDigits(rows.length)} ردیف)</TableCell>
                    <TableCell align="left">{amount(totals.debtor)}</TableCell>
                    <TableCell align="left">{amount(totals.creditor)}</TableCell>
                    <TableCell align="left">{amount(totals.debtorBalance)}</TableCell>
                    <TableCell align="left">{amount(totals.creditorBalance)}</TableCell>
                    <TableCell className="matrix-report-no-print" />
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      <Box className="matrix-report-no-print">
        <Pagination
          pageNumber={pageNumber}
          pageSize={rowsPerPage}
          totalCount={rows.length}
          onPageChange={setPageNumber}
        />
      </Box>
    </section>
  );
}
