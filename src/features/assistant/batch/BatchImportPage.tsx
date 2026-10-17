import { useMemo, useRef, useState } from 'react';
import { newClientId } from '../../../lib/ids';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { JalaliDateField } from '../../../components/JalaliDateField';
import { useSession } from '../../../lib/session/SessionContext';
import { formatThousands, toPersianDigits } from '../../../lib/format/numbers';
import { operationsApi } from '../api';
import { defaultVoucherDate, jalaliToGregorian } from '../draftMapping';
import type { ComposedLineInput, OperationResult, TemplateSummaryDto, VoucherDraft } from '../types';
import {
  batchColumns,
  downloadBatchTemplate,
  loadDetailList,
  readBatchFile,
  runPool,
  toBatchRow,
  type BatchRow,
  type DetailList,
} from './batchExcel';

type Mode = 'each' | 'single';

interface RowState {
  row: BatchRow;
  draft: VoucherDraft | null;
  messages: string[];
  clientRequestId: string;
  status: 'invalid' | 'ok' | 'running' | 'done' | 'failed';
  voucherId?: string;
  voucherNo?: string;
}

const MAX_ROWS = 500;

/**
 * ثبت گروهی حسابیار: الگو ⇒ فایل نمونه ⇒ پر کردن در اکسل ⇒ بررسی همهٔ سطرها با همان موتور الگو (بدون ثبت)
 * ⇒ ثبت. «هر سطر یک سند» یا «همه در یک سند» (ردیف‌های یکسان مثل بانک تجمیع می‌شوند). سند همیشه موقت است.
 */
