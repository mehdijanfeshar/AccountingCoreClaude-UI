import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { FormDialog } from '../../components/FormDialog';
import { useSession } from '../../lib/session/SessionContext';
import { formatLegacyJalaliDate, formatPersianDateTime } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { salesApi } from './api';
import { DOC_TYPE_LABEL, POSTABLE, STATUS_LABEL, type SalesDoc, type SalesDocResult } from './types';
import { CheckList, StatusChip } from './salesUi';

const money = (n: number) => toPersianDigits(formatThousands(Math.round(n)));

/** جزئیات سند فروش: چرخهٔ عمر، اقلام، زنجیرهٔ اسناد، سند حسابداری (پیش‌نمایش یا ثبت‌شده)، تاریخچه و اقدام‌ها. */
export function SalesDocPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const doc = useQuery({ queryKey: ['sales-doc', id, financialYear], queryFn: () => salesApi.doc(id!, financialYear), enabled: !!id, retry: false });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SalesDocResult | null>(null);
  const [confirm, setConfirm] = useState<'void' | 'reject' | 'post' | null>(null);
  const [reason, setReason] = useState('');

  async function run(action: () => Promise<SalesDocResult>) {
    setBusy(true);
    setResult(null);
    try {
      const r = await action();
      setResult(r);
      setConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ['sales-doc', id] });
      await queryClient.invalidateQueries({ queryKey: ['sales-docs'] });
    } catch (e) {
      setResult({ success: false, id: null, docNo: null, status: null, checks: [], errors: [e instanceof Error ? e.message : 'انجام نشد.'], voucherId: null, voucherNo: null });
    } finally {
      setBusy(false);
    }
  }

  if (doc.error) return <ErrorBanner error={doc.error} />;
  const d = doc.data;
  if (!d) return <Typography color="text.secondary">در حال بارگذاری…</Typography>;
  const postable = POSTABLE.includes(d.docType);

  return (
    <Box>
      <PageHeader eyebrow="فروش" icon={<ReceiptLongOutlinedIcon fontSize="small" />}
        title={`${DOC_TYPE_LABEL[d.docType]} ${d.docNo ? toPersianDigits(d.docNo) : '(بدون شماره)'}`}
        description={`${d.customer?.name ?? ''} · ${formatLegacyJalaliDate(d.docDate)}`}
        actions={<Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}><StatusChip status={d.status} /><Button color="inherit" onClick={() => navigate('/sales/docs')}>اسناد فروش</Button></Stack>} />

      <Lifecycle doc={d} />

      {result && (
        <Alert severity={result.success ? 'success' : 'error'} sx={{ mb: 2 }}>
          {result.success
            ? <>انجام شد{result.docNo ? ` — ${toPersianDigits(result.docNo)}` : ''}{result.voucherNo ? ` · سند حسابداری ${toPersianDigits(result.voucherNo)} (موقت)` : ''}.</>
            : result.errors.map((m, i) => <div key={i}>{m}</div>)}
        </Alert>
      )}
      {d.status === 4 && <Alert severity="info" icon={false} sx={{ mb: 2 }}>🔒 سند قطعی قابل ویرایش یا ابطال نیست؛ برای اصلاح، برگشت از فروش صادر کنید.</Alert>}
      {d.status === 2 && d.approvalReasons.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}><b>دلیل ارجاع برای تأیید:</b> {d.approvalReasons.join('، ')}</Alert>
      )}

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, mb: 2 }}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          {d.can.edit && <Button variant="outlined" onClick={() => navigate(`/sales/docs/${d.id}/edit`)}>ویرایش</Button>}
          {d.can.submit && <Button variant="contained" disabled={busy} onClick={() => void run(() => salesApi.submit(d.id, financialYear))}>ثبت و ارسال</Button>}
          {d.can.approve && <Button variant="contained" color="success" disabled={busy} onClick={() => void run(() => salesApi.approve(d.id, financialYear))}>تأیید</Button>}
          {d.can.reject && <Button variant="outlined" color="warning" disabled={busy} onClick={() => setConfirm('reject')}>رد و بازگشت به پیش‌نویس</Button>}
          {d.can.post && <Button variant="contained" disabled={busy || d.journalErrors.length > 0} onClick={() => setConfirm('post')}>قطعی‌سازی و ثبت حسابداری</Button>}
          {d.can.convert && d.conversions.map((c) => (
            <Button key={c.target} variant="outlined" disabled={!c.available} title={c.reason ?? ''}
              onClick={() => navigate(`/sales/docs/new?from=${d.id}&target=${c.target}`)}>
              صدور {DOC_TYPE_LABEL[c.target]}
            </Button>
          ))}
          {d.voucherId && <Button onClick={() => navigate(`/operation/vouchers/${d.voucherId}/view`)}>مشاهدهٔ سند حسابداری</Button>}
          {d.can.void && <Button color="error" disabled={busy} onClick={() => setConfirm('void')}>ابطال</Button>}
        </Stack>
        {d.conversions.some((c) => !c.available && c.reason) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {d.conversions.filter((c) => !c.available && c.reason).map((c) => `${DOC_TYPE_LABEL[c.target]}: ${c.reason}`).join(' · ')}
          </Typography>
        )}
      </Paper>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
            <Grid container spacing={2}>
              <Kv label="مشتری" value={d.customer?.name ?? '—'} />
              <Kv label="تاریخ سند" value={formatLegacyJalaliDate(d.docDate)} />
              {d.dueDate && <Kv label="سررسید" value={formatLegacyJalaliDate(d.dueDate)} />}
              {d.validUntil && <Kv label="اعتبار تا" value={formatLegacyJalaliDate(d.validUntil)} />}
              {d.refNo && <Kv label="سفارش مشتری" value={d.refNo} />}
              <Kv label="مبلغ نهایی" value={`${money(d.total)} ریال`} />
            </Grid>
          </Paper>

          <Section title="اقلام">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>کالا / خدمت</TableCell><TableCell>شناسهٔ مودیان</TableCell><TableCell>تعداد</TableCell><TableCell>فی</TableCell>
                  <TableCell>تخفیف</TableCell><TableCell>مشمول</TableCell><TableCell>نرخ</TableCell><TableCell>مالیات</TableCell><TableCell>جمع</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {d.lines.map((l) => (
                  <TableRow key={l.itemId}>
                    <TableCell>{l.itemName}</TableCell>
                    <TableCell dir="ltr" sx={{ textAlign: 'right' }}>{l.taxCode ?? '—'}</TableCell>
                    <TableCell>{toPersianDigits(l.qty)} {l.unitName}</TableCell>
                    <TableCell>{money(l.price)}</TableCell>
                    <TableCell>{money(l.lineDiscount + l.headerDiscountShare)}</TableCell>
                    <TableCell>{money(l.taxable)}</TableCell>
                    <TableCell>{l.vatRate ? `${toPersianDigits(l.vatRate)}٪` : 'معاف'}</TableCell>
                    <TableCell>{money(l.vat)}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{money(l.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} sx={{ fontWeight: 700 }}>جمع (تخفیف کلی: {money(d.headerDiscount)})</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{money(d.discount)}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{money(d.taxable)}</TableCell>
                  <TableCell />
                  <TableCell sx={{ fontWeight: 700 }}>{money(d.vat)}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{money(d.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Section>

          {postable && (
            <Section title={d.status === 4 ? 'سند حسابداری ثبت‌شده' : 'پیش‌نمایش سند حسابداری هنگام قطعی‌سازی'}>
              {d.journalErrors.length > 0 && <Alert severity="error" sx={{ m: 1.5 }}>{d.journalErrors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
              {d.journal.length > 0 ? (
                <Table size="small">
                  <TableHead><TableRow><TableCell>حساب</TableCell><TableCell>تفصیلی</TableCell><TableCell>شرح</TableCell><TableCell>بدهکار</TableCell><TableCell>بستانکار</TableCell></TableRow></TableHead>
                  <TableBody>
                    {d.journal.map((j, i) => (
                      <TableRow key={i}>
                        <TableCell>{toPersianDigits(j.accountCode ?? '')} {j.accountTitle}</TableCell>
                        <TableCell>{j.details.map((x) => x.detailTitle).join('، ') || '—'}</TableCell>
                        <TableCell>{j.description}</TableCell>
                        <TableCell>{j.debit ? money(j.debit) : ''}</TableCell>
                        <TableCell>{j.credit ? money(j.credit) : ''}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} sx={{ fontWeight: 700, color: sum(d, 'debit') === sum(d, 'credit') ? 'success.main' : 'error.main' }}>
                        {sum(d, 'debit') === sum(d, 'credit') ? '✓ سند تراز است' : '✗ سند تراز نیست'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{money(sum(d, 'debit'))}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{money(sum(d, 'credit'))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : d.journalErrors.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>این سند مبلغ حسابداری ندارد (مثلاً بهای کالا صفر است).</Typography>}
            </Section>
          )}
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          {d.checks.length > 0 && <Section title="کنترل‌ها"><Box sx={{ p: 1.5 }}><CheckList checks={d.checks} /></Box></Section>}
          <Section title="زنجیرهٔ اسناد (مبدأ ← مقصد)">
            <Stack spacing={0.5} sx={{ p: 1.5 }}>
              {d.chain.map((n) => (
                <Button key={n.id} size="small" variant={n.id === d.id ? 'contained' : 'text'} sx={{ justifyContent: 'flex-start', ms: n.depth * 2 }}
                  onClick={() => navigate(`/sales/docs/${n.id}`)}>
                  {n.depth > 0 ? '↳ ' : ''}{DOC_TYPE_LABEL[n.docType]} {n.docNo ? toPersianDigits(n.docNo) : ''} · {STATUS_LABEL[n.status]}
                </Button>
              ))}
            </Stack>
          </Section>
          <Section title="تاریخچه">
            <Stack spacing={1} sx={{ p: 1.5 }}>
              {d.history.map((h, i) => (
                <Box key={i}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{h.action}</Typography>
                  <Typography variant="caption" color="text.secondary">{toPersianDigits(h.by)} · {formatPersianDateTime(h.at)}</Typography>
                </Box>
              ))}
            </Stack>
          </Section>
        </Grid>
      </Grid>

      <ConfirmDialog open={confirm === 'void'} title="ابطال سند" description="سند باطل می‌شود و دیگر قابل استفاده نیست. ادامه می‌دهید؟" confirmLabel="ابطال" pending={busy}
        onConfirm={() => void run(() => salesApi.void(d.id))} onCancel={() => setConfirm(null)} />
      <ConfirmDialog open={confirm === 'post'} confirmColor="primary" title="قطعی‌سازی" pending={busy} confirmLabel="قطعی‌سازی"
        description={`شمارهٔ نهایی داده می‌شود، سند حسابداری موقت به مبلغ ${money(sum(d, 'debit'))} ریال ثبت می‌شود و موجودی کالا تغییر می‌کند. سند قطعی دیگر ویرایش نمی‌شود.`}
        onConfirm={() => void run(() => salesApi.post(d.id, financialYear))} onCancel={() => setConfirm(null)} />
      <FormDialog open={confirm === 'reject'} onClose={() => setConfirm(null)} title="رد سند و بازگشت به پیش‌نویس" maxWidth="xs"
        onSubmit={(e) => { e.preventDefault(); void run(() => salesApi.reject(d.id, reason || null)); }}
        actions={<><Button color="inherit" onClick={() => setConfirm(null)}>انصراف</Button><Button type="submit" color="warning" variant="contained" disabled={busy}>رد</Button></>}>
        <TextField fullWidth size="small" label="دلیل (اختیاری)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormDialog>
    </Box>
  );
}

function sum(d: SalesDoc, k: 'debit' | 'credit') {
  return d.journal.reduce((s, j) => s + j[k], 0);
}

function Lifecycle({ doc }: { doc: SalesDoc }) {
  const steps = POSTABLE.includes(doc.docType) ? [1, 2, 3, 4] : [1, 2, 3];
  if (doc.status === 9) return <Alert severity="error" sx={{ mb: 2 }}>این سند باطل شده است.</Alert>;
  const active = steps.indexOf(doc.status);
  return (
    <Stepper activeStep={doc.status === 4 ? steps.length : active} alternativeLabel sx={{ mb: 2.5 }}>
      {steps.map((s) => <Step key={s}><StepLabel>{STATUS_LABEL[s as 1 | 2 | 3 | 4]}</StepLabel></Step>)}
    </Stepper>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2, overflow: 'hidden' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>{title}</Typography>
      <Box sx={{ overflowX: 'auto' }}>{children}</Box>
    </Paper>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <Grid size={{ xs: 6, sm: 4 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{toPersianDigits(value)}</Typography>
    </Grid>
  );
}
