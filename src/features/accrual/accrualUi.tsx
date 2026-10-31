import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DoNotDisturbOnOutlinedIcon from '@mui/icons-material/DoNotDisturbOnOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { todayJalali } from '../assistant/draftMapping';
import { accrualApi } from './api';
import { KIND_LABEL, STATE_LABEL, type AccrualRunResult, type AccrualSchedule, type AccrualState } from './types';

export const rial = (n: number) => `${formatThousands(n)} ریال`;

export function isOverdue(row: AccrualSchedule, today = todayJalali()) {
  return row.state === 1 && row.dueDate <= today;
}

/** وضعیت با رنگ + آیکن + متن (نه فقط رنگ). باز و سررسیدشده = «سررسید گذشته». */
export function StateChip({ state, overdue = false }: { state: AccrualState; overdue?: boolean }) {
  if (state === 2) return <Chip size="small" color="success" variant="outlined" icon={<CheckCircleOutlineIcon />} label={STATE_LABEL[2]} />;
  if (state === 3) return <Chip size="small" variant="outlined" icon={<DoNotDisturbOnOutlinedIcon />} label={STATE_LABEL[3]} />;
  return <Chip size="small" color={overdue ? 'warning' : 'info'} variant="outlined" icon={<ScheduleOutlinedIcon />} label={overdue ? 'باز — سررسید گذشته' : STATE_LABEL[1]} />;
}

export function VoucherLink({ id, no }: { id: string | null; no: string | null }) {
  if (!id) return <>—</>;
  return (
    <Link component={RouterLink} to={`/operation/vouchers/${id}/view`} onClick={(e) => e.stopPropagation()}>
      سند <bdi>{toPersianDigits(no ?? '…')}</bdi>
    </Link>
  );
}

/** خلاصهٔ اثر اجرای یک سطر — متن دیالوگ تأیید، نه «آیا مطمئنید؟». */
export function runEffect(row: AccrualSchedule): string {
  const date = formatLegacyJalaliDate(row.dueDate);
  return row.kind === 1
    ? `سند برگشت ${rial(row.amount)} با تاریخ ${date} برای سند ${toPersianDigits(row.sourceVoucherNo ?? '')} ساخته می‌شود (وضعیت «موقت»).`
    : `سند ${KIND_LABEL[row.kind]} به مبلغ ${rial(row.amount)} با تاریخ ${date} ساخته می‌شود (وضعیت «موقت»).`;
}

/** دیالوگ «اجرا الان» + نتیجه با لینک سند. `onDone` پس از موفقیت. */
export function RunDialog({ row, onClose, onDone }: { row: AccrualSchedule | null; onClose: () => void; onDone: (r: AccrualRunResult) => void }) {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: (id: string) => accrualApi.run(id),
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: ['accrual'] });
      onDone(r);
    },
  });
  return (
    <ConfirmDialog
      open={!!row}
      title="اجرای الان"
      description={row ? runEffect(row) : undefined}
      confirmLabel="ساخت سند"
      confirmColor="primary"
      pending={run.isPending}
      error={run.error}
      onConfirm={() => row && run.mutate(row.id)}
      onCancel={() => { run.reset(); onClose(); }}
    />
  );
}

/** پیام نتیجهٔ اجرا با لینک سند ساخته‌شده. */
export function RunResultAlert({ result, onClose }: { result: AccrualRunResult | null; onClose: () => void }) {
  if (!result) return null;
  return (
    <Alert severity="success" onClose={onClose} sx={{ mb: 2 }}>
      {result.alreadyDone ? 'این سطر قبلاً اجرا شده بود؛ همان سند: ' : 'سند ساخته شد: '}
      <VoucherLink id={result.voucherId} no={result.voucherNo} />
    </Alert>
  );
}

/**
 * کشوی جزئیات یک سند اصلی: همهٔ سطرهای زمان‌بندی‌اش به‌صورت خط زمان (ماه، مبلغ، وضعیت، سند ساخته‌شده)،
 * جمع کل برابر مبلغ اصلی، و «لغو باقی‌مانده‌ها» (فسخ قرارداد) با دلیل الزامی.
 */
