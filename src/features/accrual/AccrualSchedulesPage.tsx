import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ListToolbar } from '../../components/ListToolbar';
import { JalaliDateField } from '../../components/JalaliDateField';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits } from '../../lib/format/numbers';
import { todayJalali } from '../assistant/draftMapping';
import { accrualApi } from './api';
import { RunDialog, RunResultAlert, ScheduleDrawer, StateChip, VoucherLink, isOverdue, rial } from './accrualUi';
import { KIND_LABEL, STATE_LABEL, type AccrualKind, type AccrualRunResult, type AccrualSchedule, type AccrualState } from './types';

/**
 * زمان‌بندی‌ها: همهٔ سطرهای برگشت برآورد و سهم ماهانه با فیلتر وضعیت/نوع/بازهٔ سررسید (فیلترها در URL می‌مانند).
 * «جزئیات» کشوی خط زمان همان سند اصلی را باز می‌کند؛ سند اجراشده حذف ندارد، فقط لینک.
 */
export function AccrualSchedulesPage() {
  const [params, setParams] = useSearchParams();
  const state = params.get('state') ? (Number(params.get('state')) as AccrualState) : undefined;
  const kind = params.get('kind') ? (Number(params.get('kind')) as AccrualKind) : undefined;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const [runRow, setRunRow] = useState<AccrualSchedule | null>(null);
  const [result, setResult] = useState<AccrualRunResult | null>(null);
  const [drawerVoucher, setDrawerVoucher] = useState<string | null>(params.get('voucher'));
  const today = todayJalali();

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const list = useQuery({
    queryKey: ['accrual', 'list', state, kind, from, to],
    queryFn: () => accrualApi.schedules({ state, kind, from, to }),
  });
  const rows = list.data ?? [];

  const columns: DataTableColumn<AccrualSchedule>[] = [
    { key: 'kind', header: 'نوع', render: (r) => KIND_LABEL[r.kind] },
    { key: 'line', header: 'ماه', align: 'center', render: (r) => (r.kind === 1 ? '—' : toPersianDigits(r.lineNo)), sortValue: (r) => r.lineNo },
    { key: 'desc', header: 'شرح', render: (r) => r.description ?? '—' },
    { key: 'source', header: 'سند اصلی', render: (r) => <VoucherLink id={r.sourceVoucherId} no={r.sourceVoucherNo} />, sortValue: (r) => r.sourceVoucherNo ?? '' },
    { key: 'due', header: 'سررسید', render: (r) => formatLegacyJalaliDate(r.dueDate), sortValue: (r) => r.dueDate },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (r) => rial(r.amount), sortValue: (r) => r.amount },
    { key: 'state', header: 'وضعیت', render: (r) => <StateChip state={r.state} overdue={isOverdue(r, today)} />, sortValue: (r) => r.state },
    { key: 'result', header: 'سند ساخته‌شده', render: (r) => <VoucherLink id={r.resultVoucherId} no={r.resultVoucherNo} />, sortValue: (r) => r.resultVoucherNo ?? '' },
    {
      key: 'act', header: '', sortable: false,
      render: (r) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button size="small" onClick={() => setDrawerVoucher(r.sourceVoucherId)}>جزئیات</Button>
          {r.state === 1 && <Button size="small" variant="contained" onClick={() => setRunRow(r)}>اجرا الان</Button>}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader eyebrow="حسابداری تعهدی" icon={<EventRepeatOutlinedIcon fontSize="small" />} title="زمان‌بندی‌ها"
        description="برگشت برآوردها و سهم ماهانهٔ پیش‌پرداخت و درآمد انتقالی، با وضعیت و سند ساخته‌شدهٔ هر سطر." />

      {list.error != null && <ErrorBanner error={list.error} />}
      <RunResultAlert result={result} onClose={() => setResult(null)} />

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <ListToolbar summary={list.data ? `${toPersianDigits(rows.length)} سطر · جمع ${rial(rows.reduce((s, r) => s + r.amount, 0))}` : undefined}>
          <TextField select size="small" label="وضعیت" value={state ?? ''} onChange={(e) => setFilter('state', e.target.value)} sx={{ minWidth: 140 }}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value=""><em>همه</em></MenuItem>
            {([1, 2, 3] as AccrualState[]).map((s) => <MenuItem key={s} value={s}>{STATE_LABEL[s]}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="نوع" value={kind ?? ''} onChange={(e) => setFilter('kind', e.target.value)} sx={{ minWidth: 220 }}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
            <MenuItem value=""><em>همه</em></MenuItem>
            {([1, 2, 3] as AccrualKind[]).map((k) => <MenuItem key={k} value={k}>{KIND_LABEL[k]}</MenuItem>)}
          </TextField>
          <JalaliDateField label="سررسید از" size="small" value={from} onChange={(v) => setFilter('from', v)} />
          <JalaliDateField label="سررسید تا" size="small" value={to} onChange={(v) => setFilter('to', v)} />
        </ListToolbar>
        <DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} isLoading={list.isLoading} minWidth={1100}
          emptyMessage="سطری با این فیلتر نیست."
          emptyHint="سطرها هنگام ثبت سند با الگوی تعهدی در حسابیار ساخته می‌شوند." />
      </Paper>

      <RunDialog row={runRow} onClose={() => setRunRow(null)} onDone={(r) => { setRunRow(null); setResult(r); }} />
      <ScheduleDrawer voucherId={drawerVoucher} onClose={() => { setDrawerVoucher(null); setFilter('voucher', ''); }} />
    </Box>
  );
}
