import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ApiError } from '../../../lib/api/apiError';
import { formatLegacyJalaliDate, formatPersianDateTime } from '../../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../../lib/format/numbers';
import { useSession } from '../../../lib/session/SessionContext';
import { useAllAccountCodes } from '../../chart-of-accounts/useAllAccountCodes';
import { voucherDetailsApi } from '../../vouchers/api';
import { RiskChip } from '../DraftPreview';
import { operationRequestsApi, operationsApi, reviewApi } from '../api';
import { RETURN_REASON_LABELS, relativeTimeFa } from '../roleView';
import { FromHistoryChip, isHistoryExecution } from '../HistorySuggestions';
import { RETURN_REASONS, type OperationRequestItem, type ReviewItem } from '../types';

const PAGE_SIZE = 20;
type Risk = 'all' | 'low' | 'attention';

/**
 * صف بررسی حسابدار (Agent-UX §۱۲ صفحهٔ ۵): فیلتر ریسک با شمارنده، «بررسی گروهی کم‌ریسک‌ها»، فهرست با ریسک و هشدار،
 * جزئیات (آنچه کاربر گفت، توضیح ساده، ردیف‌ها، منشأ، کنترل‌ها، پاسخ ثبت‌کننده و تاریخچه) و «بررسی شد» /
 * «برگرداندن به ثبت‌کننده» / «ویرایش سند». زبانهٔ دوم: درخواست‌های کاربران برای عملیاتی که الگو ندارد.
 * ثبت‌کنندهٔ سند نمی‌تواند سند خودش را تأیید کند و تأیید سند پرریسک بدون نقش حسابدار ۴۰۳ می‌گیرد — سرور اعمال
 * می‌کند و پیام فارسی ProblemDetails همان‌جا نشان داده می‌شود.
 */
export function ReviewQueuePage() {
  const [tab, setTab] = useState<'review' | 'requests'>('review');
  const openRequests = useQuery({ queryKey: ['operation-requests', 'open'], queryFn: () => operationRequestsApi.list('open'), retry: false });
  const openCount = openRequests.data?.length ?? 0;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }} aria-label="مسیر صفحه">
        <Typography variant="body2" color="text.secondary">سامانه</Typography>
        <Typography variant="body2" color="text.secondary">کارتابل اسناد</Typography>
        <Typography variant="body2" color="text.primary">صف بررسی حسابیار</Typography>
      </Breadcrumbs>
      <PageHeader
        eyebrow="حسابیار"
        icon={<RuleOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="صف بررسی حسابیار"
        description="سندهایی که کاربران واحد با حسابیار ثبت کرده‌اند؛ بررسی کنید و تأیید کنید، یا با دلیل به ثبت‌کننده برگردانید."
      />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, minHeight: 44 }}>
        <Tab value="review" label="اسناد در انتظار بررسی" sx={{ minHeight: 44 }} />
        <Tab value="requests" label={`درخواست‌های کاربران${openRequests.isSuccess && openCount > 0 ? ` (${toPersianDigits(openCount)})` : ''}`} sx={{ minHeight: 44 }} />
      </Tabs>
      {tab === 'review' ? <ReviewTab /> : <RequestsTab />}
    </Box>
  );
}

// ───────────────────────────── زبانهٔ اسناد ─────────────────────────────

function ReviewTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { financialYear } = useSession();
  const [risk, setRisk] = useState<Risk>('all');
  const [page, setPage] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [returning, setReturning] = useState<ReviewItem | null>(null);
  const [batchIds, setBatchIds] = useState<string[] | null>(null);

  const list = useQuery({
    queryKey: ['operations-reviews', financialYear, risk, page],
    queryFn: () => reviewApi.list({ risk, page: page + 1, pageSize: PAGE_SIZE, year: financialYear }),
    enabled: Boolean(financialYear),
    retry: false,
  });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const counts = list.data?.counts;
  const active = items.find((i) => i.executionId === activeId) ?? null;

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['operations-reviews'] });
    void qc.invalidateQueries({ queryKey: ['operations-mine'] });
  }

  const approve = useMutation({
    mutationFn: (id: string) => reviewApi.approve(id),
    onSuccess: () => { setActiveId(null); refresh(); },
  });
  // همهٔ کم‌ریسک‌های «غیر از خودم» (نه فقط صفحهٔ جاری) پیش از تأیید گروهی خوانده می‌شوند.
  const prepareBatch = useMutation({
    mutationFn: async () => {
      const low = await reviewApi.list({ risk: 'low', page: 1, pageSize: 200, year: financialYear });
      return low.items.filter((i) => !i.isMine).map((i) => i.executionId);
    },
    onSuccess: (ids) => setBatchIds(ids),
  });
  const approveBatch = useMutation({
    mutationFn: (ids: string[]) => reviewApi.approveBatch(ids),
    onSuccess: () => { setBatchIds(null); refresh(); },
  });

  const forbidden = list.error instanceof ApiError && list.error.isForbidden;
  if (forbidden) return <Alert severity="info">بررسی سندهای حسابیار فقط برای حسابدار واحد و مدیران مجاز است.</Alert>;

  const filters: { value: Risk; label: string; count: number | undefined }[] = [
    { value: 'all', label: 'همه', count: counts?.all },
    { value: 'low', label: 'کم‌ریسک', count: counts?.low },
    { value: 'attention', label: 'نیازمند توجه', count: counts?.attention },
  ];
  const lowCount = counts?.low ?? 0;

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2, alignItems: { sm: 'center' } }} useFlexGap>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }} role="group" aria-label="فیلتر ریسک">
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={risk === f.value ? 'contained' : 'outlined'}
              aria-pressed={risk === f.value}
              sx={{ minHeight: 44, borderRadius: 6 }}
              onClick={() => { setRisk(f.value); setPage(0); setActiveId(null); }}
            >
              {f.label}{f.count !== undefined ? ` · ${toPersianDigits(f.count)}` : ''}
            </Button>
          ))}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          color="success"
          sx={{ minHeight: 44 }}
          disabled={lowCount === 0 || prepareBatch.isPending}
          onClick={() => prepareBatch.mutate()}
        >
          {prepareBatch.isPending ? 'در حال آماده‌سازی…' : `بررسی گروهی کم‌ریسک‌ها (${toPersianDigits(lowCount)})`}
        </Button>
      </Stack>

      {prepareBatch.isError && <Box sx={{ mb: 2 }}><ErrorBanner error={prepareBatch.error} /></Box>}
      {approveBatch.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => approveBatch.reset()}>
          {toPersianDigits(approveBatch.data.count)} سند بررسی شد.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
            {list.isLoading && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 3 }} />}
            {list.isError && <Box sx={{ p: 2 }}><ErrorBanner error={list.error} /></Box>}
            {list.isSuccess && items.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
                سندی در انتظار بررسی نیست.
              </Typography>
            )}
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
              {items.map((item) => (
                <QueueItem key={item.executionId} item={item} selected={item.executionId === activeId} onClick={() => setActiveId(item.executionId)} />
              ))}
            </Stack>
            {(list.data?.total ?? 0) > PAGE_SIZE && (
              <TablePagination
                component="div"
                count={list.data?.total ?? 0}
                page={page}
                rowsPerPage={PAGE_SIZE}
                rowsPerPageOptions={[PAGE_SIZE]}
                onPageChange={(_, p) => setPage(p)}
                labelDisplayedRows={({ from, to, count }) => `${toPersianDigits(from)}–${toPersianDigits(to)} از ${toPersianDigits(count)}`}
              />
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <DetailPane
            item={active}
            approving={approve.isPending}
            approveError={approve.error}
            onApprove={() => active && approve.mutate(active.executionId)}
            onReturn={() => active && setReturning(active)}
            onEdit={() => active && navigate(`/operation/vouchers/${active.voucherId}/edit`)}
          />
        </Grid>
      </Grid>

      <ConfirmDialog
        open={batchIds !== null}
        title="بررسی گروهی کم‌ریسک‌ها"
        description={
          batchIds && batchIds.length > 0
            ? `${toPersianDigits(batchIds.length)} سند کم‌ریسک (غیر از اسناد ثبت‌شده توسط خودتان) «بررسی‌شده» می‌شود. ادامه می‌دهید؟`
            : 'سند کم‌ریسکی که ثبت‌کننده‌اش شما نباشید پیدا نشد.'
        }
        confirmLabel={batchIds && batchIds.length > 0 ? 'بررسی شد برای همه' : 'بستن'}
        confirmColor="primary"
        pending={approveBatch.isPending}
        error={approveBatch.error}
        onConfirm={() => (batchIds && batchIds.length > 0 ? approveBatch.mutate(batchIds) : setBatchIds(null))}
        onCancel={() => { setBatchIds(null); approveBatch.reset(); }}
      />

      {returning && (
        <ReturnDialog
          item={returning}
          onClose={() => setReturning(null)}
          onDone={() => { setReturning(null); setActiveId(null); refresh(); }}
        />
      )}
    </>
  );
}

