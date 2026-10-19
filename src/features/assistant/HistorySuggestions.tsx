import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { toPersianDigits } from '../../lib/format/numbers';
import type { HistorySuggestion } from './types';

/** عنوان اجرای ساخته‌شده از سوابق با «از سوابق: …» شروع می‌شود و کانال آن History است. */
export function isHistoryExecution(templateTitle: string | null | undefined, channel?: string | null): boolean {
  return channel === 'History' || (templateTitle ?? '').startsWith('از سوابق');
}

/** نشان کوچک «از سوابق» برای فهرست‌های سند. */
export function FromHistoryChip() {
  return <Chip size="small" color="warning" variant="outlined" label="از سوابق" />;
}

/**
 * پیشنهادهای «از روی سوابق» برای جمله‌ای که الگویی نخورده: یک کارت برای هر پیشنهاد.
 * فقط نمایش و انتخاب است؛ سند را سرور از الگوی سوابق می‌سازد.
 */
export function HistorySuggestions({ items, onPick }: { items: HistorySuggestion[]; onPick: (item: HistorySuggestion) => void }) {
  return (
    <Stack spacing={1.25} sx={{ mt: 1.25 }}>
      {items.map((s) => (
        <Paper key={s.patternId} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'background.paper' }}>
          <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>{s.plainSummary}</Typography>
          {s.sampleDescriptions.slice(0, 3).map((d, i) => (
            <Typography key={i} variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>«{d}»</Typography>
          ))}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 120 }}>
              {toPersianDigits(s.voucherCount)} سند · {toPersianDigits(s.inMyUnitCount)} در واحد شما
            </Typography>
            <Box>
              <Button variant="contained" sx={{ minHeight: 44 }} onClick={() => onPick(s)}>از روی همین بساز</Button>
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
