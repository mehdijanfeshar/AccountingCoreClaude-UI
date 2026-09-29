import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits, formatThousands } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { paymentRequestsApi } from './api';
import { bankAccountsApi } from '../bank-accounts/api';
import { TREASURY_PAYMENT_METHOD_OPTIONS } from './treasuryPaymentRequestState';
import {
  buildEmptyExecutePaymentRequestFormValues,
  executePaymentRequestFormSchema,
  executePaymentRequestFormValuesToPayload,
  type ExecutePaymentRequestFormValues,
} from './schema';
import type { PaymentRequestListItemDto } from '../../types/treasury';

function todayLegacyJalali(): string {
  return toLatinDigits(new DateObject({ calendar: persian, locale: persian_fa }).format('YYYYMMDD'));
}

function bankAccountLabel(account: { accountNumber: string | null; accountHolder: string | null }): string {
  return `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`;
}

interface PaymentExecutionDialogsProps {
  executeTarget: PaymentRequestListItemDto | null;
  onCloseExecute: () => void;
  suspendTarget: PaymentRequestListItemDto | null;
  onCloseSuspend: () => void;
  resumeTarget: PaymentRequestListItemDto | null;
  onCloseResume: () => void;
  onActionSuccess?: () => void;
}

/**
 * دیالوگ‌های «اجرای پرداخت» — خزانه‌داری بخش ۴-ب (`docs/tankhah-khazaneh-module.md` §۱۰). سه
 * اقدام مستقل روی یک درخواست پرداخت `ReadyForExecution`/`Suspended`:
 *   - اجرا: `POST payment-requests/{id}/execute` — قطعی، سند «پرداخت» بلافاصله صادر می‌شود؛
 *   - تعلیق: `POST payment-requests/{id}/suspend` — دلیل اجباری؛
 *   - رفع تعلیق: `POST payment-requests/{id}/resume` — بدون بدنه.
 */
