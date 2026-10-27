import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOffOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import SystemUpdateAltOutlinedIcon from '@mui/icons-material/SystemUpdateAltOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { ABILITIES, useRoles } from '../../../lib/roles';
import { useSession } from '../../../lib/session/SessionContext';
import { toPersianDigits } from '../../../lib/format/numbers';
import { operationsApi } from '../api';
import type { TemplateSummaryDto } from '../types';
import { aiEvalApi, type AiEvalKind, type AiEvalRun, type AiGoldenCase, type AiGoldenCaseInput } from './api';

const KIND_LABEL: Record<AiEvalKind, string> = { golden: 'نمونه‌های طلایی', shadow: 'اجرای سایه' };

function percent(hits: number, total: number) {
  return total === 0 ? '—' : `${toPersianDigits(Math.round((hits * 100) / total))}٪`;
}

function dateTime(utc: string) {
  return toPersianDigits(new Date(utc).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }));
}

/**
 * سنجش هوش مصنوعی (فاز ۶۵): پیش از روشن کردن هوش مصنوعی برای کاربران و پس از هر تغییر مدل/پرامپت.
 * نمونهٔ طلایی = جمله + جواب درست. اجرای سایه = جملهٔ اسنادی که کاربران بدون هوش مصنوعی ثبت کردند، در برابر آنچه
 * واقعاً ثبت شد؛ کاربری چیزی نمی‌بیند. فقط صاحب قابلیت «سنجش هوش مصنوعی» (پیش‌فرض: کاربر ستاد مرکزی).
 */
export function AiEvalPage() {
  const { hasAbility, loaded } = useRoles();
  const allowed = hasAbility(ABILITIES.AiEvaluate);
  const [tab, setTab] = useState<'golden' | 'runs'>('runs');

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<RuleOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="سنجش هوش مصنوعی"
        description="دقت فهم جمله را روی نمونه‌های طلایی و روی جمله‌های واقعی اسناد ثبت‌شده (اجرای سایه) بسنجید."
      />
      {loaded && !allowed && (
        <Alert severity="info" sx={{ mb: 2 }}>سنجش هوش مصنوعی فقط برای کاربر ستاد مرکزی یا نقشی که این قابلیت را دارد ممکن است.</Alert>
      )}
      {(!loaded || allowed) && (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab value="runs" label="دورهای سنجش" />
            <Tab value="golden" label="نمونه‌های طلایی" />
          </Tabs>
          {tab === 'runs' ? <RunsTab /> : <GoldenTab />}
        </>
      )}
    </Box>
  );
}

// ─────────── دورهای سنجش ───────────

