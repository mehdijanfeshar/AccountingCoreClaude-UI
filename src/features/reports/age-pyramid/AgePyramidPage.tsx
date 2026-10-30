import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import StackedBarChartOutlinedIcon from '@mui/icons-material/StackedBarChartOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { MonoCode } from '../../../components/MonoCode';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { AccountMultiSelect } from '../_shared/AccountMultiSelect';
import { useSession } from '../../../lib/session/SessionContext';
import { formatThousands, toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { agePyramidApi, type AgePyramidRowDto } from './api';
import type { AccountCodeDto } from '../../../types/accountCode';

interface Draft {
  accounts: AccountCodeDto[];
  fromIdentifier: string;
  toIdentifier: string;
}

const EMPTY_DRAFT: Draft = { accounts: [], fromIdentifier: '', toIdentifier: '' };

function money(v: number): string {
  return v ? toPersianDigits(formatThousands(v)) : '—';
}

/**
 * هرم سنی (تصمیم صاحب پروژه ۲۰۲۶-۱۰-۲۹، `GET /api/reports/age-pyramid`) — برخلاف نسخهٔ اولِ این
 * صفحه، مانده‌ی یک‌ساله نیست: برای هر (معین شناسهٔدار، شناسه) که سنش در سال انتخابی حداکثر ۱۰ سال
 * است (نه بیشتر — تصحیح صاحب پروژه ۲۰۲۶-۱۰-۲۹ روی تصمیم اولیهٔ «۱۰ سال یا بیشتر»)، سالِ شروع و ماندهٔ
 * تجمعی هر سال از شروع تا سال گزارش را نشان می‌دهد — ستون‌های سال به‌صورت پویا از خودِ نتیجه ساخته
 * می‌شوند (اتحاد سال‌های همهٔ ردیف‌ها)؛ شناسه‌ای که دیرتر شروع شده، سلول‌های سال‌های پیش از شروعش را
 * خالی نشان می‌دهد — همین شکلِ «هرم» را به جدول می‌دهد.
 */
export function AgePyramidPage() {
  const { financialYear, unitLabel, isConfigured } = useSession();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [applied, setApplied] = useState<Draft>(EMPTY_DRAFT);

  const filter = {
    year: financialYear,
    accountIds: applied.accounts.map((a) => a.id),
    fromIdentifier: toLatinDigits(applied.fromIdentifier) || undefined,
    toIdentifier: toLatinDigits(applied.toIdentifier) || undefined,
  };

  const query = useQuery({
    queryKey: ['age-pyramid-report', filter],
    queryFn: () => agePyramidApi.get(filter),
    enabled: isConfigured && !!financialYear,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setApplied(draft);
  }

  function clear() {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
  }

  const rows = query.data ?? [];

  // اتحاد سال‌های همهٔ ردیف‌ها، صعودی — چون همه تا یک سال گزارش ادامه دارند ولی از سال‌های متفاوت شروع
  // شده‌اند، این یک بازهٔ پیوسته از قدیمی‌ترین سالِ شروع تا سال گزارش است.
  const years = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.yearly.forEach((y) => set.add(y.year)));
    return Array.from(set).sort();
  }, [rows]);

  const columns: DataTableColumn<AgePyramidRowDto>[] = [
    { key: 'accCode', header: 'کد معین', width: 110, frozen: true, render: (r) => <MonoCode value={r.accCode} /> },
    { key: 'accName', header: 'نام معین', width: 160, frozen: true, render: (r) => r.accName ?? '—' },
    { key: 'identifier', header: 'شناسه', width: 130, frozen: true, render: (r) => <MonoCode value={r.identifier} /> },
    {
      key: 'age',
      header: 'سن',
      align: 'center',
      width: 90,
      frozen: true,
      render: (r) => <Chip size="small" color="warning" label={`${toPersianDigits(String(r.age))} سال`} />,
    },
    { key: 'startYear', header: 'سال شروع', align: 'center', width: 90, render: (r) => toPersianDigits(r.startYear) },
    ...years.map(
      (year): DataTableColumn<AgePyramidRowDto> => ({
        key: `year-${year}`,
        header: toPersianDigits(year),
        align: 'end',
        width: 110,
        render: (r) => {
          const cell = r.yearly.find((y) => y.year === year);
          return cell ? money(cell.balance) : '—';
        },
      }),
    ),
  ];

  return (
    <section>
      <PageHeader
        icon={<StackedBarChartOutlinedIcon />}
        title="هرم سنی"
        description={`شناسه‌هایی که سنشان حداکثر ۱۰ سال است، با ماندهٔ تجمعی هر سال از شروع تا سال گزارش. ${unitLabel ?? ''} سال ${toPersianDigits(financialYear || '-')}.`}
      />

      {!isConfigured && <Alert severity="info" sx={{ mb: 2 }}>برای مشاهدهٔ گزارش، ابتدا سال مالی را از نوار بالا انتخاب کنید.</Alert>}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }} component="form" onSubmit={submit}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: { md: 'center' } }}>
          <AccountMultiSelect
            label="معین شناسه‌دار"
            helperText="فقط معین‌هایی که شناسه دارند نتیجه می‌دهند."
            value={draft.accounts}
            onChange={(accounts) => setDraft((d) => ({ ...d, accounts }))}
          />
          <TextField
            size="small"
            label="از شناسه"
            value={draft.fromIdentifier}
            onChange={(e) => setDraft((d) => ({ ...d, fromIdentifier: e.target.value }))}
            sx={{ width: { md: 150 } }}
          />
          <TextField
            size="small"
            label="تا شناسه"
            value={draft.toIdentifier}
            onChange={(e) => setDraft((d) => ({ ...d, toIdentifier: e.target.value }))}
            sx={{ width: { md: 150 } }}
          />
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" startIcon={<SearchOutlinedIcon />} disabled={!isConfigured}>
              جستجو
            </Button>
            <Button onClick={clear}>پاک کردن</Button>
          </Stack>
        </Stack>
      </Paper>

      {query.isError && <ErrorBanner error={query.error} />}

      {isConfigured && !query.isError && (
        <DataTable
          variant="report"
          columns={columns}
          rows={rows}
          getRowKey={(r) => `${r.accCode}-${r.identifier}`}
          isLoading={query.isLoading}
          emptyMessage="شناسه‌ای با سن ۱۰ سال یا کمتر پیدا نشد."
        />
      )}
    </section>
  );
}
