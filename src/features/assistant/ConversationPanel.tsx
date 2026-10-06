import { useMemo, useState, type Dispatch, type FormEvent, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { ErrorBanner } from '../../components/ErrorBanner';
import { QuestionInput } from './QuestionInput';
import { intentSummary, rankTemplates } from './intentMatch';
import { extractAnswers } from './sentenceExtract';
import { aiAnswers } from './aiAnswers';
import { operationsApi } from './api';
import { defaultVoucherDate } from './draftMapping';
import { useSession } from '../../lib/session/SessionContext';
import { toPersianDigits } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import {
  DATE_KEY,
  voucherDateKey,
  currentQuestionKey,
  isReadyForPreview,
  orderedParameters,
  type AssistantAction,
  type AssistantState,
} from './assistantState';
import type { InterpretResult, RecentOperation, TemplateParameterDto, TemplateSummaryDto } from './types';
import { latestFor, recentToAnswers } from './recentAnswers';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';

interface ConversationPanelProps {
  state: AssistantState;
  dispatch: Dispatch<AssistantAction>;
  templates: TemplateSummaryDto[] | undefined;
  templatesLoading: boolean;
  templatesError: unknown;
  /** آخرین اجرای هر الگو توسط کاربر — «عملیات‌های اخیر من» و «مثل دفعهٔ قبل». */
  recent?: RecentOperation[];
  previewLoading: boolean;
  executing: boolean;
  onExecute: () => void;
}

export function ConversationPanel(props: ConversationPanelProps) {
  const { state } = props;
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 }, borderRadius: 3, minHeight: 420 }}>
      {state.phase === 'pick' ? <PickOperation {...props} /> : <AskQuestions {...props} />}
    </Paper>
  );
}

// ───────────────────────────── bubbles ─────────────────────────────

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start', mb: 1.75 }}>
      <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
        <AutoAwesomeOutlinedIcon fontSize="small" />
      </Avatar>
      <Box sx={{ flex: 1, bgcolor: 'action.hover', borderRadius: 3, borderTopRightRadius: 4, px: 1.75, py: 1.25, minWidth: 0 }}>
        {children}
      </Box>
    </Stack>
  );
}

function UserBubble({ children, onEdit }: { children: ReactNode; onEdit?: () => void }) {
  return (
    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center', mb: 1.75 }}>
      {onEdit && (
        <Tooltip title="تغییر پاسخ">
          <IconButton size="small" onClick={onEdit} aria-label="تغییر پاسخ">
            <EditOutlinedIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 3, borderTopLeftRadius: 4, px: 1.75, py: 1, maxWidth: '80%' }}>
        {children}
      </Box>
    </Stack>
  );
}

// ───────────────────────────── step 1: which operation ─────────────────────────────

