import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useSession } from '../../lib/session/SessionContext';
import { changeVoucherState } from '../vouchers/api';
import { myVouchersApi } from './api';
import { ReplyDialog } from './ReplyDialog';
import { RETURN_REASON_LABELS, relativeTimeFa } from './roleView';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { SaveQuickVoucherDialog } from './SaveQuickVoucherDialog';
import { VoucherAttachmentsPanel } from './VoucherAttachments';
import { draftCounterparty } from './DraftPreview';
import type { Answer, ExecutionOutcome } from './assistantState';
import type { TemplateSummaryDto, VoucherDraft } from './types';

interface SubmittedScreenProps {
  outcome: ExecutionOutcome;
  draft: VoucherDraft | null;
  template: TemplateSummaryDto | null;
  answers: Record<string, Answer>;
  /** ساخته‌شده از سوابق: الگوی ستاد نیست، پس «سند پرتکرار» ندارد. */
  fromHistory?: boolean;
  /** نام فایل‌هایی که بعد از ثبت بارگذاری نشدند. */
  uploadFailed?: string[];
  onNew: () => void;
}

/** صفحهٔ «ارسال شد»: خط زمانی سه‌مرحله‌ای وضعیت سند + توضیح + عملیات بعدی (طرح UX §۱۲.۲-۳). */
export function SubmittedScreen({ outcome, draft, template: templateProp, answers, fromHistory, uploadFailed, onNew }: SubmittedScreenProps) {
  const template = fromHistory ? null : templateProp;
  const navigate = useNavigate();
  const [saveQuickOpen, setSaveQuickOpen] = useState(false);
  const [quickSaved, setQuickSaved] = useState(false);
  const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const subtitle = [
    template?.title,
    draft ? `${toPersianDigits(formatThousands(draft.totalDebit))} ریال` : null,
    draft ? draftCounterparty(draft) : null,
  ].filter((x) => x && x !== '—').join(' · ');

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 }, borderRadius: 3, textAlign: 'center', maxWidth: 640, mx: 'auto' }}>
      <TaskAltOutlinedIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
      <Typography variant="h2" component="h2" sx={{ mb: 0.5 }}>
        سند {toPersianDigits(outcome.voucherNo)} ساخته شد و برای بررسی رفت
      </Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>{subtitle}</Typography>}
      {outcome.wasAlreadyExecuted && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>این درخواست قبلاً ثبت شده بود؛ سند تکراری ساخته نشد.</Typography>
      )}

      <Stack component="ol" direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 1 }} sx={{ listStyle: 'none', p: 0, m: 0, mb: 3, justifyContent: 'space-between' }} aria-label="مراحل سند">
        <Step n={1} state="done" title="ثبت شما" note={`وضعیت «موقت» · امروز ${time}`} />
        <Step n={2} state="active" title="بررسی حسابدار واحد" note="در صف · معمولاً تا ۱ روز کاری" />
        <Step n={3} state="todo" title="تأیید دائم" note="پایان ماه، با صورتحساب ماه" />
      </Stack>

      <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, px: 2, py: 1.5, mb: 3, textAlign: 'start' }}>
        <Typography variant="body2" sx={{ lineHeight: 2 }}>
          تا وقتی حسابدار بررسی نکرده، می‌توانید سند را از «سندهای من» ویرایش یا لغو کنید. اگر حسابدار سؤالی داشته باشد،
          سند با پیام او به شما برمی‌گردد و در خانهٔ حسابیار نشان داده می‌شود.
        </Typography>
      </Box>

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, px: 2, py: 1.5, mb: 3 }}>
        {uploadFailed && uploadFailed.length > 0 && (
          <Alert severity="error" sx={{ mb: 1, textAlign: 'start' }}>
            این فایل‌ها بارگذاری نشدند؛ دوباره اضافه کنید: {uploadFailed.join('، ')}
          </Alert>
        )}
        <VoucherAttachmentsPanel voucherId={outcome.voucherId} canEdit />
      </Box>

      <ReturnedSample voucherId={outcome.voucherId} />

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        <Button variant="contained" sx={{ minHeight: 44 }} onClick={() => { setQuickSaved(false); onNew(); }}>عملیات جدید</Button>
        {template && !quickSaved && (
          <Button variant="outlined" color="warning" sx={{ minHeight: 44 }} onClick={() => setSaveQuickOpen(true)}>ذخیره به‌عنوان سند پرتکرار</Button>
        )}
        <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => navigate(`/operation/vouchers/${outcome.voucherId}/view`)}>مشاهدهٔ سند</Button>
        <Button color="inherit" sx={{ minHeight: 44 }} onClick={() => navigate('/operation/voucher-heads')}>کارتابل اسناد</Button>
      </Stack>
      {quickSaved && (
        <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
          به سندهای پرتکرار اضافه شد؛ از این به بعد بالای صفحهٔ حسابیار است.
        </Typography>
      )}
      {template && saveQuickOpen && (
        <SaveQuickVoucherDialog
          open
          template={template}
          answers={answers}
          onClose={() => setSaveQuickOpen(false)}
          onSaved={() => {
            setSaveQuickOpen(false);
            setQuickSaved(true);
          }}
        />
      )}
    </Paper>
  );
}

