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
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { useSession } from '../../lib/session/SessionContext';
import { toLatinDigits } from '../../lib/format/numbers';
import { identitySubGroupsApi } from './api';
import {
  emptyIdentitySubGroupFormValues,
  identitySubGroupDtoToFormValues,
  identitySubGroupFormSchema,
  identitySubGroupFormValuesToPayload,
  type IdentitySubGroupFormValues,
} from './schema';
import {
  IDENTITY_SUB_GROUP_KIND_OPTIONS,
  IDENTITY_SUB_GROUP_TYPE_OPTIONS,
} from '../../types/legacyEnums';

/** `''` is the Select's own "not selected" sentinel for a `number | null` RHF field. */
const UNSET = '';

/**
 * Handles both `/base/identity-groups/:groupId/sub-groups/new` and `…/:id/edit`.
 *
 * The group comes from the route and is never editable here — moving a زیرگروه between groups
 * would orphan every value already recorded against it.
 */
export function IdentitySubGroupFormPage() {
  const { groupId, id } = useParams<{ groupId: string; id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const { financialYear } = useSession();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const backTo = `/base/identity-groups/${groupId}/sub-groups`;

  const existingQuery = useQuery({
    queryKey: ['identity-sub-groups', id],
    queryFn: () => identitySubGroupsApi.getById(id as string),
    enabled: isEdit,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IdentitySubGroupFormValues>({
    resolver: zodResolver(identitySubGroupFormSchema),
    defaultValues: emptyIdentitySubGroupFormValues(groupId ?? '', financialYear),
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    reset(identitySubGroupDtoToFormValues(existingQuery.data));
  }, [existingQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: IdentitySubGroupFormValues) =>
      identitySubGroupsApi.create(identitySubGroupFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: IdentitySubGroupFormValues) =>
      identitySubGroupsApi.update(id as string, identitySubGroupFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: IdentitySubGroupFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['identity-sub-groups'] });
      notify(isEdit ? 'زیرگروه ویرایش شد.' : 'زیرگروه جدید ذخیره شد.');
      navigate(backTo);
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
        eyebrow="تعریف ویژگی"
        icon={<ListAltOutlinedIcon />}
        title={isEdit ? 'ویرایش زیرگروه شناسنامه' : 'زیرگروه شناسنامه جدید'}
        description="زیرگروه ثابت یک مقدار روی خودِ شناسنامه می‌گیرد؛ زیرگروه متغیر به‌ازای هر ردیف سند."
      />

      {submitError !== null && <ErrorBanner error={submitError} />}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<ListAltOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="اطلاعات اصلی" />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="کد زیرگروه"
              {...register('identySubGroupsCode')}
              error={Boolean(errors.identySubGroupsCode)}
              helperText={errors.identySubGroupsCode?.message ?? 'اختیاری'}
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
              label="شرح زیرگروه"
              {...register('subgrpsDesc')}
              error={Boolean(errors.subgrpsDesc)}
              helperText={errors.subgrpsDesc?.message}
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
            <FormSectionLabel label="رفتار زیرگروه" />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              name="fixed"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  fullWidth
                  label="نوع زیرگروه"
                  value={String(field.value)}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  error={Boolean(errors.fixed)}
                  helperText={errors.fixed?.message ?? 'ثابت: مقدار روی شناسنامه — متغیر: مقدار روی ردیف سند'}
                >
                  {IDENTITY_SUB_GROUP_KIND_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              name="subgrpsType"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  fullWidth
                  label="نوع مقدار"
                  value={field.value === null ? UNSET : String(field.value)}
                  onChange={(event) =>
                    field.onChange(event.target.value === UNSET ? null : Number(event.target.value))
                  }
                  error={Boolean(errors.subgrpsType)}
                  helperText={errors.subgrpsType?.message ?? 'اختیاری'}
                >
                  <MenuItem value={UNSET}>تعیین‌نشده</MenuItem>
                  {IDENTITY_SUB_GROUP_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="طول"
              {...register('subgrpsLen', { valueAsNumber: true })}
              error={Boolean(errors.subgrpsLen)}
              helperText={errors.subgrpsLen?.message}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Controller
              name="year"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  label="سال مالی"
                  value={field.value}
                  onChange={(event) => field.onChange(toLatinDigits(event.target.value))}
                  error={Boolean(errors.year)}
                  helperText={errors.year?.message}
                  slotProps={{
                    htmlInput: { maxLength: 4, inputMode: 'numeric' },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <EventOutlinedIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              )}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Controller
              name="sumFlag"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(event) => field.onChange(event.target.checked)} />}
                  label="جمع‌پذیر"
                />
              )}
            />
          </Grid>

          <Grid size={12}>
            <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
              <Button variant="text" onClick={() => navigate(backTo)} disabled={pending}>
                انصراف
              </Button>
              <Button type="submit" variant="contained" startIcon={<SaveOutlinedIcon />} disabled={pending}>
                {pending ? 'در حال ذخیره…' : 'ذخیره'}
              </Button>
            </Stack>
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
