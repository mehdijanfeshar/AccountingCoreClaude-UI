import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { ApiError } from '../../lib/api/apiError';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { normalizeNumericInput, formatThousands } from '../../lib/format/numbers';
import { pettyCashRefundsApi } from './api';
import { getRefundRecorderLabel } from './pettyCashRefundRecorder';
import type { PettyCashFundDto } from '../../types/pettyCash';

interface PettyCashRefundDialogProps {
  fund: PettyCashFundDto | null;
  open: boolean;
  onClose: () => void;
}

/**
 * ثبت استرداد وجه (`TB_PC_REFUND`) — بخش ۳-الف (`docs/tankhah-khazaneh-module.md` §۹، صفحهٔ ۱۱
 * پاورپوینت). مجاز بودن کاربر سمت سرور با `TB_PC_FUND.REFUND_RECORDER` تعیین می‌شود؛ ۴۰۳ اینجا با
 * پیام فارسی مشخص (نقش پیکربندی‌شدهٔ همین تنخواه) نشان داده می‌شود، نه پیام خام سرور.
 */
export function PettyCashRefundDialog({ fund, open, onClose }: PettyCashRefundDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [refundDate, setRefundDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setAmount('');
      setRefundDate('');
      setReason('');
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      pettyCashRefundsApi.create({
        fundId: fund!.id,
        amount: Number(amount || 0),
        refundDate: refundDate.trim(),
        reason: reason.trim() ? reason.trim() : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-refunds', fund?.id] });
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] });
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-ledger'] });
      notify('استرداد وجه ثبت شد.');
      onClose();
    },
  });

  const forbidden = mutation.error instanceof ApiError && mutation.error.status === 403;
  const amountInvalid = !amount || Number(amount) <= 0;
  const dateInvalid = !refundDate.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>ثبت استرداد وجه{fund ? ` — تنخواه «${fund.name}»` : ''}</DialogTitle>
      <DialogContent>
        {forbidden ? (
          <ErrorBanner
            error={
              new Error(
                `ثبت استرداد برای این تنخواه فقط با نقش «${getRefundRecorderLabel(fund?.refundRecorder)}» مجاز است.`,
              )
            }
          />
        ) : (
          mutation.error && <ErrorBanner error={mutation.error} />
        )}

        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            autoFocus
            fullWidth
            required
            label="مبلغ (ریال)"
            value={amount ? formatThousands(amount) : ''}
            onChange={(e) => setAmount(normalizeNumericInput(e.target.value))}
            error={Boolean(amount) && amountInvalid}
            helperText={Boolean(amount) && amountInvalid ? 'باید بزرگ‌تر از صفر باشد' : undefined}
          />
          <JalaliDateField label="تاریخ استرداد" value={refundDate} onChange={setRefundDate} required />
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="دلیل (اختیاری)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          <Typography variant="caption" color="text.disabled">
            استرداد وجه معادل Legacy ندارد و مستقیماً در فرمول موجودی نقد این تنخواه لحاظ می‌شود.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          انصراف
        </Button>
        <Button
          variant="contained"
          disabled={mutation.isPending || !fund || amountInvalid || dateInvalid}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'در حال ثبت…' : 'ثبت استرداد'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
