import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { pettyCashExpenseDocsApi } from './api';
import { RETURN_REASON_OPTIONS } from './pettyCashReturnReason';

export type PettyCashApprovalAction = 'verify' | 'approve' | 'reject';

/**
 * بخش ۲ — دیالوگ‌های تأیید/برگشت/رد صورت‌هزینه، مشترک بین `PettyCashCartablePage` (کارتابل) و
 * `ExpenseDocFormPage` (نوار اقدام بالای خود سند، ص ۷) — یک‌بار نوشته می‌شود تا هر دو صفحه دقیقاً
 * همان قوانین (یادداشت الزامی برای رد/برگشت) و همان مدیریت خطا را داشته باشند.
 *
 * موفقیت هر اکشن، فهرست/جزئیات سند + گردش عملیات + مانده تنخواه‌ها را invalidate می‌کند — کافی
 * است چون کلید‌های React Query این ماژول همه با پیشوند `petty-cash-expense-docs` /
 * `petty-cash-doc-events` / `petty-cash-funds` شروع می‌شوند و `invalidateQueries` پیشوندی مچ
 * می‌کند.
 *
 * ⚠️ نمایش دکمه‌ها بر اساس نقش حدس زده نمی‌شود — فراخوانی همیشه انجام می‌شود و پاسخ واقعی سرور
 * (۴۰۳ «بررسی‌کنندهٔ این تنخواه نیستید» / ۴۰۹ «نمی‌توانید سند خودتان را بررسی کنید» یا «وضعیت سند
 * تغییر کرده») با `ErrorBanner` نشان داده می‌شود.
 */

export interface PettyCashReviewDocTarget {
  id: string;
  docNumber: string | null;
}

interface PettyCashReviewDialogsProps {
  approveRejectTarget: { doc: PettyCashReviewDocTarget; action: PettyCashApprovalAction } | null;
  onCloseApproveReject: () => void;
  returnTarget: PettyCashReviewDocTarget | null;
  onCloseReturn: () => void;
  /** بعد از موفقیت هر اکشن — برای بستن نوار اقدام/ناوبری اضافه در صفحهٔ فراخوان (اختیاری). */
  onActionSuccess?: (kind: PettyCashApprovalAction | 'return', docId: string) => void;
}