function Step({ n, state, title, note }: { n: number; state: 'done' | 'active' | 'todo'; title: string; note: ReactNode }) {
  const color = state === 'done' ? 'success.main' : state === 'active' ? 'secondary.main' : 'text.disabled';
  return (
    <Box component="li" aria-current={state === 'active' ? 'step' : undefined} sx={{ flex: 1, textAlign: 'center' }}>
      <Box
        sx={{
          width: 36, height: 36, mx: 'auto', mb: 0.75, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700,
          bgcolor: state === 'done' ? 'success.main' : 'background.paper',
          color: state === 'done' ? 'common.white' : color,
          border: 2, borderColor: color,
        }}
      >
        {state === 'done' ? '✓' : toPersianDigits(n)}
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="caption" color="text.secondary">{note}</Typography>
    </Box>
  );
}

/**
 * کارت «اگر حسابدار سند را برگرداند»: اگر همین سند الان برگشت خورده باشد، کارت واقعی با دکمه‌های کار؛ وگرنه نمونه‌ای
 * از آنچه کاربر خواهد دید (دکمه‌های نمونه غیرفعال‌اند، چون سندی برنگشته که به آن پاسخ داده شود).
 */
function ReturnedSample({ voucherId }: { voucherId: string }) {
  const { financialYear } = useSession();
  const qc = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const mine = useQuery({
    queryKey: ['operations-mine', financialYear, 'returned'],
    queryFn: () => myVouchersApi.mine(financialYear, 'returned'),
    enabled: Boolean(financialYear),
    retry: false,
  });
  const resubmit = useMutation({
    mutationFn: () => changeVoucherState([voucherId], 2),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operations-mine'] }),
  });
  const real = mine.data?.items.find((i) => i.voucherId === voucherId && i.status === 'returned') ?? null;

  const reason = real ? (real.returnReasonCode ? RETURN_REASON_LABELS[real.returnReasonCode] ?? real.returnReasonCode : 'برگشت') : 'پیوست ناقص';
  const message = real ? real.returnMessage : 'لطفاً فاکتور فروشنده را هم پیوست کنید.';

  return (
    <Box sx={{ textAlign: 'start', mb: 3 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
        {real ? 'حسابدار این سند را برگرداند' : 'اگر حسابدار سند را برگرداند، این‌طور می‌بینید (نمونه)'}
      </Typography>
      <Alert severity="warning" icon={<ReplayOutlinedIcon fontSize="inherit" />} sx={{ mb: 1 }}>
        <strong>{reason}</strong>{message ? ` — ${message}` : ''}
        {real?.returnedAtUtc ? ` (${relativeTimeFa(real.returnedAtUtc)})` : ''}
      </Alert>
      {resubmit.isError && <ErrorBanner error={resubmit.error} />}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button variant="outlined" sx={{ minHeight: 44 }} disabled={!real} onClick={() => setReplyOpen(true)}>پاسخ به حسابدار</Button>
        <Button variant="contained" sx={{ minHeight: 44 }} disabled={!real || resubmit.isPending} onClick={() => resubmit.mutate()}>
          {resubmit.isPending ? 'در حال ارسال…' : 'ارسال دوباره'}
        </Button>
      </Stack>
      {replyOpen && real && <ReplyDialog executionId={real.executionId} docNum={real.docNum} onClose={() => setReplyOpen(false)} />}
    </Box>
  );
}
