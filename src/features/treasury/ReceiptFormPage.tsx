import { useEffect, useState } from 'react';
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
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
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
import { CustomerTafsiliSelect } from './CustomerTafsiliSelect';
import { SingleVoucherAccountingPanel } from './VoucherAccountingPanel';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits } from '../../lib/format/numbers';
import { formatPersianDateTime } from '../../lib/format/dates';
import { amountInWordsRial } from '../../lib/format/numberToWords';
import { receiptsApi } from './api';
import { getReceiptStateColor, getReceiptStateLabel, isReceiptDraft } from './receiptTransferState';
import { TREASURY_PAYMENT_METHOD_OPTIONS } from './treasuryPaymentRequestState';
import {
  buildEmptyReceiptFormValues,
  receiptDtoToFormValues,
  receiptFormSchema,
  receiptFormValuesToPayload,
  type ReceiptFormValues,
} from './schema';
import { bankAccountsApi } from '../bank-accounts/api';
import type { BankAccountDto } from '../../types/bankAccount';
import type { TafsiliLookupItemDto } from '../../types/tafsili';

function bankAccountLabel(account: { accountNumber: string | null; accountHolder: string | null }): string {
  return `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`;
}

function todayLegacyJalali(): string {
  return toLatinDigits(new DateObject({ calendar: persian, locale: persian_fa }).format('YYYYMMDD'));
}

/**
 * ثبت/ویرایش/نمایش دریافت وجه — خزانه‌داری بخش ۴-ج (`docs/tankhah-khazaneh-module.md` §۱۰).
 * هندل می‌کند `/treasury/khazaneh/receipts/new` و `/:id/edit`. دریافت وجه «گردش عملیات» ندارد
 * (بر خلاف درخواست پرداخت/انتقال وجه) — فقط یک گذار معنادار (`register`) دارد.
 */
