import { ReportUnitScopeBar, useReportUnitScope } from '../_shared/reportUnitScope';
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
import ManageSearchOutlinedIcon from '@mui/icons-material/ManageSearchOutlined';
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
import { CollapsibleMagnitudeChart } from '../_shared/CollapsibleMagnitudeChart';
import { useSession } from '../../../lib/session/SessionContext';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { DOC_LIFE_OPTIONS } from '../../vouchers/api';
import { accountReviewApi } from './api';
import { useReportUrlParams } from '../_shared/reportUrlParams';
import { exportAccountReviewToExcel, exportAccountReviewToPdf, sumAccountReviewRows } from './export';
import { ACCOUNT_REVIEW_PRINT_STYLES } from './printStyles';
import { TabGlobalStyles } from '../../../components/workspace-tabs/TabGlobalStyles';
import {
  ACCOUNT_REVIEW_CODING_LEVELS,
  ACCOUNT_REVIEW_LEVEL,
  ACCOUNT_REVIEW_TAFSILI_LEVELS,
  ACCOUNT_REVIEW_UNIT_LEVELS,
  accountReviewLevelLabel,
  isUnitDimensionLevel,
  nextAccountReviewLevel,
  type AccountReviewLevelValue,
  type AccountReviewRow,
  type AccountReviewScopeStep,
} from '../../../types/accountReview';
import { parseBreakdownPath } from '../_shared/accountBreakdownLink';
import { ColumnChooser, SortLabel, normalizeSortValue, sortRows, useColumnVisibility, useGridSort } from '../../../components/gridTools';
import {
  GRID_SIDES,
  GRID_TOTAL_ROW,
  amountCellSx,
  frozenCell,
  frozenHeadCell,
  groupHeadSx,
  groupSeparator,
  reportGridTableSx,
  sectionSeparator,
  sideHeadSx,
  totalsCellSx,
  totalsSurfaceSx,
  useColumnHighlight,
  useHeaderRowHeight,
} from '../_shared/reportGrid';
import { useNavigate } from 'react-router-dom';
import Menu from '@mui/material/Menu';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100, 200];

/** عرض ستون‌های ثابت (کد/عنوان) — مثل گزارش ماتریسی. */
const CODE_WIDTH = 140;
const NAME_WIDTH = 260;

/** دو گروه مبلغ گرید: گردش و مانده، هر کدام بدهکار/بستانکار. */
type AmountField = 'debtor' | 'creditor' | 'debtorBalance' | 'creditorBalance';
const AMOUNT_GROUPS: { key: 'turnover' | 'balance'; label: string }[] = [
  { key: 'turnover', label: 'گردش' },
  { key: 'balance', label: 'مانده' },
];
/** ستون‌های بدهکار/بستانکار هر گروه. */
const GROUP_FIELDS: Record<'turnover' | 'balance', [AmountField, AmountField]> = {
  turnover: ['debtor', 'creditor'],
  balance: ['debtorBalance', 'creditorBalance'],
};

/** Formats an amount with thousands separators in Persian digits. */
function amount(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US'));
}

