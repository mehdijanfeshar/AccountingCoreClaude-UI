import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { transfersApi } from './api';
import { approveTransferFormSchema, type ApproveTransferFormValues } from './schema';

export interface TransferReviewTarget {
  id: string;
  code: string;
}

interface TransferReviewDialogsProps {
  approveTarget: TransferReviewTarget | null;
  onCloseApprove: () => void;
  returnTarget: TransferReviewTarget | null;
  onCloseReturn: () => void;
  rejectTarget: TransferReviewTarget | null;
  onCloseReject: () => void;
  onActionSuccess?: () => void;
}

/**
 * دیالوگ‌های تأیید/برگشت/رد انتقال وجه — خزانه‌داری بخش ۴-ج (`docs/tankhah-khazaneh-module.md`
 * §۱۰). فقط از «در انتظار تأیید خزانه‌دار» — تأیید دو کنترل مسدودکننده سمت سرور دارد (موجودی
 * مبدأ، سقف روزانه) که این‌جا فقط پیام ۴۰۹ آن نمایش داده می‌شود، هم‌الگوی
 * `CartableReviewDialogs`/`PaymentExecutionDialogs`.
 */
export function TransferReviewDialogs({
  approveTarget,
  onCloseApprove,
  returnTarget,
  onCloseReturn,
  rejectTarget,
  onCloseReject,
  onActionSuccess,
}: TransferReviewDialogsProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [returnReason, setReturnReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!returnTarget) setReturnReason('');
  }, [returnTarget]);
  useEffect(() => {
    if (!rejectTarget) setRejectReason('');
  }, [rejectTarget]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApproveTransferFormValues>({
    resolver: zodResolver(approveTransferFormSchema),
    defaultValues: { bankReference: '' },
  });

  useEffect(() => {
    if (approveTarget) reset({ bankReference: '' });
  }, [approveTarget, reset]);

  async function invalidateAfterAction() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['treasury-transfers'] }),
      queryClient.invalidateQueries({ queryKey: ['treasury-approval-cartable'] }),
    ]);
  }

  const approveMutation = useMutation({
    mutationFn: (values: ApproveTransferFormValues) => transfersApi.approve(approveTarget!.id, values.bankReference),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('انتقال وجه تأیید و سند حسابداری صادر شد.');
      onActionSuccess?.();
      onCloseApprove();
    },
  });

  const returnMutation = useMutation({
    mutationFn: (target: TransferReviewTarget) => transfersApi.returnTransfer(target.id, returnReason.trim()),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('انتقال وجه برای اصلاح برگشت داده شد.');
      onActionSuccess?.();
      onCloseReturn();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (target: TransferReviewTarget) => transfersApi.reject(target.id, rejectReason.trim()),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('انتقال وجه رد شد.');
      onActionSuccess?.();
      onCloseReject();
    },
  });

  return (
    <>
      {/* تأیید — شمارهٔ مرجع بانکی الزامی؛ بلافاصله سند GL موقت صادر می‌شود. */}
      <Dialog open={approveTarget !== null} onClose={onCloseApprove} maxWidth="xs" fullWidth>
        <DialogTitle>تأیید انتقال وجه «{approveTarget?.code ?? '—'}»</DialogTitle>
        <DialogContent>
          {approveMutation.error && <ErrorBanner error={approveMutation.error} />}
          <TextField
            {...register('bankReference')}
            autoFocus
            fullWidth
            required
            label="شمارهٔ پیگیری/مرجع بانکی"
            error={!!errors.bankReference}
            helperText={errors.bankReference?.message}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseApprove} color="inherit" disabled={approveMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={approveMutation.isPending}
            onClick={handleSubmit((values) => approveMutation.mutate(values))}
          >
            {approveMutation.isPending ? 'در حال ثبت…' : 'تأیید'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* برگشت — دلیل اجباری. */}
      <Dialog open={returnTarget !== null} onClose={onCloseReturn} maxWidth="xs" fullWidth>
        <DialogTitle>برگشت انتقال وجه «{returnTarget?.code ?? '—'}»</DialogTitle>
        <DialogContent>
          {returnMutation.error && <ErrorBanner error={returnMutation.error} />}
          <TextField
            autoFocus
            fullWidth
            required
            multiline
            minRows={2}
            label="دلیل برگشت"
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
            error={returnReason.trim().length === 0}
            helperText={returnReason.trim().length === 0 ? 'الزامی است.' : undefined}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseReturn} color="inherit" disabled={returnMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={returnMutation.isPending || returnReason.trim().length === 0}
            onClick={() => returnTarget && returnMutation.mutate(returnTarget)}
          >
            {returnMutation.isPending ? 'در حال ثبت…' : 'برگشت'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* رد — پایانی، دلیل اجباری. */}
      <Dialog open={rejectTarget !== null} onClose={onCloseReject} maxWidth="xs" fullWidth>
        <DialogTitle>رد انتقال وجه «{rejectTarget?.code ?? '—'}»</DialogTitle>
        <DialogContent>
          {rejectMutation.error && <ErrorBanner error={rejectMutation.error} />}
          <TextField
            autoFocus
            fullWidth
            required
            multiline
            minRows={2}
            label="دلیل رد"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            error={rejectReason.trim().length === 0}
            helperText={rejectReason.trim().length === 0 ? 'الزامی است.' : undefined}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseReject} color="inherit" disabled={rejectMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={rejectMutation.isPending || rejectReason.trim().length === 0}
            onClick={() => rejectTarget && rejectMutation.mutate(rejectTarget)}
          >
            {rejectMutation.isPending ? 'در حال ثبت…' : 'رد'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
