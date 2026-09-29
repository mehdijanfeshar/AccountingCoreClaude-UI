import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormActions } from '../../components/FormActions';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AmountField } from '../../components/AmountField';
import { JalaliDateField } from '../../components/JalaliDateField';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { BankAccountPickerDialog } from '../../components/BankAccountPickerDialog';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SingleVoucherAccountingPanel } from './VoucherAccountingPanel';
import { TransferReviewDialogs, type TransferReviewTarget } from './TransferReviewDialogs';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, formatThousands } from '../../lib/format/numbers';
import { formatPersianDateTime } from '../../lib/format/dates';
import { amountInWordsRial } from '../../lib/format/numberToWords';
import { bankAccountBalanceApi, transfersApi } from './api';
import {
  getTransferEventActionLabel,
  getTransferStateColor,
  getTransferStateLabel,
  isTransferEditable,
  isTransferPendingTreasurer,
  TRANSFER_STATE,
} from './receiptTransferState';
import { TREASURY_PAYMENT_METHOD_OPTIONS } from './treasuryPaymentRequestState';
import {
  buildEmptyTransferFormValues,
  transferDtoToFormValues,
  transferFormSchema,
  transferFormValuesToPayload,
  type TransferFormValues,
} from './schema';
import { bankAccountsApi } from '../bank-accounts/api';
import type { BankAccountDto } from '../../types/bankAccount';

function bankAccountLabel(account: { accountNumber: string | null; accountHolder: string | null }): string {
  return `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`;
}

function todayLegacyJalali(): string {
  return toLatinDigits(new DateObject({ calendar: persian, locale: persian_fa }).format('YYYYMMDD'));
}

/**
 * ثبت/ویرایش/نمایش انتقال وجه — خزانه‌داری بخش ۴-ج (`docs/tankhah-khazaneh-module.md` §۱۰).
 * هندل می‌کند `/treasury/khazaneh/transfers/new` و `/:id/edit`. «موجودی فعلی»/«پس از انتقال» فقط
 * پیش‌نمایش سمت کلاینت است — کنترل واقعی موجودی/سقف روزانه همیشه سمت سرور در لحظهٔ تأیید انجام
 * می‌شود (۴۰۹ اگر رد شود).
 */
