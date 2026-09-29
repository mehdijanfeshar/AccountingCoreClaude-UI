import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { paymentRequestsApi } from './api';
import { pettyCashReplenishmentsApi } from '../petty-cash/api';

export interface CartableActionTarget {
  nature: 'payment' | 'replenishment';
  id: string;
  code: string;
}

interface CartableReviewDialogsProps {
  approveTarget: CartableActionTarget | null;
  onCloseApprove: () => void;
  rejectTarget: CartableActionTarget | null;
  onCloseReject: () => void;
  /** فقط nature === 'payment' — ترمیم تنخواه در این مرحله «برگشت» ندارد، فقط تأیید/رد. */
  returnTarget: CartableActionTarget | null;
  onCloseReturn: () => void;
  onActionSuccess?: () => void;
}

/**
 * دیالوگ‌های تأیید/برگشت/رد کارتابل ادغام‌شده — خزانه‌داری بخش ۴-الف
 * (`docs/tankhah-khazaneh-module.md` §۱۰). یک ردیف کارتابل یا یک درخواست پرداخت است یا یک ترمیم
 * تنخواهِ `PendingTreasurer`؛ `nature` مشخص می‌کند کدام endpoint واقعی فراخوانی شود:
 *   - «تأیید»: پرداخت → `POST payment-requests/{id}/approve` (یادداشت اختیاری)؛
 *              ترمیم → `POST petty-cash/replenishments/{id}/record-payment` (بدون یادداشت — همان
 *              اقدام خزانه‌دار که «ثبت پرداخت» تنخواه را نهایی می‌کند).
 *   - «رد»: هر دو نوع endpoint خودشان را دارند؛ دلیل برای درخواست پرداخت الزامی است.
 *   - «برگشت»: فقط برای درخواست پرداخت وجود دارد.
 */
export function CartableReviewDialogs({
  approveTarget,
  onCloseApprove,
  rejectTarget,
  onCloseReject,
  returnTarget,
  onCloseReturn,
  onActionSuccess,
}: CartableReviewDialogsProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [returnReason, setReturnReason] = useState('');

  useEffect(() => {
    if (!approveTarget) setApproveNote('');
  }, [approveTarget]);
  useEffect(() => {
    if (!rejectTarget) setRejectReason('');
  }, [rejectTarget]);
  useEffect(() => {
    if (!returnTarget) setReturnReason('');
  }, [returnTarget]);

  async function invalidateAfterAction() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['treasury-approval-cartable'] }),
      queryClient.invalidateQueries({ queryKey: ['treasury-payment-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-replenishments'] }),
    ]);
  }

  const approveMutation = useMutation({
    mutationFn: (target: CartableActionTarget) =>
      target.nature === 'payment'
        ? paymentRequestsApi.approve(target.id, approveNote.trim() || undefined)
        : pettyCashReplenishmentsApi.recordPayment(target.id),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify(approveTarget?.nature === 'payment' ? 'درخواست پرداخت تأیید شد.' : 'پرداخت ترمیم تنخواه ثبت شد.');
      onActionSuccess?.();
      onCloseApprove();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (target: CartableActionTarget) =>
      target.nature === 'payment'
        ? paymentRequestsApi.reject(target.id, rejectReason.trim())
        : pettyCashReplenishmentsApi.reject(target.id, rejectReason.trim() || undefined),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('رد شد.');
      onActionSuccess?.();
      onCloseReject();
    },
  });

  const returnMutation = useMutation({
    mutationFn: (target: CartableActionTarget) => paymentRequestsApi.returnRequest(target.id, returnReason.trim()),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('درخواست پرداخت برای اصلاح برگشت داده شد.');
      onActionSuccess?.();
      onCloseReturn();
    },
  });

  const rejectReasonRequired = rejectTarget?.nature === 'payment';
  const rejectInvalid = rejectReasonRequired && rejectReason.trim().length === 0;

  return (
    <>
      {/* تأیید — پرداخت: یادداشت اختیاری. ترمیم: بدون یادداشت (ثبت پرداخت). */}
      <Dialog open={approveTarget !== null} onClose={onCloseApprove} maxWidth="xs" fullWidth>
        <DialogTitle>
          {approveTarget?.nature === 'payment' ? 'تأیید درخواست پرداخت' : 'ثبت پرداخت ترمیم تنخواه'} «{approveTarget?.code ?? '—'}»
        </DialogTitle>
        <DialogContent>
          {approveMutation.error && <ErrorBanner error={approveMutation.error} />}
          {approveTarget?.nature === 'payment' ? (
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={2}
              label="یادداشت (اختیاری)"
              value={approveNote}
              onChange={(event) => setApproveNote(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              این ترمیم به‌عنوان پرداخت‌شده ثبت می‌شود. ادامه می‌دهید؟
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseApprove} color="inherit" disabled={approveMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="success"
            disabled={approveMutation.isPending}
            onClick={() => approveTarget && approveMutation.mutate(approveTarget)}
          >
            {approveMutation.isPending ? 'در حال ثبت…' : 'تأیید'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* رد — برای درخواست پرداخت دلیل الزامی است؛ برای ترمیم تنخواه اختیاری است. */}
      <Dialog open={rejectTarget !== null} onClose={onCloseReject} maxWidth="xs" fullWidth>
        <DialogTitle>رد «{rejectTarget?.code ?? '—'}»</DialogTitle>
        <DialogContent>
          {rejectMutation.error && <ErrorBanner error={rejectMutation.error} />}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            رد پایانی است و امکان اصلاح و ارسال دوباره ندارد.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            required={rejectReasonRequired}
            multiline
            minRows={2}
            label={rejectReasonRequired ? 'دلیل رد' : 'دلیل رد (اختیاری)'}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            error={rejectInvalid}
            helperText={rejectInvalid ? 'دلیل رد الزامی است.' : undefined}
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
            disabled={rejectMutation.isPending || rejectInvalid}
            onClick={() => rejectTarget && rejectMutation.mutate(rejectTarget)}
          >
            {rejectMutation.isPending ? 'در حال ثبت…' : 'رد'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* برگشت — فقط درخواست پرداخت. دلیل الزامی. */}
      <Dialog open={returnTarget !== null} onClose={onCloseReturn} maxWidth="xs" fullWidth>
        <DialogTitle>برگشت درخواست پرداخت «{returnTarget?.code ?? '—'}»</DialogTitle>
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
    </>
  );
}
