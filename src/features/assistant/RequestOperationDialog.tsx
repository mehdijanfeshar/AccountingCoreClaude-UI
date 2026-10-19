import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toPersianDigits } from '../../lib/format/numbers';
import { operationRequestsApi } from './api';

const MAX = 1000;

/**
 * «عملیات مورد نظرتان نیست؟» — موضوع را (با جملهٔ فعلی) برای حسابدار واحد می‌فرستد
 * (`POST operations/requests`). حسابدار آن را در کارتابل بررسی می‌بیند و «انجام شد» می‌زند.
 */
export function RequestOperationDialog({ initialSentence, onClose }: { initialSentence: string; onClose: () => void }) {
  const [sentence, setSentence] = useState(initialSentence);
  const send = useMutation({ mutationFn: () => operationRequestsApi.create(sentence.trim()) });
  const missing = sentence.trim().length === 0;

  return (
    <Dialog open onClose={send.isPending ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="request-op-title">
      <DialogTitle id="request-op-title">موضوع را برای حسابدار واحد بفرستید</DialogTitle>
      <DialogContent>
        {send.isSuccess ? (
          <Alert severity="success">درخواست شما ثبت شد؛ حسابدار واحد آن را می‌بیند و پیگیری می‌کند.</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              اگر عملیاتی که می‌خواهید در فهرست نیست، توضیح دهید چه اتفاقی افتاده؛ حسابدار واحد یا ستاد برایش الگو می‌سازد یا سند را برایتان می‌زند.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              label="چه اتفاقی افتاده؟"
              value={sentence}
              onChange={(e) => setSentence(e.target.value.slice(0, MAX))}
              helperText={`${toPersianDigits(sentence.length)} از ${toPersianDigits(MAX)}`}
            />
            {send.isError && <Box sx={{ mt: 2 }}><ErrorBanner error={send.error} /></Box>}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {send.isSuccess ? (
          <Button variant="contained" sx={{ minHeight: 44 }} onClick={onClose}>بستن</Button>
        ) : (
          <>
            <Button sx={{ minHeight: 44 }} onClick={onClose} disabled={send.isPending}>انصراف</Button>
            <Button variant="contained" sx={{ minHeight: 44 }} disabled={missing || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? 'در حال ارسال…' : 'ارسال برای حسابدار'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
