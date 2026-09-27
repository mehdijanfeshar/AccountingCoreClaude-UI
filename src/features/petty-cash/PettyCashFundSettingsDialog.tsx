import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ApiError } from '../../lib/api/apiError';
import { AmountField } from '../../components/AmountField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits } from '../../lib/format/numbers';
import { pettyCashFundsApi } from './api';
import { SETTLEMENT_PERIOD_OPTIONS } from './pettyCashDocState';
import {
  buildEmptyFundSettingsFormValues,
  fundSettingsDtoToFormValues,
  fundSettingsFormSchema,
  fundSettingsFormValuesToPayload,
  type FundSettingsFormValues,
} from './schema';
import type { PettyCashFundDto } from '../../types/pettyCash';

const UNSET = '';

interface PettyCashFundSettingsDialogProps {
  fund: PettyCashFundDto | null;
  open: boolean;
  onClose: () => void;
}

/**
 * «تنظیمات تنخواه» — `GET/POST /api/petty-cash/funds/{fundId}/settings`, upsert semantics (same
 * endpoint whether `fund.settings` is currently `null` or not). A dialog, not a page, because this
 * is a single sub-resource of one row already visible in the list — a whole navigation round-trip
 * would be more clicks for less information than staying put.
 */
export function PettyCashFundSettingsDialog({ fund, open, onClose }: PettyCashFundSettingsDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();

  // Re-fetch rather than trust the list row: the list's `settings` is a snapshot from whenever the
  // funds query last ran, and this dialog is the one place that is allowed to be stale-free for it.
  const settingsQuery = useQuery({
    queryKey: ['petty-cash-fund-settings', fund?.id],
    queryFn: () => pettyCashFundsApi.getSettings(fund!.id),
    enabled: open && fund !== null,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FundSettingsFormValues>({
    resolver: zodResolver(fundSettingsFormSchema),
    defaultValues: buildEmptyFundSettingsFormValues(),
  });

  // No settings row yet is expected (spec: `settings: ... | null`) and surfaces as a 404 from a
  // `GET` on a not-yet-created sub-resource — told apart from a REAL failure by status code, not
  // just "any error", so a genuine outage still shows the banner below instead of a silent blank
  // form that looks saved.
  const settingsNotFound = settingsQuery.error instanceof ApiError && settingsQuery.error.isNotFound;

  useEffect(() => {
    if (!open) return;
    if (settingsQuery.data !== undefined) {
      reset(fundSettingsDtoToFormValues(settingsQuery.data));
    } else if (!settingsQuery.isFetching && settingsNotFound) {
      reset(buildEmptyFundSettingsFormValues());
    }
  }, [open, settingsQuery.data, settingsQuery.isFetching, settingsNotFound, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FundSettingsFormValues) =>
      pettyCashFundsApi.saveSettings(fund!.id, fundSettingsFormValuesToPayload(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] });
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-fund-settings', fund?.id] });
      notify('تنظیمات تنخواه ذخیره شد.');
      onClose();
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'ذخیرهٔ تنظیمات با خطا مواجه شد.', severity: 'error' });
    },
  });

  function onSubmit(values: FundSettingsFormValues) {
    saveMutation.mutate(values);
  }

  // A 404 here just means "not configured yet", handled above — only a REAL error (anything else)
  // deserves the banner.
  const showLoadError =
    settingsQuery.isError && !settingsQuery.isFetching && settingsQuery.data === undefined && !settingsNotFound;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth component="form" onSubmit={handleSubmit(onSubmit)}>
      <DialogTitle>تنظیمات تنخواه {fund?.name ? `«${fund.name}»` : ''}</DialogTitle>
      <DialogContent>
        {showLoadError && (
          <ErrorBanner error={new Error('بارگذاری تنظیمات با خطا مواجه شد؛ فرم به‌صورت خالی نمایش داده می‌شود.')} />
        )}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              {...register('custodianUserId', { setValueAs: (v) => toLatinDigits(String(v ?? '')) })}
              label="کد کاربری تنخواه‌دار"
              fullWidth
              slotProps={{
                htmlInput: { maxLength: 10 },
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
            <AmountField control={control} name="perDocLimit" label="سقف هر سند (ریال)" />
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
          <Grid size={12}>
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
    </Dialog>
  );
}
