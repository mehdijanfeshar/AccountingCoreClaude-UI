import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import DatePicker from 'react-multi-date-picker';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { PageHeader } from '../../components/PageHeader';
import { FormCard } from '../../components/FormCard';
import { FormLoadingSkeleton } from '../../components/FormLoadingSkeleton';
import { RecordMetaFooter } from '../../components/RecordMetaFooter';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits } from '../../lib/format/numbers';
import { voucherHeadsApi } from '../vouchers/api';
import { payReciveHeadsApi } from './api';
import {
  emptyPayReciveHeadFormValues,
  payReciveHeadDtoToFormValues,
  payReciveHeadFormSchema,
  payReciveHeadFormValuesToPayload,
  type PayReciveHeadFormValues,
} from './schema';
import { PAY_RECIV_TYPE_OPTIONS } from '../../types/legacyEnums';

/** `''` is the Select's own "not selected" sentinel for a `number | null` RHF field. */
const UNSET = '';

function toEnumFieldValue(raw: string): number | null {
  return raw === UNSET ? null : Number(raw);
}

/**
 * Handles both `/operation/pay-recive-heads/new` and `/operation/pay-recive-heads/:id/edit`.
 *
 * HEAD ONLY (matches `PayReciveHeadsController` exactly) — no UI for `TB_PAYRECIVDETAIL` rows;
 * that aggregate boundary hasn't been decided backend-side yet (see `docs/open-decisions.md`).
 *
 * `voucherHeadId` (which accounting voucher this document was turned into) has no picker here —
 * deliberately. It is a rare, typically-system-assigned linkage (set once a document is posted),
 * there is no `VoucherHeadPickerDialog` anywhere in this app yet, and inventing one just for this
 * one optional field would be scope creep. The field is preserved as an untouched pass-through
 * (read from the existing record, shown read-only, sent back unchanged on update) rather than
 * silently dropped, so editing a linked document never clobbers its voucher link.
 */
export function PayReciveHeadFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const existingQuery = useQuery({
    queryKey: ['pay-recive-heads', id],
    queryFn: () => payReciveHeadsApi.getById(id as string),
    enabled: isEdit,
  });

  const voucherHeadId = existingQuery.data?.voucherHeadId ?? null;
  const linkedVoucherQuery = useQuery({
    queryKey: ['voucher-heads', voucherHeadId],
    queryFn: () => voucherHeadsApi.getById(voucherHeadId as string),
    enabled: voucherHeadId !== null,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PayReciveHeadFormValues>({
    resolver: zodResolver(payReciveHeadFormSchema),
    defaultValues: emptyPayReciveHeadFormValues,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    reset(payReciveHeadDtoToFormValues(existingQuery.data));
  }, [existingQuery.data, reset]);

  const createMutation = useMutation({
    mutationFn: (values: PayReciveHeadFormValues) =>
      payReciveHeadsApi.create(payReciveHeadFormValuesToPayload(values)),
  });
  const updateMutation = useMutation({
    mutationFn: (values: PayReciveHeadFormValues) =>
      payReciveHeadsApi.update(id as string, payReciveHeadFormValuesToPayload(values)),
  });
  const pending = isEdit ? updateMutation.isPending : createMutation.isPending;

  async function onSubmit(values: PayReciveHeadFormValues) {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync(values);
      } else {
        await createMutation.mutateAsync(values);
      }
      await queryClient.invalidateQueries({ queryKey: ['pay-recive-heads'] });
      notify(isEdit ? 'سند ویرایش شد.' : 'سند جدید ذخیره شد.');
      navigate('/operation/pay-recive-heads');
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
        eyebrow="عملیات"
        icon={<SwapHorizOutlinedIcon />}
        title={isEdit ? 'ویرایش سند دریافت و پرداخت' : 'سند دریافت و پرداخت جدید'}
        description="سرسند سند دریافت/پرداخت را وارد کنید. ردیف‌های تفصیلی این سند در این نسخه پشتیبانی نمی‌شود."
      />

      {submitError !== null && <ErrorBanner error={submitError} />}

      <FormCard onSubmit={handleSubmit(onSubmit)} watermarkIcon={<SwapHorizOutlinedIcon />}>
        <Grid container spacing={3}>
          <Grid size={12}>
            <FormSectionLabel label="اطلاعات سند" />
          </Grid>

          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('payReciveCode', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="شماره سند"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 5 },
                input: { startAdornment: <InputAdornment position="start"><TagOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.payReciveCode}
              helperText={errors.payReciveCode?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Controller
              control={control}
              name="payReciveDate"
              render={({ field, fieldState }) => (
                <DatePicker
                  calendar={persian}
                  locale={persian_fa}
                  // Display "۱۴۰۴/۰۶/۱۳" while the stored value stays the Legacy 8-char
                  // `YYYYMMDD` Latin-digit string — hence the explicit DateObject on the way in
                  // (it parses with its own `format`) and the explicit `.format('YYYYMMDD')` out.
                  format="YYYY/MM/DD"
                  value={
                    field.value
                      ? new DateObject({ date: field.value, format: 'YYYYMMDD', calendar: persian, locale: persian_fa })
                      : undefined
                  }
                  onChange={(date) => field.onChange(date ? toLatinDigits(date.format('YYYYMMDD')) : '')}
                  render={(value, openCalendar) => (
                    <TextField
                      label="تاریخ سند"
                      fullWidth
                      required
                      value={value}
                      onClick={openCalendar}
                      onFocus={openCalendar}
                      inputRef={field.ref}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                      slotProps={{
                        htmlInput: { readOnly: true },
                        input: { startAdornment: <InputAdornment position="start"><EventOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
                      }}
                    />
                  )}
                />
              )}
            />
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

          <Grid size={12}>
            <TextField
              {...register('payReciveDescription')}
              label="شرح سند"
              fullWidth
              required
              multiline
              minRows={2}
              slotProps={{
                htmlInput: { maxLength: 250 },
                input: { startAdornment: <InputAdornment position="start"><NotesOutlinedIcon fontSize="small" color="action" /></InputAdornment> },
              }}
              error={!!errors.payReciveDescription}
              helperText={errors.payReciveDescription?.message}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="payReciveType"
              render={({ field }) => (
                <TextField
                  select
                  fullWidth
                  label="نوع سند"
                  helperText={errors.payReciveType?.message ?? 'payReciveType'}
                  error={!!errors.payReciveType}
                  value={field.value ?? UNSET}
                  onChange={(e) => field.onChange(toEnumFieldValue(e.target.value))}
                >
                  <MenuItem value={UNSET}>انتخاب نشده</MenuItem>
                  {PAY_RECIV_TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>

          {voucherHeadId && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'text.secondary', height: '100%' }}>
                <DescriptionOutlinedIcon fontSize="small" />
                <Typography variant="body2">
                  سند حسابداری مرتبط:{' '}
                  {linkedVoucherQuery.data ? (linkedVoucherQuery.data.docNum ?? voucherHeadId) : '...'}
                  {' — از این فرم قابل تغییر نیست.'}
                </Typography>
              </Stack>
            </Grid>
          )}

          <Grid size={12}>
            <RecordMetaFooter
              createdDate={existingQuery.data?.createdDate}
              updatedDate={existingQuery.data?.updatedDate}
              addUserId={existingQuery.data?.addUserId}
              changeUserId={existingQuery.data?.changeUserId}
            />
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="text" onClick={() => navigate('/operation/pay-recive-heads')}>
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