/**
 * مرور حساب‌ها — `GET /api/reports/account-review`.
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
export function AccountReviewPage() {
  const { financialYear, unitLabel, isConfigured } = useSession();
  const notify = useNotify();
  const navigate = useNavigate();
  const columnHighlight = useColumnHighlight();
  const headerTop = useHeaderRowHeight();
  // منوی «نمایش این ردیف به تفکیک…»
  const [breakdownMenu, setBreakdownMenu] = useState<{ anchor: HTMLElement; row: AccountReviewRow } | null>(null);

  // مقدار اولیه از آدرس (گزارش با حسابیار / گزارش ذخیره‌شده)؛ بدون پارامتر همان پیش‌فرض‌های قبلی.
  const url = useReportUrlParams();
  const [level, setLevel] = useState<AccountReviewLevelValue>(() =>
    url.oneOf('level', Object.values(ACCOUNT_REVIEW_LEVEL), ACCOUNT_REVIEW_LEVEL.moin));
  // مسیر اولیه از آدرس (پیوند «به تفکیک استان/واحد» از تراز آزمایشی و دفتر کل): path=3:110101
  const [scope, setScope] = useState<AccountReviewScopeStep[]>(
    () => parseBreakdownPath(url.text('path')) as AccountReviewScopeStep[],
  );
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
  const [initialDraft] = useState(() => ({
    ...emptyDraft,
    fromDate: url.date('from'),
    toDate: url.date('to'),
    docLife: String(url.oneOf('docLife', [0, 1, 2, 3, 4] as const, 0) || ''),
  }));
  const [draft, setDraft] = useState(initialDraft);
  const [applied, setApplied] = useState(initialDraft);
  const [codeSearch, setCodeSearch] = useState(() => url.text('code'));

  // دامنهٔ واحد همین تب — هر نسخهٔ گزارش دامنهٔ خودش را دارد.
  const [unitScope] = useReportUnitScope();

  const report = useQuery({
    queryKey: ['account-review', financialYear, level, scope, applied, unitScope],
    queryFn: () =>
      accountReviewApi.get({
        year: financialYear,
        level,
        scope,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        fromVoucherNo: applied.fromVoucherNo || undefined,
        toVoucherNo: applied.toVoucherNo || undefined,
        docLife: applied.docLife === '' ? undefined : Number(applied.docLife),
      }, unitScope),
    enabled: isConfigured,
    placeholderData: (previous) => previous,
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

  // مرتب‌سازی با سرستون (روی همهٔ سطرها، پیش از صفحه‌بندی) و ستون‌های قابل نمایش.
  const { sort, toggle: toggleSort } = useGridSort();
  function sortBy(key: string) {
    toggleSort(key);
    setPageNumber(1);
  }
  const sortedRows = useMemo(
    () =>
      sortRows(rows, sort, (r, key) =>
        key === 'code' || key === 'name' ? normalizeSortValue(r[key]) : (r[key as AmountField] ?? null),
      ),
    [rows, sort],
  );
  const visibility = useColumnVisibility(['name', ...AMOUNT_GROUPS.map((g) => g.key)], 'grid-cols:account-review');
  const showName = visibility.isVisible('name');
  const shownGroups = AMOUNT_GROUPS.filter((g) => visibility.isVisible(g.key));
  const columnCount = 2 + (showName ? 1 : 0) + shownGroups.length * 2;

  const pagedRows = useMemo(
    () => sortedRows.slice((pageNumber - 1) * rowsPerPage, pageNumber * rowsPerPage),
    [sortedRows, pageNumber, rowsPerPage],
  );

  const totals = useMemo(() => sumAccountReviewRows(rows), [rows]);

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
  // تفکیک واحد: استان ⇒ (بیمه‌ای/درمانی اگر بیش از یکی هست) ⇒ واحد ⇒ سند. واحدِ کلیک‌شده همیشه به اسنادش می‌رود،
  // حتی وقتی دامنهٔ کل چندواحدی است و «سند» در سطوح موجود نیست.
  const childLevel =
    level === ACCOUNT_REVIEW_LEVEL.province && !availableLevels.includes(ACCOUNT_REVIEW_LEVEL.unitCategory)
      ? ACCOUNT_REVIEW_LEVEL.unit
      : nextAccountReviewLevel(level);
  const canDrill = childLevel !== null && (isUnitDimensionLevel(level) || availableLevels.includes(childLevel));

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

  /** ردیف سند ⇒ صفحهٔ نمایش سند؛ در دامنهٔ چندواحدی با هدر همان واحد (فقط مشاهده، مثل دفتر کل). */
  function openVoucher(row: AccountReviewRow) {
    if (!row.voucherId) return;
    const otherUnit = unitScope.unitScope !== 0 && row.vahedCode;
    navigate(`/operation/vouchers/${row.voucherId}/view${otherUnit ? `?unit=${encodeURIComponent(row.vahedCode!)}` : ''}`);
  }

  /**
   * «این ردیف به تفکیک …» — هر ردیف (حساب، تفصیلی، استان، گروه یا واحد) را می‌توان با خانوادهٔ دیگر شکست:
   * معین ⇒ استان‌ها ⇒ بیمه‌ای/درمانی ⇒ واحدها ⇒ اسناد، یا واحد ⇒ معین‌های همان واحد.
   */
  function breakdownTargets(row: AccountReviewRow): AccountReviewLevelValue[] {
    const pinned = [...scope.map((s) => s.level), level];
    const deepestCoding = Math.max(0, ...pinned.filter((l) => !isUnitDimensionLevel(l)));
    const coding = [...ACCOUNT_REVIEW_CODING_LEVELS, ...ACCOUNT_REVIEW_TAFSILI_LEVELS]
      .map((o) => o.value)
      .filter((l) => l > deepestCoding && availableLevels.includes(l));
    const unitPinned = pinned.includes(ACCOUNT_REVIEW_LEVEL.unit);
    const units = [ACCOUNT_REVIEW_LEVEL.province, ACCOUNT_REVIEW_LEVEL.unitCategory, ACCOUNT_REVIEW_LEVEL.unit]
      .filter((l) => !unitPinned && !pinned.includes(l) && availableLevels.includes(l)) as AccountReviewLevelValue[];
    const voucher: AccountReviewLevelValue[] =
      (unitPinned || availableLevels.includes(ACCOUNT_REVIEW_LEVEL.voucher)) && row.code ? [ACCOUNT_REVIEW_LEVEL.voucher] : [];
    return [...units, ...voucher, ...coding];
  }

  function breakdown(row: AccountReviewRow, target: AccountReviewLevelValue) {
    setScope((current) => [...current, { level, code: row.code }]);
    setLevel(target);
  }

  /**
   * از جزء به کل — jump to a crumb, dropping every step after it. `depth` is how many steps to
   * keep, so 0 is the top of the report. سطح بعد از پرش همان سطحی است که کاربر از آن مرحله وارد شد
   * (مسیر می‌تواند دو خانواده را در هم داشته باشد، پس «سطح + ۱» دیگر کافی نیست).
   */
  function jumpTo(depth: number) {
    if (depth === crumbs.length && depth > 0) return;
    const kept = crumbs.slice(0, depth);
    setScope(kept.map((c) => ({ level: c.level, code: c.code })));
    setLevel(depth < crumbs.length ? crumbs[depth].level : ACCOUNT_REVIEW_LEVEL.group);
  }

  /**
   * Changing the level by hand keeps only the steps still shallower than it. Keeping a deeper step
   * would send a contradictory path the server rejects; clearing the whole path would silently
   * throw away where the user is. تفکیک واحد: مراحل کدینگ می‌مانند؛ واحدِ ثابت‌شده فقط برای «سند».
   */
  function changeLevel(value: AccountReviewLevelValue) {
    setScope((current) =>
      current.filter((s) => {
        if (s.level === value) return false;
        if (isUnitDimensionLevel(value)) return value === ACCOUNT_REVIEW_LEVEL.voucher || s.level !== ACCOUNT_REVIEW_LEVEL.unit;
        return isUnitDimensionLevel(s.level) || s.level < value;
      }),
    );
    setLevel(value);
  }

  function isLevelDisabled(value: AccountReviewLevelValue): boolean {
    return report.isSuccess && value !== level && !availableLevels.includes(value);
  }

  async function handleExcel() {
    try {
      await exportAccountReviewToExcel(rows, context);
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
      <TabGlobalStyles styles={ACCOUNT_REVIEW_PRINT_STYLES} />

      <Box className="account-review-no-print">
        <PageHeader
          icon={<ManageSearchOutlinedIcon />}
          title="مرور حساب‌ها"
          description="گردش اسناد در هر سطح، با پیمایش از کل به جزء و بازگشت از جزء به کل."
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
                onClick={exportAccountReviewToPdf}
                disabled={rows.length === 0}
              >
                چاپ / PDF
              </Button>
            </Stack>
          }
        />
        <ReportUnitScopeBar hint="مبالغ جمع همهٔ واحدهای دامنه است؛ با تفکیک استان / بیمه‌ای-درمانی / واحد تا سند پیش بروید." />

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
              {unitScope.unitScope !== 0 ? 'کل دامنه' : 'کل واحد'}
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
                  {crumb.name ? ` ${crumb.name}` : ''}
                </Button>
              </Stack>
            ))}

            <ChevronLeftOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            <Chip size="small" color="primary" label={`سطح: ${accountReviewLevelLabel(level)}`} />

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
              value={ACCOUNT_REVIEW_CODING_LEVELS.some((o) => o.value === level) ? level : null}
              exclusive
              size="small"
              onChange={(_, value) => value && changeLevel(value)}
            >
              {ACCOUNT_REVIEW_CODING_LEVELS.map((option) => (
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
              value={ACCOUNT_REVIEW_TAFSILI_LEVELS.some((o) => o.value === level) ? level : ''}
              onChange={(e) => changeLevel(Number(e.target.value) as AccountReviewLevelValue)}
              sx={{ minWidth: 190 }}
            >
              <ListSubheader>سطوح تفصیلی</ListSubheader>
              {ACCOUNT_REVIEW_TAFSILI_LEVELS.map((option) => (
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

            <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' } }} />

            {/* تفکیک واحد: استان ⇒ بیمه‌ای/درمانی ⇒ واحد ⇒ سند. در دامنهٔ یک واحد فقط «سند» فعال است. */}
            <ToggleButtonGroup
              value={isUnitDimensionLevel(level) ? level : null}
              exclusive
              size="small"
              onChange={(_, value) => value && changeLevel(value)}
            >
              {ACCOUNT_REVIEW_UNIT_LEVELS.map((option) => (
                <ToggleButton
                  key={option.value}
                  value={option.value}
                  sx={{ px: 1.5 }}
                  disabled={isLevelDisabled(option.value)}
                >
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

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
          {/* A form, so Enter in any filter field runs the report. */}
          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 2 }}
            component="form"
            noValidate
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              setApplied(draft);
            }}
          >
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
                <Button type="submit" size="small" variant="contained">
                  اعمال فیلتر
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Collapse>

        <StatTiles tiles={tiles} isLoading={report.isLoading} />
        <CollapsibleMagnitudeChart
          label="نمودار ردیف‌های پرگردش"
          title={`بزرگ‌ترین ردیف‌ها در سطح ${accountReviewLevelLabel(level)}`}
          caption="مجموع گردش بدهکار و بستانکار، بر اساس همین فیلترها"
          items={topRows}
        />

        {report.isError && <ErrorBanner error={report.error} />}
      </Box>

      <Box id="account-review-print-root">
        {/* Printed-only heading: on screen the PageHeader and breadcrumb already say all of this. */}
        <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
          <Typography variant="h2">مرور حساب‌ها، سطح {accountReviewLevelLabel(level)}</Typography>
          <Typography variant="body2">
            واحد: {unitLabel || '—'} | سال مالی: {toPersianDigits(financialYear || '—')}
            {scopeLabel ? ` | مسیر: ${scopeLabel}` : ''}
          </Typography>
        </Box>

        <Paper variant="outlined">
          <Box
            className="account-review-no-print"
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
                برای رفتن به سطح {accountReviewLevelLabel(childLevel!)} روی ردیف کلیک کنید
              </Typography>
            )}
            <Box sx={{ flexGrow: 1 }} />
            <ColumnChooser
              columns={[{ key: 'name', label: 'عنوان' }, ...AMOUNT_GROUPS.map((g) => ({ key: g.key, label: g.label }))]}
              visibility={visibility}
            />
          </Box>

          {/* A bounded height with its own scrollbar at every width — otherwise a long report
              scrolls the whole page and both the sticky header and the totals row leave view. */}
          <TableContainer
            ref={columnHighlight.ref}
            onMouseOver={columnHighlight.onMouseOver}
            onMouseLeave={columnHighlight.onMouseLeave}
            aria-busy={report.isFetching}
            sx={{ overflow: 'auto', maxHeight: '60vh', opacity: report.isFetching && !report.isLoading ? 0.55 : 1, transition: 'opacity 150ms cubic-bezier(0.23, 1, 0.32, 1)' }}
          >
            <Table size="small" stickyHeader sx={reportGridTableSx()}>
              <TableHead>
                <TableRow ref={headerTop.ref}>
                  <TableCell
                    rowSpan={2}
                    sx={frozenHeadCell(0, CODE_WIDTH, showName ? undefined : { borderInlineEnd: sectionSeparator })}
                    sortDirection={sort?.key === 'code' ? sort.direction : false}
                  >
                    <SortLabel sortKey="code" sort={sort} onSort={sortBy}>
                      کد {accountReviewLevelLabel(level)}
                    </SortLabel>
                  </TableCell>
                  {showName && (
                    <TableCell
                      rowSpan={2}
                      sx={frozenHeadCell(CODE_WIDTH, NAME_WIDTH, { borderInlineEnd: sectionSeparator })}
                      sortDirection={sort?.key === 'name' ? sort.direction : false}
                    >
                      <SortLabel sortKey="name" sort={sort} onSort={sortBy}>
                        عنوان
                      </SortLabel>
                    </TableCell>
                  )}
                  {shownGroups.map((group, index) => (
                    <TableCell key={group.key} data-ci={index} colSpan={2} align="center" sx={groupHeadSx(index)}>
                      {group.label}
                    </TableCell>
                  ))}
                  <TableCell rowSpan={2} className="account-review-no-print" sx={{ width: 84, borderInlineStart: sectionSeparator }} />
                </TableRow>
                <TableRow>
                  {shownGroups.map((group, index) =>
                    GRID_SIDES.map((side, sideIndex) => {
                      const field = GROUP_FIELDS[group.key][sideIndex];
                      return (
                        <TableCell
                          key={`${group.key}-${side.key}`}
                          data-ci={index}
                          align="left"
                          sx={sideHeadSx(side.color, { top: headerTop.height, first: sideIndex === 0 })}
                          sortDirection={sort?.key === field ? sort.direction : false}
                        >
                          <SortLabel sortKey={field} sort={sort} onSort={sortBy}>
                            {side.label}
                          </SortLabel>
                        </TableCell>
                      );
                    }),
                  )}
                </TableRow>
              </TableHead>

              <TableBody>
                {report.isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: columnCount }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!report.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columnCount} align="center" sx={{ py: 5, color: 'text.secondary' }}>
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
                    const isVoucher = level === ACCOUNT_REVIEW_LEVEL.voucher;
                    const openable = isVoucher ? Boolean(row.voucherId) : canDrill && row.hasChildren;
                    const targets = isVoucher ? [] : breakdownTargets(row);
                    return (
                      <TableRow
                        key={`${row.code}-${row.name}`}
                        onClick={openable ? () => (isVoucher ? openVoucher(row) : drillInto(row.code)) : undefined}
                        sx={openable ? { cursor: 'pointer' } : undefined}
                      >
                        <TableCell sx={{ ...frozenCell(0), ...(showName ? {} : { borderInlineEnd: sectionSeparator }) }}>
                          <MonoCode value={row.code} />
                        </TableCell>
                        {showName && (
                          <TableCell
                            title={row.name || undefined}
                            sx={{
                              ...frozenCell(CODE_WIDTH),
                              maxWidth: NAME_WIDTH,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              borderInlineEnd: sectionSeparator,
                            }}
                          >
                            {row.name || '—'}
                          </TableCell>
                        )}
                        {shownGroups.map((group, index) =>
                          GROUP_FIELDS[group.key].map((field, sideIndex) => {
                            const value = row[field];
                            return (
                              <TableCell
                                key={field}
                                data-ci={index}
                                align="left"
                                sx={amountCellSx(value, { band: index % 2 === 1, first: sideIndex === 0, strong: group.key === 'balance' })}
                              >
                                {amount(value)}
                              </TableCell>
                            );
                          }),
                        )}
                        <TableCell
                          className="account-review-no-print"
                          align="center"
                          sx={{ whiteSpace: 'nowrap', borderInlineStart: sectionSeparator }}
                        >
                          {openable && (
                            <Tooltip title={isVoucher ? 'نمایش سند' : `نمایش سطح ${accountReviewLevelLabel(childLevel!)}`}>
                              <IconButton size="small">
                                {isVoucher ? <OpenInNewOutlinedIcon fontSize="small" /> : <UnfoldMoreOutlinedIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                          )}
                          {targets.length > 0 && (
                            <Tooltip title="نمایش این ردیف به تفکیک…">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBreakdownMenu({ anchor: e.currentTarget, row });
                                }}
                              >
                                <AccountTreeOutlinedIcon fontSize="small" />
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
                  {/* Covers every row of the current level and path, not the visible page — the
                      rows are all in hand, so this is never a sum of a slice. */}
                  <TableRow className={GRID_TOTAL_ROW}>
                    <TableCell
                      colSpan={showName ? 2 : 1}
                      sx={{ ...totalsCellSx, ...frozenCell(0, 6), ...totalsSurfaceSx, borderInlineEnd: sectionSeparator }}
                    >
                      جمع کل ({toPersianDigits(rows.length)} ردیف)
                    </TableCell>
                    {shownGroups.flatMap((group) =>
                      GROUP_FIELDS[group.key].map((field, i) => (
                        <TableCell
                          key={field}
                          align="left"
                          sx={{ ...totalsCellSx, borderInlineStart: i === 0 ? groupSeparator : 'none' }}
                        >
                          {amount(totals[field])}
                        </TableCell>
                      )),
                    )}
                    <TableCell className="account-review-no-print" sx={{ ...totalsCellSx, borderInlineStart: sectionSeparator }} />
                  </TableRow>
                </TableBody>
              )}
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      <Menu
        anchorEl={breakdownMenu?.anchor ?? null}
        open={breakdownMenu !== null}
        onClose={() => setBreakdownMenu(null)}
      >
        <ListSubheader>
          {breakdownMenu ? `${breakdownMenu.row.levelLabel} ${toPersianDigits(breakdownMenu.row.code)} به تفکیک` : ''}
        </ListSubheader>
        {breakdownMenu &&
          breakdownTargets(breakdownMenu.row).map((target) => (
            <MenuItem
              key={target}
              onClick={() => {
                breakdown(breakdownMenu.row, target);
                setBreakdownMenu(null);
              }}
            >
              {accountReviewLevelLabel(target)}
            </MenuItem>
          ))}
      </Menu>

      <Box className="account-review-no-print">
        <Pagination
          pageNumber={pageNumber}
          pageSize={rowsPerPage}
          totalCount={rows.length}
          onPageChange={setPageNumber}
          onPageSizeChange={setRowsPerPage}
          pageSizeOptions={ROWS_PER_PAGE_OPTIONS}
        />
      </Box>
    </section>
  );
}
