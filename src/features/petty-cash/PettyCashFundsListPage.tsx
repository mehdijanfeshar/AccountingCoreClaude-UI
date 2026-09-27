import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { pettyCashFundsApi } from './api';
import { getSettlementPeriodLabel } from './pettyCashDocState';
import { PettyCashFundSettingsDialog } from './PettyCashFundSettingsDialog';
import type { PettyCashFundDto } from '../../types/pettyCash';

/**
 * تعریف تنخواه — ص ۱۳. هویت خودِ تنخواه (کد/نام/سقف/حساب معین) اینجا فقط نمایشی است و در صفحهٔ
 * موجود «تنخواه» (`/base/revolving-funds`) ویرایش می‌شود — این صفحه فقط تنظیمات مخصوص این ماژول
 * را می‌سازد/ویرایش می‌کند (`TB_PC_FUND_SETTING`: تنخواه‌دار، سقف هر سند، آستانهٔ هشدار، دورهٔ
 * تسویه)، به‌علاوهٔ خلاصهٔ موجودی که سرور محاسبه می‌کند.
 */
export function PettyCashFundsListPage() {
  const [filter, setFilter] = useState('');
  const [editingFund, setEditingFund] = useState<PettyCashFundDto | null>(null);

  const query = useQuery({
    queryKey: ['petty-cash-funds'],
    queryFn: () => pettyCashFundsApi.list(),
  });

  const rows = useMemo(() => {
    const items = query.data ?? [];
    if (!filter.trim()) return items;
    const needle = filter.trim().toLowerCase();
    return items.filter(
      (row) => (row.code ?? '').toLowerCase().includes(needle) || (row.name ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

  const columns: DataTableColumn<PettyCashFundDto>[] = [
    { key: 'code', header: 'کد', render: (row) => <MonoCode value={row.code} /> },
    { key: 'name', header: 'عنوان', render: (row) => row.name ?? '—' },
    { key: 'ceiling', header: 'سقف تنخواه', render: (row) => (row.ceiling != null ? formatThousands(row.ceiling) : '—') },
    {
      key: 'perDocLimit',
      header: 'سقف هر سند',
      render: (row) => (row.settings?.perDocLimit != null ? formatThousands(row.settings.perDocLimit) : '—'),
    },
    { key: 'custodian', header: 'تنخواه‌دار', render: (row) => row.settings?.custodianName ?? '—' },
    {
      key: 'alertThreshold',
      header: 'آستانهٔ هشدار',
      render: (row) =>
        row.settings?.alertThresholdPercent != null ? `${toPersianDigits(row.settings.alertThresholdPercent)}٪` : '—',
    },
    {
      key: 'settlementPeriod',
      header: 'دورهٔ تسویه',
      render: (row) => getSettlementPeriodLabel(row.settings?.settlementPeriod),
    },
    {
      key: 'cashBalance',
      header: 'موجودی نقد',
      render: (row) => (row.cashBalance != null ? formatThousands(row.cashBalance) : '—'),
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="تنظیمات تنخواه">
            <IconButton size="small" aria-label="تنظیمات تنخواه" onClick={() => setEditingFund(row)}>
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<SavingsOutlinedIcon />}
        accentColor="secondary"
        title="تعریف تنخواه"
        description="تنظیمات هر تنخواه — سقف هر سند، آستانهٔ هشدار، تنخواه‌دار و دورهٔ تسویه."
        actions={
          <Button
            variant="outlined"
            startIcon={<OpenInNewOutlinedIcon />}
            component={RouterLink}
            to="/base/revolving-funds"
          >
            مدیریت خودِ تنخواه‌ها
          </Button>
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        کد، عنوان، سقف تنخواه و حساب معین از صفحهٔ «تنخواه» (اطلاعات پایه) می‌آیند و اینجا فقط
        نمایشی‌اند؛ برای تغییرشان به آن صفحه بروید. این صفحه فقط تنظیمات مخصوص کارتابل تنخواه را
        می‌سازد.
      </Alert>

      <ListToolbar
        search={filter}
        onSearchChange={setFilter}
        searchLabel="جستجو در همین صفحه"
        summary={query.data ? `${toPersianDigits(query.data.length)} تنخواه` : ''}
      />

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          isLoading={query.isLoading}
          emptyMessage={
            filter.trim() ? 'نتیجه‌ای برای این جستجو یافت نشد.' : 'هنوز تنخواهی تعریف نشده است.'
          }
          emptyAction={
            filter.trim() ? (
              <Button size="small" variant="text" onClick={() => setFilter('')}>
                پاک کردن جستجو
              </Button>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNewOutlinedIcon />}
                component={RouterLink}
                to="/base/revolving-funds/new"
              >
                افزودن تنخواه در اطلاعات پایه
              </Button>
            )
          }
        />
      )}

      {rows.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          موجودی نقد از فرمول «سقف − Σ مبلغ اسناد در وضعیت جدید/در انتظار بررسی/برگشتی/تأییدشده»
          محاسبه می‌شود (سند مرجع بخش ۲) و تا ساخت شارژ/ترمیم (بخش ۳) موقت است.
        </Typography>
      )}

      <PettyCashFundSettingsDialog
        fund={editingFund}
        open={editingFund !== null}
        onClose={() => setEditingFund(null)}
      />
    </section>
  );
}
