import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { AmountField } from '../../components/AmountField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { accountCodesApi } from '../chart-of-accounts/api';
import { expensesApi } from './api';
import {
  emptyExpenseFormValues,
  expenseDtoToFormValues,
  expenseFormSchema,
  expenseFormValuesToPayload,
  type ExpenseFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';

/** Handles both `/base/expenses/new` and `/base/expenses/:id/edit`. */
export function ExpenseFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => expensesApi.getById(id as string),
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
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: emptyExpenseFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    if (existingQuery.data.accountCodeId && !existingAccountCodeQuery.data) return;
    const account = existingAccountCodeQuery.data;
    const accountCodeLabel = account ? `${account.accCode ?? ''} - ${account.accCodeName ?? ''}` : null;
    reset(expenseDtoToFormValues(existingQuery.data, accountCodeLabel));
  }, [existingQuery.data, existingAccountCodeQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: ExpenseFormValues) => expensesApi.create(expenseFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ExpenseFormValues) => expensesApi.update(id as string, expenseFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: ExpenseFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      notify(isEdit ? 'هزینه ویرایش شد.' : 'هزینه جدید ذخیره شد.');
      navigate('/base/expenses');
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
    submitError instanceof ApiError && submitError.status === 409 ? 'کد هزینه تکراری است.' : null;

  return (
    <section>
      <PageHeader eyebrow="اطلاعات پایه" icon={<ReceiptLongOutlinedIcon />} title={isEdit ? 'ویرایش هزینه' : 'هزینه جدید'} />

      {duplicateMessage ? (
        <ErrorBanner error={new Error(duplicateMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              {...register('expenseCode', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد هزینه"
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 2 } }}
              error={!!errors.expenseCode}
              helperText={errors.expenseCode?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>
            <TextField
              {...register('expenseName')}
              label="عنوان هزینه"
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 200 } }}
              error={!!errors.expenseName}
              helperText={errors.expenseName?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              {...register('description')}
              label="توضیحات"
              fullWidth
              multiline
              minRows={2}
              slotProps={{ htmlInput: { maxLength: 100 } }}
              error={!!errors.description}
              helperText={errors.description?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <AmountField control={control} name="defaultAmount" label="مبلغ پیش‌فرض" />
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
              <Button variant="text" onClick={() => navigate('/base/expenses')}>
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