export function BatchImportPage() {
  const navigate = useNavigate();
  const { financialYear } = useSession();
  const templates = useQuery({ queryKey: ['operation-templates'], queryFn: operationsApi.listTemplates, retry: false });
  const [templateId, setTemplateId] = useState('');
  const template = templates.data?.find((t) => t.id === templateId) ?? null;
  const [mode, setMode] = useState<Mode>('each');
  const [merge, setMerge] = useState(true);
  const [date, setDate] = useState(() => defaultVoucherDate(financialYear).value);
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<RowState[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [single, setSingle] = useState<{ voucherId: string; voucherNo: string } | null>(null);
  const [singleErrors, setSingleErrors] = useState<string[]>([]);
  const lists = useRef<{ templateId: string; lists: Record<string, DetailList | null> } | null>(null);
  const singleRequestId = useRef(newClientId());
  const fileInput = useRef<HTMLInputElement>(null);

  async function detailLists(t: TemplateSummaryDto) {
    if (lists.current?.templateId === t.id) return lists.current.lists;
    const out: Record<string, DetailList | null> = {};
    for (const p of t.parameters.filter((x) => x.type === 2)) out[p.key] = await loadDetailList(p);
    lists.current = { templateId: t.id, lists: out };
    return out;
  }

  function chooseTemplate(id: string) {
    setTemplateId(id);
    setRows([]);
    setSingle(null);
    setSingleErrors([]);
    setNotice(null);
    const t = templates.data?.find((x) => x.id === id);
    setDescription(t ? `${t.title} (گروهی)` : '');
  }

  async function download() {
    if (!template) return;
    setBusy('در حال ساخت فایل نمونه…');
    setError(null);
    try {
      await downloadBatchTemplate(template, await detailLists(template));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    if (!template) return;
    setBusy('در حال خواندن و بررسی سطرها…');
    setError(null);
    setNotice(null);
    setSingle(null);
    setSingleErrors([]);
    setRows([]);
    setProgress(0);
    try {
      const cols = batchColumns(template);
      const parsed = await readBatchFile(file, cols);
      if (parsed.missingHeaders.length) {
        setNotice(`این ستون‌ها در فایل پیدا نشد: ${parsed.missingHeaders.join('، ')} — از «دریافت فایل نمونه» همین الگو استفاده کنید.`);
        if (parsed.missingHeaders.length === cols.length) return;
      }
      if (parsed.rows.length === 0) {
        setNotice('سطری برای ثبت در فایل نیست.');
        return;
      }
      if (parsed.rows.length > MAX_ROWS) {
        setNotice(`حداکثر ${toPersianDigits(MAX_ROWS)} سطر در هر فایل؛ فایل را تقسیم کنید.`);
        return;
      }
      const l = await detailLists(template);
      let done = 0;
      const result = await runPool(parsed.rows, 4, async (raw, i): Promise<RowState> => {
        const row = await toBatchRow(template, cols, l, raw, parsed.rowNos[i], date);
        let state: RowState;
        if (!row.input) {
          state = { row, draft: null, messages: row.problems, clientRequestId: newClientId(), status: 'invalid' };
        } else {
          const r = await operationsApi.preview(template.id, row.input, financialYear);
          state = {
            row,
            draft: r.draft,
            messages: r.success ? [] : r.errors.map((e) => e.message),
            clientRequestId: newClientId(),
            status: r.success && r.draft ? 'ok' : 'invalid',
          };
        }
        setProgress(++done / parsed.rows.length);
        return state;
      });
      setRows(result);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function executeEach() {
    if (!template) return;
    setBusy('در حال ثبت سندها…');
    setError(null);
    const pending = rows.map((r, i) => ({ r, i })).filter((x) => x.r.status === 'ok' || x.r.status === 'failed');
    let done = 0;
    setProgress(0);
    try {
      // پشت سر هم تا شمارهٔ سندها به ترتیب سطرهای فایل باشد.
      for (const { r, i } of pending) {
        if (!r.row.input) continue;
        let result: OperationResult;
        try {
          result = await operationsApi.execute(template.id, { ...r.row.input, clientRequestId: r.clientRequestId }, financialYear);
        } catch (e) {
          result = { success: false, draft: null, errors: [{ code: 'Network', message: e instanceof Error ? e.message : 'خطا', parameterKey: null, askPrompt: null }], voucherId: null, voucherNo: null, wasAlreadyExecuted: false };
        }
        setRows((prev) => prev.map((x, j) => (j !== i ? x : result.success && result.voucherId
          ? { ...x, status: 'done', voucherId: result.voucherId, voucherNo: result.voucherNo ?? '', messages: [] }
          : { ...x, status: 'failed', messages: result.errors.map((e) => e.message) })));
        setProgress(++done / pending.length);
      }
    } finally {
      setBusy(null);
    }
  }

  const okRows = rows.filter((r) => r.status === 'ok' && r.draft);
  const composed = useMemo(() => composeLines(okRows.map((r) => r.draft!), merge), [okRows, merge]);

  async function executeSingle() {
    if (!template || okRows.length === 0) return;
    setBusy('در حال ثبت سند…');
    setError(null);
    setSingleErrors([]);
    try {
      const input = {
        voucherDate: jalaliToGregorian(date),
        description: description.trim() || null,
        apendix: null,
        systemTypeId: okRows[0].draft!.systemTypeId,
        lines: composed,
      };
      const preview = await operationsApi.composePreview(input, financialYear);
      if (!preview.success) {
        setSingleErrors(preview.errors.map((e) => e.message));
        return;
      }
      const result = await operationsApi.composeExecute({ ...input, sourceTemplateId: template.id, clientRequestId: singleRequestId.current }, financialYear);
      if (result.success && result.voucherId) {
        setSingle({ voucherId: result.voucherId, voucherNo: result.voucherNo ?? '' });
        singleRequestId.current = newClientId();
      } else setSingleErrors(result.errors.map((e) => e.message));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const doneCount = rows.filter((r) => r.status === 'done').length;
  const total = okRows.reduce((s, r) => s + r.draft!.totalDebit, 0);
  const cols = template ? batchColumns(template) : [];

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<UploadFileOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="ثبت گروهی از اکسل"
        description="یک الگو انتخاب کنید، فایل نمونه را بگیرید و پر کنید، سپس فایل را برگردانید. همهٔ سطرها پیش از ثبت با همان قواعد سند بررسی می‌شوند."
      />

      {error != null && <Box sx={{ mb: 2 }}><ErrorBanner error={error} /></Box>}
      {templates.error != null && <Box sx={{ mb: 2 }}><ErrorBanner error={templates.error} /></Box>}
      {templates.data && templates.data.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => navigate('/assistant/templates')}>الگوهای عملیات</Button>}>
          برای این واحد هیچ الگوی عملیات فعالی نیست. ثبت گروهی با یکی از الگوها کار می‌کند؛ اول در «الگوهای عملیات» الگو تعریف یا فعال کنید
          (و اگر برای نوع واحد خاصی محدود شده، نوع این واحد را هم اضافه کنید).
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <TextField select size="small" label="عملیات (الگو)" value={templateId} onChange={(e) => chooseTemplate(e.target.value)} sx={{ minWidth: 280 }}
            disabled={!!busy}>
            {(templates.data ?? []).map((t) => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}
          </TextField>
          <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} disabled={!template || !!busy} onClick={() => void download()}>
            دریافت فایل نمونه
          </Button>
          <Button variant="contained" startIcon={<UploadFileOutlinedIcon />} disabled={!template || !!busy} onClick={() => fileInput.current?.click()}>
            بارگذاری فایل پرشده
          </Button>
          <input ref={fileInput} type="file" hidden accept=".xlsx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        </Stack>
        {template && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            ستون‌ها: {cols.map((c) => c.header + (c.required ? ' *' : '')).join(' · ')}. تفصیلی‌ها با کد نوشته می‌شوند (فهرست کدها در برگه‌های فایل نمونه است).
            سطر بدون تاریخ، به تاریخ پیش‌فرض این صفحه ثبت می‌شود.
          </Typography>
        )}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2, alignItems: { md: 'center' } }}>
          <JalaliDateField label="تاریخ پیش‌فرض / تاریخ سند واحد" value={date} onChange={setDate} size="small" />
          <RadioGroup row value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <FormControlLabel value="each" control={<Radio size="small" />} label="هر سطر یک سند" />
            <FormControlLabel value="single" control={<Radio size="small" />} label="همه در یک سند" />
          </RadioGroup>
          {mode === 'single' && (
            <FormControlLabel control={<Checkbox size="small" checked={merge} onChange={(e) => setMerge(e.target.checked)} />}
              label="ردیف‌های یکسان (مثلاً بانک) جمع شوند" />
          )}
        </Stack>
        {mode === 'single' && (
          <TextField size="small" fullWidth label="شرح سند" value={description} onChange={(e) => setDescription(e.target.value)} sx={{ mt: 2 }} />
        )}
      </Paper>

      {busy && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>{busy}</Typography>
          <LinearProgress variant={progress > 0 ? 'determinate' : 'indeterminate'} value={progress * 100} />
        </Box>
      )}
      {notice && <Alert severity="warning" sx={{ mb: 2 }}>{notice}</Alert>}

      {rows.length > 0 && (
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Stack direction="row" spacing={1} sx={{ p: 1.5, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
            <Chip size="small" color="success" variant="outlined" label={`سالم: ${toPersianDigits(okRows.length)}`} />
            {invalidCount > 0 && <Chip size="small" color="error" variant="outlined" label={`دارای خطا: ${toPersianDigits(invalidCount)}`} />}
            {doneCount > 0 && <Chip size="small" color="primary" label={`ثبت‌شده: ${toPersianDigits(doneCount)}`} />}
            <Typography variant="body2" sx={{ flex: 1 }}>جمع مبلغ سطرهای سالم: {toPersianDigits(formatThousands(total))} ریال</Typography>
            {mode === 'each' ? (
              <Button variant="contained" disabled={!!busy || rows.every((r) => r.status !== 'ok' && r.status !== 'failed')} onClick={() => void executeEach()}>
                ثبت {toPersianDigits(rows.filter((r) => r.status === 'ok' || r.status === 'failed').length)} سند
              </Button>
            ) : (
              <Button variant="contained" disabled={!!busy || okRows.length === 0 || !!single} onClick={() => void executeSingle()}>
                ثبت یک سند با {toPersianDigits(composed.length)} ردیف
              </Button>
            )}
          </Stack>
          {invalidCount > 0 && (
            <Alert severity="info" sx={{ mx: 1.5, mb: 1.5 }}>
              سطرهای دارای خطا ثبت نمی‌شوند. آن‌ها را در اکسل اصلاح کنید و فایل را دوباره بارگذاری کنید (سطرهای ثبت‌شده را از فایل حذف کنید).
            </Alert>
          )}
          {single && (
            <Alert severity="success" sx={{ mx: 1.5, mb: 1.5 }}
              action={<Button size="small" color="inherit" onClick={() => navigate(`/operation/vouchers/${single.voucherId}/view`)}>مشاهدهٔ سند</Button>}>
              سند {toPersianDigits(single.voucherNo)} با {toPersianDigits(composed.length)} ردیف ثبت شد (موقت).
            </Alert>
          )}
          {singleErrors.length > 0 && <Alert severity="error" sx={{ mx: 1.5, mb: 1.5 }}>{singleErrors.map((m, i) => <div key={i}>{m}</div>)}</Alert>}
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>سطر</TableCell>
                  {cols.map((c) => <TableCell key={c.key}>{c.label}</TableCell>)}
                  <TableCell>وضعیت</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.row.rowNo} sx={r.status === 'invalid' || r.status === 'failed' ? { bgcolor: 'rgba(211, 47, 47, 0.06)' } : undefined}>
                    <TableCell>{toPersianDigits(r.row.rowNo)}</TableCell>
                    {cols.map((c) => (
                      <TableCell key={c.key}>
                        {c.type === 1 && r.row.raw[c.key] ? toPersianDigits(formatThousands(r.row.raw[c.key].replace(/[^\d]/g, '')))
                          : toPersianDigits(r.row.labels[c.key] ?? r.row.raw[c.key] ?? '')}
                      </TableCell>
                    ))}
                    <TableCell sx={{ minWidth: 220 }}>
                      {r.status === 'done' ? (
                        <Button size="small" onClick={() => navigate(`/operation/vouchers/${r.voucherId}/view`)}>سند {toPersianDigits(r.voucherNo ?? '')}</Button>
                      ) : r.status === 'ok' ? (
                        <Typography variant="caption" color="success.main">آمادهٔ ثبت</Typography>
                      ) : (
                        <Typography variant="caption" color="error.main">{r.messages.join(' · ')}</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

/**
 * ردیف‌های پیش‌نویس همهٔ سطرها ⇒ ردیف‌های یک سند. با `merge`، ردیف‌هایی که حساب، تفصیلی‌ها و سمتشان یکی
 * است (مثلاً بستانکار بانک در همهٔ پرداخت‌ها) یک ردیف با جمع مبلغ می‌شوند.
 */
function composeLines(drafts: VoucherDraft[], merge: boolean): ComposedLineInput[] {
  const out: ComposedLineInput[] = [];
  const index = new Map<string, number>();
  for (const d of drafts) {
    for (const l of d.lines) {
      const tafsili = l.details.map((x) => ({ levelId: x.levelId, tafsiliId: x.detailId }));
      const key = `${l.subsidiaryAccountId}|${tafsili.map((t) => t.tafsiliId).join(',')}|${l.debit > 0 ? 'D' : 'C'}`;
      const at = merge ? index.get(key) : undefined;
      if (at !== undefined) {
        out[at] = { ...out[at], debit: out[at].debit + l.debit, credit: out[at].credit + l.credit };
        continue;
      }
      if (merge) index.set(key, out.length);
      out.push({ accountId: l.subsidiaryAccountId, debit: l.debit, credit: l.credit, description: l.description || null, tafsili, checkId: null, cheque: null });
    }
  }
  return out;
}
