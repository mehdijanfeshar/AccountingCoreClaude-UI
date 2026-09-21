import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormActions } from '../../components/FormActions';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { TafsiliLevelFields } from '../../components/dynamic-tafsili/TafsiliLevelFields';
import { ErrorBanner } from '../../components/ErrorBanner';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { AmountField } from '../../components/AmountField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { accountCodesApi } from '../chart-of-accounts/api';
import { revolvingFundsApi } from './api';
import {
  buildEmptyRevolvingFundFormValues,
  revolvingFundDtoToFormValues,
  revolvingFundFormSchema,
  revolvingFundFormValuesToPayload,
  type RevolvingFundFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';

/** Handles both `/base/revolving-funds/new` and `/base/revolving-funds/:id/edit`. */
export function RevolvingFundFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear } = useSession();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['revolving-funds', id],
    queryFn: () => revolvingFundsApi.getById(id as string),
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
  } = useForm<RevolvingFundFormValues>({
    resolver: zodResolver(revolvingFundFormSchema),
    defaultValues: buildEmptyRevolvingFundFormValues(financialYear || ''),
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    if (existingQuery.data.accountCodeId && !existingAccountCodeQuery.data) return;
    const account = existingAccountCodeQuery.data;
    const accountCodeLabel = account ? `${account.accCode ?? ''} - ${account.accCodeName ?? ''}` : null;
    reset(revolvingFundDtoToFormValues(existingQuery.data, accountCodeLabel));
  }, [existingQuery.data, existingAccountCodeQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: RevolvingFundFormValues) =>
      revolvingFundsApi.create(revolvingFundFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: RevolvingFundFormValues) =>
      revolvingFundsApi.update(id as string, revolvingFundFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: RevolvingFundFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['revolving-funds'] });
      notify(isEdit ? 'تنخواه ویرایش شد.' : 'تنخواه جدید ذخیره شد.');
      navigate('/base/revolving-funds');
    } catch (error) {
      setSubmitError(error);
    }
  }

  function handlePickAccountCode(account: AccountCodeDto) {
    const previousId = watch('accountCodeId');
    setValue('accountCodeId', account.id, { shouldDirty: true });
    setValue('accountCodeLabel', `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`, { shouldDirty: true });
    // A تفصیلی only means anything relative to the معین whose level it was chosen under, so
    // switching معین must drop selections that now belong to another account's levels.
    if (previousId && previousId !== account.id) {
      setValue('tafsiliLinks', [], { shouldDirty: true });
    }
  }

  const accountCodeLabel = watch('accountCodeLabel');
  const accountCodeIdValue = watch('accountCodeId');
  const tafsiliLinks = watch('tafsiliLinks');

  if (isEdit && (existingQuery.isLoading || (accountCodeId !== null && existingAccountCodeQuery.isLoading))) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  const duplicateMessage =
    submitError instanceof ApiError && submitError.status === 409 ? 'کد تنخواه برای این سال مالی تکراری است.' : null;

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<SavingsOutlinedIcon />}
        title={isEdit ? 'ویرایش تنخواه' : 'تنخواه جدید'}
        description="تنخواه‌های در دسترس هر سال مالی و اتصال اختیاری آن‌ها به یک حساب معین."
      />

      {duplicateMessage ? (
        <ErrorBanner error={new Error(duplicateMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<SavingsOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="اطلاعات اصلی" />
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              {...register('code', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد تنخواه"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 2 },
                input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.code}
              helperText={errors.code?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('name')}
              label="عنوان تنخواه"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 200 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <DriveFileRenameOutlineOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
              error={!!errors.name}
              helperText={errors.name?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              {...register('year', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="سال مالی"
              fullWidth
              slotProps={{
                htmlInput: { maxLength: 4 },
                input: { startAdornment: <InputAdornment position="start"><CalendarMonthOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.year}
              helperText={errors.year?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              {...register('description')}
              label="توضیحات"
              fullWidth
              multiline
              minRows={2}
              slotProps={{
                htmlInput: { maxLength: 100 },
                input: { startAdornment: <InputAdornment position="start"><NotesOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.description}
              helperText={errors.description?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <AmountField
              control={control}
              name="defaultAmount"
              label="مبلغ پیش‌فرض"
              icon={<PaidOutlinedIcon fontSize="small" color="action" />}
            />
          </Grid>

          <Grid size={12}>
            <FormSectionLabel label="ارتباط با کدینگ حسابداری" />
          </Grid>
          <LinkedEntityPickerField
            icon={<AccountTreeOutlinedIcon fontSize="small" color="action" />}
            label="حساب معین (کد - عنوان)"
            value={accountCodeLabel}
            placeholder="بدون حساب معین مرتبط"
            pickButtonLabel="انتخاب حساب معین"
            onPick={() => setPickerOpen(true)}
            onClear={() => {
              setValue('accountCodeId', null, { shouldDirty: true });
              setValue('accountCodeLabel', null, { shouldDirty: true });
              setValue('tafsiliLinks', [], { shouldDirty: true });
            }}
          />

          <TafsiliLevelFields
            accountCodeId={accountCodeIdValue}
            value={tafsiliLinks}
            onChange={(links) => setValue('tafsiliLinks', links, { shouldDirty: true })}
            sectionLabel="تفصیلی‌های این تنخواه"
          />

          <Grid size={12}>
            <RecordMetaFooter
              createdDate={existingQuery.data?.createdDate}
              updatedDate={existingQuery.data?.updatedDate}
              addUserId={existingQuery.data?.addUserId}
              changeUserId={existingQuery.data?.changeUserId}
            />
            <FormActions onCancel={() => navigate('/base/revolving-funds')} pending={pending} />
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
