import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { JalaliDateField } from '../../components/JalaliDateField';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import { sortVouchers, VOUCHER_SORT_TYPE } from './api';

interface SortVouchersDialogProps {
  open: boolean;
  year: string;
  onClose: () => void;
}

/**
 * مرتب‌سازی اسناد — renumbers a range of vouchers so شماره سند runs in تاریخ سند order.
 *
 * The range is given one of two ways, exactly as the old system offered: a شماره سند span or a
 * تاریخ سند span. The server decides everything else — which vouchers qualify, where numbering
 * resumes from, and whether the range contains a finalized voucher (409).
 */
export function SortVouchersDialog({ open, year, onClose }: SortVouchersDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'docNum' | 'docDate'>('docNum');
  const [docNumFrom, setDocNumFrom] = useState('');
  const [docNumTo, setDocNumTo] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState<unknown>(null);

  const mutation = useMutation({
    mutationFn: () =>
      sortVouchers({
        sortType: mode === 'docNum' ? VOUCHER_SORT_TYPE.docNum : VOUCHER_SORT_TYPE.docDate,
        docNumFrom: mode === 'docNum' ? docNumFrom : null,
        docNumTo: mode === 'docNum' ? docNumTo : null,
        dateDocFrom: mode === 'docDate' ? dateFrom : null,
        dateDocTo: mode === 'docDate' ? dateTo : null,
        year,
      }),
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
      notify(
        count === 0
          ? 'سندی در این بازه برای مرتب‌سازی یافت نشد.'
          : `${toPersianDigits(count)} سند مرتب‌سازی شد.`,
      );
      handleClose();
    },
    onError: (err) => setError(err),
  });

  function handleClose() {
    setError(null);
    onClose();
  }

  const isComplete =
    mode === 'docNum'
      ? docNumFrom.trim().length > 0 && docNumTo.trim().length > 0
      : dateFrom.length > 0 && dateTo.length > 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>مرتب‌سازی اسناد</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Alert severity="warning">
            <AlertTitle>این عملیات شمارهٔ اسناد را تغییر می‌دهد</AlertTitle>
            اسناد بازهٔ انتخابی بر اساس <strong>تاریخ سند</strong> دوباره شماره‌گذاری می‌شوند. اگر
            حتی یک سند در بازه در وضعیت «بررسی‌شده» یا «تأیید دائم» باشد، کل عملیات رد می‌شود.
          </Alert>

          <ToggleButtonGroup
            value={mode}
            exclusive
            size="small"
            onChange={(_, value) => value && setMode(value)}
            fullWidth
          >
            <ToggleButton value="docNum">بر اساس شمارهٔ سند</ToggleButton>
            <ToggleButton value="docDate">بر اساس تاریخ سند</ToggleButton>
          </ToggleButtonGroup>

          {mode === 'docNum' ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="از شمارهٔ سند"
                value={docNumFrom}
                onChange={(e) => setDocNumFrom(toLatinDigits(e.target.value))}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
              />
              <TextField
                label="تا شمارهٔ سند"
                value={docNumTo}
                onChange={(e) => setDocNumTo(toLatinDigits(e.target.value))}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 6, inputMode: 'numeric' } }}
              />
            </Stack>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <JalaliDateField label="از تاریخ" value={dateFrom} onChange={setDateFrom} />
              <JalaliDateField label="تا تاریخ" value={dateTo} onChange={setDateTo} />
            </Stack>
          )}

          <TextField label="سال مالی" value={toPersianDigits(year || '—')} disabled fullWidth />

          {error !== null && <ErrorBanner error={error} />}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} color="inherit" disabled={mutation.isPending}>
          انصراف
        </Button>
        <Button
          onClick={() => {
            setError(null);
            mutation.mutate();
          }}
          variant="contained"
          disabled={!isComplete || mutation.isPending || year.trim().length === 0}
        >
          {mutation.isPending ? 'در حال مرتب‌سازی...' : 'مرتب‌سازی'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
