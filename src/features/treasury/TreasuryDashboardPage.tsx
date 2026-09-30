import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { StatTiles, type StatTile } from '../../components/StatTiles';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { treasuryDashboardApi } from './api';
import type { TreasuryDashboardOpenItemDto } from '../../types/treasury';

const OPEN_ITEM_TYPE_LABELS: Record<TreasuryDashboardOpenItemDto['type'], string> = {
  payment: 'درخواست پرداخت',
  replenishment: 'ترمیم تنخواه',
  receipt: 'دریافت وجه',
  transfer: 'انتقال وجه',
};

function getOpenItemLink(item: TreasuryDashboardOpenItemDto): string {
  switch (item.type) {
    case 'payment':
      return `/treasury/khazaneh/payment-requests/${item.id}/edit`;
    case 'replenishment':
      return `/treasury/petty-cash/replenishments/${item.id}`;
    case 'receipt':
      return `/treasury/khazaneh/receipts/${item.id}/edit`;
    case 'transfer':
      return `/treasury/khazaneh/transfers/${item.id}/edit`;
    default:
      return '/treasury/khazaneh/cartable';
  }
}

/**
 * داشبورد خزانه — خزانه‌داری بخش ۴-د، مطابق صفحهٔ ۱۴ پاورپوینت
 * (`docs/tankhah-khazaneh-module.md` §۱۰). همهٔ اعداد از `GET api/treasury/dashboard` می‌آیند —
 * هیچ محاسبه‌ای اینجا تکرار نمی‌شود.
 */
export function TreasuryDashboardPage() {
  const navigate = useNavigate();

  const dashboardQuery = useQuery({ queryKey: ['treasury-dashboard'], queryFn: () => treasuryDashboardApi.get() });
  const dashboard = dashboardQuery.data;

  const coverageHint =
    dashboard && dashboard.commitmentsNext7Days.count > 0
      ? dashboard.commitmentsNext7Days.coverageRatio != null
        ? `پوشش: ${toPersianDigits(Math.round(dashboard.commitmentsNext7Days.coverageRatio * 100))}٪`
        : 'پوشش: نامشخص'
      : 'تعهدی ثبت نشده';

  const tiles: StatTile[] = [
    {
      key: 'total-balance',
      label: 'موجودی کل بانک‌ها',
      value: dashboard?.totalBankBalance,
      icon: <AccountBalanceOutlinedIcon fontSize="small" />,
      tone: 'primary',
      hint: dashboard ? `${toPersianDigits(dashboard.bankAccounts.length)} حساب` : undefined,
    },
    {
      key: 'commitments',
      label: 'تعهدات ۷ روز آینده',
      value: dashboard?.commitmentsNext7Days.amount,
      icon: <EventAvailableOutlinedIcon fontSize="small" />,
      tone: 'warning',
      hint: dashboard ? `${toPersianDigits(dashboard.commitmentsNext7Days.count)} مورد — ${coverageHint}` : undefined,
    },
    {
      key: 'pending-approval',
      label: 'در انتظار تأیید',
      value: dashboard?.pendingApproval.amount,
      icon: <HourglassEmptyOutlinedIcon fontSize="small" />,
      tone: 'info',
      hint: dashboard ? `${toPersianDigits(dashboard.pendingApproval.count)} مورد` : undefined,
    },
    {
      key: 'today',
      label: 'خالص گردش امروز',
      value: dashboard?.today.net,
      icon: <CurrencyExchangeOutlinedIcon fontSize="small" />,
      tone: dashboard && dashboard.today.net >= 0 ? 'success' : 'error',
      hint: dashboard ? `دریافت: ${formatThousands(dashboard.today.receipts)} — پرداخت: ${formatThousands(dashboard.today.payments)}` : undefined,
    },
  ];

  const openItemColumns: DataTableColumn<TreasuryDashboardOpenItemDto>[] = [
    { key: 'type', header: 'نوع', render: (row) => OPEN_ITEM_TYPE_LABELS[row.type] },
    { key: 'code', header: 'شماره', render: (row) => row.code },
    { key: 'counterparty', header: 'طرف حساب', render: (row) => row.counterparty ?? '—' },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.amount) },
    { key: 'dueDate', header: 'سررسید', render: (row) => (row.dueDate ? formatLegacyJalaliDate(row.dueDate) : '—') },
    { key: 'state', header: 'وضعیت', render: (row) => row.stateLabel },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Button size="small" variant="outlined" onClick={() => navigate(getOpenItemLink(row))}>
          مشاهده
        </Button>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<DashboardOutlinedIcon />}
        accentColor="secondary"
        title="داشبورد خزانه"
        description="موجودی بانک‌ها، تعهدات پیش‌رو، اقلام در انتظار تأیید و گردش امروز."
      />

      {dashboardQuery.isError && <ErrorBanner error={dashboardQuery.error} />}

      {!dashboardQuery.isError && (
        <>
          <StatTiles tiles={tiles} isLoading={dashboardQuery.isLoading} />

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              اقدام سریع
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<RequestQuoteOutlinedIcon fontSize="small" />}
                onClick={() => navigate('/treasury/khazaneh/payment-requests/new')}
              >
                درخواست پرداخت
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<ReceiptLongOutlinedIcon fontSize="small" />}
                onClick={() => navigate('/treasury/khazaneh/receipts/new')}
              >
                دریافت وجه
              </Button>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<CompareArrowsOutlinedIcon fontSize="small" />}
                onClick={() => navigate('/treasury/khazaneh/transfers/new')}
              >
                انتقال وجه
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              اقلام باز
            </Typography>
            <DataTable
              columns={openItemColumns}
              rows={dashboard?.openItems ?? []}
              getRowKey={(row) => `${row.type}-${row.id}`}
              isLoading={dashboardQuery.isLoading}
              emptyMessage="اقلام بازی برای نمایش نیست."
            />
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              وضعیت نقدینگی بانک‌ها
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>حساب بانکی</TableCell>
                    <TableCell align="left">موجودی (ریال)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(dashboard?.bankAccounts ?? []).map((account) => (
                    <TableRow key={account.bankAccountId}>
                      <TableCell>{account.label}</TableCell>
                      <TableCell align="left">{formatThousands(account.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {dashboard && dashboard.bankAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">
                        حساب بانکی فعالی برای این واحد یافت نشد.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {dashboard && dashboard.bankAccounts.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>جمع کل</TableCell>
                      <TableCell align="left" sx={{ fontWeight: 700 }}>
                        {formatThousands(dashboard.totalBankBalance)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </TableContainer>
          </Paper>

          {dashboard && dashboard.alerts.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                <WarningAmberOutlinedIcon color="warning" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  هشدارها
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {dashboard.alerts.map((alert, index) => (
                  // eslint-disable-next-line react/no-array-index-key -- plain strings, no stable id on the wire
                  <Alert key={index} severity="warning">
                    {alert}
                  </Alert>
                ))}
              </Stack>
            </Paper>
          )}
        </>
      )}
    </section>
  );
}
