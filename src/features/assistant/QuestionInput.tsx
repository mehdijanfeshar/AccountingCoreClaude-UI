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
import { useQuery } from '@tanstack/react-query';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { amountInWordsRial } from '../../lib/format/numberToWords';
import { UNKNOWN_CHOICE, type Answer } from './assistantState';
import { operationsApi } from './api';
import type { TemplateParameterDto } from './types';

interface QuestionInputProps {
  /** null = the voucher-date question. */
  parameter: TemplateParameterDto | null;
  initial?: Answer;
  error?: string;
  onAnswer: (answer: Answer) => void;
  onSkip?: () => void;
  /** برای چیپ‌های پیشنهاد تفصیلی (`GET templates/{id}/suggestions`). */
  templateId?: string;
  /** در گفتگو، سؤال مبلغ/متن با کادر پایین صفحه جواب داده می‌شود؛ این‌جا فقط خطا نشان داده می‌شود. */
  composerHandles?: boolean;
}

/** One answer widget. Every widget ends in the same `onAnswer({ value, label })`, whatever its type. */
export function QuestionInput({ parameter, initial, error, onAnswer, onSkip, templateId, composerHandles }: QuestionInputProps) {
  const type = parameter?.type ?? 4;
  const viaComposer = composerHandles && (type === 1 || type === 3);
  return (
    <Box>
      {type === 1 && !viaComposer && <AmountInput initial={initial} onAnswer={onAnswer} />}
      {type === 2 && parameter && (
        templateId ? (
          <SuggestedDetailInput templateId={templateId} parameter={parameter} initial={initial} onAnswer={onAnswer} />
        ) : (
          <DetailInput parameter={parameter} initial={initial} onAnswer={onAnswer} />
        )
      )}
      {type === 3 && !viaComposer && <TextInput initial={initial} onAnswer={onAnswer} />}
      {type === 4 && <DateInput label={parameter?.title ?? 'تاریخ سند'} initial={initial} onAnswer={onAnswer} />}
      {type === 5 && parameter && <ChoiceInput parameter={parameter} initial={initial} onAnswer={onAnswer} />}
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

/**
 * سؤال انتخابی (نوع ۵): هر گزینه یک دکمهٔ واقعی (حداقل ۴۴px) و «نمی‌دانم». «نمی‌دانم» با مقدار `unknown` به سرور
 * می‌رود و سند با یادداشت برای حسابدار ثبت می‌شود.
 */
function ChoiceInput({ parameter, initial, onAnswer }: { parameter: TemplateParameterDto; initial?: Answer; onAnswer: (a: Answer) => void }) {
  const options = parameter.options ?? [];
  return (
    <Box>
      {options.length === 0 && <Alert severity="warning">برای این سؤال گزینه‌ای تعریف نشده است؛ «نمی‌دانم» را بزنید یا به حسابدار ستاد خبر دهید.</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {options.map((o) => (
          <Button
            key={o.value}
            variant={initial?.value === o.value ? 'contained' : 'outlined'}
            sx={{ minHeight: 44, justifyContent: 'center' }}
            onClick={() => onAnswer({ value: o.value, label: o.label })}
          >
            {o.label}
          </Button>
        ))}
        <Button
          variant={initial?.value === UNKNOWN_CHOICE ? 'contained' : 'text'}
          color="inherit"
          sx={{ minHeight: 44 }}
          onClick={() => onAnswer({ value: UNKNOWN_CHOICE, label: 'نمی‌دانم' })}
        >
          نمی‌دانم
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        «نمی‌دانم» اشکالی ندارد؛ سند با یادداشت برای حسابدار می‌رود.
      </Typography>
    </Box>
  );
}

/**
 * سؤال تفصیلی با پیشنهاد: چیپ‌های «نام · N بار قبل» از `suggestions` و دکمهٔ «جستجوی … دیگر…» که همان جستجوی
 * همیشگی تفصیلی را باز می‌کند. بدون پیشنهاد، مستقیم همان جستجو.
 */
function SuggestedDetailInput({ templateId, parameter, initial, onAnswer }: {
  templateId: string; parameter: TemplateParameterDto; initial?: Answer; onAnswer: (a: Answer) => void;
}) {
  const [search, setSearch] = useState(false);
  const suggestions = useQuery({
    queryKey: ['operation-suggestions', templateId, parameter.key],
    queryFn: () => operationsApi.suggestions(templateId, parameter.key),
    retry: false,
    staleTime: 60_000,
  });
  const items = (suggestions.data ?? []).slice(0, 5);
  if (items.length === 0 || search) {
    return (
      <Box>
        <DetailInput parameter={parameter} initial={initial} onAnswer={onAnswer} />
        {search && items.length > 0 && (
          <Button size="small" color="inherit" sx={{ mt: 1, minHeight: 44 }} onClick={() => setSearch(false)}>بازگشت به پیشنهادها</Button>
        )}
      </Box>
    );
  }
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {items.map((s) => (
        <Button
          key={s.detailId}
          variant="outlined"
          sx={{ minHeight: 44 }}
          onClick={() => onAnswer({ value: s.detailId, label: s.title, fromRecent: true })}
        >
          {s.title}{s.count > 0 ? ` · ${toPersianDigits(s.count)} بار قبل` : ''}
        </Button>
      ))}
      <Button variant="text" startIcon={<SearchOutlinedIcon />} sx={{ minHeight: 44 }} onClick={() => setSearch(true)}>
        جستجوی {parameter.title || 'مورد'} دیگر…
      </Button>
    </Stack>
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
