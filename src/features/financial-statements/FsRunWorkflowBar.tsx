import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { meApi } from '../../lib/api/meApi';
import { FS_ROW_TYPE } from '../../types/fsTemplate';
import { FS_RUN_ACTION, FS_RUN_STATE, FS_RUN_STATE_META, type FsRunDetailDto } from '../../types/fsRun';
import { fsRunWorkflowApi } from './api';

interface Props {
  detail: FsRunDetailDto;
  onChanged: () => void;
  onManualValues: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
  onCompare: () => void;
}

/**
 * نوار وضعیت و گردش تأیید یک اجرا (بخش ۴۵-ه، سند منبع §۱۱ و §۱۲-۴): وضعیت، اقدام‌های مجاز با دلیل
 * غیرفعال‌بودن، ورود مقادیر دستی، مقایسه، و نوار زرد «کهنه» وقتی اسناد پس از اجرا تغییر کرده‌اند.
 * تفکیک وظایف سمت سرور اجبار می‌شود؛ اینجا فقط دکمه را از پیش غیرفعال و علتش را نشان می‌دهد.
 */
export function FsRunWorkflowBar({ detail, onChanged, onManualValues, onRegenerate, regenerating, onCompare }: Props) {
  const run = detail.run;
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState('');

  const meQuery = useQuery({ queryKey: ['me'], queryFn: () => meApi.getCurrentUser() });
  const me = meQuery.data?.userId;

  const stalenessQuery = useQuery({
    queryKey: ['fs-run-staleness', run.id],
    queryFn: () => fsRunWorkflowApi.staleness(run.id),
    enabled: run.state !== FS_RUN_STATE.Superseded,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: ({ action, comments }: { action: number; comments: string | null }) =>
      fsRunWorkflowApi.transition(run.id, action, comments),
    onSuccess: () => {
      setReturning(false);
      setComment('');
      onChanged();
    },
  });

  const blockingFailed = detail.checks.filter((c) => c.severity === 3 && !c.passed).length;
  const submitter = [...detail.actions].reverse().find((a) => a.action === FS_RUN_ACTION.Submit)?.userId;
  const isPreparer = !!me && me === run.addUserId;
  const hasExternal = detail.statements.some((s) => s.rows.some((r) => r.rowType === FS_ROW_TYPE.External));
  const meta = FS_RUN_STATE_META[run.state] ?? FS_RUN_STATE_META[1];

  const submitBlock = run.usesDraft
    ? 'اجرای آزمایشی (قالب پیش‌نویس) ارسال نمی‌شود'
    : blockingFailed > 0
      ? `${blockingFailed} کنترل مسدودکننده ناموفق است`
      : '';
  const approveBlock = isPreparer || (!!me && me === submitter) ? 'تهیه‌کننده/ارسال‌کننده نمی‌تواند تأیید کند (تفکیک وظایف)' : '';
  const publishBlock = isPreparer ? 'تهیه‌کننده نمی‌تواند منتشر کند (تفکیک وظایف)' : '';

  const act = (action: number) => mutation.mutate({ action, comments: null });

  return (
    <>
      {stalenessQuery.data?.isStale && (
        <Alert
          severity="warning"
          sx={{ mb: 2, displayPrint: 'none' }}
          action={
            <Button color="inherit" size="small" startIcon={<RefreshOutlinedIcon />} disabled={regenerating} onClick={onRegenerate}>
              تهیهٔ دوباره
            </Button>
          }
        >
          دادهٔ منبع پس از این اجرا تغییر کرده است؛ اعداد این صورت دیگر با اسناد فعلی یکی نیست.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, displayPrint: 'none' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Chip color={meta.color} label={meta.label} />
          {blockingFailed > 0 && <Chip size="small" color="error" variant="outlined" label={`${blockingFailed} خطای مسدودکننده`} />}

          <Stack direction="row" spacing={1} sx={{ mr: 'auto', flexWrap: 'wrap', gap: 1 }}>
            {run.state === FS_RUN_STATE.Draft && hasExternal && (
              <Button size="small" variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={onManualValues}>
                ورود مقادیر دستی
              </Button>
            )}
            <Button size="small" variant="outlined" startIcon={<CompareArrowsOutlinedIcon />} onClick={onCompare}>
              مقایسه با اجرای دیگر
            </Button>

            {run.state === FS_RUN_STATE.Draft && (
              <Tooltip title={submitBlock}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<SendOutlinedIcon />}
                    disabled={!!submitBlock || mutation.isPending}
                    onClick={() => act(FS_RUN_ACTION.Submit)}
                  >
                    ارسال برای بازبینی
                  </Button>
                </span>
              </Tooltip>
            )}
            {run.state === FS_RUN_STATE.InReview && (
              <Tooltip title={approveBlock}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<TaskAltOutlinedIcon />}
                    disabled={!!approveBlock || mutation.isPending}
                    onClick={() => act(FS_RUN_ACTION.Approve)}
                  >
                    تأیید
                  </Button>
                </span>
              </Tooltip>
            )}
            {run.state === FS_RUN_STATE.Approved && (
              <Tooltip title={publishBlock}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<PublishOutlinedIcon />}
                    disabled={!!publishBlock || mutation.isPending}
                    onClick={() => act(FS_RUN_ACTION.Publish)}
                  >
                    انتشار
                  </Button>
                </span>
              </Tooltip>
            )}
            {(run.state === FS_RUN_STATE.InReview || run.state === FS_RUN_STATE.Approved) && (
              <Button size="small" color="warning" startIcon={<UndoOutlinedIcon />} disabled={mutation.isPending} onClick={() => setReturning(true)}>
                برگشت
              </Button>
            )}
          </Stack>
        </Stack>
        {mutation.isError && !returning && <ErrorBanner error={mutation.error} />}
      </Paper>

      <Dialog open={returning} onClose={() => setReturning(false)} maxWidth="sm" fullWidth>
        <DialogTitle>برگشت به پیش‌نویس</DialogTitle>
        <DialogContent>
          {mutation.isError && <ErrorBanner error={mutation.error} />}
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="دلیل برگشت"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturning(false)}>انصراف</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!comment.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ action: FS_RUN_ACTION.Return, comments: comment.trim() })}
          >
            برگشت
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
