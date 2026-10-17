import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { JalaliDateField } from '../../components/JalaliDateField';
import { useSession } from '../../lib/session/SessionContext';
import { formatThousands, normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { todayJalali } from '../assistant/draftMapping';
import { salesApi } from './api';
import { DOC_TYPE_LABEL, POSTABLE, type SalesDocInput, type SalesDocPreview, type SalesDocType, type SalesItem } from './types';
import { CheckList } from './salesUi';

function emptyInput(type: SalesDocType): SalesDocInput {
  return {
    docType: type, docDate: todayJalali(), customerId: '', sourceId: null, payTerms: 30, validUntil: null, deliveryDate: null,
    salesType: 1, refNo: null, note: null, printNote: null, headerDiscount: 0, lines: [{ itemId: '', qty: 1, price: 0, discountPercent: 0 }],
  };
}

const money = (n: number) => toPersianDigits(formatThousands(Math.round(n)));
const digits = (s: string) => Number(normalizeNumericInput(s).replace(/[^\d]/g, '') || 0);

/**
 * صدور/ویرایش سند فروش. هیچ عددی این‌جا ساخته نمی‌شود: با هر تغییر (۴۰۰ میلی‌ثانیه درنگ) پیش‌نمایش سرور جمع‌ها
 * و کنترل‌ها را برمی‌گرداند. سند تبدیلی مشتری، کالا و قیمت مبدأ را دارد و فقط مقدار کم می‌شود.
 */
export function SalesDocEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const { financialYear } = useSession();
  const fromId = params.get('from');
  const target = Number(params.get('target') || 0) as SalesDocType;
  const [input, setInput] = useState<SalesDocInput | null>(id || fromId ? null : emptyInput((Number(params.get('type')) || 1) as SalesDocType));
  const [loadError, setLoadError] = useState<unknown>(null);
  const [preview, setPreview] = useState<SalesDocPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const items = useQuery({ queryKey: ['sales-items', ''], queryFn: () => salesApi.items(''), retry: false });
  const customers = useQuery({ queryKey: ['sales-customers', ''], queryFn: () => salesApi.customers(''), retry: false });

  useEffect(() => {
    if (id) {
      salesApi.doc(id, financialYear).then((d) => setInput({
        docType: d.docType, docDate: d.docDate, customerId: d.customer?.id ?? '', sourceId: d.sourceId, payTerms: d.payTerms,
        validUntil: d.validUntil, deliveryDate: d.deliveryDate, salesType: d.salesType, refNo: d.refNo, note: d.note, printNote: d.printNote,
        headerDiscount: d.headerDiscount, lines: d.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, price: l.price, discountPercent: l.discountPercent })),
      })).catch(setLoadError);
    } else if (fromId && target) {
      salesApi.conversion(fromId, target).then(setInput).catch(setLoadError);
    }
  }, [id, fromId, target, financialYear]);

  // پیش‌نمایش سرور با درنگ؛ پاسخ کهنه (تغییر بعدی رسیده) نادیده گرفته می‌شود.
  const seq = useRef(0);
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    if (!input || !input.customerId || input.lines.every((l) => !l.itemId)) { setPreview(null); return; }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      const clean = { ...input, lines: input.lines.filter((l) => l.itemId) };
      salesApi.preview(id ?? null, clean, financialYear).then((p) => { if (mine === seq.current) setPreview(p); }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, id, financialYear]);

  const itemMap = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  const locked = !!input?.sourceId;

  async function save(submit: boolean) {
    if (!input) return;
    setBusy(true);
    setErrors([]);
    try {
      const clean = { ...input, lines: input.lines.filter((l) => l.itemId) };
      const saved = await salesApi.save(id ?? null, clean, financialYear);
      if (!saved.success || !saved.id) return setErrors(saved.errors);
      if (submit) {
        const r = await salesApi.submit(saved.id, financialYear);
        if (!r.success) {
          setErrors(r.errors);
          if (!id) navigate(`/sales/docs/${saved.id}/edit`, { replace: true });
          return;
        }
      }
      navigate(`/sales/docs/${saved.id}`);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'ذخیره انجام نشد.']);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <ErrorBanner error={loadError} />;
  if (!input) return <Typography color="text.secondary">در حال بارگذاری…</Typography>;

  const set = <K extends keyof SalesDocInput>(k: K, v: SalesDocInput[K]) => setInput((s) => (s ? { ...s, [k]: v } : s));
  const setLine = (i: number, patch: Partial<SalesDocInput['lines'][number]>) =>
    setInput((s) => (s ? { ...s, lines: s.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) } : s));
  const customer = customers.data?.find((c) => c.id === input.customerId) ?? null;
  const pLine = (itemId: string) => preview?.lines.find((l) => l.itemId === itemId);
  const hasErr = preview?.checks.some((c) => c.level === 'err') ?? true;
  const needsApproval = (preview?.approvalReasons.length ?? 0) > 0;

  return (
    <Box>
      <PageHeader eyebrow="فروش" icon={<PointOfSaleOutlinedIcon fontSize="small" />}
        title={`${id ? 'ویرایش' : 'صدور'} ${DOC_TYPE_LABEL[input.docType]}`}
        description="مالیات در سطح ردیف و با نرخ مؤثر در تاریخ سند حساب می‌شود؛ کنترل‌ها در ستون کنار به‌روز می‌شوند."
        actions={<Button color="inherit" onClick={() => navigate(-1)}>بازگشت</Button>} />
      {locked && <Alert severity="info" sx={{ mb: 2 }}>صادرشده از سند مبدأ: مشتری، کالا و قیمت از مبدأ می‌آید؛ مقدار را برای تحویل یا فاکتور جزئی کم کنید.</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8.5 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField select fullWidth size="small" label="نوع سند" value={input.docType} disabled={!!id || locked}
                  onChange={(e) => set('docType', Number(e.target.value) as SalesDocType)}>
                  {(locked ? [input.docType] : [1, 2, 4] as SalesDocType[]).map((t) => <MenuItem key={t} value={t}>{DOC_TYPE_LABEL[t]}{t === 4 && !locked ? ' (مستقیم)' : ''}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <JalaliDateField label="تاریخ سند" size="small" value={input.docDate} onChange={(v) => set('docDate', v)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth size="small" type="number" label="مهلت پرداخت (روز)" value={input.payTerms} onChange={(e) => set('payTerms', Number(e.target.value))} />
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Autocomplete
                  size="small"
                  disabled={locked}
                  options={customers.data ?? []}
                  value={customer}
                  getOptionLabel={(c) => `${c.name ?? ''} (${c.tafsiliCode ?? ''})${c.isBlocked ? ' — مسدود' : ''}`}
                  getOptionDisabled={(c) => c.isBlocked}
                  onChange={(_, c) => setInput((s) => (s ? { ...s, customerId: c?.id ?? '', payTerms: c?.payTerms ?? s.payTerms } : s))}
                  renderInput={(p) => <TextField {...p} label="مشتری" required />}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField select fullWidth size="small" label="نوع فروش" value={input.salesType} onChange={(e) => set('salesType', Number(e.target.value) as 1 | 2 | 3)}>
                  <MenuItem value={1}>فروش داخلی</MenuItem><MenuItem value={2}>فروش صادراتی</MenuItem><MenuItem value={3}>فروش خدمات</MenuItem>
                </TextField>
              </Grid>
              {customer && preview?.creditLimit != null && (
                <Grid size={12}>
                  <Stack direction="row" spacing={3} sx={{ px: 1.5, py: 1, border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2, flexWrap: 'wrap' }}>
                    <Kv label="مانده حساب" value={money(preview.customerBalance ?? 0)} />
                    <Kv label="سفارش باز" value={money(preview.customerOpenOrders ?? 0)} />
                    <Kv label="سقف اعتبار" value={preview.creditLimit ? money(preview.creditLimit) : 'بدون سقف'} />
                    <Kv label="مودیان" value={customer.completeForMoadian ? 'نوع اول' : 'نوع دوم'} />
                  </Stack>
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth size="small" label="شمارهٔ سفارش مشتری" value={input.refNo ?? ''} onChange={(e) => set('refNo', e.target.value || null)} />
              </Grid>
              {input.docType === 1 && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <JalaliDateField label="اعتبار پیش‌فاکتور تا" size="small" value={input.validUntil ?? ''} onChange={(v) => set('validUntil', v || null)} />
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 4 }}>
                <JalaliDateField label="تاریخ تحویل مورد انتظار" size="small" value={input.deliveryDate ?? ''} onChange={(v) => set('deliveryDate', v || null)} />
              </Grid>
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ borderRadius: 3, mb: 2, overflow: 'hidden' }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 220 }}>کالا / خدمت</TableCell>
                    <TableCell sx={{ width: 100 }}>تعداد</TableCell>
                    <TableCell sx={{ width: 140 }}>فی (ریال)</TableCell>
                    <TableCell sx={{ width: 80 }}>تخفیف ٪</TableCell>
                    <TableCell align="left">پس از تخفیف</TableCell>
                    <TableCell align="left">مالیات</TableCell>
                    <TableCell align="left">جمع</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {input.lines.map((l, i) => {
                    const it = itemMap.get(l.itemId);
                    const p = pLine(l.itemId);
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Autocomplete
                            size="small"
                            disabled={locked}
                            options={(items.data ?? []).filter((x) => x.isActive && !(input.docType === 3 && x.kind === 2))}
                            value={it ?? null}
                            getOptionLabel={(x: SalesItem) => `${x.name} · ${x.code}`}
                            onChange={(_, x) => setLine(i, { itemId: x?.id ?? '', price: x?.price ?? 0 })}
                            renderInput={(pr) => <TextField {...pr} placeholder="انتخاب کالا…" />}
                          />
                          {it && <Typography variant="caption" color="text.secondary">{it.kind === 1 ? `موجودی: ${toPersianDigits(it.stock)} ${it.unitName}` : 'خدمت'}{it.isExempt ? ' · معاف' : ''}</Typography>}
                        </TableCell>
                        <TableCell><TextField size="small" type="number" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} slotProps={{ htmlInput: { min: 0, step: 'any' } }} /></TableCell>
                        <TableCell><TextField size="small" disabled={locked} value={money(l.price)} onChange={(e) => setLine(i, { price: digits(e.target.value) })} /></TableCell>
                        <TableCell><TextField size="small" type="number" disabled={locked} value={l.discountPercent} onChange={(e) => setLine(i, { discountPercent: Number(e.target.value) })} /></TableCell>
                        <TableCell align="left">{p ? money(p.taxable) : '—'}</TableCell>
                        <TableCell align="left">{p ? (p.vatRate ? money(p.vat) : 'معاف') : '—'}</TableCell>
                        <TableCell align="left" sx={{ fontWeight: 700 }}>{p ? money(p.total) : '—'}</TableCell>
                        <TableCell>
                          <IconButton size="small" disabled={input.lines.length === 1} onClick={() => set('lines', input.lines.filter((_, j) => j !== i))}>
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            {!locked && (
              <Button sx={{ m: 1.5 }} variant="outlined" size="small" onClick={() => set('lines', [...input.lines, { itemId: '', qty: 1, price: 0, discountPercent: 0 }])}>
                افزودن ردیف
              </Button>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack spacing={2}>
              <TextField size="small" label="توضیحات داخلی" multiline minRows={2} value={input.note ?? ''} onChange={(e) => set('note', e.target.value || null)} />
              <TextField size="small" label="یادداشت قابل چاپ" multiline minRows={2} value={input.printNote ?? ''} onChange={(e) => set('printNote', e.target.value || null)} />
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 3.5 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, position: { lg: 'sticky' }, top: { lg: 88 }, overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
              <Typography variant="caption">قابل پرداخت</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>{money(preview?.total ?? 0)} ریال</Typography>
              <Typography variant="caption">نرخ مؤثر مالیات: {toPersianDigits(preview?.vatRate ?? 0)}٪</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <SumRow label="جمع ناخالص" value={money(preview?.gross ?? 0)} />
              <Stack direction="row" sx={{ alignItems: 'center', my: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>تخفیف کلی سند</Typography>
                <TextField size="small" disabled={locked} value={money(input.headerDiscount)} onChange={(e) => set('headerDiscount', digits(e.target.value))} sx={{ width: 140 }} />
              </Stack>
              <SumRow label="جمع تخفیف" value={money(preview?.discount ?? 0)} />
              <SumRow label="مبلغ مشمول" value={money(preview?.taxable ?? 0)} />
              <SumRow label="مالیات بر ارزش افزوده" value={money(preview?.vat ?? 0)} />
              <Divider sx={{ my: 1.5 }} />
              <CheckList checks={preview?.checks ?? []} />
              {errors.length > 0 && <Alert severity="error" sx={{ mt: 1.5 }}>{errors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
              <Button fullWidth variant="contained" sx={{ mt: 2 }} disabled={busy || hasErr} onClick={() => void save(true)}>
                {needsApproval ? 'ثبت و ارسال برای تأیید' : POSTABLE.includes(input.docType) ? 'ثبت (آمادهٔ قطعی‌سازی)' : 'ثبت نهایی'}
              </Button>
              <Button fullWidth variant="outlined" sx={{ mt: 1 }} disabled={busy || !input.customerId} onClick={() => void save(false)}>ذخیرهٔ پیش‌نویس</Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                گردکردن به ریال در سطح هر ردیف است؛ تخفیف کلی به نسبت مبلغ ردیف‌ها سرشکن می‌شود. پیش‌نویس سند حسابداری نمی‌سازد.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ my: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
    </Stack>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}
