import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { useSession } from '../../lib/session/SessionContext';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { yearEndApi, type YearEndKind, type YearEndLine, type YearEndVoucher } from './api';

const KINDS: Record<YearEndKind, { tab: string; yearLabel: string; explain: (year: string) => string }> = {
  closing: {
    tab: 'سند اختتامیه',
    yearLabel: 'سال مالیِ بسته‌شونده',
    explain: (y) =>
      `ماندهٔ حساب‌های گروه ۶، ۷ و ۸ سال ${y} معکوس می‌شود و هر گروه از حساب‌ها روی حساب رابط اختتامیهٔ خودش بسته می‌شود. یک سند صادر می‌شود.`,
  },
  opening: {
    tab: 'سند افتتاحیه',
    yearLabel: 'سال مالی جدید',
    explain: (y) =>
      `ماندهٔ حساب‌های گروه ۱، ۲، ۳، ۴، ۵ و ۹ سال ${prevYear(y)} به سال ${y} منتقل می‌شود؛ برای هر گروه یک سند، که با حساب رابط افتتاحیه تراز می‌شود.`,
  },
};

function prevYear(y: string) {
  return /^\d{4}$/.test(y) ? String(Number(y) - 1) : '…';
}

const money = (v: number) => (v ? toPersianDigits(formatThousands(v)) : '—');

/**
 * صدور سند اختتامیه و افتتاحیه (بازسازی فرم سیستم قدیم با تصمیم‌های ۲۰۲۶-۱۰-۰۸).
 *
 * The flow is preview first, then issue: these vouchers move a whole year's balances, so the user
 * sees every line and every blocking problem (missing interface account, already issued, …) before
 * anything is written. The server recomputes on issue, so what is issued is what the preview
 * showed, not a stale copy of it.
 */
