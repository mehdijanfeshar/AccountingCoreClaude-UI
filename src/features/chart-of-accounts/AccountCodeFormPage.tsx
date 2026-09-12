import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { accountCodesApi } from './api';
import {
  accountCodeDtoToFormValues,
  accountCodeFormSchema,
  accountCodeFormValuesToPayload,
  emptyAccountCodeFormValues,
  type AccountCodeFormValues,
} from './schema';
import { TriStateToggle, type TriStateValue } from '../../components/TriStateToggle';
import type { AccountCodeDto } from '../../types/accountCode';

/** Handles both `/base/account-codes/new` and `/base/account-codes/:id/edit`. */
export function AccountCodeFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['account-codes', id],
    queryFn: () => accountCodesApi.getById(id as string),
    enabled: isEdit,
  });

  const parentId = existingQuery.data?.parentId ?? null;
  const existingParentQuery = useQuery({
    queryKey: ['account-codes', parentId],
    queryFn: () => accountCodesApi.getById(parentId as string),
    enabled: parentId !== null,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccountCodeFormValues>({
    resolver: zodResolver(accountCodeFormSchema),
    defaultValues: emptyAccountCodeFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    // If this account has a parent, wait for the parent's own row to resolve so the
    // "حساب والد" field can show its label immediately instead of flashing blank.
    if (existingQuery.data.parentId && !existingParentQuery.data) return;
    const parent = existingParentQuery.data;
    const parentLabel = parent ? `${parent.accCode ?? ''} - ${parent.accCodeName ?? ''}` : null;
    reset(accountCodeDtoToFormValues(existingQuery.data, parentLabel));
  }, [existingQuery.data, existingParentQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: AccountCodeFormValues) => accountCodesApi.create(accountCodeFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: AccountCodeFormValues) =>
      accountCodesApi.update(id as string, accountCodeFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: AccountCodeFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['account-codes'] });
      navigate('/base/account-codes');
    } catch (error) {
      setSubmitError(error);
    }
  }

  function handlePickParent(account: AccountCodeDto) {
    setValue('parentId', account.id, { shouldDirty: true });
    setValue('parentLabel', `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`, { shouldDirty: true });
  }

  const parentLabel = watch('parentLabel');

  if (isEdit && (existingQuery.isLoading || (parentId !== null && existingParentQuery.isLoading))) {
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

  if (isEdit && !existingQuery.isLoading && existingQuery.data === undefined && !existingQuery.isError) {
    return <ErrorBanner error={new Error('حساب مورد نظر یافت نشد.')} />;
  }

  const duplicateCodeMessage =
    submitError instanceof ApiError && submitError.status === 409 ? 'کد حساب تکراری است.' : null;

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<AccountTreeOutlinedIcon />}
        title={isEdit ? 'ویرایش کدینگ حساب' : 'کدینگ حساب جدید'}
        description="اطلاعات حساب را وارد کنید. سطوح تفصیلی این حساب پس از ذخیره، در فرم صدور سند به‌صورت داینامیک نمایش داده می‌شود."
      />

      {duplicateCodeMessage ? (
        <ErrorBanner error={new Error(duplicateCodeMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/*
            `accCode`/`moInforClose` are legacy coding-tree codes, not narrative text — a
            Persian-keyboard user typing them will produce Persian digit glyphs (۰-۹) in the
            raw DOM value. `setValueAs: toLatinDigits` converts them at the point RHF reads
            the field (submit time), per the hard rule in `src/lib/format/numbers.ts` (only
            Latin digits may reach the API). `accCodeName` is intentionally left untouched
            (free-text title, not a code).
          */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('accCode', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد حساب"
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 6 } }}
              error={!!errors.accCode}
              helperText={errors.accCode?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              {...register('accCodeName')}
              label="عنوان حساب"
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 200 } }}
              error={!!errors.accCodeName}
              helperText={errors.accCodeName?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              label="حساب والد (کد - عنوان)"
              fullWidth
              value={parentLabel ?? ''}
              placeholder="بدون حساب والد (سطح گروه)"
              slotProps={{ input: { readOnly: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button variant="outlined" onClick={() => setPickerOpen(true)}>
              انتخاب حساب والد
            </Button>
            <Button
              color="inherit"
              onClick={() => {
                setValue('parentId', null, { shouldDirty: true });
                setValue('parentLabel', null, { shouldDirty: true });
              }}
            >
              پاک کردن
            </Button>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('moInforClose', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="moInforClose"
              fullWidth
              slotProps={{ htmlInput: { maxLength: 6 } }}
              error={!!errors.moInforClose}
              helperText={errors.moInforClose?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <Controller
              control={control}
              name="typeCode"
              render={({ field }) => (
                <TriStateToggle
                  label="typeCode (نوع کد)"
                  value={field.value as TriStateValue}
                  onChange={field.onChange}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Controller
              control={control}
              name="typeActivity"
              render={({ field }) => (
                <TriStateToggle
                  label="typeActivity (نوع فعالیت)"
                  value={field.value as TriStateValue}
                  onChange={field.onChange}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Controller
              control={control}
              name="typeAccCode"
              render={({ field }) => (
                <TriStateToggle
                  label="typeAccCode (نوع کد حساب)"
                  value={field.value as TriStateValue}
                  onChange={field.onChange}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Controller
              control={control}
              name="typeAction"
              render={({ field }) => (
                <TriStateToggle
                  label="typeAction (نوع عملیات)"
                  value={field.value as TriStateValue}
                  onChange={field.onChange}
                />
              )}
            />
          </Grid>

          <Grid size={12}>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
              <Button variant="text" onClick={() => navigate('/base/account-codes')}>
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
        title="انتخاب حساب والد"
        excludeId={id}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickParent}
      />
    </section>
  );
}
