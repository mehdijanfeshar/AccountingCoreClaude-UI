import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Alert from '@mui/material/Alert';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
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
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { levelTafsilsApi } from '../../lib/api/levelTafsilsApi';
import {
  LEVEL_TAFSILS_PAGE_SIZE,
  MAX_TAFSILI_LEVELS,
  emptyLevelTafsilFormValues,
  levelTafsilDtoToFormValues,
  levelTafsilFormSchema,
  levelTafsilFormValuesToPayload,
  type LevelTafsilFormValues,
} from './schema';

/** Handles both `/base/level-tafsils/new` and `/base/level-tafsils/:id/edit`. */
export function LevelTafsilFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['level-tafsils', id],
    queryFn: () => levelTafsilsApi.getById(id as string),
    enabled: isEdit,
  });

  // The whole set, purely to warn about a code that is already taken. Advisory only — see the
  // note in schema.ts on why this is not a blocking rule. Same query key as the list page, so
  // arriving from it costs no extra request.
  const siblingsQuery = useQuery({
    queryKey: ['level-tafsils', LEVEL_TAFSILS_PAGE_SIZE],
    queryFn: () => levelTafsilsApi.list({ pageNumber: 1, pageSize: LEVEL_TAFSILS_PAGE_SIZE }),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<LevelTafsilFormValues>({
    resolver: zodResolver(levelTafsilFormSchema),
    defaultValues: emptyLevelTafsilFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    reset(levelTafsilDtoToFormValues(existingQuery.data));
  }, [existingQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: LevelTafsilFormValues) => levelTafsilsApi.create(levelTafsilFormValuesToPayload(values)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: LevelTafsilFormValues) =>
      levelTafsilsApi.update(id as string, levelTafsilFormValuesToPayload(values)),
  });

  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: LevelTafsilFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['level-tafsils'] });
      await queryClient.invalidateQueries({ queryKey: ['level-tafsils-lookup'] });
      notify(isEdit ? 'سطح تفصیلی ویرایش شد.' : 'سطح تفصیلی جدید ذخیره شد.');
      navigate('/base/level-tafsils');
    } catch (error) {
      setSubmitError(error);
    }
  }

  const levelCode = watch('levelCode');

  const codeTakenBy = useMemo(() => {
    const code = (levelCode ?? '').trim();
    if (!code) return null;
    return (
      siblingsQuery.data?.items.find((row) => row.id !== id && (row.levelCode ?? '').trim() === code) ?? null
    );
  }, [levelCode, siblingsQuery.data, id]);

  // Only meaningful on create; editing an existing row does not add one.
  const atCapacity = !isEdit && (siblingsQuery.data?.items.length ?? 0) >= MAX_TAFSILI_LEVELS;

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
        icon={<LayersOutlinedIcon />}
        title={isEdit ? 'ویرایش سطح تفصیلی' : 'سطح تفصیلی جدید'}
        description="سطحی که تفصیلی حساب‌های معین در قالب آن تعریف و در فرم صدور سند خواسته می‌شود."
      />

      {submitError !== null && <ErrorBanner error={submitError} />}

      {atCapacity && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          در حال حاضر {toPersianDigits(MAX_TAFSILI_LEVELS)} سطح ثبت شده است — سقف تعریف‌شدهٔ کسب‌وکار.
          افزودن سطح بیشتر در مسیر صدور سند نگاشت نمی‌شود.
        </Alert>
      )}

      {codeTakenBy !== null && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          کد سطح «{codeTakenBy.levelCode}» قبلاً برای «{codeTakenBy.levelName}» ثبت شده است. سمت سرور
          جلوی ذخیرهٔ کد تکراری را نمی‌گیرد، ولی نگاشت شمارهٔ سطح در زمان صدور سند یکتا بودن آن را
          فرض می‌کند.
        </Alert>
      )}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<LayersOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="اطلاعات سطح" />
          </Grid>

          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              {...register('levelCode', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد سطح"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 2 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
              error={!!errors.levelCode}
              helperText={errors.levelCode?.message ?? `شمارهٔ سطح، از ۱ تا ${toPersianDigits(MAX_TAFSILI_LEVELS)}`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 9 }}>
            <TextField
              {...register('levelName')}
              label="نام سطح"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 50 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <DriveFileRenameOutlineOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
              error={!!errors.levelName}
              helperText={errors.levelName?.message ?? 'نامی که در فرم صدور سند بالای فیلد تفصیلی دیده می‌شود'}
            />
          </Grid>

          <Grid size={12}>
            <RecordMetaFooter
              createdDate={existingQuery.data?.createdDate}
              updatedDate={existingQuery.data?.updatedDate}
              addUserId={existingQuery.data?.addUserId}
              changeUserId={existingQuery.data?.changeUserId}
            />
            <FormActions onCancel={() => navigate('/base/level-tafsils')} pending={pending} />
          </Grid>
        </Grid>
      </FormCard>
    </section>
  );
}
