import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import GlobalStyles from '@mui/material/GlobalStyles';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import TableViewOutlinedIcon from '@mui/icons-material/TableViewOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { StatTiles, type StatTile } from '../../../components/StatTiles';
import { useNotify } from '../../../lib/notifications/NotificationProvider';
import { useSession } from '../../../lib/session/SessionContext';
import { formatThousands, toPersianDigits, normalizeNumericInput } from '../../../lib/format/numbers';
import { trialBalanceApi } from './api';
import { emptyTotals, sumTotals } from './columns';
import { describePeriod, exportToExcel, exportToPdf, type ReportContext } from './export';
import { TRIAL_BALANCE_PRINT_STYLES } from './printStyles';
import { TrialBalanceTable } from './TrialBalanceTable';
import {
  DOC_LIFE_FILTER_OPTIONS,
  SEARCH_OPERATOR,
  TRIAL_BALANCE_FIELD,
  TRIAL_BALANCE_LEVEL,
  TRIAL_BALANCE_LEVEL_LABELS,
  type SearchParam,
  type TrialBalanceLevel,
  type TrialBalanceVariant,
} from '../../../types/trialBalance';

const VARIANTS: { value: TrialBalanceVariant; label: string; hint: string }[] = [
  { value: 4, label: '۴ ستونی', hint: 'گردش و مانده' },
  { value: 6, label: '۶ ستونی', hint: '+ اول دوره' },
  { value: 8, label: '۸ ستونی', hint: '+ جمع کل' },
];

