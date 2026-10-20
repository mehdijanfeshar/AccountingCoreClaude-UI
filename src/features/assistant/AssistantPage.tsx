import { useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { PageHeader } from '../../components/PageHeader';
import { useSession } from '../../lib/session/SessionContext';
import { ErrorBanner } from '../../components/ErrorBanner';
import { assistantHistoryApi, historyApi, operationsApi } from './api';
import {
  DATE_KEY,
  voucherDateKey, // تاریخ سند = سؤال تاریخ الگو ({date1}) اگر دارد
  assistantReducer,
  initialAssistantState,
  isReadyForPreview,
  orderedParameters,
  answerSourceKind,
  type AssistantState,
} from './assistantState';
import { ConversationPanel } from './ConversationPanel';
import { QuickVouchersPanel } from './QuickVouchersPanel';
import { SubmittedScreen } from './SubmittedScreen';
import { MyVouchersStrip } from './MyVouchersStrip';
import { MobileDraftSheet } from './MobileDraftSheet';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits } from '../../lib/format/numbers';
import { DraftPreview } from './DraftPreview';
import { FullVoucherEditor } from './FullVoucherEditor';
import { defaultVoucherDate, gregorianToJalali, jalaliToGregorian } from './draftMapping';
import { LineExtrasDialog, lineNeedsExtras } from './LineExtrasDialog';
import { PendingAttachmentsPicker, uploadPendingAttachments } from './VoucherAttachments';
import { lineExtrasApi, type VoucherLineRequirements } from '../vouchers/lineExtras';
import type { AnswerSourceKind, DraftLineExtrasInput, OperationInput, OperationResult, TemplateSummaryDto, VoucherDraft } from './types';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import type { Answer } from './assistantState';

function toOperationInput(state: AssistantState, hasAttachment = false): OperationInput {
  const values: Record<string, string | null> = {};
  const answerSources: Record<string, AnswerSourceKind> = {};
  const dateKeys = new Set(orderedParameters(state.template).filter((p) => p.type === 4).map((p) => p.key));
  for (const [key, answer] of Object.entries(state.answers)) {
    if (key === DATE_KEY) continue;
    // Date answers are kept as Legacy Jalali `YYYYMMDD` (what the date picker emits); the API takes Gregorian.
    values[key] = dateKeys.has(key) ? jalaliToGregorian(answer.value) : answer.value;
    answerSources[key] = answerSourceKind(answer);
  }
  return {
    voucherDate: jalaliToGregorian(state.answers[voucherDateKey(state.template)]?.value),
    values,
    answerSources,
    aiConfirmed: state.aiConfirmed,
    // فایل‌ها پیش از ثبت فقط در مرورگرند و بلافاصله بعد از ساخته‌شدن سند روی آن بارگذاری می‌شوند.
    hasAttachment,
  };
}

/**
 * حسابیار — Agent-UX ثبت سند. Left: the conversation (or the full editor); right: the voucher as
 * the server builds it. Nothing here computes a voucher: preview and save always go to the engine.
 */
