import { useRef, useState, type FormEvent } from 'react';
import { newClientId } from '../../lib/ids';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TafsiliItemSelect, type TafsiliSelection } from '../../components/dynamic-tafsili/TafsiliItemSelect';
import { useTafsiliLevels } from '../../components/dynamic-tafsili/useTafsiliLevels';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { amountInWordsRial } from '../../lib/format/numberToWords';
import { operationsApi, quickVoucherApi } from './api';
import { orderedParameters, type Answer } from './assistantState';
import { defaultVoucherDate, gregorianToJalali, jalaliToGregorian } from './draftMapping';
import { LineExtrasDialog, lineNeedsExtras } from './LineExtrasDialog';
import { latestFor, recentToAnswers } from './recentAnswers';
import { lineExtrasApi, type VoucherLineRequirements } from '../vouchers/lineExtras';
import type { AnswerSourceKind, DraftLineExtrasInput, OperationInput, QuickVoucher, RecentAnswer, RecentOperation, TemplateParameterDto, TemplateSummaryDto, VoucherDraft } from './types';

interface Props {
  templates: TemplateSummaryDto[] | undefined;
  financialYear: string;
  /** آخرین اجرای هر الگو — «دفعهٔ قبل: …» به‌جای نمونهٔ مبلغ. */
  recent?: RecentOperation[];
  /** «ویرایش پیش از ثبت»: همان گفتگو با جواب‌های ثابت پر می‌شود. */
  onOpenInConversation: (template: TemplateSummaryDto, answers: Record<string, Answer>) => void;
}

/**
 * سندهای پرتکرار: هر کارت یک الگو با جواب‌های ثابت است؛ کاربر فقط مبلغ (و هر سؤال ثابت‌نشدهٔ دیگر) را می‌نویسد
 * و Enter می‌زند. تاریخ سند امروز است (اگر امروز در سال مالی نباشد، آخرین روز سال). سند را همان موتور الگو
 * می‌سازد؛ ردیف‌های بانکی/شناسه‌دار همان فرم تکمیلی گفتگو را باز می‌کنند.
 */
export function QuickVouchersPanel({ templates, financialYear, recent, onOpenInConversation }: Props) {
  const queryClient = useQueryClient();
  const quick = useQuery({ queryKey: ['assistant-quick'], queryFn: quickVoucherApi.list, retry: false });
  const [toDelete, setToDelete] = useState<QuickVoucher | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => quickVoucherApi.remove(id),
    onSuccess: () => {
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['assistant-quick'] });
    },
  });

  const items = (quick.data ?? []).filter((q) => templates?.some((t) => t.id === q.templateId));
  if (quick.isError || items.length === 0) return null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <BoltOutlinedIcon color="warning" fontSize="small" />
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>سندهای پرتکرار</Typography>
        <Typography variant="caption" color="text.secondary">
          — مبلغ را بنویسید و Enter بزنید؛ سند به تاریخ {formatLegacyJalaliDate(defaultVoucherDate(financialYear).value)} ثبت می‌شود.
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {items.map((q) => (
          <QuickVoucherRow
            key={q.id}
            quick={q}
            template={templates!.find((t) => t.id === q.templateId)!}
            financialYear={financialYear}
            lastTime={latestFor(recent, q.templateId)}
            onDelete={() => setToDelete(q)}
            onOpenInConversation={onOpenInConversation}
          />
        ))}
      </Stack>
      <ConfirmDialog
        open={toDelete !== null}
        title="حذف سند پرتکرار"
        description={`«${toDelete?.title ?? ''}» از فهرست سندهای پرتکرار واحد حذف شود؟ سندهای ثبت‌شده دست نمی‌خورند.`}
        confirmLabel="حذف"
        pending={remove.isPending}
        error={remove.error}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </Paper>
  );
}