export function TrialBalancePage() {
  const { financialYear, unitLabel, isConfigured } = useSession();
  const notify = useNotify();

  const [variant, setVariant] = useState<TrialBalanceVariant>(4);
  const [level, setLevel] = useState<TrialBalanceLevel>(TRIAL_BALANCE_LEVEL.Moin);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [docLife, setDocLife] = useState<number | ''>('');
  const [codeFilter, setCodeFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // The filters being typed are not the filters the report was run with. Holding the applied set
  // separately keeps the report from re-querying on every keystroke and gives "اعمال فیلتر"
  // something to mean.
  const [applied, setApplied] = useState({
    fromDate: '',
    toDate: '',
    docLife: '' as number | '',
    code: '',
  });

  /**
   * Account-code filtering is server-side, in the backend's generic `SearchParam` shape, so the
   * clause reaches the `WHERE` of the aggregate query instead of trimming rows already computed.
   * `property` is a logical field name the backend allowlists — never a column name.
   */
  const filters = useMemo<SearchParam[]>(() => {
    const term = applied.code.trim();
    if (!term) return [];
    return [{ property: TRIAL_BALANCE_FIELD.Code, operator: SEARCH_OPERATOR.LIKE, value: term }];
  }, [applied.code]);

  const query = useQuery({
    queryKey: [
      'trial-balance',
      variant,
      financialYear,
      level,
      applied.fromDate,
      applied.toDate,
      applied.docLife,
      applied.code,
    ],
    queryFn: () =>
      trialBalanceApi.get(variant, {
        year: financialYear,
        level,
        fromDate: applied.fromDate || undefined,
        toDate: applied.toDate || undefined,
        docLife: applied.docLife === '' ? undefined : applied.docLife,
        filters: filters.length > 0 ? filters : undefined,
      }),
    enabled: isConfigured,
    placeholderData: (previous) => previous,
  });

  const rows = query.data ?? [];
  const totals = useMemo(() => (rows.length > 0 ? sumTotals(rows) : emptyTotals()), [rows]);

  // A trial balance that does not balance is the most useful thing this page can say, and the
  // backend guarantees nothing of the sort (open risk #3) — so it is measured, not assumed.
  const difference = totals.debtor - totals.creditor;
  const isBalanced = rows.length > 0 && difference === 0;

  const docLifeLabel =
    docLife === ''
      ? 'همهٔ وضعیت‌ها'
      : (DOC_LIFE_FILTER_OPTIONS.find((o) => o.value === applied.docLife)?.label ?? '—');

  const context: ReportContext = {
    variant,
    level,
    year: financialYear,
    fromDate: applied.fromDate,
    toDate: applied.toDate,
    docLifeLabel,
    codeFilter: applied.code,
    unitLabel,
  };

  const tiles: StatTile[] = [
    { key: 'rows', label: 'تعداد حساب', value: rows.length, tone: 'info' },
    { key: 'debtor', label: 'جمع گردش بدهکار', value: formatThousands(totals.debtor), tone: 'primary' },
    { key: 'creditor', label: 'جمع گردش بستانکار', value: formatThousands(totals.creditor), tone: 'secondary' },
    {
      key: 'diff',
      label: isBalanced ? 'وضعیت تراز' : 'اختلاف',
      value: isBalanced ? 'تراز است' : formatThousands(Math.abs(difference)),
      tone: isBalanced ? 'success' : 'error',
      hint: isBalanced ? 'بدهکار و بستانکار برابرند' : 'بدهکار و بستانکار برابر نیستند',
    },
  ];

  function applyFilters() {
    setApplied({ fromDate, toDate, docLife, code: normalizeNumericInput(codeFilter) });
  }

  function resetFilters() {
    setFromDate('');
    setToDate('');
    setDocLife('');
    setCodeFilter('');
    setApplied({ fromDate: '', toDate: '', docLife: '', code: '' });
  }

  async function handleExcel() {
    setIsExporting(true);
    try {
      await exportToExcel(rows, totals, context);
    } catch {
      // ExcelJS is fetched on demand, so this can fail on a bad connection as well as on a bug.
      // Silence would look like a dead button.
      notify('ساخت فایل اکسل ناموفق بود.');
    } finally {
      setIsExporting(false);
    }
  }

  const hasPendingChanges =
    fromDate !== applied.fromDate ||
    toDate !== applied.toDate ||
    docLife !== applied.docLife ||
    normalizeNumericInput(codeFilter) !== applied.code;

  const hasRows = rows.length > 0;

  return (
    <>
      <GlobalStyles styles={TRIAL_BALANCE_PRINT_STYLES} />

      <Stack spacing={2.5}>
        <Box className="tb-no-print">
          <PageHeader
            eyebrow="گزارش‌ها"
            icon={<BarChartOutlinedIcon fontSize="small" />}
            accentColor="warning"
            title="تراز آزمایشی"
            description="گردش و مانده حساب‌ها در بازهٔ انتخابی، به تفکیک سطح کدینگ"
            actions={
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<TableViewOutlinedIcon />}
                  onClick={handleExcel}
                  disabled={!hasRows || isExporting}
                >
                  خروجی اکسل
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PrintOutlinedIcon />}
                  onClick={exportToPdf}
                  disabled={!hasRows}
                >
                  چاپ / PDF
                </Button>
              </Stack>
            }
          />
        </Box>

        {!isConfigured && (
          <Alert severity="info" className="tb-no-print">
            برای مشاهدهٔ گزارش، ابتدا سال مالی را از نوار بالا انتخاب کنید.
          </Alert>
        )}

        <Paper variant="outlined" className="tb-no-print" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Tabs
            value={variant}
            onChange={(_, next: TrialBalanceVariant) => setVariant(next)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
          >
            {VARIANTS.map((item) => (
              <Tab
                key={item.value}
                value={item.value}
                label={
                  <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {item.hint}
                    </Typography>
                  </Stack>
                }
              />
            ))}
          </Tabs>

          <Box sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{ alignItems: { md: 'flex-end' }, flexWrap: 'wrap' }}
            >
              <TextField
                select
                size="small"
                label="سطح کدینگ"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value) as TrialBalanceLevel)}
                sx={{ minWidth: 130 }}
              >
                {Object.entries(TRIAL_BALANCE_LEVEL_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={Number(value)}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                size="small"
                label="کد حساب"
                placeholder="مثلاً ۱۱۰۴"
                value={toPersianDigits(codeFilter)}
                onChange={(e) => setCodeFilter(normalizeNumericInput(e.target.value))}
                sx={{ minWidth: 140 }}
              />

              <TextField
                size="small"
                label="از تاریخ"
                placeholder="۱۴۰۳۰۱۰۱"
                value={toPersianDigits(fromDate)}
                onChange={(e) => setFromDate(normalizeNumericInput(e.target.value).slice(0, 8))}
                sx={{ minWidth: 140 }}
              />

              <TextField
                size="small"
                label="تا تاریخ"
                placeholder="۱۴۰۳۱۲۲۹"
                value={toPersianDigits(toDate)}
                onChange={(e) => setToDate(normalizeNumericInput(e.target.value).slice(0, 8))}
                sx={{ minWidth: 140 }}
              />

              <TextField
                select
                size="small"
                label="وضعیت سند"
                value={docLife}
                onChange={(e) => setDocLife(e.target.value === '' ? '' : Number(e.target.value))}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">همهٔ وضعیت‌ها</MenuItem>
                {DOC_LIFE_FILTER_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<SearchOutlinedIcon />}
                  onClick={applyFilters}
                  disabled={!isConfigured}
                >
                  اعمال فیلتر
                </Button>
                <Button variant="text" startIcon={<RestartAltOutlinedIcon />} onClick={resetFilters}>
                  پاک‌سازی
                </Button>
              </Stack>
            </Stack>

            {hasPendingChanges && (
              <Typography variant="caption" sx={{ color: 'warning.main', display: 'block', mt: 1 }}>
                فیلترها تغییر کرده‌اند — برای اعمال روی گزارش، «اعمال فیلتر» را بزنید.
              </Typography>
            )}
          </Box>
        </Paper>

        {isConfigured && (
          <Box className="tb-no-print">
            <StatTiles tiles={tiles} isLoading={query.isLoading} />
          </Box>
        )}

        {variant >= 6 && (
          <Alert severity="warning" variant="outlined" className="tb-no-print">
            ستون‌های «اول دوره» گردش خام پیش از بازه را نشان می‌دهند، نه ماندهٔ خالص یک‌طرفه. این مطابق
            فرمول پروژهٔ مرجع پیاده شده ولی معنای دقیقش هنوز تأیید نشده است.
          </Alert>
        )}

        {query.isError && (
          <Box className="tb-no-print">
            <ErrorBanner error={query.error} />
          </Box>
        )}

        {/* Everything inside this element is what the printer and the PDF get. */}
        <Box id="trial-balance-print-root">
          {/* Only on paper: a printed report has to carry its own identity, because the sidebar
              and filter panel that explain it on screen are not there. */}
          <Box className="tb-print-only" sx={{ display: 'none', mb: 1.5 }}>
            <Typography variant="h6" align="center" sx={{ fontWeight: 700 }}>
              تراز آزمایشی {VARIANTS.find((v) => v.value === variant)?.label}
            </Typography>
            <Typography variant="body2" align="center" sx={{ color: 'text.secondary' }}>
              {unitLabel ? `واحد ${unitLabel} · ` : ''}سال مالی {toPersianDigits(financialYear)} ·{' '}
              {describePeriod(context)} · سطح {TRIAL_BALANCE_LEVEL_LABELS[level]} · {docLifeLabel}
              {applied.code ? ` · فیلتر کد ${toPersianDigits(applied.code)}` : ''}
            </Typography>
            <Divider sx={{ mt: 1 }} />
          </Box>

          <Box className="tb-scroll">
            <TrialBalanceTable
              rows={rows}
              variant={variant}
              totals={totals}
              isLoading={query.isLoading}
              emptyMessage={
                isConfigured
                  ? 'برای این بازه و سطح، گردشی ثبت نشده است.'
                  : 'ابتدا سال مالی را انتخاب کنید.'
              }
            />
          </Box>

          {hasRows && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 1.5, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
            >
              <Chip
                size="small"
                color={isBalanced ? 'success' : 'error'}
                variant={isBalanced ? 'filled' : 'outlined'}
                label={
                  isBalanced
                    ? 'تراز است — جمع بدهکار و بستانکار برابرند'
                    : `ناتراز — اختلاف ${formatThousands(Math.abs(difference))}`
                }
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {toPersianDigits(rows.length)} حساب در سطح {TRIAL_BALANCE_LEVEL_LABELS[level]}
              </Typography>
            </Stack>
          )}
        </Box>
      </Stack>
    </>
  );
}
