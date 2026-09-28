import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
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
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { pettyCashDashboardApi, pettyCashFundsApi } from './api';
import { getPettyCashStateColor, getPettyCashStateLabel, PETTY_CASH_DOC_STATE } from './pettyCashDocState';
import type { PettyCashDashboardActionItemDto } from '../../types/pettyCash';

/**
 * داشبورد تنخواه — بخش ۳-الف (`docs/tankhah-khazaneh-module.md` §۹، صفحهٔ ۴ پاورپوینت).
 * کارت‌های KPI و «تراز تنخواه» فقط داده‌های سرور (`GET funds/{fundId}/dashboard`) را نمایش
 * می‌دهند — هیچ محاسبه‌ای اینجا تکرار نمی‌شود؛ منبع فرمول `PettyCashBalanceCalculator` سمت سرور است.
 */
export function PettyCashDashboardPage() {
  const navigate = useNavigate();
  const [fundId, setFundId] = useState('');

  const fundsQuery = useQuery({ queryKey: ['petty-cash-funds'], queryFn: () => pettyCashFundsApi.list() });
  const funds = fundsQuery.data ?? [];

  useEffect(() => {
    if (!fundId && funds.length > 0) setFundId(funds[0].id);
  }, [fundId, funds]);

  const dashboardQuery = useQuery({
    queryKey: ['petty-cash-dashboard', fundId],
    queryFn: () => pettyCashDashboardApi.get(fundId),
    enabled: fundId !== '',
  });

  const dashboard = dashboardQuery.data;

  const columns: DataTableColumn<PettyCashDashboardActionItemDto>[] = [
    { key: 'docNumber', header: 'سند', render: (row) => row.docNumber ?? '—' },
    { key: 'custodianName', header: 'تنخواه‌دار', render: (row) => row.custodianName ?? '—' },
    { key: 'description', header: 'شرح', render: (row) => row.description ?? '—' },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.amount) },
    {
      key: 'state',
      header: 'وضعیت',
      render: (row) => <Chip size="small" color={getPettyCashStateColor(row.state)} label={getPettyCashStateLabel(row.state)} />,
    },
    {
      key: 'ageDays',
      header: 'عمر',
      render: (row) => (
        <Box component="span" sx={{ color: row.ageDays > 5 ? 'error.main' : 'text.primary', fontWeight: row.ageDays > 5 ? 700 : 400 }}>
          {toPersianDigits(row.ageDays)} روز
        </Box>
      ),
    },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() =>
            navigate(`/treasury/petty-cash/expense-docs/${row.id}/edit`, {
              state: { reviewQueue: dashboard?.todayActions.map((a) => a.id) ?? [] },
            })
          }
        >
          {row.state === PETTY_CASH_DOC_STATE.returned ? 'پیگیری' : 'بررسی'}
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
        title="داشبورد تنخواه"
        description="موجودی نقد، اسناد منتظر ترمیم، در جریان بررسی و برگشتی — به‌ازای یک تنخواه."
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <TextField
          select
          size="small"
          label="تنخواه"
          value={fundId}
          onChange={(e) => setFundId(e.target.value)}
          sx={{ minWidth: 260 }}
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
      </Paper>

      {dashboardQuery.isError && <ErrorBanner error={dashboardQuery.error} />}

      {!dashboardQuery.isError && fundId && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  موجودی نقد
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {dashboard ? formatThousands(dashboard.cashBalance) : '—'}
                </Typography>
                {dashboard && (
                  <Typography variant="caption" color="text.secondary">
                    {toPersianDigits(Math.round(dashboard.cashPercentOfCeiling))}٪ از سقف
                  </Typography>
                )}
                {dashboard?.belowAlertThreshold && (
                  <Chip size="small" color="warning" label="زیر آستانهٔ ترمیم" sx={{ mt: 1 }} />
                )}
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  تأییدشده منتظر ترمیم
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {dashboard ? formatThousands(dashboard.awaitingReplenishment.amount) : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dashboard ? `${toPersianDigits(dashboard.awaitingReplenishment.count)} سند` : ''}
                </Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  در جریان بررسی
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {dashboard ? formatThousands(dashboard.inFlight.amount) : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dashboard ? `${toPersianDigits(dashboard.inFlight.count)} سند` : ''}
                </Typography>
                {dashboard && dashboard.inFlight.olderThan5DaysCount > 0 && (
                  <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                    {toPersianDigits(dashboard.inFlight.olderThan5DaysCount)} سند بیش از ۵ روز
                  </Typography>
                )}
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: '100%' }}>
                <Typography variant="caption" color="text.secondary">
                  برگشتی
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {dashboard ? `${toPersianDigits(dashboard.returned.count)} سند` : '—'}
                </Typography>
                {dashboard?.returned.oldestAgeDays != null && (
                  <Typography variant="caption" color="text.secondary">
                    قدیمی‌ترین: {toPersianDigits(dashboard.returned.oldestAgeDays)} روز
                  </Typography>
                )}
              </Paper>
            </Grid>
          </Grid>

          {dashboard && (
            <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  تراز تنخواه
                </Typography>
                {dashboard.balanceCheck.balanced ? (
                  <Chip size="small" color="success" icon={<CheckCircleOutlineIcon fontSize="small" />} label="متوازن" />
                ) : (
                  <Chip size="small" color="error" icon={<CancelOutlinedIcon fontSize="small" />} label="نامتوازن" />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                سقف ({formatThousands(dashboard.balanceCheck.ceiling)}) = نقد ({formatThousands(dashboard.balanceCheck.cash)}) +
                تأییدشده منتظر ترمیم ({formatThousands(dashboard.balanceCheck.awaitingReplenishment)}) + در جریان (
                {formatThousands(dashboard.balanceCheck.inFlight)}) − ترمیم‌های پرداخت‌شدهٔ هنوز‌تسویه‌نشده (
                {formatThousands(dashboard.balanceCheck.replenishedNotSettled)})
              </Typography>
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 2 }}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                اقدامات امروز
              </Typography>
              <Button size="small" component={RouterLink} to="/treasury/petty-cash/cartable">
                مشاهده همه در کارتابل
              </Button>
            </Stack>
            <DataTable
              columns={columns}
              rows={dashboard?.todayActions ?? []}
              getRowKey={(row) => row.id}
              isLoading={dashboardQuery.isLoading}
              emptyMessage="امروز اقدامی در انتظار نیست."
            />
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
                  <Alert key={index} severity={(alert.severity as 'warning' | 'error' | 'info') || 'warning'}>
                    {alert.message}
                  </Alert>
                ))}
              </Stack>
              <Button
                sx={{ mt: 2 }}
                variant="contained"
                color="secondary"
                onClick={() => navigate(`/treasury/petty-cash/replenishments/new?fundId=${fundId}`)}
              >
                ایجاد درخواست ترمیم ({formatThousands(dashboard.awaitingReplenishment.amount)} ریال)
              </Button>
            </Paper>
          )}
        </>
      )}
    </section>
  );
}
