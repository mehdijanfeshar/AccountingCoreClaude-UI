import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormActions } from '../../components/FormActions';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AmountField } from '../../components/AmountField';
import { JalaliDateField } from '../../components/JalaliDateField';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { BankAccountPickerDialog } from '../../components/BankAccountPickerDialog';
import { TafsiliLevelFields } from '../../components/dynamic-tafsili/TafsiliLevelFields';
import { BeneficiaryTafsiliSelect } from './BeneficiaryTafsiliSelect';
import { PaymentRequestAccountingPanel } from './PaymentRequestAccountingPanel';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits, formatThousands } from '../../lib/format/numbers';
import { formatLegacyJalaliDate, formatPersianDateTime } from '../../lib/format/dates';
import { amountInWordsRial } from '../../lib/format/numberToWords';
import { paymentRequestsApi } from './api';
import { getPaymentRequestEventActionLabel, getPaymentRequestStateColor, getPaymentRequestStateLabel, getTreasuryPaymentMethodLabel, isPaymentRequestEditable, PAYMENT_REQUEST_STATE, TREASURY_PAYMENT_METHOD_OPTIONS, TREASURY_PAYMENT_TYPE_OPTIONS } from './treasuryPaymentRequestState';
import {
  buildEmptyPaymentRequestFormValues,
  paymentRequestDtoToFormValues,
  paymentRequestFormSchema,
  paymentRequestFormValuesToPayload,
  previewNetPayableAmount,
  type PaymentRequestFormValues,
} from './schema';
import { accountCodesApi } from '../chart-of-accounts/api';
import { bankAccountsApi } from '../bank-accounts/api';
import type { AccountCodeDto } from '../../types/accountCode';
import type { BankAccountDto } from '../../types/bankAccount';
import type { TafsiliLookupItemDto } from '../../types/tafsili';

function accountCodeLabel(account: { accCode: string | null; accCodeName: string | null }): string {
  return `${account.accCode ? `${account.accCode} — ` : ''}${account.accCodeName ?? '—'}`;
}

function bankAccountLabel(account: { accountNumber: string | null; accountHolder: string | null }): string {
  return `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`;
}

/**
 * ثبت/ویرایش درخواست پرداخت — خزانه‌داری بخش ۴-الف (`docs/tankhah-khazaneh-module.md` §۱۰).
 * هندل می‌کند `/treasury/khazaneh/payment-requests/new` و `/:id/edit`.
 *
 * «تفصیلی(های) مرکز هزینه» — اصلاح ۴-الف (۲۰۲۶-۰۹-۲۹): با انتخاب حساب هزینه، همان کامپوننت
 * مشترک `TafsiliLevelFields` (که فرم هزینه/تنخواه هم استفاده می‌کنند) یک ردیف به‌ازای هر سطح
 * تفصیلی فعال آن حساب render می‌کند — همهٔ سطوح الزامی‌اند و سرور با ۴۰۰
 * `RequiredTafsiliLevelMissing`/`TafsiliLevelNotPermitted` این را اعمال می‌کند.
 *
 * «تفصیلی ذی‌نفع» (`beneficiaryTafsiliId`) اختیاری است و از یک منبع کاملاً جدا می‌آید —
 * `GET /api/treasury/beneficiary-tafsilis` (فقط عضو گروه تفصیلی ذی‌نفعِ تنظیمات خزانهٔ واحد)، نه
 * سطوح تفصیلی حساب هزینه — به همین دلیل کامپوننت جدای `BeneficiaryTafsiliSelect` را دارد، نه
 * `TafsiliItemSelect`.
 */
