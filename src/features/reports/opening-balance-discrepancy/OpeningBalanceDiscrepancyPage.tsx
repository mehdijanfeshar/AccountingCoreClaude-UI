import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { MonoCode } from '../../../components/MonoCode';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { useSession } from '../../../lib/session/SessionContext';
import { formatThousands, toPersianDigits } from '../../../lib/format/numbers';
import { openingBalanceDiscrepancyApi, type OpeningBalanceDiscrepancyRowDto } from './api';

function money(v: number): string {
  return v ? toPersianDigits(formatThousands(Math.abs(v))) : '—';
}

/**
 * مغایرت افتتاحیه با ماندهٔ سال قبل — ردیف‌های سند افتتاحیهٔ سال جاری که مبلغش با ماندهٔ همان
 * معین/شناسه در کل سال قبل برابر نیست (`GET /api/reports/opening-balance-discrepancy`). تنها
 * فیلتر سال مالی است (همان سراسریِ نوار بالا) — صفحه با انتخاب سال خودکار بازخوانی می‌شود، فرم
 * فیلتر جدا لازم نیست. سرور خودش فقط ردیف‌های مغایر را برمی‌گرداند؛ آرایهٔ خالی یعنی مغایرتی نیست.
 */
export function OpeningBalanceDiscrepancyPage() {
  const { financialYear, unitLabel, isConfigured } = useSession();

  const query = useQuery({
    queryKey: ['opening-balance-discrepancy-report', financialYear],
    queryFn: () => openingBalanceDiscrepancyApi.get(financialYear),
    enabled: isConfigured && !!financialYear,
  });

  const rows = query.data ?? [];

  const columns: DataTableColumn<OpeningBalanceDiscrepancyRowDto>[] = [
    { key: 'accCode', header: 'کد معین', width: 110, frozen: true, render: (r) => <MonoCode value={r.accCode} /> },
    { key: 'accName', header: 'نام معین', render: (r) => r.accName ?? '—' },
    { key: 'identifier', header: 'شناسه', render: (r) => <MonoCode value={r.identifier} /> },
    { key: 'openingAmount', header: 'مبلغ در سند افتتاحیه', align: 'end', render: (r) => money(r.openingAmount) },
    { key: 'priorYearBalance', header: 'ماندهٔ سال قبل', align: 'end', render: (r) => money(r.priorYearBalance) },
    {
      key: 'difference',
      header: 'اختلاف',
      align: 'end',
      render: (r) => (
        <Typography component="span" variant="body2" sx={{ fontWeight: 700, color: r.difference > 0 ? 'error.main' : 'warning.dark' }}>
          {r.difference > 0 ? '+' : '−'}
          {money(r.difference)}
        </Typography>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        icon={<CompareArrowsOutlinedIcon />}
        title="مغایرت افتتاحیه با ماندهٔ سال قبل"
        description={`ردیف‌های سند افتتاحیه که با ماندهٔ سال قبل همان معین/شناسه برابر نیستند. ${unitLabel ?? ''} سال ${toPersianDigits(financialYear || '-')}.`}
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshOutlinedIcon />}
            onClick={() => query.refetch()}
            disabled={!isConfigured || query.isFetching}
          >
            بازخوانی
          </Button>
        }
      />

      {!isConfigured && <Alert severity="info" sx={{ mb: 2 }}>برای مشاهدهٔ گزارش، ابتدا سال مالی را از نوار بالا انتخاب کنید.</Alert>}

      {query.isError && <ErrorBanner error={query.error} />}

      {isConfigured && !query.isError && !query.isLoading && rows.length === 0 && (
        <Alert severity="success">مغایرتی یافت نشد.</Alert>
      )}

      {isConfigured && !query.isError && (query.isLoading || rows.length > 0) && (
        <DataTable
          variant="report"
          columns={columns}
          rows={rows}
          getRowKey={(r) => `${r.accCode}-${r.identifier ?? ''}`}
          isLoading={query.isLoading}
          emptyMessage="مغایرتی یافت نشد."
        />
      )}
    </section>
  );
}
