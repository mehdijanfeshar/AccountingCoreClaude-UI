import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormActions } from '../../components/FormActions';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { identityGroupsApi } from './api';
import {
  emptyIdentityGroupFormValues,
  identityGroupDtoToFormValues,
  identityGroupFormSchema,
  identityGroupFormValuesToPayload,
  type IdentityGroupFormValues,
} from './schema';

/** Handles both `/base/features/new` and `/base/features/:id/edit`. */
export function IdentityGroupFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['identity-groups', id],
    queryFn: () => identityGroupsApi.getById(id as string),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IdentityGroupFormValues>({
    resolver: zodResolver(identityGroupFormSchema),
    defaultValues: emptyIdentityGroupFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    reset(identityGroupDtoToFormValues(existingQuery.data));
  }, [existingQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: IdentityGroupFormValues) =>
      identityGroupsApi.create(identityGroupFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: IdentityGroupFormValues) =>
      identityGroupsApi.update(id as string, identityGroupFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: IdentityGroupFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['identity-groups'] });
      notify(isEdit ? 'گروه ویژگی ویرایش شد.' : 'گروه ویژگی جدید ذخیره شد.');
      navigate('/base/features');
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

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<AccountTreeOutlinedIcon />}
        title={isEdit ? 'ویرایش گروه ویژگی' : 'گروه ویژگی جدید'}
        description="گروه ویژگی، مجموعه‌ای از اجزا را تعریف می‌کند که ویژگی‌های ثبت‌شده بر اساس آن ساخته می‌شوند."
      />

      {submitError !== null && <ErrorBanner error={submitError} />}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<AccountTreeOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="اطلاعات اصلی" />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="کد گروه"
              {...register('identityGroupsCode')}
              error={Boolean(errors.identityGroupsCode)}
              helperText={errors.identityGroupsCode?.message ?? 'اختیاری'}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              fullWidth
              label="شرح گروه"
              {...register('identityGroupsDesc')}
              error={Boolean(errors.identityGroupsDesc)}
              helperText={errors.identityGroupsDesc?.message}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <DriveFileRenameOutlineOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Grid>

          <Grid size={12}>
            <FormActions onCancel={() => navigate('/base/features')} pending={pending} />
          </Grid>
        </Grid>

        {isEdit && existingQuery.data && (
          <RecordMetaFooter
            createdDate={existingQuery.data.createdDate}
            updatedDate={existingQuery.data.updatedDate}
            addUserId={existingQuery.data.addUserId}
            changeUserId={existingQuery.data.changeUserId}
          />
        )}
      </FormCard>
    </section>
  );
}
