import { ReportUnitScopeBar } from '../_shared/reportUnitScope';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import ListSubheader from '@mui/material/ListSubheader';
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
import { alpha, type Theme } from '@mui/material/styles';
import PivotTableChartOutlinedIcon from '@mui/icons-material/PivotTableChartOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JalaliDateField } from '../../../components/JalaliDateField';
import { MonoCode } from '../../../components/MonoCode';
import { Pagination } from '../../../components/Pagination';
import { StatTiles, type StatTile } from '../../../components/StatTiles';
import { CREDITOR_COLOR, DEBTOR_COLOR } from '../_shared/chartTokens';
import { CollapsibleMagnitudeChart } from '../_shared/CollapsibleMagnitudeChart';
import { useSession } from '../../../lib/session/SessionContext';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { DOC_LIFE_OPTIONS } from '../../vouchers/api';
import { matrixReportApi } from './api';
import { exportMatrixToExcel, exportMatrixToPdf } from './export';
import { MATRIX_REPORT_PRINT_STYLES } from './printStyles';
import { useReportUrlParams } from '../_shared/reportUrlParams';
import {
  MATRIX_ALL_DIMENSIONS,
  MATRIX_CODING_DIMENSIONS,
  MATRIX_DIMENSION,
  MATRIX_TAFSILI_DIMENSIONS,
  cellsByColumn,
  matrixDimensionLabel,
  type MatrixDimensionValue,
} from '../../../types/matrixReport';

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];

/** Widths of the two frozen row-identity columns, in px. Sticky offsets are derived from them. */
const CODE_COLUMN_WIDTH = 128;
const NAME_COLUMN_WIDTH = 216;

/**
 * Starting guess for the upper header row's height; the real value is measured at runtime.
 *
 * The lower header row is pinned beneath the upper one, which means its offset has to be that row's
 * actual height. Hard-coding it was wrong the first time — the upper row carries a code and a name
 * on two lines, so a 38px guess let the names slide underneath. It is measured instead of computed
 * because the height follows the font and the theme's cell padding, neither of which this file owns.
 */
const HEADER_TOP_HEIGHT_FALLBACK = 56;

/** Formats an amount with thousands separators in Persian digits. */
function amount(value: number): string {
  return toPersianDigits(value.toLocaleString('en-US'));
}

/**
 * The grid's separation system — one place, so the tints stay inside a measured budget.
 *
 * <b>Why a budget at all.</b> The بدهکار/بستانکار accents in the sub-header are the app's two
 * validated series colours, and the data-viz validator measures their contrast <i>against the
 * surface they sit on</i>. Run against a cell tinted to `#E7E8EA` the gold `#B58108` fell to
 * <b>2.8:1</b> and the contrast check turned WARN; against `#EFF0F2` the same pair passes every
 * check. So the tints here are not free — every layer spends from a budget whose floor is roughly
 * 6.5% of `text.primary` over paper.
 *
 * <b>The budget binds on the sub-header only.</b> That is the one surface the two hues sit on,
 * and it never carries the zebra — its worst case is COLUMN_BAND + COLUMN_HOT = 0.065, which is
 * the surface measured below. Body cells carry nothing but `text.primary` on a near-white tint,
 * so they can go darker, and that is why the zebra is the strongest layer here without costing
 * anything.
 *
 * <pre>
 *   node validate_palette.js "#3B5BB5,#B58108" --mode light --surface "#EFF0F1"
 *     [PASS] Lightness band · Chroma floor · CVD separation · Normal-vision floor
 *     [PASS] Contrast vs surface  all 2 >= 3:1
 *   node validate_palette.js "#3B5BB5,#B58108" --mode light --surface "#E7E8EA"
 *     [WARN] Contrast vs surface  below 3:1 — [["#B58108", 2.8]]
 * </pre>
 *
 * ⚠️ The obvious "fix" — swapping in the darker gold `#854D0E`, which does pass on the darker
 * surface — was <b>rejected</b>. بستانکار is the same entity on every report in this app, so its
 * colour may not change just because this particular grid tints its cells. Colour follows the
 * entity, not its background. Capping the tint was the correct lever.
 */
const ZEBRA_ALPHA = 0.035;
const COLUMN_BAND_ALPHA = 0.03;
const ROW_HOT_ALPHA = 0.055;
const COLUMN_HOT_ALPHA = 0.035;

