import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { STATUS_COLOR, STATUS_LABEL, type SalesCheck, type SalesDocStatus } from './types';

const ICON: Record<string, string> = { err: '✗', warn: '!', ok: '✓', info: 'ⓘ' };
const COLOR: Record<string, string> = { err: 'error.main', warn: 'warning.main', ok: 'success.main', info: 'text.secondary' };

/** فهرست کنترل‌های سرور (خطا، هشدار، تأیید، اطلاع). */
export function CheckList({ checks }: { checks: SalesCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <Stack spacing={0.5}>
      {checks.map((c, i) => (
        <Stack key={i} direction="row" spacing={1} sx={{ color: COLOR[c.level] ?? 'text.secondary' }}>
          <Typography variant="body2" component="span" sx={{ fontWeight: 700, width: 14 }}>{ICON[c.level] ?? '•'}</Typography>
          <Typography variant="body2" component="span">{c.message}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

export function StatusChip({ status }: { status: SalesDocStatus }) {
  return <Chip size="small" color={STATUS_COLOR[status]} variant={status === 4 ? 'filled' : 'outlined'} label={STATUS_LABEL[status]} />;
}
