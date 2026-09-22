import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import MenuItem from '@mui/material/MenuItem';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import NumbersOutlinedIcon from '@mui/icons-material/NumbersOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import { JalaliDateField } from '../../components/JalaliDateField';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormActions } from '../../components/FormActions';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { BankAccountPickerDialog } from '../../components/BankAccountPickerDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { bankAccountsApi } from '../bank-accounts/api';
import { chequeTypesApi } from '../../lib/api/chequeTypesApi';
import { checkBooksApi } from './api';
import {
  checkBookDtoToFormValues,
  checkBookFormSchema,
  checkBookFormValuesToPayload,
  emptyCheckBookFormValues,
  type CheckBookFormValues,
} from './schema';
import type { BankAccountDto } from '../../types/bankAccount';
import { CHECK_TYPE_OPTIONS } from '../../types/legacyEnums';

/** `''` is the Select's own "not selected" sentinel for a `number | null` RHF field. */
const UNSET = '';

function toEnumFieldValue(raw: string): number | null {
  return raw === UNSET ? null : Number(raw);
}

/** Handles both `/base/bank/check-books/new` and `/base/bank/check-books/:id/edit`. */
export function CheckBookFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['check-books', id],
    queryFn: () => checkBooksApi.getById(id as string),
    enabled: isEdit,
  });

  const accountId = existingQuery.data?.accountId ?? null;
  const existingAccountQuery = useQuery({
    queryKey: ['bank-accounts', accountId],
    queryFn: () => bankAccountsApi.getById(accountId as string),
    enabled: accountId !== null,
  });

  const chequeTypesQuery = useQuery({
    queryKey: ['cheque-types-lookup'],
    queryFn: () => chequeTypesApi.list({ pageNumber: 1, pageSize: 200 }),
  });
  const chequeTypeOptions = chequeTypesQuery.data?.items ?? [];

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CheckBookFormValues>({
    resolver: zodResolver(checkBookFormSchema),
    defaultValues: emptyCheckBookFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    if (!existingAccountQuery.data) return;
    const account = existingAccountQuery.data;
    const accountLabel = `${account.accountNumber ?? ''} - ${account.accountHolder ?? ''}`;
    reset(checkBookDtoToFormValues(existingQuery.data, accountLabel));
  }, [existingQuery.data, existingAccountQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: CheckBookFormValues) => checkBooksApi.create(checkBookFormValuesToPayload(values)),
  });
  const updateMutation = useMutation({
    mutationFn: (values: CheckBookFormValues) => checkBooksApi.update(id as string, checkBookFormValuesToPayload(values)),
  });
  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: CheckBookFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['check-books'] });
      notify(isEdit ? 'دسته‌چک ویرایش شد.' : 'دسته‌چک جدید ذخیره شد.');
      navigate('/base/bank');
    } catch (error) {
      setSubmitError(error);
    }
  }

  function handlePickAccount(account: BankAccountDto) {
    setValue('accountId', account.id, { shouldDirty: true, shouldValidate: true });
    setValue('accountLabel', `${account.accountNumber ?? ''} - ${account.accountHolder ?? ''}`, { shouldDirty: true });
  }

  const accountLabel = watch('accountLabel');

  if (isEdit && (existingQuery.isLoading || (accountId !== null && existingAccountQuery.isLoading))) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  const duplicateMessage =
    submitError instanceof ApiError && submitError.status === 409
      ? 'دسته‌چکی با همین بازه شماره برای این حساب بانکی قبلاً ثبت شده است.'
      : null;

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<BookOutlinedIcon />}
        title={isEdit ? 'ویرایش دسته‌چک' : 'دسته‌چک جدید'}
        description="مشخصات دسته‌چک صادرشده برای یک حساب بانکی را وارد کنید."
      />

      {duplicateMessage ? (
        <ErrorBanner error={new Error(duplicateMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<BookOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="حساب بانکی مرتبط" />
          </Grid>
          <LinkedEntityPickerField
            icon={<AccountBalanceOutlinedIcon fontSize="small" color="action" />}
            label="حساب بانکی (شماره حساب - صاحب حساب)"
            value={accountLabel}
            required
            error={!!errors.accountId}
            helperText={errors.accountId?.message}
            placeholder="حسابی انتخاب نشده"
            pickButtonLabel="انتخاب حساب بانکی"
            onPick={() => setAccountPickerOpen(true)}
          />

          <Grid size={12}>
            <FormSectionLabel label="مشخصات دسته‌چک" />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('checkBookTitle')}
              label="عنوان دسته‌چک"
              fullWidth
              slotProps={{
                htmlInput: { maxLength: 100 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <DriveFileRenameOutlineOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
              error={!!errors.checkBookTitle}
              helperText={errors.checkBookTitle?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="checkBookDate"
              render={({ field, fieldState }) => (
                <JalaliDateField
                  label="تاریخ صدور"
                  value={field.value}
                  onChange={field.onChange}
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('fromCheckNumber', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="شماره اولین برگه چک"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 14 },
                input: { startAdornment: <InputAdornment position="start"><NumbersOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.fromCheckNumber}
              helperText={errors.fromCheckNumber?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('toCheckNumber', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="شماره آخرین برگه چک"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 14 },
                input: { startAdornment: <InputAdornment position="start"><NumbersOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.toCheckNumber}
              helperText={errors.toCheckNumber?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('serial')}
              label="سریال"
              fullWidth
              slotProps={{
                htmlInput: { maxLength: 20 },
                input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.serial}
              helperText={errors.serial?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="checkTypeId"
              render={({ field }) => (
                <Autocomplete
                  options={chequeTypeOptions}
                  getOptionLabel={(option) => option.chequeTypeTitle ?? '—'}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={chequeTypeOptions.find((c) => c.id === field.value) ?? null}
                  onChange={(_event, selected) => field.onChange(selected?.id ?? null)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="نوع دسته‌چک"
                      slotProps={{
                        ...params.slotProps,
                        input: {
                          ...params.slotProps.input,
                          startAdornment: (
                            <InputAdornment position="start">
                              <CategoryOutlinedIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="checkBookType"
              render={({ field }) => (
                <TextField
                  select
                  fullWidth
                  label="نوع دسته‌چک"
                  helperText={errors.checkBookType?.message ?? 'checkBookType'}
                  error={!!errors.checkBookType}
                  value={field.value ?? UNSET}
                  onChange={(e) => field.onChange(toEnumFieldValue(e.target.value))}
                >
                  <MenuItem value={UNSET}>انتخاب نشده</MenuItem>
                  {CHECK_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          <Grid size={12}>
            <RecordMetaFooter
              createdDate={existingQuery.data?.createdDate}
              updatedDate={existingQuery.data?.updatedDate}
              addUserId={existingQuery.data?.addUserId}
              changeUserId={existingQuery.data?.changeUserId}
            />
            <FormActions onCancel={() => navigate('/base/bank')} pending={pending} />
          </Grid>
        </Grid>
      </FormCard>

      <BankAccountPickerDialog
        open={accountPickerOpen}
        title="انتخاب حساب بانکی"
        onClose={() => setAccountPickerOpen(false)}
        onSelect={handlePickAccount}
      />
    </section>
  );
}
