import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { FormAdvancedSection } from '../../components/FormAdvancedSection';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
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
import { ATTRIB_CONTROL_OPTIONS, ATTRIB_FLAG_OPTIONS, ATTRIB_SUM_OPTIONS } from '../../types/legacyEnums';

/** `''` is the Select's own "not selected" sentinel for a nullable-enum RHF field. */
const UNSET = '';

function toEnumFieldValue(raw: string): number | null {
  return raw === UNSET ? null : Number(raw);
}

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
    return <FormLoadingSkeleton />;
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
        description="شمارهٔ جعبه، نوع مقدار، طول ویژگی، جمع‌پذیری و کنترل این ویژگی را وارد کنید."
      />

      {duplicateMessage ? (
        <ErrorBanner error={new Error(duplicateMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<TuneOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="ارتباط با کدینگ حسابداری" />
          </Grid>
          <LinkedEntityPickerField
            icon={<AccountTreeOutlinedIcon fontSize="small" color="action" />}
            label="حساب معین (کد - عنوان)"
            value={accountCodeLabel}
            required
            error={!!errors.accountCodeId}
            helperText={errors.accountCodeId?.message}
            placeholder="حسابی انتخاب نشده"
            pickButtonLabel="انتخاب حساب معین"
            onPick={() => setPickerOpen(true)}
          />

          <Grid size={12}>
            <FormSectionLabel label="اطلاعات اصلی" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('year', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="سال مالی"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 4 },
                input: { startAdornment: <InputAdornment position="start"><CalendarMonthOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
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
              slotProps={{
                htmlInput: { maxLength: 3 },
                input: { startAdornment: <InputAdornment position="start"><StraightenOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.lenAtr}
              helperText={errors.lenAtr?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('attribBoxNo', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="شماره جعبه (AttribBoxNo)"
              fullWidth
              required
              inputMode="numeric"
              slotProps={{ htmlInput: { maxLength: 1 } }}
              error={!!errors.attribBoxNo}
              helperText={errors.attribBoxNo?.message ?? 'عددی بین ۰ تا ۹'}
            />
          </Grid>

          <Grid size={12}>
            <FormAdvancedSection
              label="ویژگی‌های تکمیلی"
              caption="نوع مقدار، جمع‌پذیری و کنترل این ویژگی."
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Controller
                    control={control}
                    name="flag"
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="نوع مقدار (Flag)"
                        helperText={errors.flag?.message ?? 'flag'}
                        error={!!errors.flag}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      >
                        {ATTRIB_FLAG_OPTIONS.map((option) => (
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
                    name="attribSum"
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="جمع‌پذیری (AttribSum)"
                        helperText={errors.attribSum?.message ?? 'attribSum'}
                        error={!!errors.attribSum}
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      >
                        {ATTRIB_SUM_OPTIONS.map((option) => (
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
                    name="controlId"
                    render={({ field }) => (
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="کنترل (ControlId)"
                        helperText={errors.controlId?.message ?? 'controlId'}
                        error={!!errors.controlId}
                        value={field.value ?? UNSET}
                        onChange={(e) => field.onChange(toEnumFieldValue(e.target.value))}
                      >
                        <MenuItem value={UNSET}>انتخاب نشده</MenuItem>
                        {ATTRIB_CONTROL_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              </Grid>
            </FormAdvancedSection>
          </Grid>

          <Grid size={12}>
            <RecordMetaFooter
              createdDate={existingQuery.data?.createdDate}
              updatedDate={existingQuery.data?.updatedDate}
              addUserId={existingQuery.data?.addUserId}
              changeUserId={existingQuery.data?.changeUserId}
            />
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', mt: 3 }}>
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