export function PettyCashReviewDialogs({
  approveRejectTarget,
  onCloseApproveReject,
  returnTarget,
  onCloseReturn,
  onActionSuccess,
}: PettyCashReviewDialogsProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [actionNote, setActionNote] = useState('');
  const [returnReasons, setReturnReasons] = useState<number[]>([]);
  const [returnDeadline, setReturnDeadline] = useState('');
  const [returnNote, setReturnNote] = useState('');

  useEffect(() => {
    if (!approveRejectTarget) setActionNote('');
  }, [approveRejectTarget]);

  useEffect(() => {
    if (!returnTarget) {
      setReturnReasons([]);
      setReturnDeadline('');
      setReturnNote('');
    }
  }, [returnTarget]);

  async function invalidateAfterAction() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['petty-cash-expense-docs'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-doc-events'] }),
      queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] }),
    ]);
  }

  const verifyMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => pettyCashExpenseDocsApi.verify(id, note),
    onSuccess: async (_data, variables) => {
      await invalidateAfterAction();
      notify('کنترل سند تأیید شد.');
      onActionSuccess?.('verify', variables.id);
      onCloseApproveReject();
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => pettyCashExpenseDocsApi.approve(id, note),
    onSuccess: async (_data, variables) => {
      await invalidateAfterAction();
      notify('سند تأیید نهایی شد.');
      onActionSuccess?.('approve', variables.id);
      onCloseApproveReject();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => pettyCashExpenseDocsApi.reject(id, note),
    onSuccess: async (_data, variables) => {
      await invalidateAfterAction();
      notify('سند رد شد.');
      onActionSuccess?.('reject', variables.id);
      onCloseApproveReject();
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ id, reasonCodes, deadline, note }: { id: string; reasonCodes: number[]; deadline: string; note: string }) =>
      pettyCashExpenseDocsApi.returnDoc(id, { reasonCodes, deadline, note }),
    onSuccess: async (_data, variables) => {
      await invalidateAfterAction();
      notify('سند برگشت داده شد.');
      onActionSuccess?.('return', variables.id);
      onCloseReturn();
    },
  });

  const isReject = approveRejectTarget?.action === 'reject';
  const isVerify = approveRejectTarget?.action === 'verify';
  const actionNoteInvalid = isReject && actionNote.trim().length === 0;
  const approveRejectPending = verifyMutation.isPending || approveMutation.isPending || rejectMutation.isPending;
  const approveRejectError = isReject ? rejectMutation.error : isVerify ? verifyMutation.error : approveMutation.error;
  const approveRejectTitle = isReject ? 'رد صورت‌هزینه' : isVerify ? 'تأیید کنترل صورت‌هزینه' : 'تأیید نهایی صورت‌هزینه';
  const approveRejectColor = isReject ? 'error' : isVerify ? 'primary' : 'success';
  const approveRejectSubmitLabel = isReject ? 'رد سند' : isVerify ? 'تأیید کنترل' : 'تأیید نهایی';

  const returnNoteInvalid = returnNote.trim().length === 0;

  return (
    <>
      {/* تأیید/رد تک‌سندی. یادداشت برای تأیید اختیاری است؛ برای رد («دلیل رد») الزامی است. */}
      <Dialog open={approveRejectTarget !== null} onClose={onCloseApproveReject} maxWidth="xs" fullWidth>
        <DialogTitle>{approveRejectTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            سند «{approveRejectTarget?.doc.docNumber ?? '—'}»
            {isReject && ' — رد نهایی است و برخلاف برگشتی، امکان اصلاح و ارسال دوباره ندارد.'}
          </Typography>

          {approveRejectError && <ErrorBanner error={approveRejectError} />}

          <TextField
            autoFocus
            fullWidth
            required={isReject}
            multiline
            minRows={2}
            label={isReject ? 'دلیل رد' : 'یادداشت (اختیاری)'}
            value={actionNote}
            onChange={(event) => setActionNote(event.target.value)}
            error={actionNoteInvalid}
            helperText={actionNoteInvalid ? 'دلیل رد الزامی است.' : undefined}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseApproveReject} color="inherit" disabled={approveRejectPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color={approveRejectColor}
            disabled={approveRejectPending || actionNoteInvalid}
            onClick={() => {
              if (!approveRejectTarget) return;
              if (approveRejectTarget.action === 'verify') {
                verifyMutation.mutate({ id: approveRejectTarget.doc.id, note: actionNote.trim() || undefined });
              } else if (approveRejectTarget.action === 'approve') {
                approveMutation.mutate({ id: approveRejectTarget.doc.id, note: actionNote.trim() || undefined });
              } else {
                rejectMutation.mutate({ id: approveRejectTarget.doc.id, note: actionNote.trim() });
              }
            }}
          >
            {approveRejectPending ? 'در حال ثبت…' : approveRejectSubmitLabel}
          </Button>
        </DialogActions>
      </Dialog>

      {/* برگشت — یک یا چند دلیل چندگزینه‌ای، مهلت اصلاح و توضیح برای تنخواه‌دار، هر سه الزامی. */}
      <Dialog open={returnTarget !== null} onClose={onCloseReturn} maxWidth="sm" fullWidth>
        <DialogTitle>برگشت صورت‌هزینه «{returnTarget?.docNumber ?? '—'}»</DialogTitle>
        <DialogContent>
          {returnMutation.error && <ErrorBanner error={returnMutation.error} />}

          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            دلیل برگشت
          </Typography>
          <FormGroup>
            {RETURN_REASON_OPTIONS.map((option) => (
              <FormControlLabel
                key={option.value}
                control={
                  <Checkbox
                    checked={returnReasons.includes(option.value)}
                    onChange={(event) =>
                      setReturnReasons((prev) =>
                        event.target.checked ? [...prev, option.value] : prev.filter((v) => v !== option.value),
                      )
                    }
                  />
                }
                label={option.label}
              />
            ))}
          </FormGroup>
          {returnReasons.length === 0 && (
            <FormHelperText error>حداقل یک دلیل را انتخاب کنید.</FormHelperText>
          )}

          <Box sx={{ mt: 2 }}>
            <JalaliDateField
              label="مهلت اصلاح"
              value={returnDeadline}
              onChange={setReturnDeadline}
              required
              helperText={returnDeadline ? undefined : 'الزامی است'}
              error={!returnDeadline}
            />
          </Box>

          <TextField
            fullWidth
            required
            multiline
            minRows={2}
            label="توضیح برای تنخواه‌دار"
            value={returnNote}
            onChange={(event) => setReturnNote(event.target.value)}
            error={returnNoteInvalid}
            helperText={returnNoteInvalid ? 'الزامی است.' : undefined}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseReturn} color="inherit" disabled={returnMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={returnReasons.length === 0 || !returnDeadline || returnNoteInvalid || returnMutation.isPending}
            onClick={() =>
              returnTarget &&
              returnMutation.mutate({
                id: returnTarget.id,
                reasonCodes: returnReasons,
                deadline: returnDeadline,
                note: returnNote.trim(),
              })
            }
          >
            {returnMutation.isPending ? 'در حال ثبت…' : 'برگشت سند'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