export function YearEndVouchersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { financialYear, isConfigured } = useSession();
  const [kind, setKind] = useState<YearEndKind>('closing');
  const [yearDraft, setYearDraft] = useState(financialYear || '');
  const [year, setYear] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const preview = useQuery({
    queryKey: ['year-end-preview', kind, year],
    queryFn: () => yearEndApi.preview(kind, year as string),
    enabled: isConfigured && !!year,
  });

  const issue = useMutation({
    mutationFn: () => yearEndApi.issue(kind, year as string),
    onSuccess: async () => {
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
      await queryClient.invalidateQueries({ queryKey: ['year-end-preview'] });
    },
  });

  function showPreview(e: FormEvent) {
    e.preventDefault();
    issue.reset();
    setYear(normalizeNumericInput(yearDraft).slice(0, 4));
  }

  function switchKind(next: YearEndKind) {
    setKind(next);
    setYear(null);
    issue.reset();
  }

  const data = preview.data;
  const canIssue = !!data && data.problems.length === 0 && data.vouchers.length > 0 && !issue.isSuccess;
  const yearValid = /^\d{4}$/.test(normalizeNumericInput(yearDraft));

  return (
    <section>
      <PageHeader
        icon={<EventRepeatOutlinedIcon />}
        title="سند افتتاحیه و اختتامیه"
        description="بستن حساب‌های موقت در پایان سال و انتقال مانده‌ها به سال جدید. اول پیش‌نمایش را ببینید، بعد صادر کنید."
      />

      <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
        <Tabs value={kind} onChange={(_, v: YearEndKind) => switchKind(v)} sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
          {(Object.keys(KINDS) as YearEndKind[]).map((k) => (
            <Tab key={k} value={k} label={KINDS[k].tab} />
          ))}
        </Tabs>
        <Box component="form" noValidate onSubmit={showPreview} sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
            <TextField
              size="small"
              label={KINDS[kind].yearLabel}
              value={toPersianDigits(yearDraft)}
              onChange={(e) => setYearDraft(normalizeNumericInput(e.target.value).slice(0, 4))}
              error={!!yearDraft && !yearValid}
              helperText={!!yearDraft && !yearValid ? 'سال چهار رقمی است.' : ' '}
              sx={{ width: { sm: 200 } }}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
            />
            <Button type="submit" variant="contained" disabled={!isConfigured || !yearValid || preview.isFetching}>
              پیش‌نمایش
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '70ch' }}>
            {KINDS[kind].explain(yearValid ? normalizeNumericInput(yearDraft) : '…')}
          </Typography>
        </Box>
      </Paper>

      {!isConfigured && <Alert severity="info">ابتدا سال مالی و واحد را از نوار بالا انتخاب کنید.</Alert>}

      {preview.isError && <ErrorBanner error={preview.error} />}

      {preview.isLoading && year && (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </Stack>
      )}

      {issue.isSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/operation/voucher-heads')}>
              کارتابل اسناد
            </Button>
          }
        >
          <AlertTitle>سند صادر شد</AlertTitle>
          {issue.data.docNums.length === 1 ? 'سند' : 'اسناد'} شمارهٔ {toPersianDigits(issue.data.docNums.join('، '))} در وضعیت «یادداشت» ثبت
          {issue.data.docNums.length === 1 ? ' شد' : ' شدند'}. پس از بازبینی در کارتابل، آن را به «موقت» ببرید.
        </Alert>
      )}
      {issue.isError && <ErrorBanner error={issue.error} />}

      {data && !preview.isLoading && (
        <Stack spacing={3}>
          {data.problems.length > 0 && (
            <Alert severity="error">
              <AlertTitle>صدور ممکن نیست</AlertTitle>
              <Box component="ul" sx={{ m: 0, pl: 0, pr: 2.5 }}>
                {data.problems.map((p) => (
                  <li key={p}>{toPersianDigits(p)}</li>
                ))}
              </Box>
            </Alert>
          )}
          {data.warnings.length > 0 && (
            <Alert severity="warning">
              <Box component="ul" sx={{ m: 0, pl: 0, pr: 2.5 }}>
                {data.warnings.map((w) => (
                  <li key={w}>{toPersianDigits(w)}</li>
                ))}
              </Box>
            </Alert>
          )}

          {data.vouchers.map((v) => (
            <VoucherPreview key={v.headDesc} voucher={v} dateDoc={data.dateDoc} />
          ))}

          {data.vouchers.length > 0 && (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
              {!canIssue && data.problems.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  اول مشکلات بالا را برطرف کنید.
                </Typography>
              )}
              <Button variant="contained" color="secondary" disabled={!canIssue} onClick={() => setConfirmOpen(true)}>
                صدور {data.vouchers.length > 1 ? `${toPersianDigits(data.vouchers.length)} سند` : 'سند'}
              </Button>
            </Stack>
          )}
        </Stack>
      )}

      <Dialog open={confirmOpen} onClose={() => !issue.isPending && setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>صدور {KINDS[kind].tab}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {data?.vouchers.length === 1 ? 'یک سند' : `${toPersianDigits(data?.vouchers.length ?? 0)} سند`} در سال{' '}
            {toPersianDigits(data?.targetYear ?? '')} با وضعیت «یادداشت» ثبت می‌شود. ادامه می‌دهید؟
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={issue.isPending}>
            انصراف
          </Button>
          <Button
            variant="contained"
            onClick={() => issue.mutate()}
            disabled={issue.isPending}
            startIcon={issue.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {issue.isPending ? 'در حال صدور…' : 'صدور'}
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}

function VoucherPreview({ voucher, dateDoc }: { voucher: YearEndVoucher; dateDoc: string }) {
  const columns: DataTableColumn<YearEndLine & { key: string }>[] = [
    {
      key: 'account',
      header: 'معین',
      width: '28%',
      render: (l) => (
        <Box component="span" sx={{ fontWeight: l.isBalancing ? 700 : undefined }}>
          {toPersianDigits(l.accCode)} {l.accName}
        </Box>
      ),
    },
    { key: 'tafsilis', header: 'تفصیلی', render: (l) => (l.tafsilis ? toPersianDigits(l.tafsilis) : '—') },
    { key: 'debtor', header: 'بدهکار', align: 'end', width: 140, tinted: true, render: (l) => money(l.debtor) },
    { key: 'creditor', header: 'بستانکار', align: 'end', width: 140, tinted: true, render: (l) => money(l.creditor) },
  ];
  const rows = voucher.lines.map((l, i) => ({ ...l, key: `${i}` }));

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'baseline', mb: 1.25, flexWrap: 'wrap' }}>
        <Typography variant="h3" component="h2">
          {toPersianDigits(voucher.headDesc)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          تاریخ {formatLegacyJalaliDate(dateDoc)}، {toPersianDigits(voucher.lines.length)} ردیف
        </Typography>
      </Stack>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.key}
        isRowHighlighted={(r) => r.isBalancing}
        emptyMessage="ردیفی ندارد."
      />
      <Stack direction="row" spacing={3} sx={{ justifyContent: 'flex-end', mt: 1, fontVariantNumeric: 'tabular-nums' }}>
        <Typography variant="body2">
          جمع بدهکار <b>{money(voucher.totalDebtor)}</b>
        </Typography>
        <Typography variant="body2">
          جمع بستانکار <b>{money(voucher.totalCreditor)}</b>
        </Typography>
      </Stack>
    </Box>
  );
}
