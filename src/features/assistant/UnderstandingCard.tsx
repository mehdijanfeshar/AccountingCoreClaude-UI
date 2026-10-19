import type { Dispatch, ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { amountInWordsRial, numberToPersianWords } from '../../lib/format/numberToWords';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { orderedParameters, voucherDateKey, type Answer, type AssistantAction, type AssistantState } from './assistantState';

/** منبع هر مقدار — همان برچسب‌هایی که حباب پاسخ‌ها هم نشان می‌دهد. */
export function answerSource(a: Answer): string | null {
  if (a.fromRecent) return 'مثل دفعهٔ قبل';
  if (a.fromAi) return 'برداشت هوش مصنوعی';
  if (a.fromSentence) return 'از جملهٔ شما';
  return null;
}

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

/** «۱۴۰۵۰۷۱۸» ⇒ «مهر ۱۴۰۵» (دورهٔ ماهانهٔ سند). */
export function periodLabel(legacyDate: string): string {
  if (!/^\d{8}$/.test(legacyDate)) return legacyDate;
  const month = Number(legacyDate.slice(4, 6));
  return `${MONTHS[month - 1] ?? ''} ${toPersianDigits(legacyDate.slice(0, 4))}`.trim();
}

/** «۱۵۰٬۰۰۰٬۰۰۰ ریال (پانزده میلیون تومان = صد و پنجاه میلیون ریال)». */
function amountText(rials: number): string {
  return `${toPersianDigits(formatThousands(rials))} ریال (${numberToPersianWords(Math.round(rials / 10))} تومان = ${amountInWordsRial(rials)})`;
}

interface Row {
  key: string;
  label: string;
  value: ReactNode;
  plain: string;
  chip: string | null;
}

/**
 * کارت «برداشت من از جملهٔ شما» (Agent-UX §۱۲): عملیات، مبلغ، دوره و بقیهٔ جواب‌های برداشت‌شده با برچسب منبع.
 * سه دکمه: «درست است» (ثبت `aiConfirmed` برای ریسک‌سنجی)، «مبلغ را اصلاح کن» و «عملیات دیگری است».
 * فقط نمایش و ورودی کاربر است؛ سند را همچنان سرور می‌سازد.
 */
export function UnderstandingCard({ state, dispatch }: { state: AssistantState; dispatch: Dispatch<AssistantAction> }) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const template = state.template;
  if (!template) return null;

  const params = orderedParameters(template);
  const dateKey = voucherDateKey(template);
  const rows: Row[] = [];

  const amountParam = params.find((p) => p.type === 1);
  const amountAnswer = amountParam ? state.answers[amountParam.key] : undefined;
  if (amountParam && amountAnswer && answerSource(amountAnswer)) {
    const rials = Number(amountAnswer.value);
    rows.push({
      key: amountParam.key,
      label: 'مبلغ',
      plain: Number.isFinite(rials) ? `${toPersianDigits(formatThousands(rials))} ریال` : amountAnswer.label,
      value: Number.isFinite(rials) ? <Typography variant="body1" sx={{ fontWeight: 700 }}>{amountText(rials)}</Typography> : amountAnswer.label,
      chip: answerSource(amountAnswer),
    });
  }
  const dateAnswer = state.answers[dateKey];
  if (dateAnswer && answerSource(dateAnswer)) {
    rows.push({
      key: dateKey,
      label: 'بابت دوره',
      plain: periodLabel(dateAnswer.value),
      value: <Typography variant="body1" sx={{ fontWeight: 700 }}>{periodLabel(dateAnswer.value)}</Typography>,
      chip: answerSource(dateAnswer),
    });
  }
  for (const p of params) {
    if (p.type === 1 || p.type === 4) continue;
    const a = state.answers[p.key];
    if (!a || !answerSource(a)) continue;
    rows.push({
      key: p.key,
      label: p.title || p.key,
      plain: a.label,
      value: <Typography variant="body1" sx={{ fontWeight: 700 }}>{a.label}</Typography>,
      chip: answerSource(a),
    });
  }
  if (rows.length === 0 && !state.userSentence) return null;

  const templateFromAi = Object.values(state.answers).some((a) => a.fromAi);
  const amountKey = amountParam?.key ?? null;

  const buttons = state.aiConfirmed ? (
    <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="تأیید شد" />
  ) : (
    <Stack direction={compact ? 'column' : 'row'} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <Button variant="contained" sx={{ minHeight: 44 }} onClick={() => dispatch({ type: 'confirmAi' })}>درست است</Button>
      {amountKey && (
        <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => dispatch({ type: 'reopen', key: amountKey })}>مبلغ را اصلاح کن</Button>
      )}
      <Button variant="text" color="inherit" sx={{ minHeight: 44 }} onClick={() => dispatch({ type: 'backToPick' })}>عملیات دیگری است</Button>
    </Stack>
  );

  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start', mb: 2 }}>
      <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}><AutoAwesomeOutlinedIcon fontSize="small" /></Avatar>
      <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, p: 1.75, borderRadius: 3, borderColor: 'secondary.main' }} role="region" aria-label="برداشت من">
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>برداشت من از جملهٔ شما</Typography>
        {compact ? (
          <Box sx={{ mb: 1.25 }}>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>{template.title}</Typography>
            <Typography variant="body2" color="text.secondary">{rows.map((r) => r.plain).join(' · ')}</Typography>
          </Box>
        ) : (
          <Stack spacing={1} divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>عملیات</Typography>
              <Typography variant="body1" sx={{ fontWeight: 700, flex: 1 }}>{template.title}</Typography>
              <Chip size="small" variant="outlined" label={templateFromAi ? 'برداشت هوش مصنوعی' : 'از جملهٔ شما'} />
            </Stack>
            {rows.map((r) => (
              <Stack key={r.key} direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 64 }}>{r.label}</Typography>
                <Box sx={{ flex: 1, minWidth: 140 }}>{r.value}</Box>
                {r.chip && <Chip size="small" variant="outlined" label={r.chip} />}
              </Stack>
            ))}
          </Stack>
        )}
        {buttons}
      </Paper>
    </Stack>
  );
}
