import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { StatTiles } from '../../components/StatTiles';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { todayJalali } from '../assistant/draftMapping';
import { accrualApi } from './api';
import { RunDialog, RunResultAlert, ScheduleDrawer, VoucherLink, rial } from './accrualUi';
import { KIND_LABEL, type AccrualRunResult, type AccrualSchedule } from './types';

/**
 * میز کار تعهدی: اقلام سررسیدشده و اجرانشده با اقدام سریع. ثبت سند تعهدی در حسابیار است؛ اینجا فقط پیگیری و کنترل.
 */
export function AccrualDeskPage() {
  const navigate = useNavigate();
  const today = todayJalali();
  const monthStart = `${today.slice(0, 6)}01`;
  const monthEnd = `${today.slice(0, 6)}31`;
  const [runRow, setRunRow] = useState<AccrualSchedule | null>(null);
  const [result, setResult] = useState<AccrualRunResult | null>(null);
  const [drawerVoucher, setDrawerVoucher] = useState<string | null>(null);

  // سطرهای باز تا پایان این ماه + همهٔ سطرهای این ماه (برای کاشی‌های اجراشده/لغوشده).
  const open = useQuery({ queryKey: ['accrual', 'list', 'open-to', monthEnd], queryFn: () => accrualApi.schedules({ state: 1, to: monthEnd }) });
  const month = useQuery({ queryKey: ['accrual', 'list', 'month', monthStart], queryFn: () => accrualApi.schedules({ from: monthStart, to: monthEnd }) });

  const due = useMemo(() => (open.data ?? []).filter((r) => r.dueDate <= today), [open.data, today]);
  const dueThisMonth = (open.data ?? []).filter((r) => r.dueDate >= monthStart);
  const doneThisMonth = (month.data ?? []).filter((r) => r.state === 2);
  const cancelledThisMonth = (month.data ?? []).filter((r) => r.state === 3);
  const sum = (rows: AccrualSchedule[]) => rows.reduce((s, r) => s + r.amount, 0);

  const columns: DataTableColumn<AccrualSchedule>[] = [
    { key: 'kind', header: 'نوع', render: (r) => KIND_LABEL[r.kind] },
    { key: 'desc', header: 'شرح', render: (r) => r.description ?? '—' },
    { key: 'source', header: 'سند اصلی', render: (r) => <VoucherLink id={r.sourceVoucherId} no={r.sourceVoucherNo} />, sortValue: (r) => r.sourceVoucherNo ?? '' },
    { key: 'due', header: 'تاریخ سررسید', render: (r) => formatLegacyJalaliDate(r.dueDate), sortValue: (r) => r.dueDate },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (r) => rial(r.amount), sortValue: (r) => r.amount },
    {
      key: 'act', header: '', sortable: false,
      render: (r) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button size="small" onClick={() => setDrawerVoucher(r.sourceVoucherId)}>جزئیات</Button>
          <Button size="small" variant="contained" onClick={() => setRunRow(r)}>اجرا الان</Button>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader eyebrow="حسابداری تعهدی" icon={<EventRepeatOutlinedIcon fontSize="small" />} title="میز کار تعهدی"
        description="برگرداندن برآوردها و سهم ماهانهٔ پیش‌پرداخت و درآمد انتقالی. ثبت سند تعهدی از حسابیار است."
        actions={<Button variant="outlined" onClick={() => navigate('/accrual/schedules')}>همهٔ زمان‌بندی‌ها</Button>} />

      {(open.error ?? month.error) != null && <ErrorBanner error={open.error ?? month.error} />}

      <StatTiles isLoading={open.isLoading || month.isLoading} tiles={[
        { key: 'due', label: 'سررسید امروز یا گذشته، اجرانشده', value: due.length, hint: rial(sum(due)), tone: due.length ? 'warning' : 'success' },
        { key: 'month', label: 'سررسید این ماه (باز)', value: dueThisMonth.length, hint: rial(sum(dueThisMonth)), tone: 'info',
          onClick: () => navigate(`/accrual/schedules?state=1&from=${monthStart}&to=${monthEnd}`) },
        { key: 'done', label: 'اجراشدهٔ این ماه', value: doneThisMonth.length, hint: rial(sum(doneThisMonth)), tone: 'success',
          onClick: () => navigate(`/accrual/schedules?state=2&from=${monthStart}&to=${monthEnd}`) },
        { key: 'cancelled', label: 'لغوشدهٔ این ماه', value: cancelledThisMonth.length, tone: 'secondary',
          onClick: () => navigate(`/accrual/schedules?state=3&from=${monthStart}&to=${monthEnd}`) },
      ]} />

      <RunResultAlert result={result} onClose={() => setResult(null)} />

      {due.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          تا این اقلام اجرا نشوند، صورتحساب این ماه انجام نمی‌شود.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>نیاز به اقدام</Typography>
        {!open.isLoading && due.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
            <TaskAltOutlinedIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
            <Typography>همهٔ اقلام تعهدی سررسیدشده اجرا شده‌اند.</Typography>
          </Box>
        ) : (
          <DataTable columns={columns} rows={due} getRowKey={(r) => r.id} isLoading={open.isLoading} minWidth={860} />

        )}
      </Paper>

      <RunDialog row={runRow} onClose={() => setRunRow(null)} onDone={(r) => { setRunRow(null); setResult(r); }} />
      <ScheduleDrawer voucherId={drawerVoucher} onClose={() => setDrawerVoucher(null)} />
    </Box>
  );
}
