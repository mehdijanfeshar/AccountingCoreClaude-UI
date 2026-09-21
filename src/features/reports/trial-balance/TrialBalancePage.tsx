import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import { PageHeader } from '../../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { ListToolbar } from '../../../components/ListToolbar';
import { MonoCode } from '../../../components/MonoCode';
import { StatTiles, type StatTile } from '../../../components/StatTiles';
import { useSession } from '../../../lib/session/SessionContext';
import { formatThousands, toPersianDigits, normalizeNumericInput } from '../../../lib/format/numbers';
import { trialBalanceApi } from './api';
import {
  DOC_LIFE_FILTER_OPTIONS,
  SEARCH_OPERATOR,
  TRIAL_BALANCE_FIELD,
  TRIAL_BALANCE_LEVEL,
  TRIAL_BALANCE_LEVEL_LABELS,
  type SearchParam,
  type TrialBalanceLevel,
  type TrialBalanceRow,
  type TrialBalanceVariant,
} from '../../../types/trialBalance';

const VARIANTS: { value: TrialBalanceVariant; label: string; hint: string }[] = [
  { value: 4, label: '۴ ستونی', hint: 'گردش و مانده دوره' },
  { value: 6, label: '۶ ستونی', hint: '+ اول دوره' },
  { value: 8, label: '۸ ستونی', hint: '+ جمع کل' },
];

/** A zero cell is noise in a report this dense; only real figures earn ink. */
function Amount({ value }: { value: number | undefined }) {
  if (!value) {
    return (
      <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
        —
      </Typography>
    );
  }

  return (
    <Typography component="span" variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatThousands(value)}
    </Typography>
  );
}