export function PaymentRequestFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear } = useSession();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [bankAccountPickerOpen, setBankAccountPickerOpen] = useState(false);

  const existingQuery = useQuery({
    queryKey: ['treasury-payment-requests', id],
    queryFn: () => paymentRequestsApi.getById(id as string),
    enabled: isEdit,
  });

  const expenseAccountLookupQuery = useQuery({
    queryKey: ['account-codes', existingQuery.data?.expenseAccountId],
    queryFn: () => accountCodesApi.getById(existingQuery.data!.expenseAccountId),
    enabled: Boolean(existingQuery.data?.expenseAccountId),
  });
  const paymentAccountLookupQuery = useQuery({
    queryKey: ['bank-accounts', existingQuery.data?.paymentAccountId],
    queryFn: () => bankAccountsApi.getById(existingQuery.data!.paymentAccountId),
    enabled: Boolean(existingQuery.data?.paymentAccountId),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentRequestFormValues>({
    resolver: zodResolver(paymentRequestFormSchema),
    defaultValues: buildEmptyPaymentRequestFormValues(),
  });

  // بارگذاری اولیهٔ فرم — برچسب‌های حساب هزینه/حساب پرداخت هنوز معلوم نیستند؛ به‌محض رسیدن
  // (کوئری‌های جدا) با یک `setValue` روی همان دو فیلد پر می‌شوند، بدون `reset` دوباره کل فرم.
  useEffect(() => {
    if (existingQuery.data) {
      reset(paymentRequestDtoToFormValues(existingQuery.data, null, null));
    }
  }, [existingQuery.data, reset]);

  useEffect(() => {
    if (expenseAccountLookupQuery.data) {
      setValue('expenseAccountLabel', accountCodeLabel(expenseAccountLookupQuery.data), { shouldDirty: false });
    }
  }, [expenseAccountLookupQuery.data, setValue]);

  useEffect(() => {
    if (paymentAccountLookupQuery.data) {
      setValue('paymentAccountLabel', bankAccountLabel(paymentAccountLookupQuery.data), { shouldDirty: false });
    }
  }, [paymentAccountLookupQuery.data, setValue]);

  const expenseAccountId = watch('expenseAccountId');
  const expenseAccountLabel = watch('expenseAccountLabel');
  const costCenterTafsilis = watch('costCenterTafsilis');
  const paymentAccountLabel = watch('paymentAccountLabel');
  const beneficiaryTafsiliId = watch('beneficiaryTafsiliId');
  const beneficiaryTafsiliLabel = watch('beneficiaryTafsiliLabel');
  const beneficiaryName = watch('beneficiaryName');
  const invoiceRef = watch('invoiceRef');
  const amountBeforeTax = watch('amountBeforeTax');
  const vatAmount = watch('vatAmount');
  const insuranceDeductionAmount = watch('insuranceDeductionAmount');

  function handleBeneficiaryTafsiliChange(selection: TafsiliLookupItemDto | null) {
    setValue('beneficiaryTafsiliId', selection?.id ?? null, { shouldDirty: true });
    setValue('beneficiaryTafsiliLabel', selection?.label ?? null, { shouldDirty: true });
    // فقط وقتی نام ذی‌نفع هنوز خالی است پر می‌شود، تا انتخاب اشتباه یک مقدار قبلاً واردشده را
    // پاک نکند.
    if (selection && !beneficiaryName.trim()) {
      setValue('beneficiaryName', selection.tafsiliName ?? '', { shouldDirty: true });
    }
  }

  const netPayablePreview = useMemo(
    () => previewNetPayableAmount({ amountBeforeTax, vatAmount, insuranceDeductionAmount }),
    [amountBeforeTax, vatAmount, insuranceDeductionAmount],
  );

  const readOnly = isEdit && existingQuery.data !== undefined && !isPaymentRequestEditable(existingQuery.data.requestState);

  async function invalidateLists() {
    await queryClient.invalidateQueries({ queryKey: ['treasury-payment-requests'] });
  }

  const saveDraftMutation = useMutation({
    mutationFn: async (values: PaymentRequestFormValues) => {
      const payload = paymentRequestFormValuesToPayload(values);
      return isEdit
        ? paymentRequestsApi.update(id as string, payload)
        : paymentRequestsApi.create({ ...payload, year: financialYear || '', submit: false });
    },
    onSuccess: async () => {
      await invalidateLists();
      notify('درخواست پرداخت به‌صورت پیش‌نویس ذخیره شد.');
      navigate('/treasury/khazaneh/payment-requests');
    },
    onError: (error) => setSubmitError(error),
  });

  const submitMutation = useMutation({
    mutationFn: async (values: PaymentRequestFormValues) => {
      const payload = paymentRequestFormValuesToPayload(values);
      if (isEdit) {
        await paymentRequestsApi.update(id as string, payload);
        return paymentRequestsApi.submit(id as string);
      }
      return paymentRequestsApi.create({ ...payload, year: financialYear || '', submit: true });
    },
    onSuccess: async () => {
      await invalidateLists();
      notify('درخواست پرداخت برای تأیید ارسال شد.');
      navigate('/treasury/khazaneh/payment-requests');
    },
    onError: (error) => setSubmitError(error),
  });

  const pending = saveDraftMutation.isPending || submitMutation.isPending;

  function onSubmitForApproval(values: PaymentRequestFormValues) {
    setSubmitError(null);
    submitMutation.mutate(values);
  }

  function onSaveDraft(values: PaymentRequestFormValues) {
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
        icon={<RequestQuoteOutlinedIcon />}
        accentColor="secondary"
        title={isEdit ? 'ویرایش درخواست پرداخت' : 'ثبت درخواست پرداخت'}
        description={
          existingQuery.data
            ? `درخواست ${existingQuery.data.code}`
            : 'ثبت درخواست پرداخت برای طی مراحل تأیید مدیر واحد ← مدیر مالی ← (در صورت لزوم) مدیرعامل.'
        }
        actions={
          existingQuery.data && (
            <Chip
              color={getPaymentRequestStateColor(existingQuery.data.requestState)}
              label={getPaymentRequestStateLabel(existingQuery.data.requestState)}
            />
          )
        }
      />

      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          این درخواست در وضعیت «{getPaymentRequestStateLabel(existingQuery.data?.requestState)}» است و دیگر قابل ویرایش
          نیست — فقط درخواست‌های «پیش‌نویس» و «برگشتی» قابل ویرایش‌اند.
        </Alert>
      )}

      {/* بخش ۴-ب — تعلیق موقت. */}
      {existingQuery.data?.requestState === PAYMENT_REQUEST_STATE.suspended && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          این درخواست معلق است.{existingQuery.data.suspendReason ? ` دلیل: ${existingQuery.data.suspendReason}` : ''}
        </Alert>
      )}

      {submitError !== null && <ErrorBanner error={submitError} />}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <FormCard accentColor="secondary" watermarkIcon={<RequestQuoteOutlinedIcon />} onSubmit={handleSubmit(onSubmitForApproval)}>
            <Grid container spacing={3}>
              <Grid size={12}>
                <FormSectionLabel label="ذی‌نفع" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  {...register('beneficiaryName')}
                  label="نام ذی‌نفع"
                  fullWidth
                  required
                  disabled={readOnly}
                  slotProps={{
                    htmlInput: { maxLength: 200 },
                    input: { startAdornment: <InputAdornment position="start"><BadgeOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                  }}
                  error={!!errors.beneficiaryName}
                  helperText={errors.beneficiaryName?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  {...register('beneficiaryNationalId', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
                  label="شناسه/کد ملی"
                  fullWidth
                  disabled={readOnly}
                  slotProps={{ htmlInput: { maxLength: 11, inputMode: 'numeric' } }}
                  error={!!errors.beneficiaryNationalId}
                  helperText={errors.beneficiaryNationalId?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <Controller
                  control={control}
                  name="paymentType"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      required
                      label="نوع ذی‌نفع"
                      disabled={readOnly}
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      error={!!errors.paymentType}
                      helperText={errors.paymentType?.message}
                    >
                      {TREASURY_PAYMENT_TYPE_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <BeneficiaryTafsiliSelect
                  value={
                    beneficiaryTafsiliId
                      ? { id: beneficiaryTafsiliId, tafsiliCode: null, tafsiliName: null, label: beneficiaryTafsiliLabel ?? '' }
                      : null
                  }
                  onChange={handleBeneficiaryTafsiliChange}
                  disabled={readOnly}
                />
              </Grid>

              <Grid size={12}>
                <FormSectionLabel label="فاکتور" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  {...register('invoiceRef')}
                  label="شماره فاکتور (اختیاری)"
                  fullWidth
                  disabled={readOnly}
                  slotProps={{
                    htmlInput: { maxLength: 100 },
                    input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                  }}
                  error={!!errors.invoiceRef}
                  helperText={errors.invoiceRef?.message}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                <Controller
                  control={control}
                  name="invoiceApproved"
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} disabled={readOnly} />}
                      label="فاکتور تأیید شده"
                    />
                  )}
                />
              </Grid>
              {!!invoiceRef && errors.invoiceApproved && (
                <Grid size={12}>
                  <Alert severity="warning" variant="outlined" sx={{ py: 0.5 }}>
                    {errors.invoiceApproved.message}
                  </Alert>
                </Grid>
              )}

              <Grid size={12}>
                <FormSectionLabel label="حساب و مرکز هزینه" accentColor="secondary" />
              </Grid>
              <LinkedEntityPickerField
                icon={<ReceiptOutlinedIcon fontSize="small" color="action" />}
                label="حساب هزینه (معین)"
                value={expenseAccountLabel}
                required
                error={!!errors.expenseAccountId}
                helperText={errors.expenseAccountId?.message}
                onPick={() => setAccountPickerOpen(true)}
              />
              <TafsiliLevelFields
                accountCodeId={expenseAccountId || null}
                value={costCenterTafsilis}
                onChange={(links) => setValue('costCenterTafsilis', links, { shouldDirty: true })}
                sectionLabel="تفصیلی‌های مرکز هزینه"
                disabled={readOnly}
              />

              <Grid size={12}>
                <FormSectionLabel label="مبلغ" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AmountField
                  control={control}
                  name="amountBeforeTax"
                  label="مبلغ قبل از مالیات (ریال)"
                  required
                  disabled={readOnly}
                  icon={<PaidOutlinedIcon fontSize="small" color="action" />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AmountField control={control} name="vatPercent" label="درصد ارزش افزوده" disabled={readOnly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AmountField control={control} name="vatAmount" label="مبلغ ارزش افزوده (ریال)" disabled={readOnly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AmountField control={control} name="insuranceDeductionPercent" label="درصد کسر بیمه" disabled={readOnly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <AmountField control={control} name="insuranceDeductionAmount" label="مبلغ کسر بیمه (ریال)" disabled={readOnly} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="مبلغ خالص قابل‌پرداخت (پیش‌نمایش)"
                  fullWidth
                  disabled
                  value={netPayablePreview ? formatThousands(netPayablePreview) : ''}
                  helperText={netPayablePreview ? amountInWordsRial(netPayablePreview) : 'محاسبهٔ نهایی همیشه سمت سرور است'}
                />
              </Grid>

              <Grid size={12}>
                <FormSectionLabel label="سررسید و پرداخت" accentColor="secondary" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="dueDate"
                  render={({ field }) => (
                    <JalaliDateField
                      label="تاریخ سررسید"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      disabled={readOnly}
                      error={!!errors.dueDate}
                      helperText={errors.dueDate?.message}
                    />
                  )}
                />
              </Grid>
              <LinkedEntityPickerField
                icon={<AccountBalanceOutlinedIcon fontSize="small" color="action" />}
                label="حساب پرداخت (بانک/صندوق)"
                value={paymentAccountLabel}
                required
                error={!!errors.paymentAccountId}
                helperText={errors.paymentAccountId?.message}
                onPick={() => setBankAccountPickerOpen(true)}
              />
              <Grid size={{ xs: 12, sm: 4 }}>
                <Controller
                  control={control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="روش پرداخت"
                      disabled={readOnly}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
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
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      ایجاد: کاربر {existingQuery.data.addUserId}
                    </Typography>
                  </>
                )}
                {!readOnly && (
                  <FormActions
                    onCancel={() => navigate('/treasury/khazaneh/payment-requests')}
                    pending={pending}
                    submitLabel="ارسال برای تأیید"
                    extra={
                      <Button type="button" variant="outlined" disabled={pending} onClick={handleSubmit(onSaveDraft)}>
                        ذخیره پیش‌نویس
                      </Button>
                    }
                  />
                )}
                {readOnly && (
                  <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 3 }}>
                    <Button variant="outlined" onClick={() => navigate('/treasury/khazaneh/payment-requests')}>
                      بازگشت به فهرست
                    </Button>
                  </Stack>
                )}
              </Grid>
            </Grid>
          </FormCard>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          {/* بخش ۴-ب — فقط وقتی حداقل یک سند خودکار صادر شده باشد نمایش داده می‌شود. */}
          {isEdit && existingQuery.data && (existingQuery.data.liabilityVoucherNumber || existingQuery.data.paymentVoucherNumber) && (
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                اجرای پرداخت
              </Typography>
              <Stack spacing={1}>
                {existingQuery.data.liabilityVoucherNumber && (
                  <Typography variant="body2">شمارهٔ سند شناسایی بدهی: {existingQuery.data.liabilityVoucherNumber}</Typography>
                )}
                {existingQuery.data.paymentVoucherNumber && (
                  <Typography variant="body2">شمارهٔ سند پرداخت: {existingQuery.data.paymentVoucherNumber}</Typography>
                )}
                {existingQuery.data.bankReference && (
                  <Typography variant="body2">شمارهٔ مرجع بانکی: {existingQuery.data.bankReference}</Typography>
                )}
                {existingQuery.data.paidDate && (
                  <Typography variant="body2">تاریخ پرداخت: {formatLegacyJalaliDate(existingQuery.data.paidDate)}</Typography>
                )}
                {existingQuery.data.destinationIban && (
                  <Typography variant="body2">شبای مقصد: {existingQuery.data.destinationIban}</Typography>
                )}
                {existingQuery.data.paymentMethod != null && (
                  <Typography variant="body2">روش پرداخت: {getTreasuryPaymentMethodLabel(existingQuery.data.paymentMethod)}</Typography>
                )}
                {existingQuery.data.executedBy && (
                  <Typography variant="body2">اجراکننده: {existingQuery.data.executedBy}</Typography>
                )}
                {existingQuery.data.executedDate && (
                  <Typography variant="body2">تاریخ اجرا: {formatPersianDateTime(existingQuery.data.executedDate)}</Typography>
                )}
              </Stack>
            </Paper>
          )}

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
                        {getPaymentRequestEventActionLabel(event.action)}
                      </Typography>
                      {event.toState != null && (
                        <Chip size="small" color={getPaymentRequestStateColor(event.toState)} label={getPaymentRequestStateLabel(event.toState)} />
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
            <PaymentRequestAccountingPanel paymentRequestId={existingQuery.data.id} />
          </Grid>
        )}
      </Grid>

      <AccountCodePickerDialog
        open={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        onSelect={(account: AccountCodeDto) => {
          setValue('expenseAccountId', account.id, { shouldDirty: true, shouldValidate: true });
          setValue('expenseAccountLabel', accountCodeLabel(account), { shouldDirty: true });
          // یک تفصیلی مرکز هزینه فقط نسبت به سطوح معینی معنا دارد که زیرش انتخاب شده — تغییر
          // معین باید انتخاب‌های قبلی را پاک کند، هم‌الگوی `ExpenseFormPage.handlePickAccountCode`.
          setValue('costCenterTafsilis', [], { shouldDirty: true });
          setAccountPickerOpen(false);
        }}
      />
      <BankAccountPickerDialog
        open={bankAccountPickerOpen}
        onClose={() => setBankAccountPickerOpen(false)}
        onSelect={(account: BankAccountDto) => {
          setValue('paymentAccountId', account.id, { shouldDirty: true, shouldValidate: true });
          setValue('paymentAccountLabel', bankAccountLabel(account), { shouldDirty: true });
          setBankAccountPickerOpen(false);
        }}
      />
    </section>
  );
}
