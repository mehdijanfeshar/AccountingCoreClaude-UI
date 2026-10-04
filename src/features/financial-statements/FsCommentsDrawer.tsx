import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toPersianDigits } from '../../lib/format/numbers';
import type { FsRunCommentDto } from '../../types/fsRun';
import { fsRunWorkflowApi } from './api';

export interface FsCommentTarget {
  rowId: string | null;
  checkId: string | null;
  title: string;
}

interface Props {
  runId: string;
  target: FsCommentTarget;
  comments: FsRunCommentDto[];
  onClose: () => void;
  onChanged: () => void;
}

/** ح-۳ — گفت‌وگوی بازبین و تهیه‌کننده روی یک ردیف، یک کنترل یا کل اجرا (سند منبع §۱۲-۳). */
export function FsCommentsDrawer({ runId, target, comments, onClose, onChanged }: Props) {
  const [body, setBody] = useState('');
  const thread = comments.filter((c) => c.rowId === target.rowId && c.checkId === target.checkId);

  const add = useMutation({
    mutationFn: () => fsRunWorkflowApi.addComment(runId, { rowId: target.rowId, checkId: target.checkId, body: body.trim() }),
    onSuccess: () => {
      setBody('');
      onChanged();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => fsRunWorkflowApi.deleteComment(runId, id),
    onSuccess: onChanged,
  });

  return (
    <Drawer anchor="left" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 }, p: 2 } } }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
          نظرها — {target.title}
        </Typography>
        <IconButton onClick={onClose} aria-label="بستن">
          <CloseIcon />
        </IconButton>
      </Stack>

      {(add.error ?? remove.error) && <ErrorBanner error={add.error ?? remove.error} />}

      <Stack spacing={1.5} sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
        {thread.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            هنوز نظری ثبت نشده است.
          </Typography>
        )}
        {thread.map((c) => (
          <Paper key={c.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: c.isMine ? 'action.hover' : undefined }}>
            <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }}>
                {c.userId} · {toPersianDigits(new Date(c.createdDate).toLocaleString('fa-IR'))}
              </Typography>
              {c.isMine && (
                <Tooltip title="حذف">
                  <IconButton size="small" disabled={remove.isPending} onClick={() => remove.mutate(c.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {c.body}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Box>
        <TextField
          label="نظر تازه"
          multiline
          minRows={3}
          fullWidth
          value={body}
          onChange={(e) => setBody(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 2000 } }}
        />
        <Button
          variant="contained"
          sx={{ mt: 1 }}
          disabled={!body.trim() || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? 'در حال ثبت…' : 'ثبت نظر'}
        </Button>
      </Box>
    </Drawer>
  );
}