export function ScheduleDrawer({ voucherId, onClose }: { voucherId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [runRow, setRunRow] = useState<AccrualSchedule | null>(null);
  const [runResult, setRunResult] = useState<AccrualRunResult | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const data = useQuery({ queryKey: ['accrual', 'by-voucher', voucherId], queryFn: () => accrualApi.byVoucher(voucherId!), enabled: !!voucherId });
  const lines = data.data?.lines ?? [];
  const open = lines.filter((l) => l.state === 1);
  const firstOpen = open[0] ?? null;
  const cancel = useMutation({
    mutationFn: () => accrualApi.cancel(firstOpen!.id, reason.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['accrual'] });
      setCancelOpen(false);
      setReason('');
    },
  });
  const today = todayJalali();

  return (
    <Drawer anchor="left" open={!!voucherId} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 }, p: 2 } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          زمان‌بندی سند <bdi>{toPersianDigits(data.data?.sourceVoucherNo ?? '')}</bdi>
        </Typography>
        <IconButton onClick={onClose} aria-label="بستن"><CloseIcon /></IconButton>
      </Stack>
      {data.data && <Box sx={{ mb: 2 }}><VoucherLink id={data.data.sourceVoucherId} no={data.data.sourceVoucherNo} /> (سند اصلی)</Box>}
      {data.error != null && <ErrorBanner error={data.error} />}
      <RunResultAlert result={runResult} onClose={() => setRunResult(null)} />

      {data.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} height={64} />)}
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {lines.map((l) => (
          <Box component="li" key={l.id} sx={{ borderInlineStart: 2, borderColor: l.state === 2 ? 'success.main' : 'divider', ps: 2, pb: 1.5, position: 'relative' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {l.kind === 1 ? KIND_LABEL[1] : `ماه ${toPersianDigits(l.lineNo)}`} · {formatLegacyJalaliDate(l.dueDate)}
              </Typography>
              <StateChip state={l.state} overdue={isOverdue(l, today)} />
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{rial(l.amount)}</Typography>
              {l.state === 2 && <VoucherLink id={l.resultVoucherId} no={l.resultVoucherNo} />}
              {l.state === 1 && <Button size="small" onClick={() => setRunRow(l)}>اجرا الان</Button>}
            </Stack>
            {l.state === 3 && l.description && <Typography variant="caption" color="text.secondary">{l.description}</Typography>}
          </Box>
        ))}
      </Box>

      {data.data && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">جمع کل (برابر مبلغ اصلی)</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{rial(data.data.totalAmount)}</Typography>
          </Stack>
          {firstOpen && firstOpen.kind !== 1 && (
            <Button color="error" variant="outlined" sx={{ mt: 2 }} onClick={() => setCancelOpen(true)}>لغو باقی‌مانده‌ها (فسخ قرارداد)</Button>
          )}
        </>
      )}

      <RunDialog row={runRow} onClose={() => setRunRow(null)} onDone={(r) => { setRunRow(null); setRunResult(r); }} />

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>لغو باقی‌مانده‌ها</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {toPersianDigits(open.length)} سطر باز به جمع {rial(open.reduce((s, l) => s + l.amount, 0))} لغو می‌شود و دیگر سندی برایشان ساخته
            نمی‌شود. سطرهای اجراشده دست نمی‌خورند؛ اگر سند تعدیلی لازم است، دستی ثبت کنید.
          </Typography>
          <TextField label="دلیل لغو" required fullWidth multiline minRows={2} value={reason}
            onChange={(e) => setReason(e.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }}
            helperText="مثلاً: فسخ قرارداد اجاره از آبان" />
          {cancel.error != null && <Box sx={{ mt: 2 }}><ErrorBanner error={cancel.error} /></Box>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>انصراف</Button>
          <Button color="error" variant="contained" disabled={!reason.trim() || cancel.isPending} onClick={() => cancel.mutate()}>لغو سطرها</Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}
