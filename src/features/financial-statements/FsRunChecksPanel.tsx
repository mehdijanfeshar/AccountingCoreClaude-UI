import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { MonoCode } from '../../components/MonoCode';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import {
  FS_CHECK_SEVERITY_LABEL,
  FS_RUN_ACTION_LABEL,
  FS_RUN_STATE_META,
  type FsRunActionDto,
  type FsRunCheckDto,
  type FsRunCommentDto,
  type FsRunDetailDto,
  type FsRunManualDto,
} from '../../types/fsRun';
import { fsRunWorkflowApi } from './api';
import type { FsCommentTarget } from './FsCommentsDrawer';

function statusIcon(c: FsRunCheckDto) {
  if (c.passed) return <CheckCircleOutlineIcon fontSize="small" color="success" />;
  return c.severity === 3 ? <ErrorOutlineIcon fontSize="small" color="error" /> : <WarningAmberOutlinedIcon fontSize="small" color="warning" />;
}

const formatDate = (d: string) => toPersianDigits(`${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}`);

interface Props {
  detail: FsRunDetailDto;
  /** ح-۳ — نظرهای اجرا (برای شمارش گفت‌وگوی هر کنترل). */
  comments: FsRunCommentDto[];
  onComment: (target: FsCommentTarget) => void;
  /** پس از ارجاع/رفع ⇒ بارگذاری دوبارهٔ اجرا و نظرها. */
  onChanged: () => void;
}

/**
 * زبانهٔ «کنترل‌ها» (بخش ۴۵-ه، سند منبع §۱۰ و §۱۲-۳): شمارندهٔ موفق/هشدار/خطا، جدول نتایج، مقادیر دستی
 * این اجرا با دلیلشان، و تاریخچهٔ گردش تأیید. ح-۳: کنترل ناموفق به مسئول با مهلت ارجاع و گفت‌وگو دارد.
 */
