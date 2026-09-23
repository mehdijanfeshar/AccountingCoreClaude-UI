import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { FormSectionLabel } from '../../components/FormSectionLabel';
import { JalaliDateField } from '../../components/JalaliDateField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toPersianDigits } from '../../lib/format/numbers';
import { AccountCodeCheckTree } from './AccountCodeCheckTree';
import { VahedTypeCheckTree } from './VahedTypeCheckTree';
import { codingPermissionsApi } from './api';
import {
  CODING_PERMISSION_STATE,
  CODING_PERMISSION_STATE_OPTIONS,
  type CodingPermissionState,
} from '../../types/codingPermission';

export interface CodingPermissionCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-ticks the trees and dates — used by the grid's «تکثیر» action. */
  initial?: {
    accountCodeIds?: string[];
    vahedTypeIds?: string[];
    fromDate?: string | null;
    toDate?: string | null;
    state?: CodingPermissionState;
  };
}

/**
 * «افزودن دسترسی جدید» — the cartesian grant: every ticked معین × every ticked نوع واحد, written
 * in one server transaction.
 *
 * **One date range, not two.** The table has an authorized pair and a limitation pair, and which
 * one the range lands in *is* the meaning of the radio above it — «مجاز» writes the authorized
 * pair, «محدود کردن (ثبت سیستمی)» writes the limitation pair. The server does that routing; this
 * form never sends four dates. Both the Figma and the old Angular screen work this way.
 *
 * «غیرمجاز» is deliberately absent from the radio group: blacklisting is a transition applied to
 * an existing row by the grid's «غیرفعال‌سازی» action, never an initial state. The server rejects
 * it with a 400 too, so this is not the only guard.
 */
export function CodingPermissionCreateDialog({ open, onClose, initial }: CodingPermissionCreateDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [state, setState] = useState<CodingPermissionState>(CODING_PERMISSION_STATE.Allowed);
  const [accountCodeIds, setAccountCodeIds] = useState<string[]>([]);
  const [vahedTypeIds, setVahedTypeIds] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Re-seed on every open so a reopened dialog never shows the previous grant's selection, and so
  // «تکثیر» can hand in the row it was launched from.
  useEffect(() => {
    if (!open) return;
    setState(initial?.state ?? CODING_PERMISSION_STATE.Allowed);
    setAccountCodeIds(initial?.accountCodeIds ?? []);
    setVahedTypeIds(initial?.vahedTypeIds ?? []);
    setFromDate(initial?.fromDate ?? '');
    setToDate(initial?.toDate ?? '');
    setSubmitted(false);
    // `initial` is a fresh object literal on each render of the parent; keying the effect on
    // `open` alone is what makes this a per-open seed rather than a per-render reset that would
    // wipe the user's ticks as they made them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      codingPermissionsApi.createBulk({
        accountCodeIds,
        vahedTypeIds,
        fromDate: fromDate || null,
        toDate: toDate || null,
        state,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['coding-permissions'] });
      // Both numbers are reported: "nothing happened" is a plausible and legitimate outcome here
      // (re-granting what is already granted), and a bare success toast would hide it.
      const parts = [`${toPersianDigits(result.created)} دسترسی ثبت شد`];
      if (result.skipped > 0) {
        parts.push(`${toPersianDigits(result.skipped)} مورد تکراری بود و رد شد`);
      }
      notify(`${parts.join(' — ')}.`);
      onClose();
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'ثبت دسترسی با خطا مواجه شد.',
        severity: 'error',
      });
    },
  });

  const rangeInverted = fromDate.length === 8 && toDate.length === 8 && fromDate > toDate;
  const missingAccounts = accountCodeIds.length === 0;
  const missingVahedTypes = vahedTypeIds.length === 0;
  const canSubmit = !missingAccounts && !missingVahedTypes && !rangeInverted;
  const combinations = accountCodeIds.length * vahedTypeIds.length;

  function submit() {
    setSubmitted(true);
    if (!canSubmit) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>دسترسی جدید</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <RadioGroup
            row
            value={state}
            onChange={(event) => setState(Number(event.target.value) as CodingPermissionState)}
          >
            {CODING_PERMISSION_STATE_OPTIONS.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio size="small" />}
                label={option.label}
              />
            ))}
          </RadioGroup>

          {state === CODING_PERMISSION_STATE.SystemOnly && (
            <Alert severity="info">
              با این گزینه، کاربر نمی‌تواند به‌صورت دستی از این معین‌ها آرتیکل ثبت کند؛ فقط سند
              سیستمی (مانند افتتاحیه و اختتامیه) اجازهٔ ثبت دارد.
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JalaliDateField
                label="از تاریخ"
                value={fromDate}
                onChange={setFromDate}
                fullWidth
                size="small"
                error={rangeInverted}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <JalaliDateField
                label="تا تاریخ"
                value={toDate}
                onChange={setToDate}
                fullWidth
                size="small"
                error={rangeInverted}
                helperText={rangeInverted ? '«تا تاریخ» نباید قبل از «از تاریخ» باشد.' : undefined}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormSectionLabel label="انتخاب کد معین" />
              <AccountCodeCheckTree value={accountCodeIds} onChange={setAccountCodeIds} />
              {submitted && missingAccounts && (
                <Typography variant="caption" color="error">
                  حداقل یک کد معین باید انتخاب شود.
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormSectionLabel label="انتخاب نوع واحد سازمانی" />
              <VahedTypeCheckTree value={vahedTypeIds} onChange={setVahedTypeIds} />
              {submitted && missingVahedTypes && (
                <Typography variant="caption" color="error">
                  حداقل یک نوع واحد باید انتخاب شود.
                </Typography>
              )}
            </Grid>
          </Grid>

          {combinations > 0 && (
            <Typography variant="body2" color="text.secondary">
              {toPersianDigits(accountCodeIds.length)} معین × {toPersianDigits(vahedTypeIds.length)} نوع واحد ={' '}
              {toPersianDigits(combinations)} دسترسی
            </Typography>
          )}

          {mutation.isError && <ErrorBanner error={mutation.error} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          ثبت
        </Button>
      </DialogActions>
    </Dialog>
  );
}