export function PaymentExecutionDialogs({
  executeTarget,
  onCloseExecute,
  suspendTarget,
  onCloseSuspend,
  resumeTarget,
  onCloseResume,
  onActionSuccess,
}: PaymentExecutionDialogsProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    if (!suspendTarget) setSuspendReason('');
  }, [suspendTarget]);

  async function invalidateAfterAction() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['treasury-payment-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['treasury-approval-cartable'] }),
    ]);
  }

  // جزئیات کامل + برچسب حساب پرداخت (مبدأ) — فقط برای خلاصهٔ دیالوگ اجرا؛ فهرست «اجرای پرداخت»
  // خودش این‌ها را ندارد (`PaymentRequestListItemDto` شامل `paymentAccountId` نیست).
  const detailQuery = useQuery({
    queryKey: ['treasury-payment-requests', executeTarget?.id],
    queryFn: () => paymentRequestsApi.getById(executeTarget!.id),
    enabled: executeTarget !== null,
  });
  const paymentAccountQuery = useQuery({
    queryKey: ['bank-accounts', detailQuery.data?.paymentAccountId],
    queryFn: () => bankAccountsApi.getById(detailQuery.data!.paymentAccountId),
    enabled: Boolean(detailQuery.data?.paymentAccountId),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExecutePaymentRequestFormValues>({
    resolver: zodResolver(executePaymentRequestFormSchema),
    defaultValues: buildEmptyExecutePaymentRequestFormValues(todayLegacyJalali()),
  });

  useEffect(() => {
    if (executeTarget) {
      reset(buildEmptyExecutePaymentRequestFormValues(todayLegacyJalali()));
    }
  }, [executeTarget, reset]);

  const executeMutation = useMutation({
    mutationFn: (values: ExecutePaymentRequestFormValues) =>
      paymentRequestsApi.execute(executeTarget!.id, executePaymentRequestFormValuesToPayload(values)),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('پرداخت با موفقیت اجرا شد.');
      onActionSuccess?.();
      onCloseExecute();
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (target: PaymentRequestListItemDto) => paymentRequestsApi.suspend(target.id, suspendReason.trim()),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('درخواست پرداخت معلق شد.');
      onActionSuccess?.();
      onCloseSuspend();
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (target: PaymentRequestListItemDto) => paymentRequestsApi.resume(target.id),
    onSuccess: async () => {
      await invalidateAfterAction();
      notify('تعلیق رفع شد؛ درخواست دوباره آمادهٔ اجراست.');
      onActionSuccess?.();
      onCloseResume();
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'رفع تعلیق با خطا مواجه شد.', severity: 'error' });
    },
  });

  function onSubmitExecute(values: ExecutePaymentRequestFormValues) {
    executeMutation.mutate(values);
  }

  return (
    <>
      {/* اجرا — قطعی؛ سند «پرداخت» بلافاصله صادر می‌شود. */}
      <Dialog open={executeTarget !== null} onClose={onCloseExecute} maxWidth="sm" fullWidth>
        <DialogTitle>اجرای پرداخت «{executeTarget?.code ?? '—'}»</DialogTitle>
        <DialogContent>
          {executeMutation.error && <ErrorBanner error={executeMutation.error} />}

          <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="body2">ذی‌نفع: {executeTarget?.beneficiaryName ?? '—'}</Typography>
            <Typography variant="body2">
              مبلغ خالص قابل‌پرداخت: {executeTarget ? formatThousands(executeTarget.netPayableAmount) : '—'} ریال
            </Typography>
            <Typography variant="body2">سررسید: {executeTarget ? formatLegacyJalaliDate(executeTarget.dueDate) : '—'}</Typography>
            <Typography variant="body2">
              حساب پرداخت (مبدأ):{' '}
              {paymentAccountQuery.data
                ? bankAccountLabel(paymentAccountQuery.data)
                : paymentAccountQuery.isLoading
                  ? 'در حال بارگذاری…'
                  : '—'}
            </Typography>
          </Stack>

          <Alert severity="warning" sx={{ mb: 2 }}>
            اجرای پرداخت قطعی است و بلافاصله سند «پرداخت» صادر می‌شود؛ لغو آن فقط از طریق بانک ممکن است، نه از این
            صفحه.
          </Alert>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                control={control}
                name="bankReference"
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    required
                    autoFocus
                    label="شمارهٔ پیگیری/مرجع بانکی"
                    error={!!errors.bankReference}
                    helperText={errors.bankReference?.message}
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                control={control}
                name="paidDate"
                render={({ field }) => (
                  <JalaliDateField
                    label="تاریخ پرداخت"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    error={!!errors.paidDate}
                    helperText={errors.paidDate?.message}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                control={control}
                name="destinationIban"
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(toLatinDigits(event.target.value).toUpperCase())}
                    fullWidth
                    label="شمارهٔ شبای مقصد (اختیاری)"
                    placeholder="IR000000000000000000000000"
                    error={!!errors.destinationIban}
                    helperText={errors.destinationIban?.message}
                    slotProps={{ htmlInput: { maxLength: 26 } }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    label="روش پرداخت (اختیاری)"
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value === '' ? null : Number(event.target.value))}
                    error={!!errors.paymentMethod}
                    helperText={errors.paymentMethod?.message}
                  >
                    <MenuItem value="">تعیین‌نشده</MenuItem>
                    {TREASURY_PAYMENT_METHOD_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseExecute} color="inherit" disabled={executeMutation.isPending}>
            انصراف
          </Button>
          <Button variant="contained" color="success" disabled={executeMutation.isPending} onClick={handleSubmit(onSubmitExecute)}>
            {executeMutation.isPending ? 'در حال اجرا…' : 'اجرای پرداخت'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* تعلیق — دلیل اجباری. */}
      <Dialog open={suspendTarget !== null} onClose={onCloseSuspend} maxWidth="xs" fullWidth>
        <DialogTitle>تعلیق «{suspendTarget?.code ?? '—'}»</DialogTitle>
        <DialogContent>
          {suspendMutation.error && <ErrorBanner error={suspendMutation.error} />}
          <TextField
            autoFocus
            fullWidth
            required
            multiline
            minRows={2}
            label="دلیل تعلیق"
            value={suspendReason}
            onChange={(event) => setSuspendReason(event.target.value)}
            error={suspendReason.trim().length === 0}
            helperText={suspendReason.trim().length === 0 ? 'الزامی است.' : undefined}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCloseSuspend} color="inherit" disabled={suspendMutation.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={suspendMutation.isPending || suspendReason.trim().length === 0}
            onClick={() => suspendTarget && suspendMutation.mutate(suspendTarget)}
          >
            {suspendMutation.isPending ? 'در حال ثبت…' : 'تعلیق'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* رفع تعلیق — بدون بدنه. */}
      <ConfirmDialog
        open={resumeTarget !== null}
        title="رفع تعلیق"
        description={resumeTarget ? `درخواست «${resumeTarget.code}» دوباره آمادهٔ اجرا می‌شود. ادامه می‌دهید؟` : undefined}
        confirmLabel="رفع تعلیق"
        confirmColor="primary"
        pending={resumeMutation.isPending}
        onCancel={onCloseResume}
        onConfirm={() => resumeTarget && resumeMutation.mutate(resumeTarget)}
      />
    </>
  );
}