export function AssistantPage() {
  const navigate = useNavigate();
  const { financialYear, unitName } = useSession();
  const [state, dispatch] = useReducer(assistantReducer, undefined, initialAssistantState);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [requestError, setRequestError] = useState<unknown>(null);
  const [editorDraft, setEditorDraft] = useState<VoucherDraft | null>(null);
  // مدرک انتخاب‌شده پیش از ثبت؛ بعد از ثبت روی سند بارگذاری می‌شود.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadFailed, setUploadFailed] = useState<string[]>([]);
  useEffect(() => {
    if (state.phase === 'pick') {
      setPendingFiles([]);
      setUploadFailed([]);
    }
  }, [state.phase]);

  async function finishExecuted(result: OperationResult) {
    if (result.success && result.voucherId && !result.wasAlreadyExecuted && pendingFiles.length > 0) {
      setUploadFailed(await uploadPendingAttachments(result.voucherId, pendingFiles));
      setPendingFiles([]);
    }
    dispatch({ type: 'executed', result });
  }
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // سند پرتکرار ⇒ «ویرایش پیش از ثبت»: همان گفتگو با جواب‌های ثابت.
  function openInConversation(template: TemplateSummaryDto, answers: Record<string, Answer>) {
    const date = defaultVoucherDate(financialYear);
    dispatch({ type: 'selectTemplate', template, today: { value: date.value, label: formatLegacyJalaliDate(date.value) } });
    dispatch({ type: 'prefill', templateId: template.id, answers });
  }

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
    const request = state.source === 'history'
      ? historyApi.preview(state.template.id, { ...input, userSentence: state.userSentence || null, aiTraceId: state.aiTraceId }, financialYear)
      : operationsApi.preview(state.template.id, input, financialYear);
    request
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
      const body = { ...toOperationInput(state, pendingFiles.length > 0), clientRequestId: state.clientRequestId, lineExtras, aiTraceId: state.aiTraceId, userSentence: state.userSentence || null };
      const result = state.source === 'history'
        ? await historyApi.execute(state.template.id, body, financialYear)
        : await operationsApi.execute(state.template.id, body, financialYear);
      // سوابق: اگر سرور اطلاعات تکمیلی ردیف را خواست (`lines[i].extras`) همان دیالوگ ردیف‌ها باز می‌شود.
      const draft = state.draft;
      if (!result.success && !lineExtras && draft && result.errors.some((e) => /^lines\[\d+\]\.extras$/.test(e.parameterKey ?? ''))) {
        const year = gregorianToJalali(draft.voucherDate).slice(0, 4) || financialYear;
        const requirements = await Promise.all(
          draft.lines.map((l) => lineExtrasApi.requirements(l.subsidiaryAccountId, l.details.map((d) => d.detailId), year)),
        );
        if (extrasDialog?.draft !== draft) setExtrasDialog({ id: Date.now(), draft, requirements });
        setExtrasDialogOpen(true);
        return;
      }
      if (result.success || !lineExtras) {
        setExtrasDialogOpen(false);
        if (result.success) await finishExecuted(result);
        else dispatch({ type: 'previewResult', result });
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
    <Box sx={{ pb: isMobile && state.phase === 'ask' ? 22 : 0 }}>
      {isMobile ? (
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', mb: 1.5 }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: 'secondary.main' }}><AutoAwesomeOutlinedIcon fontSize="small" /></Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>حسابیار</Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {[unitName, financialYear ? toPersianDigits(financialYear) : ''].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <Button variant="outlined" size="small" sx={{ minHeight: 44 }} onClick={() => dispatch({ type: 'reset' })}>جدید</Button>
        </Stack>
      ) : (
        <PageHeader
          eyebrow="حسابیار"
          icon={<AutoAwesomeOutlinedIcon fontSize="small" />}
          accentColor="secondary"
          title="ثبت سند با حسابیار"
          description="بگویید چه اتفاقی افتاده؛ سند را حسابیار از روی الگوهای ستاد می‌سازد. حسابدار می‌تواند همهٔ فیلدهای سند را ویرایش کند."
          actions={<Button variant="outlined" onClick={() => navigate('/assistant/templates')}>الگوهای عملیات</Button>}
        />
      )}

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
        <SubmittedScreen
          outcome={state.outcome}
          draft={state.draft}
          template={state.template}
          fromHistory={state.source === 'history'}
          answers={state.answers}
          uploadFailed={uploadFailed}
          onNew={() => dispatch({ type: 'reset' })}
        />
      ) : state.phase === 'edit' ? (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <FullVoucherEditor
              key={state.clientRequestId}
              seed={state.editorSeed}
              initialDescription={state.manualDescription}
              sourceTemplateId={state.source === 'history' ? null : state.template?.id ?? null}
              clientRequestId={state.clientRequestId}
              userSentence={state.userSentence || null}
              answerSources={state.template ? toOperationInput(state).answerSources : undefined}
              aiConfirmed={state.aiConfirmed}
              hasPendingAttachment={pendingFiles.length > 0}
              onExecuted={(result) => void finishExecuted(result)}
              onPreview={setEditorDraft}
              onBack={() => {
                setEditorDraft(null);
                dispatch({ type: 'backToConversation' });
              }}
              onCancel={() => {
                setEditorDraft(null);
                dispatch({ type: 'reset' });
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <DraftPreview draft={editorDraft ?? state.editorSeed} />
            <Box sx={{ mt: 1.5 }}><PendingAttachmentsPicker files={pendingFiles} onChange={setPendingFiles} /></Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              پیش‌نویس بعد از «بررسی سند» از سرور به‌روز می‌شود.
            </Typography>
          </Grid>
        </Grid>
      ) : (
        <>
        {state.phase === 'pick' && <MyVouchersStrip financialYear={financialYear} />}
        {state.phase === 'pick' && (
          <QuickVouchersPanel templates={templates.data} financialYear={financialYear} recent={recent.data} onOpenInConversation={openInConversation} />
        )}
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
          {isMobile && state.phase === 'ask' && state.draft && (
            <Grid size={12}><PendingAttachmentsPicker files={pendingFiles} onChange={setPendingFiles} disabled={executing} /></Grid>
          )}
          {isMobile ? (
            state.phase === 'ask' && (
              <MobileDraftSheet
                state={state}
                dispatch={dispatch}
                draft={state.draft}
                info={state.previewInfo}
                loading={previewLoading}
                actions={{ onSubmit: () => void executeTemplate(), onEditFull: () => dispatch({ type: 'openEditor' }), submitting: executing }}
              />
            )
          ) : (
            <Grid size={{ xs: 12, md: 6, lg: 7 }}>
              <DraftPreview
                draft={state.draft}
                loading={previewLoading}
                progress={progress}
                templateTitle={state.template?.title}
                templateId={state.source === 'history' ? undefined : state.template?.id}
                fromHistory={state.source === 'history'}
                info={state.previewInfo}
                actions={{ onSubmit: () => void executeTemplate(), onEditFull: () => dispatch({ type: 'openEditor' }), submitting: executing }}
              />
              {state.phase === 'ask' && state.draft && (
                <Box sx={{ mt: 1.5 }}><PendingAttachmentsPicker files={pendingFiles} onChange={setPendingFiles} disabled={executing} /></Box>
              )}
            </Grid>
          )}
        </Grid>
        </>
      )}
    </Box>
  );
}
