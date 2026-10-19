import { useState, type Dispatch, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import {
  DATE_KEY,
  currentQuestionKey,
  orderedParameters,
  voucherDateKey,
  type AssistantAction,
  type AssistantState,
} from './assistantState';

/** «۴ از ۵ سؤال»: سؤال‌های پاسخ‌داده‌شده یا ردشده از کل سؤال‌های گفتگو (شامل سؤال تاریخ سند). */
export function questionProgress(state: AssistantState): { done: number; total: number } {
  const keys = [...(voucherDateKey(state.template) === DATE_KEY ? [DATE_KEY] : []), ...orderedParameters(state.template).map((p) => p.key)];
  return { done: keys.filter((k) => state.answers[k] || state.skipped[k]).length, total: keys.length };
}

/** نوار پیشرفت طلایی + پیوند «همهٔ فیلدها». */
export function ProgressLine({ state, onShowAll }: { state: AssistantState; onShowAll?: () => void }) {
  const { done, total } = questionProgress(state);
  return (
    <Box sx={{ mb: 1 }}>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {toPersianDigits(done)} از {toPersianDigits(total)} سؤال
        </Typography>
        {onShowAll && (
          <Link component="button" type="button" variant="caption" onClick={onShowAll} sx={{ minHeight: 24 }}>
            همهٔ فیلدها
          </Link>
        )}
      </Stack>
      <LinearProgress
        variant="determinate"
        color="secondary"
        value={total ? Math.round((done / total) * 100) : 0}
        sx={{ height: 6, borderRadius: 3 }}
        aria-label="پیشرفت سؤال‌ها"
      />
    </Box>
  );
}

/**
 * کادر جواب پایین گفتگو: سؤال مبلغ و متن را همین‌جا جواب می‌دهید؛ سؤال تفصیلی، تاریخ و انتخابی دکمه/انتخاب‌گر خودشان
 * را در حباب دارند و این کادر فقط راهنما می‌دهد.
 */
export function AnswerComposer({ state, dispatch }: { state: AssistantState; dispatch: Dispatch<AssistantAction> }) {
  const key = currentQuestionKey(state);
  const param = key ? orderedParameters(state.template).find((p) => p.key === key) ?? null : null;
  const type = key === null ? null : param?.type ?? 4;
  const typed = type === 1 || type === 3;
  const [text, setText] = useState('');
  // با عوض شدن سؤال، متن نیمه‌تمام پاک می‌شود.
  const [lastKey, setLastKey] = useState<string | null>(key);
  if (lastKey !== key) {
    setLastKey(key);
    setText('');
  }

  const amount = type === 1 ? Number(text || 0) : 0;
  const canSend = typed && (type === 1 ? amount > 0 : text.trim().length > 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend || !key) return;
    if (type === 1) dispatch({ type: 'answer', key, answer: { value: String(amount), label: `${formatThousands(amount)} ریال` } });
    else dispatch({ type: 'answer', key, answer: { value: text.trim(), label: text.trim() } });
    setText('');
  }

  const placeholder = !key
    ? 'همهٔ سؤال‌ها جواب داده شد'
    : type === 1
      ? 'مبلغ را به ریال بنویسید…'
      : type === 3
        ? 'جواب را بنویسید…'
        : 'از گزینه‌های بالا انتخاب کنید';

  return (
    <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        fullWidth
        size="small"
        disabled={!typed}
        placeholder={placeholder}
        value={type === 1 ? (text ? formatThousands(text) : '') : text}
        onChange={(e) => setText(type === 1 ? normalizeNumericInput(e.target.value).replace(/[.-]/g, '') : e.target.value)}
        slotProps={{ htmlInput: { 'aria-label': 'جواب شما', inputMode: type === 1 ? 'numeric' : 'text' } }}
        sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
      />
      <IconButton type="submit" color="primary" disabled={!canSend} aria-label="ارسال جواب" sx={{ width: 44, height: 44, bgcolor: canSend ? 'primary.main' : undefined, color: canSend ? 'primary.contrastText' : undefined, '&:hover': { bgcolor: 'primary.dark' } }}>
        <SendRoundedIcon sx={{ transform: 'scaleX(-1)' }} />
      </IconButton>
    </Box>
  );
}