/**
 * The two sub-columns under every dimension value, in render order.
 *
 * Declared once because they are repeated in four places — both header rows, the body, and the
 * totals row — and a pair that drifted out of step between them would silently label بدهکار figures
 * as بستانکار. The colours are the app-wide validated series hues, so بستانکار is the same gold here
 * as in the balance bar above.
 */
const SIDES = [
  { key: "debtor" as const, label: "بدهکار", color: DEBTOR_COLOR },
  { key: "creditor" as const, label: "بستانکار", color: CREDITOR_COLOR },
];

/** A flat tint layer, expressed as a gradient so several can be composed in one `backgroundImage`. */
function tintLayer(theme: Theme, opacity: number): string {
  const c = alpha(theme.palette.text.primary, opacity);
  return `linear-gradient(${c}, ${c})`;
}

/**
 * The static banding of a body cell: zebra by row, band by column group.
 *
 * Both are deliberately faint. On a grid this dense the separation that actually does the work is
 * the <i>rule</i> at each group boundary — the fills only keep the eye from drifting between
 * neighbouring rows on a wide line, and a fill strong enough to be noticed on its own would turn
 * the grid into a checkerboard and eat the whole contrast budget above.
 */
function bandedCell(theme: Theme, rowIndex: number, columnIndex: number): string {
  const layers: string[] = [];
  if (rowIndex % 2 === 1) layers.push(tintLayer(theme, ZEBRA_ALPHA));
  if (columnIndex % 2 === 1) layers.push(tintLayer(theme, COLUMN_BAND_ALPHA));
  return layers.length > 0 ? layers.join(", ") : "none";
}

/** The rule between two column groups — what makes «this pair belongs to that معین» readable. */
function groupSeparator(theme: Theme): string {
  return `1.5px solid ${alpha(theme.palette.text.primary, 0.16)}`;
}

/** The heavier rule that fences off the frozen columns and the row-total pair. */
function sectionSeparator(theme: Theme): string {
  return `2px solid ${alpha(theme.palette.text.primary, 0.28)}`;
}

/**
 * The totals' tint, painted as a gradient image rather than set as the background colour.
 *
 * ⚠️ <b>A translucent background on a sticky cell is a bug, not a style choice.</b> `alpha(...)`
 * alone let the row underneath show straight through the pinned totals row — the last data row was
 * legible through the figures. The surface is painted opaque and the tint laid over it, which keeps
 * the intended shade while making the cell genuinely cover what it is pinned over. Every sticky cell
 * on this page has to do this; nothing else on the page may show through.
 */
const STICKY_TINT = (theme: Theme) => {
  const tint = alpha(theme.palette.primary.main, 0.06);
  return `linear-gradient(${tint}, ${tint})`;
};

/** The opaque tinted surface every sticky totals cell sits on. */
const totalsSurfaceSx = {
  backgroundColor: 'background.paper',
  backgroundImage: (theme: Theme) => STICKY_TINT(theme),
};

/** Shared style of every cell in the pinned totals row. */
const totalsCellSx = {
  ...totalsSurfaceSx,
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  borderTop: (theme: Theme) => `2px solid ${alpha(theme.palette.text.primary, 0.35)}`,
  position: 'sticky' as const,
  bottom: 0,
  zIndex: 2,
};

/**
 * A frozen row-identity cell.
 *
 * ⚠️ <b>`insetInlineStart`, never `left`.</b> This app runs `stylis-plugin-rtl`, which rewrites
 * physical `left`/`right` and would move the frozen columns to the wrong edge — the exact bug the
 * coding-permission trees hit (`features/coding-permissions/TreeRow.tsx`). The logical property is
 * left alone by the plugin and resolves to the reading-order start in both directions, which is
 * where these columns belong.
 *
 * An opaque background is not decoration either: without it, the scrolled amount columns show
 * through the frozen ones.
 */
function frozenCell(offset: number, zIndex: number) {
  return {
    position: 'sticky' as const,
    insetInlineStart: offset,
    zIndex,
    backgroundColor: 'background.paper',
  };
}

