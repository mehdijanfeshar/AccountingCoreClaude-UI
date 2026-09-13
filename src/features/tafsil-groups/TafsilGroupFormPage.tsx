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
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { TriStateToggle, type TriStateValue } from '../../components/TriStateToggle';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { toLatinDigits } from '../../lib/format/numbers';
import { tafsilGroupsApi } from './api';
import {
  emptyTafsilGroupFormValues,
  tafsilGroupDtoToFormValues,
  tafsilGroupFormSchema,
  tafsilGroupFormValuesToPayload,
  type TafsilGroupFormValues,
} from './schema';

/** Handles both `/base/tafsil-groups/new` and `/base/tafsil-groups/:id/edit`. */
export function TafsilGroupFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['tafsil-groups', id],
    queryFn: () => tafsilGroupsApi.getById(id as string),
    enabled: isEdit,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TafsilGroupFormValues>({
    resolver: zodResolver(tafsilGroupFormSchema),
    defaultValues: emptyTafsilGroupFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    reset(tafsilGroupDtoToFormValues(existingQuery.data));
  }, [existingQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: TafsilGroupFormValues) => tafsilGroupsApi.create(tafsilGroupFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: TafsilGroupFormValues) =>
      tafsilGroupsApi.update(id as string, tafsilGroupFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: TafsilGroupFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['tafsil-groups'] });
      notify(isEdit ? 'گروه تفصیلی ویرایش شد.' : 'گروه تفصیلی جدید ذخیره شد.');
      navigate('/base/tafsil-groups');
    } catch (error) {
      setSubmitError(error);
    }
  }

  if (isEdit && existingQuery.isLoading) {
    return <FormLoadingSkeleton />;
  }

  if (isEdit && existingQuery.isError) {
    return <ErrorBanner error={existingQuery.error} />;
  }

  const duplicateCodeMessage =
    submitError instanceof ApiError && submitError.status === 409 ? 'کد گروه تفصیلی تکراری است.' : null;

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<CategoryOutlinedIcon />}
        title={isEdit ? 'ویرایش گروه تفصیلی' : 'گروه تفصیلی جدید'}
        description="گروه‌های تفصیلی، حساب‌های تفصیلی مشابه را برای گزارش‌گیری و ارتباط با معین‌ها دسته‌بندی می‌کنند."
      />

      {duplicateCodeMessage ? (
        <ErrorBanner error={new Error(duplicateCodeMessage)} />
      ) : (
        submitError !== null && <ErrorBanner error={submitError} />
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<CategoryOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="اطلاعات اصلی" />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('tafsilGroupCode', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد گروه"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 3 },
                input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.tafsilGroupCode}
              helperText={errors.tafsilGroupCode?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              {...register('tafsilGroupName')}
              label="عنوان گروه"
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
              error={!!errors.tafsilGroupName}
              helperText={errors.tafsilGroupName?.message}
            />
          </Grid>

          <Grid size={12}>
            <FormSectionLabel
              label="ویژگی‌های تکمیلی"
              caption="معنای دقیق این فیلد در بک‌اند مستند نشده — فعلاً به‌صورت سه‌حالته نمایش داده می‌شود."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              control={control}
              name="personType"
              render={({ field }) => (
                <TriStateToggle label="نوع شخص (PersonType)" value={field.value as TriStateValue} onChange={field.onChange} />
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
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="text" onClick={() => navigate('/base/tafsil-groups')}>
                انصراف
              </Button>
              <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={pending}>
                {pending ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </FormCard>
    </section>
  );
}
