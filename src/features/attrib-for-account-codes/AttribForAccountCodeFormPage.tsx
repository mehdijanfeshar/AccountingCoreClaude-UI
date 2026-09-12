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
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { TriStateToggle, type TriStateValue } from '../../components/TriStateToggle';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { accountCodesApi } from '../chart-of-accounts/api';
import { attribForAccountCodesApi } from './api';
import {
  attribForAccountCodeDtoToFormValues,
  attribForAccountCodeFormSchema,
  attribForAccountCodeFormValuesToPayload,
  buildEmptyAttribForAccountCodeFormValues,
  type AttribForAccountCodeFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';

/** Handles both `/base/attrib-for-account-codes/new` and `/base/attrib-for-account-codes/:id/edit`. */
export function AttribForAccountCodeFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear } = useSession();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['attrib-for-account-codes', id],
    queryFn: () => attribForAccountCodesApi.getById(id as string),
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
  } = useForm<AttribForAccountCodeFormValues>({
    resolver: zodResolver(attribForAccountCodeFormSchema),
    defaultValues: buildEmptyAttribForAccountCodeFormValues(financialYear || ''),
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    if (existingQuery.data.accountCodeId && !existingAccountCodeQuery.data) return;
    const account = existingAccountCodeQuery.data;
    const accountCodeLabel = account ? `${account.accCode ?? ''} - ${account.accCodeName ?? ''}` : null;
    reset(attribForAccountCodeDtoToFormValues(existingQuery.data, accountCodeLabel));
  }, [existingQuery.data, existingAccountCodeQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: AttribForAccountCodeFormValues) =>
      attribForAccountCodesApi.create(attribForAccountCodeFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: AttribForAccountCodeFormValues) =>
      attribForAccountCodesApi.update(id as string, attribForAccountCodeFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: AttribForAccountCodeFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['attrib-for-account-codes'] });
      notify(isEdit ? 'ویژگی ویرایش شد.' : 'ویژگی جدید ذخیره شد.');
      navigate('/base/attrib-for-account-codes');
    } catch (error) {
      setSubmitError(error);
    }
  }

  function handlePickAccountCode(account: AccountCodeDto) {
    setValue('accountCodeId', account.id, { shouldDirty: true, shouldValidate: true });
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
    submitError instanceof ApiError && submitError.status === 409
      ? 'ویژگی برای این حساب معین و سال مالی تکراری است.'
      : null;

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<TuneOutlinedIcon />}
        title={isEdit ? 'ویرایش ویژگی' : 'ویژگی جدید'}
        description="معنای دقیق فیلدهای AttribBoxNo/Flag/LenAtr/AttribSum/ControlId در بک‌اند مستند نشده — نام انگلیسی فیلد در کنار هر برچسب آمده."
      />

      {duplicateMessage ? (
        <ErrorBanner error={new Error(duplicateMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              label="حساب معین (کد - عنوان)"
              fullWidth
              required
              value={accountCodeLabel ?? ''}
              placeholder="حسابی انتخاب نشده"
              error={!!errors.accountCodeId}
              helperText={errors.accountCodeId?.message}
              slotProps={{ input: { readOnly: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <Button variant="outlined" onClick={() => setPickerOpen(true)}>
              انتخاب حساب معین
            </Button>
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('year', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="سال مالی"
              fullWidth
              required
              slotProps={{ htmlInput: { maxLength: 4 } }}
              error={!!errors.year}
              helperText={errors.year?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('lenAtr', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="LenAtr (طول ویژگی)"
              fullWidth
              required
              inputMode="numeric"
              slotProps={{ htmlInput: { maxLength: 3 } }}
              error={!!errors.lenAtr}
              helperText={errors.lenAtr?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              control={control}
              name="controlId"
              render={({ field }) => (
                <TriStateToggle label="ControlId" value={field.value as TriStateValue} onChange={field.onChange} />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              control={control}
              name="attribBoxNo"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="AttribBoxNo"
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              control={control}
              name="flag"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Flag"
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              control={control}
              name="attribSum"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="AttribSum"
                />
              )}
            />
          </Grid>

          <Grid size={12}>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
              <Button variant="text" onClick={() => navigate('/base/attrib-for-account-codes')}>
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