function RunsTab() {
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [take, setTake] = useState(20);
  const [allUnits, setAllUnits] = useState(false);
  const [openRun, setOpenRun] = useState<string | null>(null);
  const runs = useQuery({ queryKey: ['ai-eval-runs'], queryFn: aiEvalApi.runs, retry: false });

  const run = useMutation({
    mutationFn: (kind: AiEvalKind) => aiEvalApi.run(kind, take, allUnits, financialYear),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-eval-runs'] });
      setOpenRun(r.run.id);
    },
  });

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap', rowGap: 1.5 }}>
          <TextField
            label="تعداد جمله"
            type="number"
            size="small"
            value={take}
            onChange={(e) => setTake(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            slotProps={{ htmlInput: { min: 1, max: 50 } }}
            sx={{ width: 130 }}
          />
          <FormControlLabel control={<Checkbox checked={allUnits} onChange={(e) => setAllUnits(e.target.checked)} />} label="اجرای سایه روی همهٔ واحدها" />
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<PlayArrowOutlinedIcon />} disabled={run.isPending} onClick={() => run.mutate('golden')}>
            اجرا روی نمونه‌های طلایی
          </Button>
          <Button variant="contained" startIcon={<PlayArrowOutlinedIcon />} disabled={run.isPending} onClick={() => run.mutate('shadow')}>
            اجرای سایه
          </Button>
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          هر دور حداکثر ۵۰ جمله یا حدود ۹۰ ثانیه است. اجرای سایه جمله‌هایی را می‌سنجد که کاربران بدون هوش مصنوعی سند زده‌اند؛ جمله پیش از ذخیره پوشانده می‌شود.
        </Typography>
        {run.isPending && <LinearProgress sx={{ mt: 2 }} />}
      </Paper>

      {run.error != null && <ErrorBanner error={run.error} />}
      {runs.error != null && <ErrorBanner error={runs.error} />}
      {runs.isLoading && <LinearProgress />}

      {runs.data && runs.data.length === 0 && <Alert severity="info">هنوز سنجشی اجرا نشده است.</Alert>}
      {runs.data && runs.data.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>زمان</TableCell>
                <TableCell>نوع</TableCell>
                <TableCell>مدل</TableCell>
                <TableCell align="center">جمله</TableCell>
                <TableCell align="center">الگوی درست</TableCell>
                <TableCell align="center">جواب درست</TableCell>
                <TableCell align="center">خطا</TableCell>
                <TableCell align="center">میانگین زمان</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.data.map((r) => <RunRow key={r.id} run={r} onOpen={() => setOpenRun(r.id)} />)}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {openRun && <RunDialog id={openRun} onClose={() => setOpenRun(null)} />}
    </Stack>
  );
}

function RunRow({ run, onOpen }: { run: AiEvalRun; onOpen: () => void }) {
  return (
    <TableRow hover sx={{ cursor: 'pointer' }} onClick={onOpen}>
      <TableCell>{dateTime(run.createdAtUtc)}</TableCell>
      <TableCell><Chip size="small" label={KIND_LABEL[run.kind]} color={run.kind === 'shadow' ? 'secondary' : 'default'} variant="outlined" /></TableCell>
      <TableCell sx={{ direction: 'ltr', textAlign: 'right' }}>{run.provider}{run.model ? ` · ${run.model}` : ''}</TableCell>
      <TableCell align="center">{toPersianDigits(run.total)}</TableCell>
      <TableCell align="center">{percent(run.templateHits, run.total)}</TableCell>
      <TableCell align="center">{percent(run.answerHits, run.answerTotal)}</TableCell>
      <TableCell align="center">{toPersianDigits(run.failures)}</TableCell>
      <TableCell align="center">{toPersianDigits((run.avgLatencyMs / 1000).toFixed(1))} ثانیه</TableCell>
    </TableRow>
  );
}

function RunDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ['ai-eval-run', id], queryFn: () => aiEvalApi.runDetail(id), retry: false });
  const [onlyWrong, setOnlyWrong] = useState(true);
  const items = (detail.data?.items ?? []).filter((i) => !onlyWrong || !i.templateOk || i.answersOk < i.answersExpected || i.error);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        نتیجهٔ سنجش
        {detail.data && (
          <Typography variant="body2" component="span" sx={{ color: 'text.secondary', mr: 1 }}>
            {KIND_LABEL[detail.data.run.kind]} — الگو {percent(detail.data.run.templateHits, detail.data.run.total)}، جواب‌ها {percent(detail.data.run.answerHits, detail.data.run.answerTotal)}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {detail.isLoading && <LinearProgress />}
        {detail.error != null && <ErrorBanner error={detail.error} />}
        <FormControlLabel control={<Switch checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />} label="فقط موارد نادرست" />
        {detail.data && items.length === 0 && <Alert severity="success" sx={{ mt: 1 }}>همهٔ جمله‌ها درست فهمیده شدند.</Alert>}
        {items.length > 0 && (
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>جمله (پوشانده)</TableCell>
                <TableCell>الگوی انتظار / برداشت</TableCell>
                <TableCell align="center">جواب‌ها</TableCell>
                <TableCell>اختلاف</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell sx={{ maxWidth: 320 }}>{i.maskedSentence}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      {i.templateOk ? <CheckCircleOutlineIcon color="success" fontSize="small" /> : <HighlightOffIcon color="error" fontSize="small" />}
                      <Typography variant="body2" sx={{ direction: 'ltr' }}>{i.expectedTemplateCode ?? '—'} / {i.actualTemplateCode ?? '—'}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">{toPersianDigits(`${i.answersOk}/${i.answersExpected}`)}</TableCell>
                  <TableCell>
                    {i.error && <Chip size="small" color="error" variant="outlined" label={i.error} sx={{ mb: 0.5 }} />}
                    <Stack spacing={0.25}>
                      {i.diffs.filter((d) => d.key !== 'template' && d.key !== 'error').map((d) => (
                        <Typography key={d.key} variant="caption">
                          <b>{d.key}</b>: انتظار «{d.expected ?? '—'}»، برداشت «{d.actual ?? '—'}»
                        </Typography>
                      ))}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────── نمونه‌های طلایی ───────────

function GoldenTab() {
  const queryClient = useQueryClient();
  const golden = useQuery({ queryKey: ['ai-eval-golden'], queryFn: aiEvalApi.golden, retry: false });
  const templates = useQuery({ queryKey: ['operation-templates'], queryFn: operationsApi.listTemplates, retry: false });
  const [editing, setEditing] = useState<AiGoldenCase | 'new' | null>(null);
  const [importAll, setImportAll] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['ai-eval-golden'] });

  const remove = useMutation({ mutationFn: aiEvalApi.removeGolden, onSuccess: refresh });
  const importCases = useMutation({ mutationFn: () => aiEvalApi.importGolden(50, importAll), onSuccess: refresh });
  const toggle = useMutation({
    mutationFn: (g: AiGoldenCase) => aiEvalApi.updateGolden(g.id, { sentence: g.sentence, expectedTemplateCode: g.expectedTemplateCode, expectedAnswers: g.expectedAnswers, note: g.note, isActive: !g.isActive }),
    onSuccess: refresh,
  });

  const titleOf = (code: string | null) => code === null ? 'هیچ الگو' : templates.data?.find((t) => t.code === code)?.title ?? code;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => setEditing('new')}>نمونهٔ تازه</Button>
          <Button variant="outlined" startIcon={<SystemUpdateAltOutlinedIcon />} disabled={importCases.isPending} onClick={() => importCases.mutate()}>
            ساخت از اسناد ثبت‌شده
          </Button>
          <FormControlLabel control={<Checkbox checked={importAll} onChange={(e) => setImportAll(e.target.checked)} />} label="از همهٔ واحدها" />
        </Stack>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          «ساخت از اسناد» جملهٔ کاربر و آنچه واقعاً ثبت کرد را نمونه می‌کند (تا ۵۰ سند تازه). پیش از تکیه بر نمونه‌ها مرورشان کنید.
        </Typography>
        {importCases.data !== undefined && (
          <Alert severity="success" sx={{ mt: 1.5 }}>{toPersianDigits(importCases.data)} نمونهٔ تازه ساخته شد.</Alert>
        )}
      </Paper>

      {[golden.error, remove.error, importCases.error, toggle.error].map((e, i) => e != null && <ErrorBanner key={i} error={e} />)}
      {golden.isLoading && <LinearProgress />}
      {golden.data && golden.data.length === 0 && <Alert severity="info">هنوز نمونه‌ای ندارید.</Alert>}

      {golden.data && golden.data.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>جمله</TableCell>
                <TableCell>الگوی درست</TableCell>
                <TableCell>جواب‌های درست</TableCell>
                <TableCell>منبع</TableCell>
                <TableCell align="center">فعال</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {golden.data.map((g) => (
                <TableRow key={g.id} sx={{ opacity: g.isActive ? 1 : 0.55 }}>
                  <TableCell sx={{ maxWidth: 320 }}>{g.sentence}</TableCell>
                  <TableCell>{titleOf(g.expectedTemplateCode)}</TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                      {Object.entries(g.expectedAnswers).map(([k, v]) => <Chip key={k} size="small" variant="outlined" label={`${k}: ${v}`} />)}
                    </Stack>
                  </TableCell>
                  <TableCell>{g.sourceExecutionId ? 'از سند' : 'دستی'}</TableCell>
                  <TableCell align="center">
                    <Switch size="small" checked={g.isActive} onChange={() => toggle.mutate(g)} slotProps={{ input: { 'aria-label': 'فعال' } }} />
                  </TableCell>
                  <TableCell align="left" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="ویرایش"><IconButton size="small" aria-label="ویرایش" onClick={() => setEditing(g)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="حذف"><IconButton size="small" aria-label="حذف" onClick={() => remove.mutate(g.id)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {editing && (
        <GoldenDialog
          initial={editing === 'new' ? null : editing}
          templates={templates.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </Stack>
  );
}

function GoldenDialog({ initial, templates, onClose, onSaved }: {
  initial: AiGoldenCase | null;
  templates: TemplateSummaryDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AiGoldenCaseInput>({
    sentence: initial?.sentence ?? '',
    expectedTemplateCode: initial?.expectedTemplateCode ?? null,
    expectedAnswers: initial?.expectedAnswers ?? {},
    note: initial?.note ?? null,
    isActive: initial?.isActive ?? true,
  });
  const template = templates.find((t) => t.code === form.expectedTemplateCode);
  // متن آزاد سنجیده نمی‌شود؛ تفصیلی با نام، تاریخ شمسی YYYYMMDD، مبلغ ریال.
  const params = (template?.parameters ?? []).filter((p) => p.type !== 3);
  const hint: Record<number, string> = { 1: 'ریال، مثل 25000000', 2: 'نام طرف حساب', 4: 'شمسی، مثل 14040708', 5: 'مقدار گزینه' };

  const save = useMutation({
    mutationFn: () => {
      const input = { ...form, expectedAnswers: Object.fromEntries(Object.entries(form.expectedAnswers).filter(([k, v]) => v.trim() && params.some((p) => p.key === k))) };
      return initial ? aiEvalApi.updateGolden(initial.id, input) : aiEvalApi.createGolden(input);
    },
    onSuccess: onSaved,
  });

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial ? 'ویرایش نمونهٔ طلایی' : 'نمونهٔ طلایی تازه'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {save.error != null && <ErrorBanner error={save.error} />}
          <TextField
            label="جملهٔ کاربر"
            multiline
            minRows={2}
            required
            value={form.sentence}
            onChange={(e) => setForm({ ...form, sentence: e.target.value.slice(0, 1000) })}
          />
          <TextField
            select
            label="الگوی درست"
            value={form.expectedTemplateCode ?? ''}
            onChange={(e) => setForm({ ...form, expectedTemplateCode: e.target.value || null, expectedAnswers: {} })}
            helperText="«هیچ الگو» یعنی هوش مصنوعی نباید الگویی انتخاب کند (جملهٔ بی‌ربط یا مبهم)."
          >
            <MenuItem value="">هیچ الگو</MenuItem>
            {templates.map((t) => <MenuItem key={t.id} value={t.code}>{t.title}</MenuItem>)}
          </TextField>
          {params.map((p) => (
            <TextField
              key={p.key}
              size="small"
              label={p.title}
              helperText={p.type === 5 && p.options ? p.options.map((o) => `${o.value} = ${o.label}`).join('، ') : hint[p.type]}
              value={form.expectedAnswers[p.key] ?? ''}
              onChange={(e) => setForm({ ...form, expectedAnswers: { ...form.expectedAnswers, [p.key]: e.target.value } })}
            />
          ))}
          <TextField label="یادداشت" value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value.slice(0, 500) || null })} />
          <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="فعال" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>انصراف</Button>
        <Button variant="contained" disabled={!form.sentence.trim() || save.isPending} onClick={() => save.mutate()}>ذخیره</Button>
      </DialogActions>
    </Dialog>
  );
}