export function TrialBalancePage() {
  const { financialYear, isConfigured } = useSession();

  const [variant, setVariant] = useState<TrialBalanceVariant>(4);
  const [level, setLevel] = useState<TrialBalanceLevel>(TRIAL_BALANCE_LEVEL.Moin);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [docLife, setDocLife] = useState<number | ''>('');
  const [codeFilter, setCodeFilter] = useState('');

  // The filters the user is typing are not the filters the report was run with. Holding the
  // applied set separately keeps the table from re-querying on every keystroke and makes the
  // "اعمال فیلتر" button mean something.
  const [applied, setApplied] = useState({
    fromDate: '',
    toDate: '',
    docLife: '' as number | '',
    code: '',
  });

  /**
   * Account-code filtering is server-side, expressed in the backend's generic `SearchParam` shape.
   * It used to run here on rows already fetched, which meant the entire report was computed and
   * sent before being narrowed; the clause now reaches the `WHERE` of the aggregate query.
   *
   * `property` is a logical field name the backend allowlists — never a column name — so this
   * cannot be turned into a filter on something the report does not mean to expose.
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

  const visibleRows = query.data ?? [];

  const totals = useMemo(() => {
    return visibleRows.reduce(
      (acc, row) => ({
        debtor: acc.debtor + row.debtor,
        creditor: acc.creditor + row.creditor,
        debtorBalance: acc.debtorBalance + row.debtorBalance,
        creditorBalance: acc.creditorBalance + row.creditorBalance,
        firstDebtor: acc.firstDebtor + (row.firstDebtor ?? 0),
        firstCreditor: acc.firstCreditor + (row.firstCreditor ?? 0),
        totDebtor: acc.totDebtor + (row.totDebtor ?? 0),
        totCreditor: acc.totCreditor + (row.totCreditor ?? 0),
      }),
      {
        debtor: 0,
        creditor: 0,
        debtorBalance: 0,
        creditorBalance: 0,
        firstDebtor: 0,
        firstCreditor: 0,
        totDebtor: 0,
        totCreditor: 0,
      },
    );
  }, [visibleRows]);

  // A trial balance that does not balance is the single most useful thing this page can tell an
  // accountant, and this system has no server-side guarantee of it (open risk #3) — so the answer
  // is computed and shown rather than assumed.
  const difference = totals.debtor - totals.creditor;
  const isBalanced = visibleRows.length > 0 && difference === 0;

  const columns = useMemo<DataTableColumn<TrialBalanceRow>[]>(() => {
    const base: DataTableColumn<TrialBalanceRow>[] = [
      {
        key: 'code',
        header: 'کد حساب',
        width: 140,
        render: (row) => <MonoCode value={row.code} />,
      },
      {
        key: 'description',
        header: 'شرح',
        render: (row) =>
          row.description ?? (
            <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
              بدون شرح
            </Typography>
          ),
      },
    ];

    if (variant >= 6) {
      base.push(
        {
          key: 'firstDebtor',
          header: 'بدهکار اول دوره',
          align: 'end',
          render: (row) => <Amount value={row.firstDebtor} />,
        },
        {
          key: 'firstCreditor',
          header: 'بستانکار اول دوره',
          align: 'end',
          render: (row) => <Amount value={row.firstCreditor} />,
        },
      );
    }

    base.push(
      { key: 'debtor', header: 'گردش بدهکار', align: 'end', render: (row) => <Amount value={row.debtor} /> },
      { key: 'creditor', header: 'گردش بستانکار', align: 'end', render: (row) => <Amount value={row.creditor} /> },
    );

    if (variant >= 8) {
      base.push(
        { key: 'totDebtor', header: 'جمع بدهکار', align: 'end', render: (row) => <Amount value={row.totDebtor} /> },
        {
          key: 'totCreditor',
          header: 'جمع بستانکار',
          align: 'end',
          render: (row) => <Amount value={row.totCreditor} />,
        },
      );
    }

    base.push(
      {
        key: 'debtorBalance',
        header: 'مانده بدهکار',
        align: 'end',
        render: (row) => <Amount value={row.debtorBalance} />,
      },
      {
        key: 'creditorBalance',
        header: 'مانده بستانکار',
        align: 'end',
        render: (row) => <Amount value={row.creditorBalance} />,
      },
    );

    return base;
  }, [variant]);

  const tiles: StatTile[] = [
    { key: 'rows', label: 'تعداد حساب', value: visibleRows.length, tone: 'info' },
    { key: 'debtor', label: 'جمع گردش بدهکار', value: formatThousands(totals.debtor), tone: 'primary' },
    { key: 'creditor', label: 'جمع گردش بستانکار', value: formatThousands(totals.creditor), tone: 'secondary' },
    {
      key: 'diff',
      label: 'اختلاف',
      value: formatThousands(Math.abs(difference)),
      tone: isBalanced ? 'success' : 'error',
      hint: isBalanced ? 'تراز است' : 'بدهکار و بستانکار برابر نیستند',
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

  const hasPendingChanges =
    fromDate !== applied.fromDate ||
    toDate !== applied.toDate ||
    docLife !== applied.docLife ||
    normalizeNumericInput(codeFilter) !== applied.code;

  return (
    <Stack spacing={2.5}>
      <PageHeader
        eyebrow="گزارش‌ها"
        icon={<BarChartOutlinedIcon fontSize="small" />}
        accentColor="warning"
        title="تراز آزمایشی"
        description="گردش و مانده حساب‌ها در بازهٔ انتخابی، به تفکیک سطح کدینگ"
      />

      {!isConfigured && (
        <Alert severity="info">
          برای مشاهدهٔ گزارش، ابتدا سال مالی را از نوار بالا انتخاب کنید.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
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
                <Stack spacing={0.25} sx={{ alignItems: "center" }}>
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
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ alignItems: { md: "flex-end" } }}
          >
            <TextField
              select
              size="small"
              label="سطح کدینگ"
              value={level}
              onChange={(e) => setLevel(Number(e.target.value) as TrialBalanceLevel)}
              sx={{ minWidth: 140 }}
            >
              {Object.entries(TRIAL_BALANCE_LEVEL_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={Number(value)}>
                  {label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              label="از تاریخ"
              placeholder="۱۴۰۳۰۱۰۱"
              value={toPersianDigits(fromDate)}
              onChange={(e) => setFromDate(normalizeNumericInput(e.target.value).slice(0, 8))}
              sx={{ minWidth: 150 }}
            />

            <TextField
              size="small"
              label="تا تاریخ"
              placeholder="۱۴۰۳۱۲۲۹"
              value={toPersianDigits(toDate)}
              onChange={(e) => setToDate(normalizeNumericInput(e.target.value).slice(0, 8))}
              sx={{ minWidth: 150 }}
            />

            <TextField
              select
              size="small"
              label="وضعیت سند"
              value={docLife}
              onChange={(e) => setDocLife(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{ minWidth: 190 }}
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

      {isConfigured && <StatTiles tiles={tiles} isLoading={query.isLoading} />}

      {variant >= 6 && (
        <Alert severity="warning" variant="outlined">
          ستون‌های «اول دوره» گردش خام پیش از بازه را نشان می‌دهند، نه ماندهٔ خالص یک‌طرفه. این مطابق
          فرمول پروژهٔ مرجع پیاده شده ولی معنای دقیقش هنوز تأیید نشده است.
        </Alert>
      )}

      {query.isError && <ErrorBanner error={query.error} />}

      <ListToolbar
        search={codeFilter}
        onSearchChange={setCodeFilter}
        searchLabel="جست‌وجوی کد حساب (با «اعمال فیلتر»)"
        summary={
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {/*
              A plain row count, not "x از y". The server now returns only matching rows, so the
              unfiltered total is no longer known here — and claiming one would be inventing it.
            */}
            <Chip size="small" variant="outlined" label={`${toPersianDigits(visibleRows.length)} ردیف`} />
            {applied.code && (
              <Chip size="small" color="info" variant="outlined" label={`کد: ${toPersianDigits(applied.code)}`} />
            )}
            <Chip
              size="small"
              color={isBalanced ? 'success' : 'default'}
              variant={isBalanced ? 'filled' : 'outlined'}
              label={isBalanced ? 'تراز' : 'ناتراز'}
            />
          </Stack>
        }
      />

      <DataTable
        columns={columns}
        rows={visibleRows}
        getRowKey={(row) => row.code}
        isLoading={query.isLoading}
        emptyMessage={
          isConfigured ? 'برای این بازه و سطح، گردشی ثبت نشده است.' : 'ابتدا سال مالی را انتخاب کنید.'
        }
      />

      {visibleRows.length > 0 && (
        <Paper
          variant="outlined"
          sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', borderStyle: 'dashed' }}
        >
          <Stack
            direction="row"
            spacing={3}
            sx={{ justifyContent: "flex-end", flexWrap: "wrap", fontVariantNumeric: "tabular-nums" }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              جمع کل:
            </Typography>
            {variant >= 6 && (
              <>
                <Typography variant="body2">اول دوره بدهکار: {formatThousands(totals.firstDebtor)}</Typography>
                <Typography variant="body2">
                  اول دوره بستانکار: {formatThousands(totals.firstCreditor)}
                </Typography>
              </>
            )}
            <Typography variant="body2">گردش بدهکار: {formatThousands(totals.debtor)}</Typography>
            <Typography variant="body2">گردش بستانکار: {formatThousands(totals.creditor)}</Typography>
            <Typography variant="body2">مانده بدهکار: {formatThousands(totals.debtorBalance)}</Typography>
            <Typography variant="body2">
              مانده بستانکار: {formatThousands(totals.creditorBalance)}
            </Typography>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
