import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { VahedInfoPickerDialog } from '../../components/VahedInfoPickerDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { accountCodesApi } from '../chart-of-accounts/api';
import { vahedInfosApi } from '../../lib/api/vahedInfosApi';
import { workShopsApi } from './api';
import {
  emptyWorkShopFormValues,
  workShopDtoToFormValues,
  workShopFormSchema,
  workShopFormValuesToPayload,
  type WorkShopFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';
import type { VahedInfoDto } from '../../types/vahedInfo';

/** Handles both `/base/work-shops/new` and `/base/work-shops/:id/edit`. */
export function WorkShopFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['work-shops', id],
    queryFn: () => workShopsApi.getById(id as string),
    enabled: isEdit,
  });

  const accountCodeId = existingQuery.data?.accountCodeId ?? null;
  const existingAccountCodeQuery = useQuery({
    queryKey: ['account-codes', accountCodeId],
    queryFn: () => accountCodesApi.getById(accountCodeId as string),
    enabled: accountCodeId !== null,
  });

  const branchId = existingQuery.data?.branchId ?? null;
  const existingBranchQuery = useQuery({
    queryKey: ['vahed-infos', branchId],
    queryFn: () => vahedInfosApi.getById(branchId as string),
    enabled: branchId !== null,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkShopFormValues>({
    resolver: zodResolver(workShopFormSchema),
    defaultValues: emptyWorkShopFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    if (existingQuery.data.accountCodeId && !existingAccountCodeQuery.data) return;
    if (existingQuery.data.branchId && !existingBranchQuery.data) return;
    const account = existingAccountCodeQuery.data;
    const branch = existingBranchQuery.data;
    const accountCodeLabel = account ? `${account.accCode ?? ''} - ${account.accCodeName ?? ''}` : null;
    const branchLabel = branch ? `${branch.vahedCode ?? ''} - ${branch.vahedName ?? ''}` : null;
    reset(workShopDtoToFormValues(existingQuery.data, accountCodeLabel, branchLabel));
  }, [existingQuery.data, existingAccountCodeQuery.data, existingBranchQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: WorkShopFormValues) => workShopsApi.create(workShopFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: WorkShopFormValues) => workShopsApi.update(id as string, workShopFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: WorkShopFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['work-shops'] });
      notify(isEdit ? 'کارگاه ویرایش شد.' : 'کارگاه جدید ذخیره شد.');
      navigate('/base/work-shops');
    } catch (error) {
      setSubmitError(error);
    }
  }

  function handlePickAccountCode(account: AccountCodeDto) {
    setValue('accountCodeId', account.id, { shouldDirty: true, shouldValidate: true });
    setValue('accountCodeLabel', `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`, { shouldDirty: true });
  }

  function handlePickBranch(branch: VahedInfoDto) {
    setValue('branchId', branch.id, { shouldDirty: true });
    setValue('branchLabel', `${branch.vahedCode ?? ''} - ${branch.vahedName ?? ''}`, { shouldDirty: true });
  }

  const accountCodeLabel = watch('accountCodeLabel');
  const branchLabel = watch('branchLabel');

  const stillResolvingLinkedRows =
    (accountCodeId !== null && existingAccountCodeQuery.isLoading) || (branchId !== null && existingBranchQuery.isLoading);

  if (isEdit && (existingQuery.isLoading || stillResolvingLinkedRows)) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  const duplicateMessage =
    submitError instanceof ApiError && submitError.status === 409 ? 'کد کارگاه تکراری است.' : null;

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<FactoryOutlinedIcon />}
        title={isEdit ? 'ویرایش کارگاه' : 'کارگاه جدید'}
        description="کارگاه‌های تولیدی/خدماتی و اتصال آن‌ها به حساب معین و واحد سازمانی مربوطه."
      />

      {duplicateMessage ? (
        <ErrorBanner error={new Error(duplicateMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<FactoryOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="اطلاعات اصلی" />
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              {...register('workShopCode', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد کارگاه"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 10 },
                input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.workShopCode}
              helperText={errors.workShopCode?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('workShopName')}
              label="نام کارگاه"
              fullWidth
              required
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
              error={!!errors.workShopName}
              helperText={errors.workShopName?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }} sx={{ display: 'flex', alignItems: 'center' }}>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="کارگاه فعال است"
                />
              )}
            />
          </Grid>

          <Grid size={12}>
            <FormSectionLabel label="ارتباط با سازمان" />
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
            onPick={() => setAccountPickerOpen(true)}
          />

          <LinkedEntityPickerField
            icon={<ApartmentOutlinedIcon fontSize="small" color="action" />}
            label="واحد سازمانی (کد - عنوان)"
            value={branchLabel}
            placeholder="بدون واحد سازمانی مرتبط"
            pickButtonLabel="انتخاب واحد"
            onPick={() => setBranchPickerOpen(true)}
            onClear={() => {
              setValue('branchId', null, { shouldDirty: true });
              setValue('branchLabel', null, { shouldDirty: true });
            }}
          />

          <Grid size={12}>
            <RecordMetaFooter
              createdDate={existingQuery.data?.createdDate}
              updatedDate={existingQuery.data?.updatedDate}
              addUserId={existingQuery.data?.addUserId}
              changeUserId={existingQuery.data?.changeUserId}
            />
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="text" onClick={() => navigate('/base/work-shops')}>
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
        open={accountPickerOpen}
        title="انتخاب حساب معین"
        onClose={() => setAccountPickerOpen(false)}
        onSelect={handlePickAccountCode}
      />
      <VahedInfoPickerDialog
        open={branchPickerOpen}
        title="انتخاب واحد سازمانی"
        onClose={() => setBranchPickerOpen(false)}
        onSelect={handlePickBranch}
      />
    </section>
  );
}
