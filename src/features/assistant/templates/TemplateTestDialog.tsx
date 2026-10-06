import { useState } from 'react';
import { useSession } from '../../../lib/session/SessionContext';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { assistantHistoryApi } from '../api';
import type { Answer } from '../assistantState';
import { DraftPreview } from '../DraftPreview';
import { defaultVoucherDate, jalaliToGregorian } from '../draftMapping';
import { QuestionInput } from '../QuestionInput';
import type { OperationResult, TemplateParameterDto } from '../types';
import { toPayload, type DesignModel } from './designerModel';

/**
 * «آزمایش الگو»: طراح به سؤال‌ها جواب نمونه می‌دهد و همان موتور سرور، با همین تعریف ذخیره‌نشده، پیش‌نویس سند
 * را در واحد جاری می‌سازد. نه الگو ذخیره می‌شود نه سندی ثبت می‌شود.
 */
export function TemplateTestDialog({ model, onClose }: { model: DesignModel; onClose: () => void }) {
  const { financialYear } = useSession();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<OperationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<unknown>(null);

  // سؤال تفصیلی فهرست انتخابش را از اولین ردیفی می‌گیرد که به آن وصل است (همان قاعدهٔ حسابیار).
  const params: TemplateParameterDto[] = model.params.map((p, i) => {
    const binding = model.lines
      .flatMap((l) => l.details.map((d) => ({ accountId: l.accountId, level: d.level, d })))
      .find((x) => x.d.source === 'param' && x.d.parameterKey === p.key);
    return {
      key: p.key,
      title: p.title,
      type: p.type,
      detailGroupId: p.detailGroupId,
      isRequired: p.isRequired,
      askPrompt: p.askPrompt || p.title,
      sortOrder: i,
      pickerAccountId: binding?.accountId ?? null,
      pickerLevel: binding?.level ?? null,
    };
  });

  async function run() {
    setBusy(true);
    setRequestError(null);
    try {
      const values: Record<string, string | null> = {};
      for (const p of params) {
        const a = answers[p.key];
        values[p.key] = a ? (p.type === 4 ? jalaliToGregorian(a.value) : a.value) : null;
      }
      const r = await assistantHistoryApi.testTemplate({
        ...toPayload(model),
        voucherDate: jalaliToGregorian(defaultVoucherDate(financialYear).value),
        values,
      });
      setResult(r);
    } catch (e) {
      setRequestError(e);
    } finally {
      setBusy(false);
    }
  }

  const paramErrors = Object.fromEntries((result?.errors ?? []).filter((e) => e.parameterKey).map((e) => [e.parameterKey!, e.message]));
  const generalErrors = (result?.errors ?? []).filter((e) => !e.parameterKey || !params.some((p) => p.key === e.parameterKey));

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>آزمایش الگو «{model.title || model.code}»</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          به سؤال‌ها جواب نمونه بدهید (هر کدام «تأیید») و «ساخت پیش‌نویس» را بزنید. سند با همین تعریف ذخیره‌نشده و در واحد شما
          ساخته و فقط نمایش داده می‌شود — هیچ چیز ثبت نمی‌شود.
        </Typography>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={2}>
              {params.map((p) => (
                <Box key={p.key}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                    {p.askPrompt}
                    {answers[p.key] && <Typography component="span" variant="caption" color="success.main"> — {answers[p.key].label}</Typography>}
                  </Typography>
                  <QuestionInput
                    key={`${p.key}-${answers[p.key]?.value ?? ''}`}
                    parameter={p}
                    initial={answers[p.key]}
                    error={paramErrors[p.key]}
                    onAnswer={(a) => setAnswers((prev) => ({ ...prev, [p.key]: a }))}
                    onSkip={!p.isRequired ? () => setAnswers((prev) => { const n = { ...prev }; delete n[p.key]; return n; }) : undefined}
                  />
                </Box>
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            {requestError != null && <Box sx={{ mb: 1.5 }}><ErrorBanner error={requestError} /></Box>}
            {generalErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {generalErrors.map((e, i) => <Box key={i}>• {e.message}</Box>)}
              </Alert>
            )}
            {result?.success && <Alert severity="success" sx={{ mb: 1.5 }}>الگو با این جواب‌ها سند تراز می‌سازد.</Alert>}
            <DraftPreview draft={result?.draft ?? null} loading={busy} templateTitle={model.title} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
        <Button variant="contained" onClick={run} disabled={busy}>{busy ? 'در حال ساخت…' : 'ساخت پیش‌نویس'}</Button>
      </DialogActions>
    </Dialog>
  );
}