function PickOperation({ state, dispatch, templates, templatesLoading, templatesError, recent }: ConversationPanelProps) {
  const { financialYear } = useSession();
  const [search, setSearch] = useState('');
  /** The sentence the user actually sent (Enter) — the assistant replies to this, not to every keystroke. */
  const [asked, setAsked] = useState('');
  const matches = useMemo(() => rankTemplates(templates ?? [], search), [templates, search]);
  const filtered = search.trim() ? matches.map((m) => m.template) : templates ?? [];

  /** پاسخ هوش مصنوعی به آخرین جمله (برای نمایش سؤال روشن‌کننده یا پیام خطا). */
  const [ai, setAi] = useState<InterpretResult | null>(null);
  const [thinking, setThinking] = useState(false);

  /**
   * `sentence` = what the user sent; answers found in it (amount, date, تفصیلی, توضیح) are pre-filled —
   * first by the rules, then (when the AI chose this template) by the AI's reading, which wins.
   */
  function select(template: TemplateSummaryDto, sentence?: string, aiResult?: InterpretResult) {
    const date = defaultVoucherDate(financialYear);
    const label = date.isToday ? `امروز — ${formatLegacyJalaliDate(date.value)}` : `پایان سال مالی ${toPersianDigits(financialYear)} — ${formatLegacyJalaliDate(date.value)}`;
    dispatch({ type: 'selectTemplate', template, today: { value: date.value, label } });
    if (sentence) {
      extractAnswers(template, sentence, financialYear)
        .then((answers) => dispatch({ type: 'prefill', templateId: template.id, answers }))
        .catch(() => { /* nothing found ⇒ the questions are simply asked */ });
    }
    if (aiResult?.templateId === template.id) {
      aiAnswers(template, aiResult)
        .then((answers) => dispatch({ type: 'prefill', templateId: template.id, answers }))
        .catch(() => { /* the rule-based answers stay */ });
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const sentence = search.trim();
    if (!sentence || thinking) return;
    setAsked(sentence);
    setAi(null);

    // فاز ۲: اول هوش مصنوعی (اگر در سرور روشن است). همان Action «انتخاب الگو» را می‌فرستد که کاربر می‌فرستد.
    setThinking(true);
    const result = await operationsApi.interpret(sentence, financialYear);
    setThinking(false);
    if (result.enabled) {
      setAi(result);
      const chosen = result.succeeded && result.templateId ? templates?.find((t) => t.id === result.templateId) : undefined;
      if (chosen) {
        select(chosen, sentence, result);
        return;
      }
      if (result.succeeded) return; // هوش مصنوعی الگویی نیافت یا سؤال روشن‌کننده دارد ⇒ کارت‌های نزدیک نمایش داده می‌شوند.
    }

    // روش قاعده‌ای: One clear winner ⇒ go straight to its questions.
    const ranked = rankTemplates(templates ?? [], sentence);
    if (ranked.length === 1 || (ranked.length > 1 && ranked[0].score > ranked[1].score)) select(ranked[0].template, sentence);
  }

  const askedMatches = asked ? rankTemplates(templates ?? [], asked) : [];
  const manualDescription = asked ? intentSummary(asked) || asked : '';

  return (
    <Box>
      <AssistantBubble>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>سلام! چه اتفاقی افتاده؟</Typography>
        <Typography variant="body2" color="text.secondary">
          عملیات را انتخاب کنید؛ چند سؤال ساده می‌پرسم و سند را خودم می‌سازم. اگر حسابدار هستید می‌توانید سند را کامل و دستی هم بنویسید.
        </Typography>
      </AssistantBubble>

      <Box component="form" onSubmit={send} sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="مثلاً: می‌خواهم سند خرید کالا بزنم"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
        />
        <Button type="submit" variant="contained" disabled={!search.trim()} endIcon={<SendRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}>
          بفرست
        </Button>
      </Box>

      {asked && (
        <>
          <UserBubble>{asked}</UserBubble>
          <AssistantBubble>
            {thinking ? (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <CircularProgress size={16} />
                <Typography variant="body2">در حال فهمیدن جملهٔ شما…</Typography>
              </Stack>
            ) : ai?.clarification ? (
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{ai.clarification}</Typography>
            ) : ai && !ai.succeeded && ai.message ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{ai.message}</Typography>
            ) : null}
            {thinking ? null : templatesError != null ? (
              <Typography variant="body2">
                فهرست عملیات‌ها از سرور خوانده نشد، پس نمی‌توانم عملیات آماده پیشنهاد کنم
                (اگر اسکریپت ۰۶۷ هنوز روی پایگاه داده اجرا نشده، دلیلش همین است). سند را می‌توانید دستی بنویسید:
              </Typography>
            ) : askedMatches.length === 0 ? (
              <Typography variant="body2">
                برای «{asked}» هنوز عملیات آماده‌ای تعریف نشده
                {(templates?.length ?? 0) === 0 ? ' (هیچ الگویی تعریف نشده است؛ الگوها را حسابدار ستاد تعریف می‌کند)' : ''}.
                سند را دستی بنویسید؛ شرحش را از جملهٔ شما گذاشتم:
              </Typography>
            ) : (
              <Typography variant="body2">این عملیات‌ها به درخواست شما نزدیک‌اند؛ یکی را انتخاب کنید یا سند را دستی بنویسید:</Typography>
            )}
            {!thinking && <Button
              size="small"
              variant="outlined"
              startIcon={<EditNoteOutlinedIcon />}
              sx={{ mt: 1 }}
              onClick={() => dispatch({ type: 'startManual', description: manualDescription })}
            >
              سند دستی — «{manualDescription}»
            </Button>}
          </AssistantBubble>
        </>
      )}

      {templatesError != null && !asked && <ErrorBanner error={templatesError} />}
      {templatesLoading && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 2 }} />}

      {!asked && (recent ?? []).some((r) => templates?.some((t) => t.id === r.templateId)) && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>عملیات‌های اخیر من</Typography>
          <Stack spacing={0.75}>
            {(recent ?? []).slice(0, 5).map((r) => {
              const t = templates?.find((x) => x.id === r.templateId);
              if (!t) return null;
              const summary = r.answers.filter((a) => a.type !== 4).map((a) => (a.type === 1 ? `${toPersianDigits(Number(a.value).toLocaleString('en-US'))} ریال` : a.label ?? a.value)).join(' · ');
              return (
                <Paper key={r.executionId} variant="outlined" sx={{ px: 1.5, py: 1, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.title}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                      سند {toPersianDigits(r.voucherNo)} — {toPersianDigits(new Date(r.createdAtUtc).toLocaleDateString('fa-IR'))}{summary ? ` — ${summary}` : ''}
                    </Typography>
                  </Box>
                  <Button size="small" startIcon={<ReplayOutlinedIcon />} onClick={() => {
                    select(t);
                    dispatch({ type: 'prefill', templateId: t.id, answers: recentToAnswers(t, r) });
                  }}>
                    تکرار
                  </Button>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      )}

      <Grid container spacing={1.5}>
        {filtered.map((t) => (
          <Grid key={t.id} size={{ xs: 12, sm: 6 }}>
            <Card variant="outlined" sx={{ height: '100%', borderRadius: 2.5 }}>
              <CardActionArea onClick={() => select(t, asked || undefined)} sx={{ p: 1.75, height: '100%', alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>{t.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, flex: 1 }}>{t.description}</Typography>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
                  {orderedParameters(t).slice(0, 4).map((p) => (
                    <Chip key={p.key} size="small" variant="outlined" label={p.title} />
                  ))}
                </Stack>
              </CardActionArea>
            </Card>
          </Grid>
        ))}

        <Grid size={{ xs: 12, sm: 6 }}>
          <Card variant="outlined" sx={{ height: '100%', borderRadius: 2.5, borderStyle: 'dashed' }}>
            <CardActionArea onClick={() => dispatch({ type: 'startManual' })} sx={{ p: 1.75, height: '100%', alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                <EditNoteOutlinedIcon color="secondary" />
                <Typography variant="body1" sx={{ fontWeight: 700 }}>سند کامل (دستی)</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                همهٔ فیلدهای سند: معین، تفصیلی هر سطح، بدهکار/بستانکار، شرح، پیوست و چک.
              </Typography>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {!templatesLoading && !asked && templates && filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {templates.length === 0 ? 'هنوز الگوی عملیاتی تعریف نشده است.' : 'عملیاتی با این عبارت پیدا نشد.'}
        </Typography>
      )}
      {state.generalErrors.length > 0 && <Alert severity="error" sx={{ mt: 2 }}>{state.generalErrors[0].message}</Alert>}
    </Box>
  );
}

// ───────────────────────────── step 2: questions ─────────────────────────────

function AskQuestions({ state, dispatch, previewLoading, executing, onExecute, recent }: ConversationPanelProps) {
  const [view, setView] = useState<'chat' | 'form'>('chat');
  const template = state.template!;
  /** آخرین سندی که کاربر با همین الگو زد — دکمهٔ «مثل دفعهٔ قبل». */
  const lastTime = latestFor(recent, template.id);
  const params = orderedParameters(template);
  const current = currentQuestionKey(state);
  const ready = isReadyForPreview(state);

  const questions: { key: string; prompt: string; parameter: TemplateParameterDto | null }[] = [
    // الگویی که سؤال تاریخ دارد ({date1}): همان سؤال تاریخ سند است؛ سؤال جدا پرسیده نمی‌شود.
    ...(voucherDateKey(template) === DATE_KEY ? [{ key: DATE_KEY, prompt: 'سند به چه تاریخی ثبت شود؟', parameter: null }] : []),
    ...params.map((p) => ({
      key: p.key,
      prompt: p.key === voucherDateKey(template) ? `${p.askPrompt} (تاریخ سند)` : p.askPrompt,
      parameter: p,
    })),
  ];

  function questionInput(q: (typeof questions)[number]) {
    return (
      <QuestionInput
        key={`${q.key}-${state.answers[q.key]?.value ?? ''}`}
        parameter={q.parameter}
        // سؤال تاریخ سند: اگر هنوز جوابی نیست، امروز/پایان سال مالی از پیش در کادر است تا فقط تأیید شود.
        initial={state.answers[q.key] ?? (q.key === voucherDateKey(template) ? state.defaultDate ?? undefined : undefined)}
        error={state.paramErrors[q.key]}
        onAnswer={(answer) => dispatch({ type: 'answer', key: q.key, answer })}
        onSkip={q.parameter && !q.parameter.isRequired ? () => dispatch({ type: 'skip', key: q.key }) : undefined}
      />
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>عملیات</Typography>
        <Button size="small" color="inherit" onClick={() => dispatch({ type: 'reset' })} disabled={executing} sx={{ mr: 1 }}>
          انصراف
        </Button>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)}>
          <ToggleButton value="chat" aria-label="گفتگو"><ForumOutlinedIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="form" aria-label="همهٔ فیلدها"><ViewListOutlinedIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <UserBubble onEdit={() => dispatch({ type: 'reset' })}>{template.title}</UserBubble>

      {lastTime && !Object.values(state.answers).some((a) => !a.fromSentence) && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}>
          <Button size="small" variant="outlined" startIcon={<ReplayOutlinedIcon />}
            onClick={() => dispatch({ type: 'prefill', templateId: template.id, answers: recentToAnswers(template, lastTime) })}>
            مثل دفعهٔ قبل
          </Button>
          <Typography variant="caption" color="text.secondary">
            جواب‌های سند {toPersianDigits(lastTime.voucherNo)} ({toPersianDigits(new Date(lastTime.createdAtUtc).toLocaleDateString('fa-IR'))}) پر می‌شود؛ تاریخ دوباره پرسیده می‌شود.
          </Typography>
        </Stack>
      )}

      {view === 'form' ? (
        <Stack spacing={2} sx={{ mb: 2 }}>
          {questions.map((q) => (
            <Box key={q.key}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                {q.parameter?.title ?? 'تاریخ سند'}
                {q.parameter && !q.parameter.isRequired && <Chip size="small" label="اختیاری" sx={{ mr: 1 }} />}
                {state.answers[q.key] && <Chip size="small" color="success" variant="outlined" label={state.answers[q.key].label} sx={{ mr: 1 }} />}
              </Typography>
              {questionInput(q)}
            </Box>
          ))}
        </Stack>
      ) : (
        questions.map((q) => {
          const answered = state.answers[q.key];
          const skipped = state.skipped[q.key];
          if (q.key === current) {
            return (
              <AssistantBubble key={q.key}>
                <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>{q.prompt}</Typography>
                {questionInput(q)}
              </AssistantBubble>
            );
          }
          if (!answered && !skipped) return null;
          return (
            <Box key={q.key}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, mr: 5.5 }}>{q.prompt}</Typography>
              <UserBubble onEdit={() => dispatch({ type: 'reopen', key: q.key })}>
                {answered ? answered.label : <em>رد شد</em>}
                {(answered?.fromSentence || answered?.fromRecent) && (
                  <Box component="span" sx={{ display: "block", fontSize: 11, opacity: 0.85 }}>
                    {answered.fromRecent ? 'مثل دفعهٔ قبل' : answered.fromAi ? 'برداشت هوش مصنوعی از جملهٔ شما' : 'از جملهٔ شما'} — اگر درست نیست تغییرش دهید
                  </Box>
                )}
              </UserBubble>
            </Box>
          );
        })
      )}

      {ready && (
        <AssistantBubble>
          {previewLoading ? (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <CircularProgress size={18} />
              <Typography variant="body2">در حال ساخت سند…</Typography>
            </Stack>
          ) : state.draft ? (
            <Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <TaskAltOutlinedIcon color="success" fontSize="small" />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>سند آماده است. پیش‌نویس را کنارش ببینید.</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                اگر درست است ثبت کنید؛ سند «موقت» ثبت می‌شود و حسابدار آن را بررسی می‌کند. برای تغییر هر فیلد سند (شرح، پیوست، ردیف، چک…) ویرایش کامل را بزنید.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                <Button variant="contained" onClick={onExecute} disabled={executing}>
                  {executing ? 'در حال ثبت…' : 'ثبت سند'}
                </Button>
                <Button variant="outlined" startIcon={<EditNoteOutlinedIcon />} onClick={() => dispatch({ type: 'openEditor' })}>
                  ویرایش کامل سند
                </Button>
                <Button color="inherit" onClick={() => dispatch({ type: 'reset' })} disabled={executing}>
                  انصراف
                </Button>
              </Stack>
            </Box>
          ) : state.generalErrors.length > 0 ? (
            <Box>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>از این اطلاعات نمی‌توانم سند بسازم:</Typography>
              {state.generalErrors.map((e, i) => (
                <Alert key={i} severity="error" sx={{ mb: 1 }}>{e.message}</Alert>
              ))}
              <Typography variant="body2" color="text.secondary">
                این خطا معمولاً از تعریف الگوست؛ به حسابدار ستاد خبر دهید یا سند را دستی بنویسید.
              </Typography>
              <Button sx={{ mt: 1 }} variant="outlined" onClick={() => dispatch({ type: 'startManual' })}>سند کامل (دستی)</Button>
            </Box>
          ) : null}
        </AssistantBubble>
      )}
    </Box>
  );
}
