import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { myVouchersApi } from './api';

const MAX = 500;

/** «پاسخ به حسابدار»: ثبت‌کنندهٔ سند برگشتی توضیح می‌دهد (`POST operations/mine/{executionId}/reply`، ≤۵۰۰ نویسه). */
export function ReplyDialog({ executionId, docNum, onClose }: { executionId: string; docNum?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const send = useMutation({
    mutationFn: () => myVouchersApi.reply(executionId, message.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operations-mine'] });
      void qc.invalidateQueries({ queryKey: ['operations-reviews'] });
    },
  });
  const missing = message.trim().length === 0;

  return (
    <Dialog open onClose={send.isPending ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="reply-title">
      <DialogTitle id="reply-title">پاسخ به حسابدار{docNum ? ` — سند ${toPersianDigits(docNum)}` : ''}</DialogTitle>
      <DialogContent>
        {send.isSuccess ? (
          <Alert severity="success">پاسخ شما برای حسابدار ثبت شد. برای بررسی دوباره، سند را اصلاح و «ارسال دوباره» کنید.</Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              اگر سؤال حسابدار جواب کوتاهی دارد، همین‌جا بنویسید؛ لازم نیست سند را عوض کنید.
            </Typography>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              label="پیام شما"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
              helperText={`${toPersianDigits(message.length)} از ${toPersianDigits(MAX)}`}
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
              {send.isPending ? 'در حال ارسال…' : 'ارسال پاسخ'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