export function ReceiptFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear } = useSession();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [bankAccountPickerOpen, setBankAccountPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const existingQuery = useQuery({
    queryKey: ['treasury-receipts', id],
    queryFn: () => receiptsApi.getById(id as string),
    enabled: isEdit,
  });

  const bankAccountLookupQuery = useQuery({
    queryKey: ['bank-accounts', existingQuery.data?.bankAccountId],
    queryFn: () => bankAccountsApi.getById(existingQuery.data!.bankAccountId),
    enabled: Boolean(existingQuery.data?.bankAccountId),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ReceiptFormValues>({
    resolver: zodResolver(receiptFormSchema),
    defaultValues: buildEmptyReceiptFormValues(todayLegacyJalali()),
  });

  useEffect(() => {
    if (existingQuery.data) {
      reset(receiptDtoToFormValues(existingQuery.data, null));
    }
  }, [existingQuery.data, reset]);

  useEffect(() => {
    if (bankAccountLookupQuery.data) {
      setValue('bankAccountLabel', bankAccountLabel(bankAccountLookupQuery.data), { shouldDirty: false });
    }
  }, [bankAccountLookupQuery.data, setValue]);

  const bankAccountLabelValue = watch('bankAccountLabel');
  const payerTafsiliId = watch('payerTafsiliId');
  const payerTafsiliLabel = watch('payerTafsiliLabel');
  const amount = watch('amount');

  function handlePayerChange(selection: TafsiliLookupItemDto | null) {
    setValue('payerTafsiliId', selection?.id ?? '', { shouldDirty: true, shouldValidate: true });
    setValue('payerTafsiliLabel', selection?.label ?? null, { shouldDirty: true });
  }

  const readOnly = isEdit && existingQuery.data !== undefined && !isReceiptDraft(existingQuery.data.state);

  async function invalidateLists() {
    await queryClient.invalidateQueries({ queryKey: ['treasury-receipts'] });
  }

  const saveDraftMutation = useMutation({
    mutationFn: async (values: ReceiptFormValues) => {
      const payload = receiptFormValuesToPayload(values);
      return isEdit
        ? receiptsApi.update(id as string, payload)
        : receiptsApi.create({ ...payload, year: financialYear || '', register: false });
    },
    onSuccess: async () => {
      await invalidateLists();
      notify('دریافت وجه به‌صورت پیش‌نویس ذخیره شد.');
      navigate('/treasury/khazaneh/receipts-transfers');
    },
    onError: (error) => setSubmitError(error),
  });

  const registerMutation = useMutation({
    mutationFn: async (values: ReceiptFormValues) => {
      const payload = receiptFormValuesToPayload(values);
      if (isEdit) {
        await receiptsApi.update(id as string, payload);
        return receiptsApi.register(id as string);
      }
      return receiptsApi.create({ ...payload, year: financialYear || '', register: true });
    },
    onSuccess: async () => {
      await invalidateLists();
      notify('دریافت وجه ثبت شد.');
      navigate('/treasury/khazaneh/receipts-transfers');
    },
    onError: (error) => setSubmitError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: () => receiptsApi.remove(id as string),
    onSuccess: async () => {
      await invalidateLists();
      notify('دریافت وجه حذف شد.');
      navigate('/treasury/khazaneh/receipts-transfers');
    },
    onError: (error) => {
      setConfirmDelete(false);
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => receiptsApi.cancel(id as string),
    onSuccess: async () => {
      await invalidateLists();
      await queryClient.invalidateQueries({ queryKey: ['treasury-receipts', id] });
      notify('دریافت وجه لغو شد.');
      setConfirmCancel(false);
    },
    onError: (error) => {
      setConfirmCancel(false);
      notify({ message: error instanceof Error ? error.message : 'لغو با خطا مواجه شد.', severity: 'error' });
    },
  });

  const pending = saveDraftMutation.isPending || registerMutation.isPending;

  function onRegister(values: ReceiptFormValues) {
    setSubmitError(null);
    registerMutation.mutate(values);
  }

  function onSaveDraft(values: ReceiptFormValues) {
    setSubmitError(null);
    saveDraftMutation.mutate(values);
  }

  if (isEdit && existingQuery.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<ReceiptOutlinedIcon />}
        accentColor="secondary"
        title={isEdit ? 'ویرایش دریافت وجه' : 'ثبت دریافت وجه'}
        description={existingQuery.data ? `دریافت ${existingQuery.data.code}` : 'ثبت دریافت وجه از یک مشتری به حساب بانکی واحد.'}
        actions={
          existingQuery.data && (
            <Chip color={getReceiptStateColor(existingQuery.data.state)} label={getReceiptStateLabel(existingQuery.data.state)} />
          )
        }
      />

      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          این دریافت در وضعیت «{getReceiptStateLabel(existingQuery.data?.state)}» است و دیگر قابل ویرایش نیست — فقط دریافت‌های
          «پیش‌نویس» قابل ویرایش‌اند.
        </Alert>
      )}

      {submitError !== null && <ErrorBanner error={submitError} />}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <FormCard accentColor="secondary" watermarkIcon={<ReceiptOutlinedIcon />} onSubmit={handleSubmit(onRegister)}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <FormSectionLabel label="پرداخت‌کننده" accentColor="secondary" />
              </Grid>
              <Grid size={12}>
                <CustomerTafsiliSelect
                  value={payerTafsiliId ? { id: payerTafsiliId, tafsiliCode: null, tafsiliName: null, label: payerTafsiliLabel ?? '' } : null}
                  onChange={handlePayerChange}
                  disabled={readOnly}
                />
                {errors.payerTafsiliId && (
                  <Typography variant="caption" color="error">
                    {errors.payerTafsiliId.message}
                  </Typography>
                )}
              </Grid>

              <Grid size={12}>
                <FormSectionLabel label="مبلغ و مقصد" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <AmountField control={control} name="amount" label="مبلغ دریافتی (ریال)" required disabled={readOnly} />
                {!!amount && Number(amount) > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {amountInWordsRial(Number(amount))}
                  </Typography>
                )}
              </Grid>
              <LinkedEntityPickerField
                icon={<AccountBalanceOutlinedIcon fontSize="small" color="action" />}
                label="حساب بانکی مقصد"
                value={bankAccountLabelValue}
                required
                error={!!errors.bankAccountId}
                helperText={errors.bankAccountId?.message}
                onPick={() => setBankAccountPickerOpen(true)}
              />
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="receiptMethod"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      required
                      label="روش دریافت"
                      disabled={readOnly}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      error={!!errors.receiptMethod}
                      helperText={errors.receiptMethod?.message}
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
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="receiptDate"
                  render={({ field }) => (
                    <JalaliDateField
                      label="تاریخ دریافت"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly}
                      error={!!errors.receiptDate}
                      helperText={errors.receiptDate?.message}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  {...register('bankReference')}
                  label="شمارهٔ پیگیری/مرجع بانکی"
                  fullWidth
                  required
                  disabled={readOnly}
                  slotProps={{
                    htmlInput: { maxLength: 100 },
                    input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                  }}
                  error={!!errors.bankReference}
                  helperText={errors.bankReference?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  {...register('invoiceRef')}
                  label="شماره فاکتور (اختیاری)"
                  fullWidth
                  disabled={readOnly}
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                  error={!!errors.invoiceRef}
                  helperText={errors.invoiceRef?.message}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  {...register('description')}
                  label="شرح (اختیاری)"
                  fullWidth
                  multiline
                  minRows={2}
                  disabled={readOnly}
                  slotProps={{
                    htmlInput: { maxLength: 1000 },
                    input: { startAdornment: <InputAdornment position="start"><DescriptionOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                  }}
                  error={!!errors.description}
                  helperText={errors.description?.message}
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
                    submitLabel="ثبت"
                    extra={
                      <>
                        <Button type="button" variant="outlined" disabled={pending} onClick={handleSubmit(onSaveDraft)}>
                          ذخیره پیش‌نویس
                        </Button>
                        {isEdit && (
                          <>
                            <Button type="button" variant="outlined" color="warning" disabled={pending} onClick={() => setConfirmCancel(true)}>
                              لغو دریافت
                            </Button>
                            <Button type="button" variant="outlined" color="error" disabled={pending} onClick={() => setConfirmDelete(true)}>
                              حذف
                            </Button>
                          </>
                        )}
                      </>
                    }
                  />
                )}
                {readOnly && (
                  <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 3 }}>
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
          {isEdit && existingQuery.data && existingQuery.data.state !== undefined && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                وضعیت
              </Typography>
              <Stack spacing={1}>
                {existingQuery.data.registeredBy && (
                  <Typography variant="body2">ثبت‌کنندهٔ نهایی: {existingQuery.data.registeredBy}</Typography>
                )}
                {existingQuery.data.registeredDate && (
                  <Typography variant="body2">تاریخ ثبت: {formatPersianDateTime(existingQuery.data.registeredDate)}</Typography>
                )}
                {existingQuery.data.voucherNumber && <Typography variant="body2">شمارهٔ سند: {existingQuery.data.voucherNumber}</Typography>}
                {existingQuery.data.payRecivCode && <Typography variant="body2">کد Legacy: {existingQuery.data.payRecivCode}</Typography>}
                {!existingQuery.data.registeredBy && (
                  <Typography variant="body2" color="text.secondary">
                    هنوز ثبت نشده است.
                  </Typography>
                )}
              </Stack>
            </Paper>
          )}
        </Grid>

        {isEdit && existingQuery.data && (
          <Grid size={12}>
            <SingleVoucherAccountingPanel
              voucherTitle="سند دریافت"
              emptyMessage="سند «دریافت» هنوز صادر نشده است — این سند هنگام ثبت دریافت صادر می‌شود."
              queryKey={['treasury-receipts', existingQuery.data.id, 'accounting']}
              queryFn={() => receiptsApi.getAccounting(existingQuery.data!.id)}
            />
          </Grid>
        )}
      </Grid>

      <BankAccountPickerDialog
        open={bankAccountPickerOpen}
        onClose={() => setBankAccountPickerOpen(false)}
        onSelect={(account: BankAccountDto) => {
          setValue('bankAccountId', account.id, { shouldDirty: true, shouldValidate: true });
          setValue('bankAccountLabel', bankAccountLabel(account), { shouldDirty: true });
          setBankAccountPickerOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="حذف دریافت وجه"
        description={existingQuery.data ? `دریافت «${existingQuery.data.code}» حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
      <ConfirmDialog
        open={confirmCancel}
        title="لغو دریافت وجه"
        description={existingQuery.data ? `دریافت «${existingQuery.data.code}» لغو می‌شود. ادامه می‌دهید؟` : undefined}
        confirmLabel="لغو دریافت"
        confirmColor="primary"
        pending={cancelMutation.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => cancelMutation.mutate()}
      />
    </section>
  );
}