function QueueItem({ item, selected, onClick }: { item: ReviewItem; selected: boolean; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'block', width: '100%', minHeight: 44, px: 2, py: 1.5,
        borderInlineStartWidth: 4, borderInlineStartStyle: 'solid', borderInlineStartColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? 'action.selected' : undefined,
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', outlineOffset: -2 },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
        <Typography variant="body1" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>{item.templateTitle ?? 'سند دستی'}</Typography>
        {isHistoryExecution(item.templateTitle, item.channel) && <FromHistoryChip />}
        {item.riskLevel && <RiskChip level={item.riskLevel} reasons={item.riskReasons} />}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.25 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          سند {toPersianDigits(item.docNum)} · {item.createdBy}{item.isMine ? ' (شما)' : ''} · {relativeTimeFa(item.createdAtUtc)}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{toPersianDigits(formatThousands(item.totalAmount))} ریال</Typography>
      </Stack>
      {item.warnings.length > 0 && (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start', mt: 0.5 }}>
          <WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'warning.dark' }} />
          <Typography variant="caption" sx={{ color: 'warning.dark' }}>{item.warnings.join(' · ')}</Typography>
        </Stack>
      )}
    </Box>
  );
}

const HISTORY_LABEL: Record<string, string> = {
  approved: 'بررسی شد',
  returned: 'برگشت به ثبت‌کننده',
  resubmitted: 'ارسال دوباره',
  replied: 'پاسخ ثبت‌کننده',
};