/**
 * گزارش ماتریسی — `GET /api/reports/matrix`.
 *
 * <b>What makes this a different report from مرور حساب‌ها rather than a variant of it.</b> That one
 * groups by a single level and hands back a list you walk from کل to جزء. This one crosses two
 * dimensions the user chooses independently, so the answer is a grid: «این تفصیلی در کدام معین‌ها
 * گردش داشته، و چقدر». Both are kept — the project owner asked for this as a new report and for the
 * existing one to stay untouched.
 *
 * <b>Columns come from the data, not from a schema.</b> Every header on the horizontal axis is a
 * value that actually occurred inside the filtered period, which is what makes the grid a pivot. It
 * is also why the page has to handle a column set that can be too wide to draw — see the truncation
 * notice below, which is load-bearing rather than cosmetic.
 *
 * <b>No client-side row search here, unlike the matrix report.</b> The column totals in the footer
 * are the server's, computed over every row; a local text filter would leave them describing rows
 * that are no longer on screen. The report's own «شروع با» narrowings do the same job server-side
 * and keep the footer true — and they are what the reference system offers as «فیلتر سطر»/«فیلتر
 * ستون». Paging is still client-side, which is safe precisely because no total is derived from the
 * page.
 */
export function MatrixReportPage() {
  const { financialYear, unitLabel, isConfigured } = useSession();
  const notify = useNotify();

  // مقدار اولیه از آدرس (گزارش با حسابیار / گزارش ذخیره‌شده)؛ بدون پارامتر همان پیش‌فرض‌های قبلی.
  const url = useReportUrlParams();
  const dimensionValues = MATRIX_ALL_DIMENSIONS.map((d) => d.value);
  const [rowDimension, setRowDimension] = useState<MatrixDimensionValue>(
    () => url.oneOf('row', dimensionValues, MATRIX_DIMENSION.tafsili1),
  );
  const [columnDimension, setColumnDimension] = useState<MatrixDimensionValue>(
    () => url.oneOf('col', dimensionValues, MATRIX_DIMENSION.moin),
  );
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [pageNumber, setPageNumber] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);

  // The lower header row is pinned directly beneath the upper one, so its offset must be that
  // row's real height — measured, not assumed. See HEADER_TOP_HEIGHT_FALLBACK.
  const headerTopRef = useRef<HTMLTableRowElement>(null);

  /**
   * The column half of the hover crosshair, driven by direct DOM writes rather than React state.
   *
   * <b>Why not state.</b> A pivot page can hold 25 rows × 120 columns; storing the hovered column in
   * state would re-render several thousand cells on every pointer move across a cell boundary. One
   * delegated listener and a class toggle touch only the cells that actually change, and the effect
   * is purely visual — nothing downstream reads it — so React never needs to know.
   *
   * The class is transient: a re-render (paging, a new query) drops it, and the next pointer move
   * puts it back.
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  const hotColumnRef = useRef<string | null>(null);

  function paintColumn(next: string | null) {
    const root = scrollRef.current;
    if (!root || next === hotColumnRef.current) return;
    root.querySelectorAll(".col-hot").forEach((el) => el.classList.remove("col-hot"));
    if (next !== null) {
      root
        .querySelectorAll(`[data-ci="${next}"]`)
        .forEach((el) => el.classList.add("col-hot"));
    }
    hotColumnRef.current = next;
  }

  function highlightColumn(event: React.MouseEvent<HTMLDivElement>) {
    const cell = (event.target as HTMLElement).closest("[data-ci]");
    paintColumn(cell instanceof HTMLElement ? (cell.dataset.ci ?? null) : null);
  }

  function clearColumnHighlight() {
    paintColumn(null);
  }

  const [headerTopHeight, setHeaderTopHeight] = useState(HEADER_TOP_HEIGHT_FALLBACK);

  // Draft vs applied: typing in a filter must not fire a query per keystroke on a report this
  // expensive. The query key reads only from `applied`.
  const emptyDraft = {
    fromDate: '',
    toDate: '',
    docLife: '' as string,
    rowCodeFilter: '',
    columnCodeFilter: '',
  };
  const [initialDraft] = useState(() => ({
    fromDate: url.date('from'),
    toDate: url.date('to'),
    docLife: String(url.oneOf('docLife', [0, 1, 2, 3, 4] as const, 0) || ''),
    rowCodeFilter: url.text('rowCode'),
    columnCodeFilter: url.text('colCode'),
  }));
  const [draft, setDraft] = useState(initialDraft);
  const [applied, setApplied] = useState(initialDraft);

  const report = useQuery({
    queryKey: ['matrix-report', financialYear, rowDimension, columnDimension, applied],
    queryFn: () =>
      matrixReportApi.get({
        year: financialYear,
        rowDimension,
        columnDimension,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        docLife: applied.docLife === '' ? undefined : Number(applied.docLife),
        rowCodeFilter: applied.rowCodeFilter || undefined,
        columnCodeFilter: applied.columnCodeFilter || undefined,
      }),
    enabled: isConfigured,
    placeholderData: (previous) => previous,
  });

  const result = report.data;
  const columns = useMemo(() => result?.columns ?? [], [result]);
  const rows = useMemo(() => result?.rows ?? [], [result]);

  // Anything that changes which rows exist invalidates the current page — page 4 of the old pivot is
  // meaningless against the new one, and landing on an empty page reads as "no data".
  useEffect(() => {
    setPageNumber(1);
  }, [rowDimension, columnDimension, applied, rowsPerPage]);

  const pagedRows = useMemo(
    () => rows.slice((pageNumber - 1) * rowsPerPage, pageNumber * rowsPerPage),
    [rows, pageNumber, rowsPerPage],
  );

  // Layout effect, not a plain one: the offset is read and applied before paint, so the header
  // never flashes with its two rows overlapping. The observer covers the font loading late, or the
  // row changing height when the column set does.
  useLayoutEffect(() => {
    const element = headerTopRef.current;
    if (!element) return;

    const measure = () => setHeaderTopHeight(element.getBoundingClientRect().height);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [columns.length]);

  /**
   * Ranked on total turnover (بدهکار + بستانکار) rather than on the net: a row that moved a large
   * amount both ways and nets to zero is still one of the busiest rows on this axis, and ranking on
   * the net would hide exactly those.
   */
  const topRows = useMemo(
    () =>
      rows.map((row) => ({
        key: row.code,
        code: row.code,
        name: row.name,
        value: row.debtor + row.creditor,
      })),
    [rows],
  );

  const grandDebtor = result?.debtor ?? 0;
  const grandCreditor = result?.creditor ?? 0;
  const isBalanced = grandDebtor === grandCreditor;
  const truncated = result?.columnsTruncated ?? false;

  const rowLabel = matrixDimensionLabel(rowDimension);
  const columnLabel = matrixDimensionLabel(columnDimension);

  const filterLabel = [
    applied.rowCodeFilter ? `فیلتر سطر: ${applied.rowCodeFilter}` : '',
    applied.columnCodeFilter ? `فیلتر ستون: ${applied.columnCodeFilter}` : '',
  ]
    .filter(Boolean)
    .join('   |   ');

  const tiles: StatTile[] = [
    // One tile, not two: «۱۰ سطر × ۸ ستون» is the shape of the pivot and reads as a single fact,
    // and splitting it pushed the balance tile onto a row of its own.
    {
      key: 'shape',
      label: `${rowLabel} × ${columnLabel}`,
      value: `${toPersianDigits(rows.length)} × ${toPersianDigits(columns.length)}`,
      tone: truncated ? 'error' : 'primary',
      hint: truncated
        ? `از ${toPersianDigits(result?.totalColumnCount ?? 0)} ستون موجود، فقط پرگردش‌ترین‌ها نمایش داده شده‌اند`
        : 'سطر × ستون',
    },
    { key: 'debtor', label: 'جمع بدهکار', value: amount(grandDebtor), tone: 'info' },
    { key: 'creditor', label: 'جمع بستانکار', value: amount(grandCreditor), tone: 'warning' },
    {
      key: 'balance',
      label: isBalanced ? 'تراز' : 'اختلاف',
      value: amount(Math.abs(grandDebtor - grandCreditor)),
      tone: isBalanced ? 'success' : 'error',
      hint: isBalanced ? 'بدهکار و بستانکار برابرند' : 'بدهکار و بستانکار برابر نیستند',
    },
  ];

  /**
   * Picking the dimension that is already on the other axis <b>swaps</b> them.
   *
   * The server rejects the two axes being equal with a 400, so the UI has to do something. Blocking
   * the choice would leave the user to work out that they must first move the other axis; swapping
   * is what they meant — «همین را روی سطر ببر» implies the current row dimension goes to the column.
   * The explicit swap button does the same thing without a menu.
   */
  function chooseRowDimension(value: MatrixDimensionValue) {
    if (value === columnDimension) setColumnDimension(rowDimension);
    setRowDimension(value);
  }

  function chooseColumnDimension(value: MatrixDimensionValue) {
    if (value === rowDimension) setRowDimension(columnDimension);
    setColumnDimension(value);
  }

  function swapAxes() {
    setRowDimension(columnDimension);
    setColumnDimension(rowDimension);
  }

  async function handleExcel() {
    if (!result) return;
    try {
      await exportMatrixToExcel(result, {
        year: financialYear,
        fromDate: applied.fromDate,
        toDate: applied.toDate,
        unitLabel,
        filterLabel,
      });
    } catch (error) {
      notify({
        message: error instanceof Error ? error.message : 'ساخت فایل اکسل با خطا مواجه شد.',
        severity: 'error',
      });
    }
  }

  const hasDraftFilters = Object.values(draft).some((v) => v !== '');
  const hasAppliedFilters = Object.values(applied).some((v) => v !== '');

  /** Total column count of the rendered table: two frozen + a بدهکار/بستانکار pair per column + the row total pair. */
  const tableColumnCount = 2 + columns.length * 2 + 2;

  function renderDimensionSelect(
    label: string,
    value: MatrixDimensionValue,
    onPick: (value: MatrixDimensionValue) => void,
  ) {
    return (
      <TextField
        select
        size="small"
        label={label}
        value={value}
        onChange={(e) => onPick(Number(e.target.value) as MatrixDimensionValue)}
        sx={{ minWidth: 178 }}
      >
        <ListSubheader>سطوح کدینگ</ListSubheader>
        {MATRIX_CODING_DIMENSIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
        <ListSubheader>سطوح تفصیلی</ListSubheader>
        {MATRIX_TAFSILI_DIMENSIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  return (
    <section>
      <style>{MATRIX_REPORT_PRINT_STYLES}</style>

      <Box className="matrix-report-no-print">
        <PageHeader
          icon={<PivotTableChartOutlinedIcon />}
          title="گزارش ماتریسی"
          description="گردش اسناد در تقاطع دو بُعد: یکی روی سطر، یکی روی ستون، با بدهکار و بستانکار در هر خانه."
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
        <ReportUnitScopeBar />

        {!isConfigured && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2">
              برای دیدن گزارش، ابتدا سال مالی را از نوار بالای صفحه انتخاب کنید.
            </Typography>
          </Paper>
        )}

        {/* The two axis pickers are this page's primary control — they are the report's question,
            not a filter on it. */}
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ alignItems: { md: 'center' } }}
          >
            {renderDimensionSelect('بُعد سطر', rowDimension, chooseRowDimension)}

            <Tooltip title="جابه‌جایی محورها">
              <Button
                size="small"
                variant="outlined"
                onClick={swapAxes}
                sx={{ minWidth: 44, px: 1 }}
                aria-label="جابه‌جایی محورها"
              >
                <SwapHorizOutlinedIcon fontSize="small" />
              </Button>
            </Tooltip>

            {renderDimensionSelect('بُعد ستون', columnDimension, chooseColumnDimension)}

            <Chip size="small" color="primary" label={`${rowLabel} × ${columnLabel}`} />

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

              {/* The reference system's «فیلتر سطر» / «فیلتر ستون», one field each. Both are
                  «شروع با» on the code of that axis — and narrowing the columns is the real answer
                  to a pivot that is too wide, rather than asking for more columns. */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  size="small"
                  label={`فیلتر سطر: کد ${rowLabel} شروع با`}
                  value={draft.rowCodeFilter}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, rowCodeFilter: toLatinDigits(e.target.value) }))
                  }
                  slotProps={{ htmlInput: { maxLength: 15 } }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label={`فیلتر ستون: کد ${columnLabel} شروع با`}
                  value={draft.columnCodeFilter}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, columnCodeFilter: toLatinDigits(e.target.value) }))
                  }
                  slotProps={{ htmlInput: { maxLength: 15 } }}
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

        {report.isError && <ErrorBanner error={report.error} />}
      </Box>

      {/* The truncation notice prints too. The backend keeps the grand totals over the whole
          filtered set on purpose — rebasing them onto the visible slice would make a cut-down
          report look complete — so the figures genuinely disagree and the reader has to be told,
          on paper as much as on screen. */}
      {truncated && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>گزارش بریده شده است</AlertTitle>
          از {toPersianDigits(result?.totalColumnCount ?? 0)} مقدارِ «{columnLabel}» در این بازه، تنها{' '}
          {toPersianDigits(columns.length)} ستونِ پرگردش‌تر نمایش داده شده است. <b>جمع کل، کل دادهٔ
          فیلترشده را پوشش می‌دهد؛ ستون‌های دیده‌شده نه</b>. پس جمع سطرها و ستون‌های این جدول با جمع کل
          برابر نخواهد بود. برای گزارشی که جمع‌هایش با هم بخوانند، با «فیلتر ستون» دامنه را باریک‌تر
          کنید.
        </Alert>
      )}

      <Box className="matrix-report-no-print">
        <CollapsibleMagnitudeChart
          label="نمودار ردیف‌های پرگردش"
          title={`بزرگ‌ترین مقادیر ${rowLabel}`}
          caption="مجموع گردش بدهکار و بستانکار در همهٔ ستون‌ها، بر اساس همین فیلترها"
          items={topRows}
        />
      </Box>

      <Box id="matrix-report-print-root">
        {/* Printed-only heading: on screen the PageHeader and the axis chip already say all of this. */}
        <Box sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}>
          <Typography variant="h2">
            گزارش ماتریسی، سطر: {rowLabel} × ستون: {columnLabel}
          </Typography>
          <Typography variant="body2">
            واحد: {unitLabel || '—'} | سال مالی: {toPersianDigits(financialYear || '—')}
            {filterLabel ? ` | ${filterLabel}` : ''}
          </Typography>
        </Box>

        <Paper variant="outlined">
          <Box
            className="matrix-report-no-print"
            sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}
          >
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
                {toPersianDigits(rows.length)} سطر × {toPersianDigits(columns.length)} ستون
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              ۰ یعنی در آن تقاطع گردشی ثبت نشده است.
            </Typography>
          </Box>

          {/* Scrolls in both directions inside a bounded box: a pivot is wide by nature, and letting
              the page scroll horizontally instead would take the frozen columns with it. */}
          {/* Scrolls in both directions inside a bounded box: a pivot is wide by nature, and letting
              the page scroll horizontally instead would take the frozen columns with it.

              The mouse handlers drive the column half of the crosshair — see `highlightColumn`. */}
          <TableContainer
            className="matrix-scroll"
            ref={scrollRef}
            onMouseOver={highlightColumn}
            onMouseLeave={clearColumnHighlight}
            sx={{ overflow: 'auto', maxHeight: '64vh' }}
          >
            <Table
              size="small"
              sx={{
                '& td, & th': { whiteSpace: 'nowrap' },
                // Row half of the crosshair, in CSS so it costs nothing. It replaces the zebra on
                // the hovered line rather than stacking on it, which is what makes that one row read
                // as a single continuous band across a very wide grid.
                '& tbody tr:hover td': {
                  backgroundImage: (theme) => tintLayer(theme, ROW_HOT_ALPHA),
                },
                // Column half. An inset shadow, not a background, precisely so it composites over
                // whatever banding the cell already carries instead of replacing it — including the
                // hovered row, so the intersection is the darkest cell on screen.
                // ⚠️ Two traps here. First, an overlay pseudo-element and NOT `box-shadow`: a table with
                // `border-collapse: collapse` — MUI's default, and what gives this grid its
                // single-pixel rules — does not paint box-shadow on its cells at all, so the
                // first attempt produced no highlight and read as a dead event handler. Second,
                // this rule must NOT set `position`, because the header cells it also matches are
                // `position: sticky` — overriding that to `relative` unpinned them and dropped
                // «بدهکار»/«بستانکار» out of the header into the first data row. Sticky is already a
                // containing block; only the plain body cells need to declare `relative`, and they
                // do it themselves below.
                '& .col-hot::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  backgroundColor: (theme) => alpha(theme.palette.text.primary, COLUMN_HOT_ALPHA),
                },
              }}
            >
              <TableHead>
                {/* Upper header: one cell per column dimension value, spanning its own pair. */}
                <TableRow ref={headerTopRef}>
                  <TableCell
                    rowSpan={2}
                    sx={{
                      ...frozenCell(0, 5),
                      top: 0,
                      width: CODE_COLUMN_WIDTH,
                      minWidth: CODE_COLUMN_WIDTH,
                    }}
                  >
                    کد {rowLabel}
                  </TableCell>
                  <TableCell
                    rowSpan={2}
                    sx={{
                      ...frozenCell(CODE_COLUMN_WIDTH, 5),
                      top: 0,
                      width: NAME_COLUMN_WIDTH,
                      minWidth: NAME_COLUMN_WIDTH,
                      borderInlineEnd: sectionSeparator,
                    }}
                  >
                    عنوان {rowLabel}
                  </TableCell>

                  {columns.map((column, index) => (
                    <TableCell
                      key={column.code}
                      data-ci={index}
                      colSpan={2}
                      align="center"
                      sx={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 3,
                        backgroundColor: 'background.paper',
                        backgroundImage: (theme) => bandedCell(theme, 0, index),
                        borderInlineStart: groupSeparator,
                      }}
                    >
                      <Stack spacing={0} sx={{ alignItems: 'center' }}>
                        <MonoCode value={column.code} />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {column.name || '—'}
                        </Typography>
                      </Stack>
                    </TableCell>
                  ))}

                  <TableCell
                    colSpan={2}
                    align="center"
                    sx={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 3,
                      backgroundColor: 'background.paper',
                      backgroundImage: (theme) => STICKY_TINT(theme),
                      borderInlineStart: sectionSeparator,
                      fontWeight: 700,
                    }}
                  >
                    جمع سطر
                  </TableCell>
                </TableRow>

                {/* Lower header: the بدهکار/بستانکار pair under every column. Offset by the upper
                    row's height so both stay visible while the body scrolls.

                    Each label carries a 3px rule in its own series colour — the same two hues the
                    balance bar and every other report use for these two entities. The word is still
                    there, so identity never rests on colour alone; the rule is what lets the eye
                    find «کدام ستون بدهکار بود» after scrolling sideways past a dozen groups. */}
                <TableRow>
                  {columns.flatMap((column, index) =>
                    SIDES.map((side, sideIndex) => (
                      <TableCell
                        key={`${column.code}-${side.key}`}
                        data-ci={index}
                        align="left"
                        sx={{
                          position: 'sticky',
                          top: headerTopHeight,
                          zIndex: 3,
                          backgroundColor: 'background.paper',
                          backgroundImage: (theme) => bandedCell(theme, 0, index),
                          borderInlineStart: sideIndex === 0 ? groupSeparator : 'none',
                          borderBottom: `3px solid ${side.color}`,
                          fontWeight: 500,
                          color: 'text.secondary',
                        }}
                      >
                        {side.label}
                      </TableCell>
                    )),
                  )}

                  {SIDES.map((side, sideIndex) => (
                    <TableCell
                      key={`total-${side.key}`}
                      align="left"
                      sx={{
                        position: 'sticky',
                        top: headerTopHeight,
                        zIndex: 3,
                        backgroundColor: 'background.paper',
                        backgroundImage: (theme) => STICKY_TINT(theme),
                        borderInlineStart: sideIndex === 0 ? sectionSeparator : 'none',
                        borderBottom: `3px solid ${side.color}`,
                        fontWeight: 700,
                      }}
                    >
                      {side.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {report.isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!report.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={Math.max(tableColumnCount, 4)}
                      align="center"
                      sx={{ py: 5, color: 'text.secondary' }}
                    >
                      {!isConfigured
                        ? 'سال مالی انتخاب نشده است.'
                        : 'برای این دو بُعد و این بازه، گردشی ثبت نشده است.'}
                    </TableCell>
                  </TableRow>
                )}

                {!report.isLoading &&
                  pagedRows.map((row, rowIndex) => {
                    // Built once per row: the cells arrive as a sparse array, so looking each column
                    // up by scanning it would be O(rows × columns × cells).
                    const lookup = cellsByColumn(row);
                    const banding = (columnIndex: number) => (theme: Theme) =>
                      bandedCell(theme, rowIndex, columnIndex);

                    return (
                      <TableRow key={row.code}>
                        <TableCell
                          sx={{ ...frozenCell(0, 2), backgroundImage: banding(0) }}
                        >
                          <MonoCode value={row.code} />
                        </TableCell>
                        <TableCell
                          sx={{
                            ...frozenCell(CODE_COLUMN_WIDTH, 2),
                            backgroundImage: banding(0),
                            maxWidth: NAME_COLUMN_WIDTH,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            borderInlineEnd: sectionSeparator,
                          }}
                          title={row.name || undefined}
                        >
                          {row.name || '—'}
                        </TableCell>

                        {columns.flatMap((column, index) => {
                          const cell = lookup.get(column.code);

                          // A native `title` rather than an MUI Tooltip: at 120 columns a page of
                          // rows is thousands of cells, and mounting a Tooltip per cell costs far
                          // more than the hover layer is worth. The charts above keep real tooltips.
                          const hover = cell
                            ? `${row.name || row.code} × ${column.name || column.code}\nبدهکار: ${amount(cell.debtor)}\nبستانکار: ${amount(cell.creditor)}`
                            : undefined;

                          return SIDES.map((side, sideIndex) => {
                            const value = cell?.[side.key] ?? 0;
                            return (
                              <TableCell
                                key={`${column.code}-${side.key}`}
                                data-ci={index}
                                align="left"
                                title={hover}
                                sx={{
                                  // Containing block for the column-highlight overlay — see the
                                  // `.col-hot::after` rule on the table.
                                  position: 'relative',
                                  backgroundImage: banding(index),
                                  borderInlineStart: sideIndex === 0 ? groupSeparator : 'none',
                                  fontVariantNumeric: 'tabular-nums',
                                  // Text wears text tokens. The series colours identify the two
                                  // sub-columns in the header; painting the figures with them too
                                  // would make a wall of coloured numbers and destroy the contrast
                                  // the budget above exists to protect.
                                  //
                                  // A zero still reads as recessive: an empty intersection is a
                                  // real ۰, but printing thousands of them at full ink weight
                                  // would bury the figures that carry the report.
                                  color: value ? 'text.primary' : 'text.disabled',
                                }}
                              >
                                {amount(value)}
                              </TableCell>
                            );
                          });
                        })}

                        {SIDES.map((side, sideIndex) => (
                          <TableCell
                            key={`row-total-${side.key}`}
                            align="left"
                            sx={{
                              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                              borderInlineStart: sideIndex === 0 ? sectionSeparator : 'none',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {amount(row[side.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
              </TableBody>

              {rows.length > 0 && (
                <TableBody>
                  {/* ⚠️ The shared style is spread into every cell rather than written once as
                      `'& td'` on the row. A descendant selector outranks a cell's own class, so a
                      row-level rule silently overrode the frozen corner cell's z-index and the
                      label «جمع ستون» disappeared behind the amount cells scrolled over it. Same
                      specificity for every cell keeps the last spread winning, which is what the
                      code here reads as. */}
                  <TableRow>
                    {/* Column totals are the server's, over every row of the report — never a sum
                        of the visible page. */}
                    <TableCell
                      colSpan={2}
                      sx={{
                        ...totalsCellSx,
                        ...frozenCell(0, 6),
                        ...totalsSurfaceSx,
                        borderInlineEnd: sectionSeparator,
                      }}
                    >
                      جمع ستون ({toPersianDigits(rows.length)} سطر)
                    </TableCell>

                    {columns.flatMap((column, index) =>
                      SIDES.map((side, sideIndex) => (
                        <TableCell
                          key={`${column.code}-total-${side.key}`}
                          data-ci={index}
                          align="left"
                          sx={{
                            ...totalsCellSx,
                            borderInlineStart: sideIndex === 0 ? groupSeparator : 'none',
                          }}
                        >
                          {amount(column[side.key])}
                        </TableCell>
                      )),
                    )}

                    {SIDES.map((side, sideIndex) => (
                      <TableCell
                        key={`grand-${side.key}`}
                        align="left"
                        sx={{
                          ...totalsCellSx,
                          borderInlineStart: sideIndex === 0 ? sectionSeparator : 'none',
                        }}
                      >
                        {amount(side.key === 'debtor' ? grandDebtor : grandCreditor)}
                      </TableCell>
                    ))}
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
          onPageSizeChange={setRowsPerPage}
          pageSizeOptions={ROWS_PER_PAGE_OPTIONS}
        />
      </Box>
    </section>
  );
}
