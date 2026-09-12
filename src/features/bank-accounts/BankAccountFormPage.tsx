import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { AmountField } from '../../components/AmountField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { accountCodesApi } from '../chart-of-accounts/api';
import { bankAccountsApi } from './api';
import {
  bankAccountDtoToFormValues,
  bankAccountFormSchema,
  bankAccountFormValuesToPayload,
  emptyBankAccountFormValues,
  type BankAccountFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';

/** Handles both `/base/bank-accounts/new` and `/base/bank-accounts/:id/edit`. */
export function BankAccountFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['bank-accounts', id],
    queryFn: () => bankAccountsApi.getById(id as string),
    enabled: isEdit,
  });

  const accountCodeId = existingQuery.data?.accountCodeId ?? null;
  const existingAccountCodeQuery = useQuery({
    queryKey: ['account-codes', accountCodeId],
    queryFn: () => accountCodesApi.getById(accountCodeId as string),
    enabled: accountCodeId !== null,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: emptyBankAccountFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    if (existingQuery.data.accountCodeId && !existingAccountCodeQuery.data) return;
    const account = existingAccountCodeQuery.data;
    const accountCodeLabel = account ? `${account.accCode ?? ''} - ${account.accCodeName ?? ''}` : null;
    reset(bankAccountDtoToFormValues(existingQuery.data, accountCodeLabel));
  }, [existingQuery.data, existingAccountCodeQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: BankAccountFormValues) => bankAccountsApi.create(bankAccountFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: BankAccountFormValues) =>
      bankAccountsApi.update(id as string, bankAccountFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: BankAccountFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      notify(isEdit ? 'حساب بانکی ویرایش شد.' : 'حساب بانکی جدید ذخیره شد.');
      navigate('/base/bank-accounts');
    } catch (error) {
      setSubmitError(error);
    }
  }

  function handlePickAccountCode(account: AccountCodeDto) {
    setValue('accountCodeId', account.id, { shouldDirty: true });
    setValue('accountCodeLabel', `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`, { shouldDirty: true });
  }

  const accountCodeLabel = watch('accountCodeLabel');

  if (isEdit && (existingQuery.isLoading || (accountCodeId !== null && existingAccountCodeQuery.isLoading))) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 4 }}>
        <CircularProgress size={20} />
        <span>در حال بارگذاری...</span>
      </Box>
    );
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  const duplicateMessage =
    submitError instanceof ApiError && submitError.status === 409 ? 'این حساب بانکی برای این حساب معین تکراری است.' : null;

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<AccountBalanceOutlinedIcon />}
        title={isEdit ? 'ویرایش حساب بانکی' : 'حساب بانکی جدید'}
      />

      {duplicateMessage ? (
        <ErrorBanner error={new Error(duplicateMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('accountNumber', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="شماره حساب"
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 15 } }}
              error={!!errors.accountNumber}
              helperText={errors.accountNumber?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('accountHolder')}
              label="صاحب حساب"
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 80 } }}
              error={!!errors.accountHolder}
              helperText={errors.accountHolder?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('cardNumber', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="شماره کارت"
              fullWidth
              slotProps={{ htmlInput: { maxLength: 16 } }}
              error={!!errors.cardNumber}
              helperText={errors.cardNumber?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('shebaNumber', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="شماره شبا"
              fullWidth
              slotProps={{ htmlInput: { maxLength: 50 } }}
              error={!!errors.shebaNumber}
              helperText={errors.shebaNumber?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <AmountField control={control} name="firstAmount" label="مانده اولیه" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="accountOpeningDate"
              render={({ field, fieldState }) => (
                <DatePicker
                  calendar={persian}
                  locale={persian_fa}
                  format="YYYYMMDD"
                  value={field.value || undefined}
                  onChange={(date) => field.onChange(date ? toLatinDigits(date.format('YYYYMMDD')) : '')}
                  render={(value, openCalendar) => (
                    <TextField
                      label="تاریخ افتتاح حساب"
                      fullWidth
                      value={value}
                      onClick={openCalendar}
                      onFocus={openCalendar}
                      inputRef={field.ref}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      slotProps={{ htmlInput: { readOnly: true } }}
                    />
                  )}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              label="حساب معین (کد - عنوان)"
              fullWidth
              value={accountCodeLabel ?? ''}
              placeholder="بدون حساب معین مرتبط"
              slotProps={{ input: { readOnly: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button variant="outlined" onClick={() => setPickerOpen(true)}>
              انتخاب حساب معین
            </Button>
            <Button
              color="inherit"
              onClick={() => {
                setValue('accountCodeId', null, { shouldDirty: true });
                setValue('accountCodeLabel', null, { shouldDirty: true });
              }}
            >
              پاک کردن
            </Button>
          </Grid>

          <Grid size={12}>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
              <Button variant="text" onClick={() => navigate('/base/bank-accounts')}>
                انصراف
              </Button>
              <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={pending}>
                {pending ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </FormCard>

      <AccountCodePickerDialog
        open={pickerOpen}
        title="انتخاب حساب معین"
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickAccountCode}
      />
    </section>
  );
}
