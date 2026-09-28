import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { pettyCashFundsApi, pettyCashLedgerApi } from './api';
import { exportPettyCashLedgerToExcel } from './ledgerExport';
import { getLedgerRowTypeColor, getLedgerRowTypeLabel, LEDGER_ROW_TYPE_OPTIONS } from './pettyCashLedgerRowType';
import { PettyCashRefundsPanel } from './PettyCashRefundsPanel';
import type { PettyCashLedgerRowDto, PettyCashLedgerRowType } from '../../types/pettyCash';

interface DisplayRow {
  kind: 'opening' | 'row' | 'closing';
  key: string;
  row?: PettyCashLedgerRowDto;
  balance: number;
}

/**
 * گزارش گردش تنخواه — بخش ۳-الف (`docs/tankhah-khazaneh-module.md` §۹، صفحهٔ ۱۱ پاورپوینت).
 * ⚠️ این گزارش تاریخچهٔ حرکت واقعی وجه است، نه معادل لحظه‌ایِ فرمول موجودی نقد داشبورد —
 * `مانده پایان بازه` با `موجودی نقد` فعلی برابر نیست (تفاوتشان اسناد در جریان است؛ عمدی، نه باگ).
 */
export function PettyCashLedgerPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [fundId, setFundId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<PettyCashLedgerRowType | ''>('');
  const [exporting, setExporting] = useState(false);

  const fundsQuery = useQuery({ queryKey: ['petty-cash-funds'], queryFn: () => pettyCashFundsApi.list() });
  const funds = fundsQuery.data ?? [];

  useEffect(() => {
    if (!fundId && funds.length > 0) setFundId(funds[0].id);
  }, [fundId, funds]);

  const selectedFund = useMemo(() => funds.find((f) => f.id === fundId) ?? null, [funds, fundId]);

  const ledgerQuery = useQuery({
    queryKey: ['petty-cash-ledger', fundId, fromDate, toDate, typeFilter],
    queryFn: () =>
      pettyCashLedgerApi.get(fundId, {
        from: fromDate || undefined,
        to: toDate || undefined,
        type: typeFilter || undefined,
      }),
    enabled: fundId !== '',
  });

  const ledger = ledgerQuery.data;

  const displayRows: DisplayRow[] = useMemo(() => {
    if (!ledger) return [];
    return [
      { kind: 'opening', key: 'opening', balance: ledger.openingBalance },
      ...ledger.rows.map((row, index) => ({ kind: 'row' as const, key: `${row.type}-${row.sourceId}-${index}`, row, balance: row.balance })),
      { kind: 'closing', key: 'closing', balance: ledger.closingBalance },
    ];
  }, [ledger]);

  const columns: DataTableColumn<DisplayRow>[] = [
    {
      key: 'date',
      header: 'تاریخ',
      render: (r) => (r.kind === 'row' ? formatLegacyJalaliDate(r.row!.date) : '—'),
    },
    {
      key: 'type',
      header: 'نوع',
      render: (r) =>
        r.kind === 'row' ? (
          <Chip size="small" color={getLedgerRowTypeColor(r.row!.type)} label={getLedgerRowTypeLabel(r.row!.type)} />
        ) : (
          '—'
        ),
    },
    {
      key: 'description',
      header: 'شرح',
      render: (r) => {
        if (r.kind === 'opening') return <strong>مانده ابتدای بازه</strong>;
        if (r.kind === 'closing') return <strong>مانده پایان بازه</strong>;
        return r.row!.description ?? '—';
      },
    },
    {
      key: 'reference',
      header: 'مرجع',
      render: (r) => {
        if (r.kind !== 'row') return '—';
        const row = r.row!;
        if (row.type === 'expense') {
          return (
            <Button size="small" variant="text" onClick={() => navigate(`/treasury/petty-cash/expense-docs/${row.sourceId}/edit`)}>
              {row.reference}
            </Button>
          );
        }
        if (row.type === 'replenishment') {
          return (
            <Button size="small" variant="text" onClick={() => navigate(`/treasury/petty-cash/replenishments/${row.sourceId}`)}>
              {row.reference}
            </Button>
          );
        }
        return row.reference;
      },
    },
    {
      key: 'receipt',
      header: 'دریافت (ریال)',
      align: 'end',
      render: (r) => (r.kind === 'row' && r.row!.receipt != null ? formatThousands(r.row!.receipt) : '—'),
    },
    {
      key: 'payment',
      header: 'پرداخت (ریال)',
      align: 'end',
      render: (r) => (r.kind === 'row' && r.row!.payment != null ? formatThousands(r.row!.payment) : '—'),
    },
    {
      key: 'balance',
      header: 'مانده (ریال)',
      align: 'end',
      render: (r) => <strong>{formatThousands(r.balance)}</strong>,
    },
  ];

  async function handleExport() {
    if (!ledger) return;
    setExporting(true);
    try {
      await exportPettyCashLedgerToExcel(ledger, {
        fundLabel: selectedFund?.name ?? selectedFund?.code ?? '',
        fromDate,
        toDate,
      });
    } catch (error) {
      notify({ message: error instanceof Error ? error.message : 'خروجی اکسل با خطا مواجه شد.', severity: 'error' });
    } finally {
      setExporting(false);
    }
  }

  const balanceEquationOk =
    ledger != null &&
    Math.abs(ledger.openingBalance + ledger.totalReceipt - ledger.totalPayment - ledger.closingBalance) < 1;

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<TrendingUpOutlinedIcon />}
        accentColor="secondary"
        title="گزارش گردش تنخواه"
        description="تاریخچهٔ حرکت نقد یک تنخواه — ترمیم، هزینه‌کرد، استرداد."
        actions={
          <Button
            variant="outlined"
            startIcon={<DownloadOutlinedIcon />}
            disabled={!ledger || exporting}
            onClick={handleExport}
          >
            {exporting ? 'در حال خروجی…' : 'خروجی اکسل'}
          </Button>
        }
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="تنخواه"
          value={fundId}
          onChange={(e) => setFundId(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {funds.length === 0 && (
            <MenuItem value="" disabled>
              {fundsQuery.isLoading ? 'در حال بارگذاری…' : 'هیچ تنخواهی تعریف نشده است'}
            </MenuItem>
          )}
          {funds.map((fund) => (
            <MenuItem key={fund.id} value={fund.id}>
              {fund.code ? `${fund.code} — ` : ''}
              {fund.name}
            </MenuItem>
          ))}
        </TextField>
        <JalaliDateField label="از تاریخ" value={fromDate} onChange={setFromDate} size="small" sx={{ minWidth: 180 }} />
        <JalaliDateField label="تا تاریخ" value={toDate} onChange={setToDate} size="small" sx={{ minWidth: 180 }} />
        <TextField
          select
          size="small"
          label="نوع"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as PettyCashLedgerRowType | '')}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">همه</MenuItem>
          {LEDGER_ROW_TYPE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      {ledgerQuery.isError && <ErrorBanner error={ledgerQuery.error} />}

      {!ledgerQuery.isError && fundId && (
        <>
          <DataTable
            columns={columns}
            rows={displayRows}
            getRowKey={(r) => r.key}
            isLoading={ledgerQuery.isLoading}
            emptyMessage="ردیفی برای این بازه یافت نشد."
          />

          {ledger && (
            <Paper variant="outlined" sx={{ p: 2.5, mt: 2, borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    جمع دریافت
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatThousands(ledger.totalReceipt)} ({toPersianDigits(ledger.receiptCount)} ردیف)
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    جمع پرداخت
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatThousands(ledger.totalPayment)} ({toPersianDigits(ledger.paymentCount)} ردیف)
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    مانده پایان
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {formatThousands(ledger.closingBalance)}
                  </Typography>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5 }}>
                {balanceEquationOk ? (
                  <CheckCircleOutlineIcon fontSize="small" color="success" />
                ) : (
                  <CancelOutlinedIcon fontSize="small" color="error" />
                )}
                <Typography variant="caption" color="text.secondary">
                  ابتدا + دریافت − پرداخت = پایان
                </Typography>
              </Stack>
            </Paper>
          )}

          <Grid container sx={{ mt: 3 }}>
            <Grid size={12}>
              <PettyCashRefundsPanel fund={selectedFund} />
            </Grid>
          </Grid>
        </>
      )}
    </section>
  );
}