function DetailPane({ item, approving, approveError, onApprove, onReturn, onEdit }: {
  item: ReviewItem | null; approving: boolean; approveError: unknown;
  onApprove: () => void; onReturn: () => void; onEdit: () => void;
}) {
  const { items: accountCodes } = useAllAccountCodes();
  const accountLabel = useMemo(() => {
    const byId = new Map((accountCodes ?? []).map((a) => [a.id, `${a.accCode ?? ''} - ${a.accCodeName ?? ''}`]));
    return (id: string | null | undefined) => (id ? byId.get(id) ?? '—' : '—');
  }, [accountCodes]);

  const lines = useQuery({
    queryKey: ['operations-review-lines', item?.voucherId],
    queryFn: () => voucherDetailsApi.list({ pageNumber: 1, pageSize: 200, voucherHeadId: item!.voucherId }),
    enabled: Boolean(item),
  });
  // تاریخچه (برگشت، پاسخ، ارسال دوباره) و نسخهٔ تازهٔ همین مورد.
  const detail = useQuery({
    queryKey: ['operations-review-detail', item?.executionId],
    queryFn: () => reviewApi.detail(item!.executionId),
    enabled: Boolean(item),
    retry: false,
  });
  const templates = useQuery({ queryKey: ['operation-templates'], queryFn: operationsApi.listTemplates, retry: false, staleTime: 60_000 });

  if (!item) {
    return (
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">یک سند را از فهرست انتخاب کنید تا جزئیاتش اینجا دیده شود.</Typography>
      </Paper>
    );
  }

  const full = detail.data?.item ?? item;
  const history = detail.data?.history ?? [];
  const template = templates.data?.find((t) => t.title === (full.origin?.templateTitle ?? full.templateTitle));
  const keyLabel = (key: string) => template?.parameters.find((p) => p.key === key)?.title ?? key;
  const aiKeys = full.origin?.aiFilledKeys ?? [];
  const controls = full.controls ?? [];
  const reply = full.latestReply;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}>
        <Typography variant="h3" component="h2" sx={{ flex: 1, minWidth: 0 }}>
          سند {toPersianDigits(full.docNum)} · {full.templateTitle ?? 'سند دستی'}
        </Typography>
        {isHistoryExecution(full.templateTitle, full.channel) && <FromHistoryChip />}
        {full.riskLevel && <RiskChip level={full.riskLevel} reasons={full.riskReasons} />}
        <Chip size="small" color="info" variant="outlined" label="موقت" />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {full.createdBy} · {formatPersianDateTime(full.createdAtUtc)} · {formatLegacyJalaliDate(full.date)}
      </Typography>

      {full.userSentence && (
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, px: 1.75, py: 1.25, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>آنچه کاربر گفت</Typography>
          <Typography variant="body1">«{full.userSentence}»</Typography>
        </Box>
      )}

      <Typography variant="body1" sx={{ lineHeight: 2, mb: 1.5 }}>
        <strong>به زبان ساده: </strong>{full.plainText || '—'}
      </Typography>

      {full.isMine && (
        <Alert severity="info" sx={{ mb: 1.5 }}>ثبت‌کنندهٔ این سند شما هستید؛ تأیید آن باید توسط حسابدار دیگری انجام شود.</Alert>
      )}

      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>ردیف‌های سند</Typography>
      {lines.isLoading && <CircularProgress size={20} />}
      {lines.isError && <ErrorBanner error={lines.error} />}
      {lines.data && (
        <Box sx={{ overflowX: 'auto', mb: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>معین و تفصیلی</TableCell>
                <TableCell align="left">بدهکار</TableCell>
                <TableCell align="left">بستانکار</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.data.items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{accountLabel(l.accountId)}</Typography>
                    {l.tafsiliLinks.map((t, i) => (
                      <Typography key={`${t.levelId}-${t.tafsiliId}`} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        سطح {toPersianDigits(i + 1)}: {t.label}
                      </Typography>
                    ))}
                  </TableCell>
                  <TableCell align="left">{l.debtor ? toPersianDigits(formatThousands(l.debtor)) : '—'}</TableCell>
                  <TableCell align="left">{l.creditor ? toPersianDigits(formatThousands(l.creditor)) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>منشأ</Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">الگو: {full.origin?.templateTitle ?? full.templateTitle ?? 'سند دستی'}</Typography>
              <Typography variant="body2">
                برداشت هوش مصنوعی: {aiKeys.length > 0 ? aiKeys.map(keyLabel).join('، ') : 'ندارد'}
              </Typography>
              <Typography variant="body2">
                تأیید کاربر: {full.origin ? (full.origin.userConfirmedAll ? 'همهٔ جواب‌ها' : 'نه همه') : '—'}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>کنترل‌ها</Typography>
            <Stack spacing={0.5}>
              {controls.map((c) => (
                <Stack key={c.key} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  {c.passed ? <CheckCircleOutlineIcon fontSize="small" color="success" /> : <WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'warning.dark' }} />}
                  <Typography variant="body2">{c.label}</Typography>
                </Stack>
              ))}
              {full.warnings.map((w, i) => (
                <Stack key={`w${i}`} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <WarningAmberOutlinedIcon fontSize="small" sx={{ color: 'warning.dark' }} />
                  <Typography variant="body2" sx={{ color: 'warning.dark' }}>{w}</Typography>
                </Stack>
              ))}
              {controls.length === 0 && full.warnings.length === 0 && <Typography variant="body2" color="text.secondary">—</Typography>}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {reply && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          <strong>پاسخ ثبت‌کننده</strong> ({relativeTimeFa(reply.createdAtUtc)}): «{reply.message}»
        </Alert>
      )}

      {history.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>تاریخچه</Typography>
          <Stack spacing={0.5}>
            {history.map((h, i) => (
              <Typography key={i} variant="body2" color="text.secondary">
                {formatPersianDateTime(h.createdAtUtc)} · {HISTORY_LABEL[h.action] ?? h.action}
                {h.reasonCode ? ` (${RETURN_REASON_LABELS[h.reasonCode] ?? h.reasonCode})` : ''}
                {h.message ? ` — «${h.message}»` : ''}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      {approveError != null && <Box sx={{ mb: 1.5 }}><ErrorBanner error={approveError} /></Box>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap>
        <Button variant="contained" color="success" sx={{ minHeight: 44 }} disabled={full.isMine || approving} onClick={onApprove}>
          {approving ? 'در حال تأیید…' : 'بررسی شد'}
        </Button>
        <Button variant="outlined" color="warning" sx={{ minHeight: 44 }} onClick={onReturn}>برگرداندن به ثبت‌کننده</Button>
        <Button variant="outlined" sx={{ minHeight: 44 }} onClick={onEdit}>ویرایش سند</Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        با «بررسی شد» وضعیت سند «بررسی‌شده» می‌شود.
      </Typography>
    </Paper>
  );
}

function ReturnDialog({ item, onClose, onDone }: { item: ReviewItem; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const messageRequired = reason === 'other';
  const messageMissing = messageRequired && message.trim().length === 0;
  const send = useMutation({
    mutationFn: () => reviewApi.returnToSubmitter(item.executionId, { reasonCode: reason, message: message.trim() || null }),
    onSuccess: onDone,
  });

  return (
    <Dialog open onClose={send.isPending ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="return-title">
      <DialogTitle id="return-title">برگرداندن سند {toPersianDigits(item.docNum)} به ثبت‌کننده</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          سند به وضعیت «یادداشت» برمی‌گردد و پیام شما در «سندهای من» ثبت‌کننده نشان داده می‌شود.
        </Typography>
        <TextField select fullWidth required label="دلیل" value={reason} onChange={(e) => setReason(e.target.value)} sx={{ mb: 2 }}>
          {RETURN_REASONS.map((r) => <MenuItem key={r.code} value={r.code}>{r.label}</MenuItem>)}
        </TextField>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="پیام برای ثبت‌کننده"
          value={message}
          required={messageRequired}
          error={messageMissing}
          helperText={messageMissing ? 'برای دلیل «سایر» نوشتن پیام الزامی است' : `${toPersianDigits(message.length)} از ${toPersianDigits(500)}`}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
        />
        {send.isError && <Box sx={{ mt: 2 }}><ErrorBanner error={send.error} /></Box>}
      </DialogContent>
      <DialogActions>
        <Button sx={{ minHeight: 44 }} onClick={onClose} disabled={send.isPending}>انصراف</Button>
        <Button variant="contained" color="warning" sx={{ minHeight: 44 }} disabled={!reason || messageMissing || send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? 'در حال ارسال…' : 'برگرداندن'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ───────────────────────────── زبانهٔ درخواست‌های کاربران ─────────────────────────────

function RequestsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'open' | 'done'>('open');
  const [finishing, setFinishing] = useState<OperationRequestItem | null>(null);
  const list = useQuery({ queryKey: ['operation-requests', status], queryFn: () => operationRequestsApi.list(status), retry: false });
  const forbidden = list.error instanceof ApiError && list.error.isForbidden;

  if (forbidden) return <Alert severity="info">دیدن درخواست‌های کاربران فقط برای حسابدار واحد و مدیران مجاز است.</Alert>;

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} role="group" aria-label="وضعیت درخواست">
        <Button variant={status === 'open' ? 'contained' : 'outlined'} aria-pressed={status === 'open'} sx={{ minHeight: 44, borderRadius: 6 }} onClick={() => setStatus('open')}>باز</Button>
        <Button variant={status === 'done' ? 'contained' : 'outlined'} aria-pressed={status === 'done'} sx={{ minHeight: 44, borderRadius: 6 }} onClick={() => setStatus('done')}>انجام‌شده</Button>
      </Stack>
      {list.isLoading && <CircularProgress size={24} sx={{ display: 'block', mx: 'auto', my: 3 }} />}
      {list.isError && <ErrorBanner error={list.error} />}
      {list.isSuccess && list.data.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
          {status === 'open' ? 'درخواست بازی نیست.' : 'درخواست انجام‌شده‌ای نیست.'}
        </Typography>
      )}
      <Stack spacing={1.25}>
        {(list.data ?? []).map((r) => (
          <Paper key={r.id} variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}>
            <Typography variant="body1" sx={{ mb: 0.5 }}>«{r.sentence}»</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {r.createdBy} · {formatPersianDateTime(r.createdAtUtc)}
            </Typography>
            {r.status === 'done' && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                انجام‌شده توسط {r.handledBy ?? '—'} · {formatPersianDateTime(r.handledAtUtc)}{r.note ? ` — ${r.note}` : ''}
              </Typography>
            )}
            {r.status === 'open' && (
              <Button variant="outlined" color="success" sx={{ minHeight: 44, mt: 1 }} onClick={() => setFinishing(r)}>انجام شد</Button>
            )}
          </Paper>
        ))}
      </Stack>
      {finishing && (
        <DoneDialog
          request={finishing}
          onClose={() => setFinishing(null)}
          onDone={() => { setFinishing(null); void qc.invalidateQueries({ queryKey: ['operation-requests'] }); }}
        />
      )}
    </Box>
  );
}

function DoneDialog({ request, onClose, onDone }: { request: OperationRequestItem; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const send = useMutation({ mutationFn: () => operationRequestsApi.done(request.id, note.trim() || null), onSuccess: onDone });
  return (
    <Dialog open onClose={send.isPending ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="done-title">
      <DialogTitle id="done-title">درخواست انجام شد</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>«{request.sentence}»</Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="یادداشت (اختیاری)"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          helperText="مثلاً: الگوی «پرداخت اجاره» اضافه شد."
        />
        {send.isError && <Box sx={{ mt: 2 }}><ErrorBanner error={send.error} /></Box>}
      </DialogContent>
      <DialogActions>
        <Button sx={{ minHeight: 44 }} onClick={onClose} disabled={send.isPending}>انصراف</Button>
        <Button variant="contained" color="success" sx={{ minHeight: 44 }} disabled={send.isPending} onClick={() => send.mutate()}>
          {send.isPending ? 'در حال ثبت…' : 'انجام شد'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
