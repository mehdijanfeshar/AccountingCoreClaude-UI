import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { MonoCode } from '../../components/MonoCode';
import { toPersianDigits } from '../../lib/format/numbers';
import {
  FS_CHECK_SEVERITY_LABEL,
  FS_RUN_ACTION_LABEL,
  FS_RUN_STATE_META,
  type FsRunActionDto,
  type FsRunCheckDto,
  type FsRunDetailDto,
  type FsRunManualDto,
} from '../../types/fsRun';

function statusIcon(c: FsRunCheckDto) {
  if (c.passed) return <CheckCircleOutlineIcon fontSize="small" color="success" />;
  return c.severity === 3 ? <ErrorOutlineIcon fontSize="small" color="error" /> : <WarningAmberOutlinedIcon fontSize="small" color="warning" />;
}

/**
 * زبانهٔ «کنترل‌ها» (بخش ۴۵-ه، سند منبع §۱۰ و §۱۲-۳): شمارندهٔ موفق/هشدار/خطا، جدول نتایج، مقادیر دستی
 * این اجرا با دلیلشان، و تاریخچهٔ گردش تأیید.
 */
export function FsRunChecksPanel({ detail }: { detail: FsRunDetailDto }) {
  const passed = detail.checks.filter((c) => c.passed).length;
  const warnings = detail.checks.filter((c) => !c.passed && c.severity !== 3).length;
  const errors = detail.checks.filter((c) => !c.passed && c.severity === 3).length;

  const checkColumns: DataTableColumn<FsRunCheckDto>[] = [
    { key: 'st', header: '', width: 36, render: statusIcon },
    { key: 'code', header: 'کد', width: 60, render: (c) => <MonoCode value={c.code} /> },
    { key: 'title', header: 'کنترل', render: (c) => c.titleFa },
    { key: 'sev', header: 'شدت', width: 100, render: (c) => FS_CHECK_SEVERITY_LABEL[c.severity] },
    { key: 'msg', header: 'نتیجه', render: (c) => (c.passed ? 'موفق' : toPersianDigits(c.message ?? 'ناموفق')) },
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

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Chip color="success" variant="outlined" label={`${toPersianDigits(passed)} موفق`} />
          <Chip color="warning" variant="outlined" label={`${toPersianDigits(warnings)} هشدار`} />
          <Chip color="error" variant="outlined" label={`${toPersianDigits(errors)} خطا`} />
        </Stack>
        <DataTable
          columns={checkColumns}
          rows={detail.checks}
          getRowKey={(c) => `${c.code}-${c.titleFa}`}
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
    </Stack>
  );
}
