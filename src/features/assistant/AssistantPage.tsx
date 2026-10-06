import { useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { PageHeader } from '../../components/PageHeader';
import { useSession } from '../../lib/session/SessionContext';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toPersianDigits } from '../../lib/format/numbers';
import { assistantHistoryApi, operationsApi } from './api';
import {
  DATE_KEY,
  voucherDateKey, // تاریخ سند = سؤال تاریخ الگو ({date1}) اگر دارد
  assistantReducer,
  initialAssistantState,
  isReadyForPreview,
  orderedParameters,
  type AssistantState,
} from './assistantState';
import { ConversationPanel } from './ConversationPanel';
import { DraftPreview } from './DraftPreview';
import { FullVoucherEditor } from './FullVoucherEditor';
import { gregorianToJalali, jalaliToGregorian } from './draftMapping';
import { LineExtrasDialog, lineNeedsExtras } from './LineExtrasDialog';
import { lineExtrasApi, type VoucherLineRequirements } from '../vouchers/lineExtras';
import type { DraftLineExtrasInput, OperationInput, VoucherDraft } from './types';

function toOperationInput(state: AssistantState): OperationInput {
  const values: Record<string, string | null> = {};
  const dateKeys = new Set(orderedParameters(state.template).filter((p) => p.type === 4).map((p) => p.key));
  for (const [key, answer] of Object.entries(state.answers)) {
    if (key === DATE_KEY) continue;
    // Date answers are kept as Legacy Jalali `YYYYMMDD` (what the date picker emits); the API takes Gregorian.
    values[key] = dateKeys.has(key) ? jalaliToGregorian(answer.value) : answer.value;
  }
  return { voucherDate: jalaliToGregorian(state.answers[voucherDateKey(state.template)]?.value), values };
}

/**
 * حسابیار — Agent-UX ثبت سند. Left: the conversation (or the full editor); right: the voucher as
 * the server builds it. Nothing here computes a voucher: preview and save always go to the engine.
 */