function QuickVoucherRow({ quick, template, financialYear, lastTime, onDelete, onOpenInConversation }: {
  quick: QuickVoucher;
  template: TemplateSummaryDto;
  financialYear: string;
  lastTime?: RecentOperation;
  onDelete: () => void;
  onOpenInConversation: Props['onOpenInConversation'];
}) {
  const navigate = useNavigate();
  const fixed = recentToAnswers(template, { ...emptyRecent, answers: quick.fixedAnswers });
  const asked = orderedParameters(template).filter((p) => p.type !== 4 && !fixed[p.key]);
  const [entered, setEntered] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<{ voucherId: string; voucherNo: string } | null>(null);
  const [extras, setExtras] = useState<{ draft: VoucherDraft; requirements: VoucherLineRequirements[] } | null>(null);
  // یک شناسه برای هر تلاش ثبت: کلیک دوباره همان سند قبلی را برمی‌گرداند؛ بعد از ثبت موفق عوض می‌شود.
  const clientRequestId = useRef(newClientId());

  const missing = asked.filter((p) => p.isRequired && !entered[p.key]);

  function input(): OperationInput {
    const date = defaultVoucherDate(financialYear).value;
    const values: Record<string, string | null> = {};
    const answerSources: Record<string, AnswerSourceKind> = {};
    for (const [k, a] of Object.entries({ ...fixed, ...entered })) {
      values[k] = a.value;
      answerSources[k] = entered[k] ? 'user' : 'quick';
    }
    for (const p of template.parameters.filter((x) => x.type === 4)) values[p.key] = jalaliToGregorian(date);
    return { voucherDate: jalaliToGregorian(date), values, answerSources, aiConfirmed: false, hasAttachment: false };
  }

  async function execute(lineExtras?: DraftLineExtrasInput[]) {
    const result = await operationsApi.execute(template.id, { ...input(), clientRequestId: clientRequestId.current, lineExtras }, financialYear);
    if (result.success && result.voucherId) {
      setExtras(null);
      setDone({ voucherId: result.voucherId, voucherNo: result.voucherNo ?? '' });
      setEntered({});
      clientRequestId.current = newClientId();
    } else {
      setErrors(result.errors.map((e) => e.message));
    }
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (busy || missing.length) return;
    setBusy(true);
    setErrors([]);
    setDone(null);
    try {
      const preview = await operationsApi.preview(template.id, input(), financialYear);
      if (!preview.success || !preview.draft) {
        setErrors(preview.errors.map((x) => x.message));
        return;
      }
      const draft = preview.draft;
      const year = gregorianToJalali(draft.voucherDate).slice(0, 4) || financialYear;
      const requirements = await Promise.all(
        draft.lines.map((l) => lineExtrasApi.requirements(l.subsidiaryAccountId, l.details.map((d) => d.detailId), year)),
      );
      if (requirements.some(lineNeedsExtras)) {
        setExtras({ draft, requirements });
        return;
      }
      await execute();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'ثبت سند انجام نشد.']);
    } finally {
      setBusy(false);
    }
  }

  const summary = Object.values(fixed).map((a) => a.label);

  return (
    <Box component="form" onSubmit={submit}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 1.5, py: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1.5 }}>
      <Box sx={{ minWidth: 200, flex: '1 1 220px' }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{quick.title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{template.title}</Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {summary.map((s, i) => <Chip key={i} size="small" variant="outlined" label={s} />)}
        </Stack>
      </Box>

      {asked.map((p, i) => (
        <Box key={p.key} sx={{ flex: '1 1 220px', minWidth: 200 }}>
          <AskedField
            parameter={p}
            autoFocus={i === 0}
            lastValue={lastTime?.answers.find((a) => a.key === p.key)}
            value={entered[p.key]}
            onChange={(a) => setEntered((prev) => {
              const next = { ...prev };
              if (a) next[p.key] = a; else delete next[p.key];
              return next;
            })}
          />
        </Box>
      ))}

      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pt: 0.25 }}>
        <Button type="submit" variant="contained" disabled={busy || missing.length > 0}>
          {busy ? 'در حال ثبت…' : 'ثبت'}
        </Button>
        <Tooltip title="ویرایش پیش از ثبت (گفتگوی کامل)">
          <IconButton size="small" onClick={() => onOpenInConversation(template, { ...fixed, ...entered })}>
            <EditNoteOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="حذف از سندهای پرتکرار">
          <IconButton size="small" onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {errors.length > 0 && (
        <Alert severity="warning" sx={{ flexBasis: '100%' }}>
          {errors.map((m, i) => <div key={i}>{m}</div>)}
        </Alert>
      )}
      {done && (
        <Alert severity="success" sx={{ flexBasis: '100%' }}
          action={<Button size="small" color="inherit" onClick={() => navigate(`/operation/vouchers/${done.voucherId}/view`)}>مشاهدهٔ سند</Button>}>
          سند {toPersianDigits(done.voucherNo)} ثبت شد (موقت).
        </Alert>
      )}

      {extras && (
        <LineExtrasDialog
          open
          draft={extras.draft}
          requirements={extras.requirements}
          financialYear={financialYear}
          executing={busy}
          onCancel={() => setExtras(null)}
          onConfirm={(lineExtras) => {
            setBusy(true);
            execute(lineExtras)
              .catch((error) => setErrors([error instanceof Error ? error.message : 'ثبت سند انجام نشد.']))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </Box>
  );
}

const emptyRecent = { executionId: '', templateId: '', templateTitle: '', voucherNo: '', voucherId: '', createdAtUtc: '' };

/** یک سؤال ثابت‌نشده در یک خط (بدون دکمهٔ «تأیید» جدا — Enter کل کارت را ثبت می‌کند). */
function AskedField({ parameter, value, autoFocus, lastValue, onChange }: {
  parameter: TemplateParameterDto;
  value: Answer | undefined;
  autoFocus: boolean;
  lastValue?: RecentAnswer;
  onChange: (a: Answer | null) => void;
}) {
  if (parameter.type === 1) {
    const amount = Number(value?.value ?? 0);
    return (
      <TextField
        autoFocus={autoFocus}
        fullWidth
        size="small"
        label={parameter.title}
        placeholder={lastValue ? `دفعهٔ قبل: ${toPersianDigits(formatThousands(lastValue.value))}` : undefined}
        value={value ? formatThousands(value.value) : ''}
        onChange={(e) => {
          const raw = normalizeNumericInput(e.target.value).replace(/[.-]/g, '');
          const n = Number(raw || 0);
          onChange(n > 0 ? { value: String(n), label: `${formatThousands(n)} ریال` } : null);
        }}
        helperText={amount > 0 ? amountInWordsRial(amount) : ' '}
        slotProps={{ input: { endAdornment: <InputAdornment position="end">ریال</InputAdornment> } }}
      />
    );
  }
  if (parameter.type === 2) return <AskedDetail parameter={parameter} value={value} onChange={onChange} />;
  return (
    <TextField
      autoFocus={autoFocus}
      fullWidth
      size="small"
      label={parameter.title}
      value={value?.value ?? ''}
      onChange={(e) => onChange(e.target.value.trim() ? { value: e.target.value, label: e.target.value } : null)}
      helperText=" "
    />
  );
}

function AskedDetail({ parameter, value, onChange }: { parameter: TemplateParameterDto; value: Answer | undefined; onChange: (a: Answer | null) => void }) {
  const { allLevels } = useTafsiliLevels(parameter.pickerAccountId);
  const level = allLevels.find((l) => l.code === parameter.pickerLevel);
  if (!parameter.pickerAccountId || !level) return <Typography variant="caption" color="text.secondary">{parameter.title}…</Typography>;
  const selection: TafsiliSelection | null = value ? { levelId: level.levelId, tafsiliId: value.value, label: value.label } : null;
  return (
    <TafsiliItemSelect
      accountCodeId={parameter.pickerAccountId}
      level={level}
      value={selection}
      onChange={(s) => onChange(s ? { value: s.tafsiliId, label: s.label } : null)}
    />
  );
}

/** کلیدهایی که در «ذخیره به‌عنوان سند پرتکرار» به‌طور پیش‌فرض ثابت می‌شوند: همه جز مبلغ و تاریخ. */
export function defaultFixedKeys(template: TemplateSummaryDto, answers: Record<string, Answer>): string[] {
  return orderedParameters(template).filter((p) => p.type !== 1 && p.type !== 4 && answers[p.key]).map((p) => p.key);
}
