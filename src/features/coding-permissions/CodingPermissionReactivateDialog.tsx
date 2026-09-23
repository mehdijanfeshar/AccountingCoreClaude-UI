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
import { JalaliDateField } from '../../components/JalaliDateField';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { codingPermissionsApi } from './api';
import {
  CODING_PERMISSION_STATE,
  CODING_PERMISSION_STATE_OPTIONS,
  type CodingPermissionDto,
  type CodingPermissionState,
} from '../../types/codingPermission';

export interface CodingPermissionReactivateDialogProps {
  /** The blacklisted row to bring back, or null when the dialog is closed. */
  row: CodingPermissionDto | null;
  onClose: () => void;
}

/**
 * «فعال سازی مجدد» — brings a blacklisted row back into service.
 *
 * It asks for a fresh date range rather than restoring the old one because there is nothing to
 * restore: blacklisting clears all four date columns server-side, by design. The radio group
 * again decides which column pair the range lands in.
 */
export function CodingPermissionReactivateDialog({ row, onClose }: CodingPermissionReactivateDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [state, setState] = useState<CodingPermissionState>(CODING_PERMISSION_STATE.Allowed);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    if (!row) return;
    setState(CODING_PERMISSION_STATE.Allowed);
    setFromDate('');
    setToDate('');
  }, [row]);

  const mutation = useMutation({
    mutationFn: (id: string) =>
      codingPermissionsApi.reactivate(id, {
        state,
        fromDate: fromDate || null,
        toDate: toDate || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['coding-permissions'] });
      notify('دسترسی دوباره فعال شد.');
      onClose();
    },
    onError: (error) => {
      notify({
        message: error instanceof Error ? error.message : 'فعال‌سازی با خطا مواجه شد.',
        severity: 'error',
      });
    },
  });

  const rangeInverted = fromDate.length === 8 && toDate.length === 8 && fromDate > toDate;

  return (
    <Dialog open={row !== null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>فعال سازی مجدد</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {row && (
            <Typography variant="body2" color="text.secondary">
              {row.accCode} — {row.accCodeName ?? '—'} / {row.vahedTypeName ?? '—'}
            </Typography>
          )}

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
              با این گزینه، کاربر نمی‌تواند به‌صورت دستی از این معین آرتیکل ثبت کند؛ فقط سند سیستمی
              (مانند افتتاحیه و اختتامیه) اجازهٔ ثبت دارد.
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

          {mutation.isError && <ErrorBanner error={mutation.error} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
        <Button
          variant="contained"
          disabled={rangeInverted || mutation.isPending || !row}
          onClick={() => row && mutation.mutate(row.id)}
        >
          فعال‌سازی
        </Button>
      </DialogActions>
    </Dialog>
  );
}