export function AssistantPage() {
  const navigate = useNavigate();
  const { financialYear } = useSession();
  const [state, dispatch] = useReducer(assistantReducer, undefined, initialAssistantState);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [requestError, setRequestError] = useState<unknown>(null);
  const [editorDraft, setEditorDraft] = useState<VoucherDraft | null>(null);

  const templates = useQuery({ queryKey: ['operation-templates'], queryFn: operationsApi.listTemplates, retry: false });
  // «عملیات‌های اخیر من» — بعد از هر ثبت تازه می‌شود (queryKey در reset/executed دوباره خوانده می‌شود).
  const recent = useQuery({ queryKey: ['assistant-recent', state.outcome?.voucherId ?? ''], queryFn: assistantHistoryApi.recent, retry: false });

  // Preview automatically once every question is answered — but only once per set of answers, so
  // an error that is not about any one question cannot loop the request.
  const lastPreviewed = useRef<string | null>(null);
  const ready = isReadyForPreview(state);
  useEffect(() => {
    if (!ready) lastPreviewed.current = null; // a question is open again — the next answer must preview, even if unchanged
    if (!ready || !state.template || state.draft) return;
    const input = toOperationInput(state);
    const signature = `${state.template.id}|${JSON.stringify(input)}`;
    if (lastPreviewed.current === signature) return;
    lastPreviewed.current = signature;
    setPreviewLoading(true);
    setRequestError(null);
    operationsApi
      .preview(state.template.id, input, financialYear)
      .then((result) => dispatch({ type: 'previewResult', result }))
      .catch(setRequestError)
      .finally(() => setPreviewLoading(false));
  }, [ready, state, financialYear]);

  // ردیف‌هایی که حساب بانکی/شناسه‌دار یا ویژگی دارند، پیش از ثبت فرم تکمیلی خودشان را باز می‌کنند.
  const [extrasDialog, setExtrasDialog] = useState<{ id: number; draft: VoucherDraft; requirements: VoucherLineRequirements[] } | null>(null);
  const [extrasDialogOpen, setExtrasDialogOpen] = useState(false);

  async function executeTemplate() {
    if (!state.template) return;
    const draft = state.draft;
    if (draft) {
      setExecuting(true);
      setRequestError(null);
      try {
        const year = gregorianToJalali(draft.voucherDate).slice(0, 4) || financialYear;
        const requirements = await Promise.all(
          draft.lines.map((l) => lineExtrasApi.requirements(l.subsidiaryAccountId, l.details.map((d) => d.detailId), year)),
        );
        if (requirements.some(lineNeedsExtras)) {
          // همان پیش‌نویس ⇒ همان دیالوگ با مقادیری که کاربر قبلاً وارد کرده بود.
          if (extrasDialog?.draft !== draft) setExtrasDialog({ id: Date.now(), draft, requirements });
          setExtrasDialogOpen(true);
          return;
        }
      } catch (error) {
        setRequestError(error);
        return;
      } finally {
        setExecuting(false);
      }
    }
    await runExecute(undefined);
  }

  async function runExecute(lineExtras: DraftLineExtrasInput[] | undefined) {
    if (!state.template) return;
    setExecuting(true);
    setRequestError(null);
    try {
      const result = await operationsApi.execute(
        state.template.id,
        { ...toOperationInput(state), clientRequestId: state.clientRequestId, lineExtras },
        financialYear,
      );
      if (result.success || !lineExtras) {
        setExtrasDialogOpen(false);
        dispatch({ type: result.success ? 'executed' : 'previewResult', result });
      } else {
        // خطای اطلاعات تکمیلی ⇒ دیالوگ باز می‌ماند و پیام سرور بالای صفحه.
        setRequestError(new Error(result.errors.map((e) => e.message).join(' · ')));
      }
    } catch (error) {
      setRequestError(error);
    } finally {
      setExecuting(false);
    }
  }

  const params = orderedParameters(state.template);
  const answeredCount = params.filter((p) => state.answers[p.key] || state.skipped[p.key]).length;
  const progress = params.length ? answeredCount / params.length : 0;

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<AutoAwesomeOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="ثبت سند با حسابیار"
        description="بگویید چه اتفاقی افتاده؛ سند را حسابیار از روی الگوهای ستاد می‌سازد. حسابدار می‌تواند همهٔ فیلدهای سند را ویرایش کند."
        actions={<Button variant="outlined" onClick={() => navigate('/assistant/templates')}>الگوهای عملیات</Button>}
      />

      {requestError != null && <Box sx={{ mb: 2 }}><ErrorBanner error={requestError} /></Box>}

      {extrasDialog && (
        <LineExtrasDialog
          key={extrasDialog.id}
          open={extrasDialogOpen && state.phase !== 'done'}
          draft={extrasDialog.draft}
          requirements={extrasDialog.requirements}
          financialYear={financialYear}
          executing={executing}
          onCancel={() => setExtrasDialogOpen(false)}
          onConfirm={(lineExtras) => void runExecute(lineExtras)}
        />
      )}

      {state.phase === 'done' && state.outcome ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center', maxWidth: 560, mx: 'auto' }}>
          <TaskAltOutlinedIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h2" component="h2" sx={{ mb: 1 }}>
            سند {toPersianDigits(state.outcome.voucherNo)} ثبت شد
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {state.outcome.wasAlreadyExecuted
              ? 'این درخواست قبلاً ثبت شده بود؛ سند تکراری ساخته نشد.'
              : 'سند در وضعیت «موقت» است و در کارتابل اسناد برای بررسی حسابدار قرار گرفت.'}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Button variant="contained" onClick={() => dispatch({ type: 'reset' })}>عملیات جدید</Button>
            <Button variant="outlined" onClick={() => navigate(`/operation/vouchers/${state.outcome!.voucherId}/view`)}>مشاهدهٔ سند</Button>
            <Button color="inherit" onClick={() => navigate('/operation/voucher-heads')}>کارتابل اسناد</Button>
          </Stack>
        </Paper>
      ) : state.phase === 'edit' ? (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <FullVoucherEditor
              key={state.clientRequestId}
              seed={state.editorSeed}
              initialDescription={state.manualDescription}
              sourceTemplateId={state.template?.id ?? null}
              clientRequestId={state.clientRequestId}
              onExecuted={(result) => dispatch({ type: 'executed', result })}
              onPreview={setEditorDraft}
              onBack={() => {
                setEditorDraft(null);
                dispatch({ type: 'backToConversation' });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <DraftPreview draft={editorDraft ?? state.editorSeed} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              پیش‌نویس بعد از «بررسی سند» از سرور به‌روز می‌شود.
            </Typography>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6, lg: 5 }}>
            <ConversationPanel
              state={state}
              dispatch={dispatch}
              templates={templates.data}
              templatesLoading={templates.isLoading}
              templatesError={templates.error}
              recent={recent.data}
              previewLoading={previewLoading}
              executing={executing}
              onExecute={executeTemplate}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 7 }}>
            <DraftPreview draft={state.draft} loading={previewLoading} progress={progress} templateTitle={state.template?.title} />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