export function TransferFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear } = useSession();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [destPickerOpen, setDestPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [approveTarget, setApproveTarget] = useState<TransferReviewTarget | null>(null);
  const [returnTarget, setReturnTarget] = useState<TransferReviewTarget | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TransferReviewTarget | null>(null);

  const existingQuery = useQuery({
    queryKey: ['treasury-transfers', id],
    queryFn: () => transfersApi.getById(id as string),
    enabled: isEdit,
  });

  const sourceLookupQuery = useQuery({
    queryKey: ['bank-accounts', existingQuery.data?.sourceBankAccountId],
    queryFn: () => bankAccountsApi.getById(existingQuery.data!.sourceBankAccountId),
    enabled: Boolean(existingQuery.data?.sourceBankAccountId),
  });
  const destLookupQuery = useQuery({
    queryKey: ['bank-accounts', existingQuery.data?.destBankAccountId],
    queryFn: () => bankAccountsApi.getById(existingQuery.data!.destBankAccountId),
    enabled: Boolean(existingQuery.data?.destBankAccountId),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: buildEmptyTransferFormValues(todayLegacyJalali()),
  });

  useEffect(() => {
    if (existingQuery.data) {
      reset(transferDtoToFormValues(existingQuery.data, null, null));
    }
  }, [existingQuery.data, reset]);

  useEffect(() => {
    if (sourceLookupQuery.data) {
      setValue('sourceBankAccountLabel', bankAccountLabel(sourceLookupQuery.data), { shouldDirty: false });
    }
  }, [sourceLookupQuery.data, setValue]);
  useEffect(() => {
    if (destLookupQuery.data) {
      setValue('destBankAccountLabel', bankAccountLabel(destLookupQuery.data), { shouldDirty: false });
    }
  }, [destLookupQuery.data, setValue]);

  const sourceBankAccountId = watch('sourceBankAccountId');
  const sourceBankAccountLabel = watch('sourceBankAccountLabel');
  const destBankAccountId = watch('destBankAccountId');
  const destBankAccountLabel = watch('destBankAccountLabel');
  const amount = watch('amount');

  const sourceBalanceQuery = useQuery({
    queryKey: ['treasury-bank-account-balance', sourceBankAccountId],
    queryFn: () => bankAccountBalanceApi.get(sourceBankAccountId),
    enabled: Boolean(sourceBankAccountId),
  });
  const destBalanceQuery = useQuery({
    queryKey: ['treasury-bank-account-balance', destBankAccountId],
    queryFn: () => bankAccountBalanceApi.get(destBankAccountId),
    enabled: Boolean(destBankAccountId),
  });

  const amountNumber = Number(amount || 0);
  const sourceAfterTransfer = useMemo(
    () => (sourceBalanceQuery.data ? sourceBalanceQuery.data.balance - amountNumber : null),
    [sourceBalanceQuery.data, amountNumber],
  );
  const destAfterTransfer = useMemo(
    () => (destBalanceQuery.data ? destBalanceQuery.data.balance + amountNumber : null),
    [destBalanceQuery.data, amountNumber],
  );

  const readOnly = isEdit && existingQuery.data !== undefined && !isTransferEditable(existingQuery.data.state);

  async function invalidateLists() {
    await queryClient.invalidateQueries({ queryKey: ['treasury-transfers'] });
  }

  const saveDraftMutation = useMutation({
    mutationFn: async (values: TransferFormValues) => {
      const payload = transferFormValuesToPayload(values);
      return isEdit
        ? transfersApi.update(id as string, payload)
        : transfersApi.create({ ...payload, year: financialYear || '' });
    },
    onSuccess: async () => {
      await invalidateLists();
      notify('انتقال وجه به‌صورت پیش‌نویس ذخیره شد.');
      navigate('/treasury/khazaneh/receipts-transfers');
    },
    onError: (error) => setSubmitError(error),
  });

  const submitMutation = useMutation({
    mutationFn: async (values: TransferFormValues) => {
      const payload = transferFormValuesToPayload(values);
      if (isEdit) {
        await transfersApi.update(id as string, payload);
        return transfersApi.submit(id as string);
      }
      const created = await transfersApi.create({ ...payload, year: financialYear || '' });
      await transfersApi.submit(created.id);
      return created;
    },
    onSuccess: async () => {
      await invalidateLists();
      notify('انتقال وجه برای تأیید خزانه‌دار ارسال شد.');
      navigate('/treasury/khazaneh/receipts-transfers');
    },
    onError: (error) => setSubmitError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: () => transfersApi.remove(id as string),
    onSuccess: async () => {
      await invalidateLists();
      notify('انتقال وجه حذف شد.');
      navigate('/treasury/khazaneh/receipts-transfers');
    },
    onError: (error) => {
      setConfirmDelete(false);
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const pending = saveDraftMutation.isPending || submitMutation.isPending;

  function onSubmitForApproval(values: TransferFormValues) {
    setSubmitError(null);
    submitMutation.mutate(values);
  }

  function onSaveDraft(values: TransferFormValues) {
    setSubmitError(null);
    saveDraftMutation.mutate(values);
  }

  async function handleReviewActionSuccess() {
    if (id) await queryClient.invalidateQueries({ queryKey: ['treasury-transfers', id] });
  }

  if (isEdit && existingQuery.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  const pendingTreasurer = isEdit && isTransferPendingTreasurer(existingQuery.data?.state);
  const reviewTarget: TransferReviewTarget | null = existingQuery.data
    ? { id: existingQuery.data.id, code: existingQuery.data.code }
    : null;

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<CompareArrowsOutlinedIcon />}
        accentColor="secondary"
        title={isEdit ? 'ویرایش انتقال وجه' : 'ثبت انتقال وجه'}
        description={existingQuery.data ? `انتقال ${existingQuery.data.code}` : 'انتقال وجه بین دو حساب بانکی واحد.'}
        actions={
          existingQuery.data && (
            <Chip color={getTransferStateColor(existingQuery.data.state)} label={getTransferStateLabel(existingQuery.data.state)} />
          )
        }
      />

      {readOnly && !pendingTreasurer && (
        <Alert severity="info" sx={{ mb: 2 }}>
          این انتقال در وضعیت «{getTransferStateLabel(existingQuery.data?.state)}» است و دیگر قابل ویرایش نیست — فقط انتقال‌های
          «پیش‌نویس» و «برگشتی» قابل ویرایش‌اند.
        </Alert>
      )}
      {pendingTreasurer && (
        <Alert severity="info" sx={{ mb: 2 }}>
          این انتقال در انتظار تأیید خزانه‌دار است.
        </Alert>
      )}
      {existingQuery.data?.state === TRANSFER_STATE.returned && existingQuery.data.returnReason && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          دلیل برگشت: {existingQuery.data.returnReason}
        </Alert>
      )}

      {submitError !== null && <ErrorBanner error={submitError} />}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <FormCard accentColor="secondary" watermarkIcon={<CompareArrowsOutlinedIcon />} onSubmit={handleSubmit(onSubmitForApproval)}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <FormSectionLabel label="حساب مبدأ" accentColor="secondary" />
              </Grid>
              <LinkedEntityPickerField
                icon={<AccountBalanceOutlinedIcon fontSize="small" color="action" />}
                label="حساب بانکی مبدأ"
                value={sourceBankAccountLabel}
                required
                error={!!errors.sourceBankAccountId}
                helperText={errors.sourceBankAccountId?.message}
                onPick={() => setSourcePickerOpen(true)}
              />
              {sourceBankAccountId && (
                <Grid size={12}>
                  <Stack direction="row" spacing={3}>
                    <Typography variant="body2">
                      موجودی فعلی:{' '}
                      {sourceBalanceQuery.isLoading ? 'در حال بارگذاری…' : sourceBalanceQuery.data ? formatThousands(sourceBalanceQuery.data.balance) : '—'}
                    </Typography>
                    <Typography variant="body2" color={sourceAfterTransfer != null && sourceAfterTransfer < 0 ? 'error.main' : 'text.primary'}>
                      پس از انتقال: {sourceAfterTransfer != null ? formatThousands(sourceAfterTransfer) : '—'}
                    </Typography>
                  </Stack>
                </Grid>
              )}

              <Grid size={12}>
                <FormSectionLabel label="حساب مقصد" accentColor="secondary" />
              </Grid>
              <LinkedEntityPickerField
                icon={<AccountBalanceOutlinedIcon fontSize="small" color="action" />}
                label="حساب بانکی مقصد"
                value={destBankAccountLabel}
                required
                error={!!errors.destBankAccountId}
                helperText={errors.destBankAccountId?.message}
                onPick={() => setDestPickerOpen(true)}
              />
              {destBankAccountId && (
                <Grid size={12}>
                  <Stack direction="row" spacing={3}>
                    <Typography variant="body2">
                      موجودی فعلی:{' '}
                      {destBalanceQuery.isLoading ? 'در حال بارگذاری…' : destBalanceQuery.data ? formatThousands(destBalanceQuery.data.balance) : '—'}
                    </Typography>
                    <Typography variant="body2">پس از انتقال: {destAfterTransfer != null ? formatThousands(destAfterTransfer) : '—'}</Typography>
                  </Stack>
                </Grid>
              )}

              <Grid size={12}>
                <FormSectionLabel label="مبلغ و شرایط" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AmountField control={control} name="amount" label="مبلغ انتقال (ریال)" required disabled={readOnly} />
                {!!amount && Number(amount) > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {amountInWordsRial(Number(amount))}
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="transferDate"
                  render={({ field }) => (
                    <JalaliDateField
                      label="تاریخ انتقال"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly}
                      error={!!errors.transferDate}
                      helperText={errors.transferDate?.message}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="transferMethod"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      required
                      label="روش انتقال"
                      disabled={readOnly}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      error={!!errors.transferMethod}
                      helperText={errors.transferMethod?.message}
                    >
                      {TREASURY_PAYMENT_METHOD_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  {...register('reason')}
                  label="دلیل انتقال"
                  fullWidth
                  required
                  multiline
                  minRows={2}
                  disabled={readOnly}
                  slotProps={{
                    htmlInput: { maxLength: 1000 },
                    input: { startAdornment: <DescriptionOutlinedIcon fontSize="small" color="action" sx={{ mr: 1 }} /> },
                  }}
                  error={!!errors.reason}
                  helperText={errors.reason?.message}
                />
              </Grid>

              <Grid size={12}>
                {isEdit && existingQuery.data?.addUserId && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    ایجاد: کاربر {existingQuery.data.addUserId}
                  </Typography>
                )}
                {!readOnly && (
                  <FormActions
                    onCancel={() => navigate('/treasury/khazaneh/receipts-transfers')}
                    pending={pending}
                    submitLabel="ارسال برای تأیید"
                    extra={
                      <>
                        <Button type="button" variant="outlined" disabled={pending} onClick={handleSubmit(onSaveDraft)}>
                          ذخیره پیش‌نویس
                        </Button>
                        {isEdit && (
                          <Button type="button" variant="outlined" color="error" disabled={pending} onClick={() => setConfirmDelete(true)}>
                            حذف
                          </Button>
                        )}
                      </>
                    }
                  />
                )}
                {readOnly && (
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 3, flexWrap: 'wrap' }}>
                    {pendingTreasurer && reviewTarget && (
                      <>
                        <Button variant="contained" color="success" onClick={() => setApproveTarget(reviewTarget)}>
                          تأیید
                        </Button>
                        <Button variant="outlined" color="warning" onClick={() => setReturnTarget(reviewTarget)}>
                          برگشت
                        </Button>
                        <Button variant="outlined" color="error" onClick={() => setRejectTarget(reviewTarget)}>
                          رد
                        </Button>
                      </>
                    )}
                    <Button variant="outlined" onClick={() => navigate('/treasury/khazaneh/receipts-transfers')}>
                      بازگشت به فهرست
                    </Button>
                  </Stack>
                )}
              </Grid>
            </Grid>
          </FormCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          {isEdit && existingQuery.data && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                گردش عملیات
              </Typography>
              {existingQuery.data.events.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  هنوز رویدادی ثبت نشده است.
                </Typography>
              )}
              <Stack spacing={1.5}>
                {[...existingQuery.data.events].reverse().map((event) => (
                  <Stack key={event.id} spacing={0.25}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {getTransferEventActionLabel(event.action)}
                      </Typography>
                      {event.toState != null && (
                        <Chip size="small" color={getTransferStateColor(event.toState)} label={getTransferStateLabel(event.toState)} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {formatPersianDateTime(event.createdDate)} — کاربر: {event.userId}
                    </Typography>
                    {event.note && (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {event.note}
                      </Typography>
                    )}
                    <Divider sx={{ mt: 1 }} />
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}
        </Grid>

        {isEdit && existingQuery.data && (
          <Grid size={12}>
            <SingleVoucherAccountingPanel
              voucherTitle="سند انتقال"
              emptyMessage="سند «انتقال» هنوز صادر نشده است — این سند هنگام تأیید خزانه‌دار صادر می‌شود."
              queryKey={['treasury-transfers', existingQuery.data.id, 'accounting']}
              queryFn={() => transfersApi.getAccounting(existingQuery.data!.id)}
            />
          </Grid>
        )}
      </Grid>

      <BankAccountPickerDialog
        open={sourcePickerOpen}
        title="انتخاب حساب بانکی مبدأ"
        onClose={() => setSourcePickerOpen(false)}
        onSelect={(account: BankAccountDto) => {
          setValue('sourceBankAccountId', account.id, { shouldDirty: true, shouldValidate: true });
          setValue('sourceBankAccountLabel', bankAccountLabel(account), { shouldDirty: true });
          setSourcePickerOpen(false);
        }}
      />
      <BankAccountPickerDialog
        open={destPickerOpen}
        title="انتخاب حساب بانکی مقصد"
        onClose={() => setDestPickerOpen(false)}
        onSelect={(account: BankAccountDto) => {
          setValue('destBankAccountId', account.id, { shouldDirty: true, shouldValidate: true });
          setValue('destBankAccountLabel', bankAccountLabel(account), { shouldDirty: true });
          setDestPickerOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="حذف انتقال وجه"
        description={existingQuery.data ? `انتقال «${existingQuery.data.code}» حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />

      <TransferReviewDialogs
        approveTarget={approveTarget}
        onCloseApprove={() => setApproveTarget(null)}
        returnTarget={returnTarget}
        onCloseReturn={() => setReturnTarget(null)}
        rejectTarget={rejectTarget}
        onCloseReject={() => setRejectTarget(null)}
        onActionSuccess={handleReviewActionSuccess}
      />
    </section>
  );
}
