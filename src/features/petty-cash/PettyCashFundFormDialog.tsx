import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import InputAdornment from '@mui/material/InputAdornment';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import TagOutlinedIcon from '@mui/icons-material/TagOutlined';
import DriveFileRenameOutlineOutlinedIcon from '@mui/icons-material/DriveFileRenameOutlineOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { LinkedEntityPickerField } from '../../components/LinkedEntityPickerField';
import { AccountCodePickerDialog } from '../../components/AccountCodePickerDialog';
import { ApiError } from '../../lib/api/apiError';
import { AmountField } from '../../components/AmountField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits } from '../../lib/format/numbers';
import { accountCodesApi } from '../chart-of-accounts/api';
import { pettyCashFundsApi } from './api';
import { SETTLEMENT_PERIOD_OPTIONS } from './pettyCashDocState';
import { PETTY_CASH_REFUND_RECORDER_OPTIONS } from './pettyCashRefundRecorder';
import {
  buildEmptyFundFormValues,
  fundDtoToFormValues,
  fundFormSchema,
  fundFormValuesToPayload,
  type FundFormValues,
} from './schema';
import type { AccountCodeDto } from '../../types/accountCode';
import type { PettyCashFundDto } from '../../types/pettyCash';

const UNSET = '';

interface PettyCashFundFormDialogProps {
  /** `null` on «تنخواه جدید»; the row being edited on «ویرایش». */
  fund: PettyCashFundDto | null;
  /** Dialog visibility, separate from `fund` so a fresh «تنخواه جدید» (`fund === null`) still opens. */
  open: boolean;
  onClose: () => void;
}

/**
 * ساخت/ویرایش تنخواه — `POST /api/petty-cash/funds` و `POST /api/petty-cash/funds/{fundId}/update`.
 * تصمیم صاحب پروژه ۲۰۲۶-۰۹-۲۸: تنخواه‌های این ماژول جدول مستقل خودشان (`TB_PC_FUND`) را دارند و
 * دیگر به «تنخواه» اطلاعات پایه (`TB_REVOLVING_FUND`) ربطی ندارند — این دیالوگ جایگزین قبلیِ
 * «تنظیمات تنخواه» (`PettyCashFundSettingsDialog`) شده که فقط زیرمجموعهٔ تنظیمات را می‌ساخت.
 */
