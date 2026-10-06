import { useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';
import { JalaliDateField } from '../../components/JalaliDateField';
import { TafsiliItemSelect, type TafsiliSelection } from '../../components/dynamic-tafsili/TafsiliItemSelect';
import { useTafsiliLevels } from '../../components/dynamic-tafsili/useTafsiliLevels';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, normalizeNumericInput } from '../../lib/format/numbers';
import { amountInWordsRial } from '../../lib/format/numberToWords';
import type { Answer } from './assistantState';
import type { TemplateParameterDto } from './types';

interface QuestionInputProps {
  /** null = the voucher-date question. */
  parameter: TemplateParameterDto | null;
  initial?: Answer;
  error?: string;
  onAnswer: (answer: Answer) => void;
  onSkip?: () => void;
}

/** One answer widget. Every widget ends in the same `onAnswer({ value, label })`, whatever its type. */
export function QuestionInput({ parameter, initial, error, onAnswer, onSkip }: QuestionInputProps) {
  const type = parameter?.type ?? 4;
  return (
    <Box>
      {type === 1 && <AmountInput initial={initial} onAnswer={onAnswer} />}
      {type === 2 && parameter && <DetailInput parameter={parameter} initial={initial} onAnswer={onAnswer} />}
      {type === 3 && <TextInput initial={initial} onAnswer={onAnswer} />}
      {type === 4 && <DateInput label={parameter?.title ?? 'تاریخ سند'} initial={initial} onAnswer={onAnswer} />}
      {error && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
      {onSkip && (
        <Button size="small" color="inherit" startIcon={<SkipNextOutlinedIcon />} onClick={onSkip} sx={{ mt: 1 }}>
          این مورد را رد کن (اختیاری است)
        </Button>
      )}
    </Box>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  return (
    <Button type="submit" variant="contained" disabled={disabled} endIcon={<SendRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}>
      تأیید
    </Button>
  );
}

function AmountInput({ initial, onAnswer }: { initial?: Answer; onAnswer: (a: Answer) => void }) {
  const [raw, setRaw] = useState(initial?.value ?? '');
  const amount = Number(raw || 0);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (amount > 0) onAnswer({ value: String(amount), label: `${formatThousands(amount)} ریال` });
  }
  return (
    <form onSubmit={submit}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="مثلاً ۲۰۰٬۰۰۰٬۰۰۰"
          value={raw ? formatThousands(raw) : ''}
          onChange={(e) => setRaw(normalizeNumericInput(e.target.value).replace(/[.-]/g, ''))}
          helperText={amount > 0 ? amountInWordsRial(amount) : 'مبلغ به ریال'}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">ریال</InputAdornment> } }}
        />
        <SubmitButton disabled={!(amount > 0)} />
      </Stack>
    </form>
  );
}

function TextInput({ initial, onAnswer }: { initial?: Answer; onAnswer: (a: Answer) => void }) {
  const [text, setText] = useState(initial?.value ?? '');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) onAnswer({ value: text.trim(), label: text.trim() });
  }
  return (
    <form onSubmit={submit}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <TextField autoFocus fullWidth size="small" multiline maxRows={4} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }} />
        <SubmitButton disabled={!text.trim()} />
      </Stack>
    </form>
  );
}

function DateInput({ label, initial, onAnswer }: { label: string; initial?: Answer; onAnswer: (a: Answer) => void }) {
  const [value, setValue] = useState(initial?.value ?? '');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (value) onAnswer({ value, label: formatLegacyJalaliDate(value) });
  }
  return (
    <form onSubmit={submit}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <JalaliDateField label={label} value={value} onChange={setValue} size="small" />
        <SubmitButton disabled={!value} />
      </Stack>
    </form>
  );
}

/**
 * تفصیلی answer. The list is the same server lookup the voucher form uses for the معین/سطح this
 * parameter feeds in the template — so the unit-visibility rule is applied, never bypassed here.
 */
function DetailInput({ parameter, initial, onAnswer }: { parameter: TemplateParameterDto; initial?: Answer; onAnswer: (a: Answer) => void }) {
  const { allLevels, isLoading } = useTafsiliLevels(parameter.pickerAccountId);
  const level = allLevels.find((l) => l.code === parameter.pickerLevel);
  const [selection, setSelection] = useState<TafsiliSelection | null>(
    initial && level ? { levelId: level.levelId, tafsiliId: initial.value, label: initial.label } : null,
  );

  if (!parameter.pickerAccountId || parameter.pickerLevel === null) {
    return <Alert severity="error">این پارامتر در هیچ ردیف الگو استفاده نشده است (خطای تعریف الگو).</Alert>;
  }
  if (isLoading) return <Typography variant="body2" color="text.secondary">در حال بارگذاری فهرست…</Typography>;
  if (!level) {
    return <Alert severity="error">سطح {parameter.pickerLevel} برای حساب این الگو تعریف نشده است (خطای تعریف الگو).</Alert>;
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1 }}>
        <TafsiliItemSelect accountCodeId={parameter.pickerAccountId} level={level} value={selection} onChange={setSelection} />
      </Box>
      <Button
        variant="contained"
        disabled={!selection}
        onClick={() => selection && onAnswer({ value: selection.tafsiliId, label: selection.label })}
        endIcon={<SendRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}
      >
        تأیید
      </Button>
    </Stack>
  );
}