export function FsRunChecksPanel({ detail, comments, onComment, onChanged }: Props) {
  const runId = detail.run.id;
  const passed = detail.checks.filter((c) => c.passed).length;
  const warnings = detail.checks.filter((c) => !c.passed && c.severity !== 3).length;
  const errors = detail.checks.filter((c) => !c.passed && c.severity === 3).length;

  const [assigning, setAssigning] = useState<FsRunCheckDto | null>(null);
  const [assignee, setAssignee] = useState({ userId: '', name: '', due: '', note: '' });

  const assign = useMutation({
    mutationFn: (c: FsRunCheckDto) =>
      fsRunWorkflowApi.assignCheck(runId, c.id!, {
        assigneeUserId: assignee.userId.trim(),
        assigneeName: assignee.name.trim() || null,
        dueDate: assignee.due || null,
        note: assignee.note.trim() || null,
      }),
    onSuccess: () => {
      setAssigning(null);
      onChanged();
    },
  });

  const resolve = useMutation({
    mutationFn: (c: FsRunCheckDto) => fsRunWorkflowApi.resolveCheck(runId, c.id!, null),
    onSuccess: onChanged,
  });

  const threadCount = (c: FsRunCheckDto) => comments.filter((x) => x.checkId === c.id).length;

  const checkColumns: DataTableColumn<FsRunCheckDto>[] = [
    { key: 'st', header: '', width: 36, render: statusIcon },
    { key: 'code', header: 'کد', width: 60, render: (c) => <MonoCode value={c.code} /> },
    { key: 'title', header: 'کنترل', render: (c) => c.titleFa },
    { key: 'sev', header: 'شدت', width: 100, render: (c) => FS_CHECK_SEVERITY_LABEL[c.severity] },
    { key: 'msg', header: 'نتیجه', render: (c) => (c.passed ? 'موفق' : toPersianDigits(c.message ?? 'ناموفق')) },
    {
      key: 'assign',
      header: 'مسئول',
      render: (c) =>
        c.assigneeUserId ? (
          <Chip
            size="small"
            color={c.assignState === 2 ? 'success' : 'info'}
            variant="outlined"
            label={
              `${c.assigneeName ?? c.assigneeUserId}` +
              (c.dueDate ? ` · تا ${formatDate(c.dueDate)}` : '') +
              (c.assignState === 2 ? ' · رفع شد' : '')
            }
          />
        ) : (
          ''
        ),
    },
    {
      key: 'act',
      header: '',
      align: 'end',
      render: (c) =>
        c.id && (
          <Stack direction="row" spacing={0} sx={{ justifyContent: 'flex-end' }}>
            {!c.passed && (
              <Tooltip title={c.assigneeUserId ? 'ارجاع دوباره' : 'ارجاع به مسئول'}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setAssignee({ userId: c.assigneeUserId ?? '', name: c.assigneeName ?? '', due: c.dueDate ?? '', note: '' });
                    assign.reset();
                    setAssigning(c);
                  }}
                >
                  <AssignmentIndOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {c.assignState === 1 && (
              <Tooltip title="رفع شد">
                <IconButton size="small" color="success" disabled={resolve.isPending} onClick={() => resolve.mutate(c)}>
                  <DoneAllOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="گفت‌وگو">
              <IconButton size="small" onClick={() => onComment({ rowId: null, checkId: c.id, title: `${c.code} — ${c.titleFa}` })}>
                <Badge badgeContent={threadCount(c)} color="primary">
                  <ChatBubbleOutlineIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          </Stack>
        ),
    },
  ];

  const manualColumns: DataTableColumn<FsRunManualDto>[] = [
    { key: 'row', header: 'ردیف', render: (m) => <MonoCode value={`${m.templateCode} / ${m.rowCode}`} /> },
    { key: 'cur', header: 'جاری', align: 'end', render: (m) => (m.amountCur === null ? '—' : m.amountCur.toLocaleString('fa-IR')) },
    { key: 'prv', header: 'سال قبل', align: 'end', render: (m) => (m.amountPrv === null ? '—' : m.amountPrv.toLocaleString('fa-IR')) },
    { key: 'reason', header: 'دلیل', render: (m) => m.reason },
    { key: 'by', header: 'ثبت', render: (m) => m.addUserId },
  ];

  const actionColumns: DataTableColumn<FsRunActionDto>[] = [
    { key: 'date', header: 'زمان', render: (a) => toPersianDigits(new Date(a.createdDate).toLocaleString('fa-IR')) },
    { key: 'action', header: 'اقدام', render: (a) => FS_RUN_ACTION_LABEL[a.action] ?? a.action },
    {
      key: 'state',
      header: 'وضعیت',
      render: (a) => `${FS_RUN_STATE_META[a.fromState]?.label ?? ''} ← ${FS_RUN_STATE_META[a.toState]?.label ?? ''}`,
    },
    { key: 'user', header: 'کاربر', render: (a) => a.userId },
    { key: 'comments', header: 'توضیح', render: (a) => a.comments ?? '—' },
  ];

  const runComments = comments.filter((c) => !c.rowId && !c.checkId).length;

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Chip color="success" variant="outlined" label={`${toPersianDigits(passed)} موفق`} />
          <Chip color="warning" variant="outlined" label={`${toPersianDigits(warnings)} هشدار`} />
          <Chip color="error" variant="outlined" label={`${toPersianDigits(errors)} خطا`} />
          <Button
            size="small"
            sx={{ mr: 'auto' }}
            startIcon={<ChatBubbleOutlineIcon />}
            onClick={() => onComment({ rowId: null, checkId: null, title: 'کل اجرا' })}
          >
            نظرهای کل اجرا ({toPersianDigits(runComments)})
          </Button>
        </Stack>
        {resolve.isError && <ErrorBanner error={resolve.error} />}
        <DataTable
          columns={checkColumns}
          rows={detail.checks}
          getRowKey={(c) => c.id ?? `${c.code}-${c.titleFa}`}
          emptyMessage="برای این اجرا کنترلی ثبت نشده (اجرای پیش از بخش ۴۵-ه)."
        />
      </Paper>

      {detail.manualValues.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            مقادیر دستی (به ریال، علامت نمایشی)
          </Typography>
          <DataTable columns={manualColumns} rows={detail.manualValues} getRowKey={(m) => `${m.templateCode}-${m.rowCode}`} />
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          تاریخچهٔ گردش تأیید
        </Typography>
        <DataTable
          columns={actionColumns}
          rows={detail.actions}
          getRowKey={(a) => `${a.createdDate}-${a.action}`}
          emptyMessage="هنوز اقدامی ثبت نشده است."
        />
      </Paper>

      <Dialog open={assigning !== null} onClose={() => setAssigning(null)} maxWidth="xs" fullWidth>
        <DialogTitle>ارجاع کنترل {assigning?.code}</DialogTitle>
        <DialogContent>
          {assign.isError && <ErrorBanner error={assign.error} />}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="کد کاربری مسئول"
              required
              value={assignee.userId}
              onChange={(e) => setAssignee((a) => ({ ...a, userId: toLatinDigits(e.target.value).slice(0, 10) }))}
              autoFocus
            />
            <TextField label="نام مسئول (اختیاری)" value={assignee.name} onChange={(e) => setAssignee((a) => ({ ...a, name: e.target.value }))} />
            <JalaliDateField label="مهلت (اختیاری)" value={assignee.due} onChange={(v) => setAssignee((a) => ({ ...a, due: v }))} />
            <TextField
              label="توضیح (اختیاری)"
              multiline
              minRows={2}
              value={assignee.note}
              onChange={(e) => setAssignee((a) => ({ ...a, note: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssigning(null)} disabled={assign.isPending}>
            انصراف
          </Button>
          <Button variant="contained" disabled={!assignee.userId.trim() || assign.isPending} onClick={() => assigning && assign.mutate(assigning)}>
            ارجاع
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