export function PettyCashFundFormDialog({ fund, open, onClose }: PettyCashFundFormDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isEdit = fund !== null;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const accountCodeId = fund?.accountCodeId ?? null;
  const existingAccountCodeQuery = useQuery({
    queryKey: ['account-codes', accountCodeId],
    queryFn: () => accountCodesApi.getById(accountCodeId as string),
    enabled: open && accountCodeId !== null,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FundFormValues>({
    resolver: zodResolver(fundFormSchema),
    defaultValues: buildEmptyFundFormValues(),
  });

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    if (!fund) {
      reset(buildEmptyFundFormValues());
      return;
    }
    if (fund.accountCodeId && !existingAccountCodeQuery.data) return;
    const account = existingAccountCodeQuery.data;
    const accountCodeLabel = account ? `${account.accCode ?? ''} - ${account.accCodeName ?? ''}` : null;
    reset(fundDtoToFormValues(fund, accountCodeLabel));
  }, [open, fund, existingAccountCodeQuery.data, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FundFormValues) => {
      const payload = fundFormValuesToPayload(values);
      return isEdit ? pettyCashFundsApi.update(fund!.id, payload) : pettyCashFundsApi.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] });
      notify(isEdit ? 'تنخواه ویرایش شد.' : 'تنخواه جدید ذخیره شد.');
      onClose();
    },
    onError: (error) => setSubmitError(error),
  });

  function onSubmit(values: FundFormValues) {
    setSubmitError(null);
    saveMutation.mutate(values);
  }

  function handlePickAccountCode(account: AccountCodeDto) {
    setValue('accountCodeId', account.id, { shouldDirty: true });
    setValue('accountCodeLabel', `${account.accCode ?? ''} - ${account.accCodeName ?? ''}`, { shouldDirty: true });
  }

  const accountCodeLabel = watch('accountCodeLabel');
  const isActive = watch('isActive');

  const duplicateMessage =
    submitError instanceof ApiError && submitError.status === 409
      ? submitError.detail ?? 'کد تنخواه تکراری است.'
      : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth component="form" onSubmit={handleSubmit(onSubmit)}>
      <DialogTitle>{isEdit ? `ویرایش تنخواه «${fund?.name ?? ''}»` : 'تنخواه جدید'}</DialogTitle>
      <DialogContent>
        {duplicateMessage ? (
          <ErrorBanner error={new Error(duplicateMessage)} />
        ) : (
          submitError !== null && <ErrorBanner error={submitError} />
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              {...register('code', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 20 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TagOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
              error={!!errors.code}
              helperText={errors.code?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField
              {...register('name')}
              label="عنوان"
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
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('custodianUserId', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد کاربری تنخواه‌دار"
              fullWidth
              required
              slotProps={{
                htmlInput: { maxLength: 50 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <BadgeOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
              error={!!errors.custodianUserId}
              helperText={errors.custodianUserId?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('custodianName')}
              label="نام تنخواه‌دار"
              fullWidth
              slotProps={{ htmlInput: { maxLength: 200 } }}
              error={!!errors.custodianName}
              helperText={errors.custodianName?.message}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <AmountField control={control} name="ceiling" label="سقف تنخواه (ریال)" required />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <AmountField control={control} name="perDocLimit" label="سقف هر سند (ریال)" required />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <AmountField
              control={control}
              name="financeManagerApprovalLimit"
              label="سقف اختیار مدیر مالی (ریال)"
              required
              helperText="تا این مبلغ، نقش «مدیر مالی» هم می‌تواند تأیید نهایی کند؛ بیشتر از آن فقط مدیرعامل."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('alertThresholdPercent', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="آستانهٔ هشدار"
              fullWidth
              inputMode="numeric"
              placeholder="مثلاً ۸۰"
              slotProps={{
                htmlInput: { maxLength: 3 },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <PercentOutlinedIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
              error={!!errors.alertThresholdPercent}
              helperText={errors.alertThresholdPercent?.message ?? 'وقتی موجودی نقد به این درصدِ باقی‌مانده برسد، هشدار داده می‌شود.'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="settlementPeriod"
              render={({ field }) => (
                <TextField
                  select
                  fullWidth
                  label="دورهٔ تسویه"
                  value={field.value ?? UNSET}
                  onChange={(e) => field.onChange(e.target.value === UNSET ? null : Number(e.target.value))}
                  error={!!errors.settlementPeriod}
                  helperText={errors.settlementPeriod?.message}
                >
                  <MenuItem value={UNSET}>انتخاب نشده</MenuItem>
                  {SETTLEMENT_PERIOD_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              control={control}
              name="refundRecorder"
              render={({ field }) => (
                <TextField
                  select
                  fullWidth
                  required
                  label="ثبت‌کنندهٔ استرداد"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  error={!!errors.refundRecorder}
                  helperText={
                    errors.refundRecorder?.message ?? 'چه نقشی مجاز به ثبت/حذف استرداد وجه این تنخواه است.'
                  }
                >
                  {PETTY_CASH_REFUND_RECORDER_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
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
            }}
          />

          <Grid size={12}>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label={isActive ? 'فعال' : 'غیرفعال'}
                />
              )}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={saveMutation.isPending}>
          انصراف
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={saveMutation.isPending}
          startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}
        </Button>
      </DialogActions>

      <AccountCodePickerDialog
        open={pickerOpen}
        title="انتخاب حساب معین"
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickAccountCode}
      />
    </Dialog>
  );
}
