import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { toPersianDigits } from '../../../lib/format/numbers';
import { fsRunsApi } from '../api';
import { FsWorksheetPanel } from './FsWorksheetPanel';

const fa = (v: number | string) => toPersianDigits(String(v));
const DIVISORS: [number, string][] = [
  [1, 'ریال'],
  [1000, 'هزار ریال'],
  [1000000, 'میلیون ریال'],
];

/**
 * «تلفیق و حذف فی‌مابین» (سند منبع، زیر «کنترل و تأیید»): انتخاب یک اجرای ترکیبی و دیدن تطبیق جفت واحدها، نتیجهٔ قواعد
 * حذف و کاربرگ تلفیق در یک صفحه. همان زبانهٔ «کاربرگ» صفحهٔ اجراست، بدون رفتن به خود اجرا.
 */
export function FsIntercompanyPage() {
  const runs = useQuery({ queryKey: ['fs-runs', 'combined'], queryFn: () => fsRunsApi.list() });
  const combined = (runs.data ?? []).filter((r) => r.includeSubUnits || r.includeEntities);
  const [runId, setRunId] = useState('');
  const [divisor, setDivisor] = useState(1000000);
  const current = runId || combined[0]?.id || '';

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        تلفیق و حذف فی‌مابین
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        تطبیق حساب‌های فی‌مابین به تفکیک واحد، نتیجهٔ قواعد حذف و کاربرگ تلفیق یک اجرای ترکیبی. قواعد حذف در «تلفیق، جریان نقد
        و XBRL» تعریف می‌شوند.
      </Typography>
      {runs.isLoading && <LinearProgress />}
      {runs.isError && <ErrorBanner error={runs.error} />}
      {runs.data && combined.length === 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            اجرای ترکیبی (با زیرواحدها یا شرکت‌های تابعه) نیست؛ اول در «تهیهٔ صورت‌های مالی» یک اجرای ترکیبی بسازید.
          </Typography>
        </Paper>
      )}
      {combined.length > 0 && (
        <>
          <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1.5 }}>
            <TextField select size="small" label="اجرا" value={current} onChange={(e) => setRunId(e.target.value)} sx={{ minWidth: 360 }}>
              {combined.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {`اجرای ${fa(r.runNo)} — ${r.vahedName ?? r.vahedCode}، سال ${fa(r.year)} تا ماه ${fa(r.toMonth)}`}
                </MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="واحد مبلغ" value={divisor} onChange={(e) => setDivisor(Number(e.target.value))} sx={{ minWidth: 160 }}>
              {DIVISORS.map(([v, label]) => (
                <MenuItem key={v} value={v}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {current && <FsWorksheetPanel key={current} runId={current} unitDivisor={divisor} />}
        </>
      )}
    </Box>
  );
}
