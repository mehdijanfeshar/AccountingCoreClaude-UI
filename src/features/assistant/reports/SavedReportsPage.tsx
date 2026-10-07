import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { ABILITIES, useRoles } from '../../../lib/roles';
import { useSession } from '../../../lib/session/SessionContext';
import { vahedTypesApi } from '../../coding-permissions/api';
import { REPORT_KINDS, buildReportUrl, kindSpec, type ReportKind } from './reportCatalog';
import { parseSettings, savedReportsApi, type SavedReportDto } from './reportsApi';
import { ParamInput } from './ReportAssistantPage';

interface Draft {
  id: string | null;
  code: string;
  title: string;
  description: string;
  keywords: string;
  reportKind: ReportKind;
  values: Record<string, string>;
  ask: string[];
  allowedVahedTypes: string[];
}

function emptyDraft(kind: ReportKind = 'trial-balance'): Draft {
  const spec = kindSpec(kind)!;
  return {
    id: null, code: '', title: '', description: '', keywords: '', reportKind: kind,
    values: Object.fromEntries(spec.params.map((p) => [p.key, p.defaultValue])),
    ask: spec.params.filter((p) => p.askByDefault).map((p) => p.key),
    allowedVahedTypes: [],
  };
}

function fromDto(r: SavedReportDto): Draft {
  const spec = kindSpec(r.reportKind)!;
  const s = parseSettings(r.settingsJson);
  return {
    id: r.id, code: r.code, title: r.title, description: r.description ?? '', keywords: r.keywords ?? '', reportKind: r.reportKind,
    values: Object.fromEntries(spec.params.map((p) => [p.key, s.fixed[p.key] ?? p.defaultValue])),
    ask: s.ask, allowedVahedTypes: r.allowedVahedTypes,
  };
}

/**
 * گزارش‌های ذخیره‌شدهٔ حسابیار (گزارش‌ساز): حسابدار ستاد یکی از گزارش‌های موجود را با تنظیمات دلخواه، اسم،
 * توضیح و کلمات کلیدی ذخیره می‌کند و مشخص می‌کند کدام پارامترها هر بار از کاربر پرسیده شوند.
 */
export function SavedReportsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // تعریف گزارش سراسری = قابلیت «saved-reports.define» (پیش‌فرض: کاربر ستاد مرکزی).
  const { hasAbility, loaded } = useRoles();
  const isSetad = hasAbility(ABILITIES.SavedReportsDefine);
  const list = useQuery({ queryKey: ['saved-report-definitions'], queryFn: savedReportsApi.definitions, retry: false });
  const [editing, setEditing] = useState<Draft | null>(null);

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => savedReportsApi.setActive(id, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['saved-report-definitions'] });
      await queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
    },
  });

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<BookmarkBorderOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="گزارش‌های ذخیره‌شده"
        description="یک گزارش موجود را با تنظیمات دلخواه و یک اسم ذخیره کنید؛ کاربران فقط می‌گویند «گزارش هزینهٔ دارو ماه قبل»."
        actions={
          <Stack direction="row" spacing={1}>
            <Button color="inherit" onClick={() => navigate('/assistant/reports')}>گزارش با حسابیار</Button>
            <Button variant="contained" startIcon={<AddCircleOutlineIcon />} disabled={loaded && !isSetad} onClick={() => setEditing(emptyDraft())}>
              گزارش جدید
            </Button>
          </Stack>
        }
      />

      {loaded && !isSetad && <Alert severity="info" sx={{ mb: 2 }}>تعریف و تغییر گزارش ذخیره‌شده فقط برای کاربر ستاد مرکزی یا نقشی که این قابلیت را دارد ممکن است.</Alert>}
      {list.error != null && <ErrorBanner error={list.error} />}
      {toggle.error != null && <ErrorBanner error={toggle.error} />}

      {list.data && list.data.length === 0 && (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="body1" sx={{ mb: 1 }}>هنوز گزارشی ذخیره نشده است.</Typography>
          <Typography variant="body2" color="text.secondary">مثلاً «هزینهٔ دارو به تفکیک مرکز»: ماتریسی، ردیف = تفصیلی مرکز، ستون = معین‌های دارو.</Typography>
        </Card>
      )}

      <Grid container spacing={1.5}>
        {(list.data ?? []).map((r) => (
          <Grid key={r.id} size={{ xs: 12, md: 6, lg: 4 }}>
            <Card variant="outlined" sx={{ p: 2, height: '100%', borderRadius: 3, opacity: r.isActive ? 1 : 0.6 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 0.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{r.title}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ direction: 'ltr', display: 'inline-block' }}>{r.code}</Typography>
                </Box>
                <Switch checked={r.isActive} disabled={!isSetad || toggle.isPending} onChange={(e) => toggle.mutate({ id: r.id, isActive: e.target.checked })} />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{r.description}</Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Chip size="small" variant="outlined" label={kindSpec(r.reportKind)?.title ?? r.reportKind} />
                <Box sx={{ flex: 1 }} />
                <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(fromDto(r))}>{isSetad ? 'ویرایش' : 'مشاهده'}</Button>
              </Stack>
            </Card>
          </Grid>
        ))}
      </Grid>

      {editing && (
        <SavedReportEditor
          draft={editing}
          readOnly={loaded && !isSetad}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: ['saved-report-definitions'] });
            await queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
          }}
        />
      )}
    </Box>
  );
}

function SavedReportEditor({ draft: initial, readOnly, onClose, onSaved }: {
  draft: Draft;
  readOnly: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { financialYear } = useSession();
  const [d, setD] = useState<Draft>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<unknown>(null);
  const vahedTypes = useQuery({ queryKey: ['vahed-types'], queryFn: () => vahedTypesApi.list(), staleTime: 300_000 });
  const spec = kindSpec(d.reportKind)!;

  function changeKind(kind: ReportKind) {
    const next = emptyDraft(kind);
    setD({ ...next, id: d.id, code: d.code, title: d.title, description: d.description, keywords: d.keywords, allowedVahedTypes: d.allowedVahedTypes });
  }

  async function save() {
    setBusy(true);
    setRequestError(null);
    try {
      const payload = {
        code: d.code.trim().toUpperCase(),
        title: d.title.trim(),
        description: d.description.trim() || null,
        keywords: d.keywords.trim() || null,
        reportKind: d.reportKind,
        // مقدار پرسیدنی هم ذخیره می‌شود: پیش‌فرض همان سؤال است.
        settingsJson: JSON.stringify({ fixed: d.values, ask: d.ask }),
        allowedVahedTypes: d.allowedVahedTypes,
      };
      const r = d.id ? await savedReportsApi.update(d.id, payload) : await savedReportsApi.create(payload);
      if (!r.success) setErrors(r.errors);
      else onSaved();
    } catch (e) {
      setRequestError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{d.id ? `گزارش «${initial.title}»` : 'گزارش ذخیره‌شدهٔ جدید'}</DialogTitle>
      <DialogContent>
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <TextField label="عنوان (همان که کاربر می‌بیند)" fullWidth value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })}
              placeholder="مثلاً: هزینهٔ دارو به تفکیک مرکز" />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField label="کد لاتین" fullWidth value={d.code} slotProps={{ htmlInput: { dir: 'ltr' } }}
              onChange={(e) => setD({ ...d, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="DRUG_COST_BY_CENTER" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="گزارش پایه" fullWidth value={d.reportKind} onChange={(e) => changeKind(e.target.value as ReportKind)}>
              {REPORT_KINDS.map((k) => <MenuItem key={k.kind} value={k.kind}>{k.title}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              select label="برای کدام نوع واحدها؟" fullWidth value={d.allowedVahedTypes}
              onChange={(e) => {
                const v = e.target.value as unknown as string[] | string;
                setD({ ...d, allowedVahedTypes: typeof v === 'string' ? v.split(',').filter(Boolean) : v });
              }}
              slotProps={{
                select: {
                  multiple: true, displayEmpty: true,
                  renderValue: (s) => ((s as string[]).length === 0 ? <em>همهٔ واحدها</em> : (s as string[]).map((c) => vahedTypes.data?.find((t) => t.typeCode === c)?.typeName ?? c).join('، ')),
                },
                inputLabel: { shrink: true },
              }}
            >
              {(vahedTypes.data ?? []).filter((t) => t.typeCode).map((t) => <MenuItem key={t.typeCode!} value={t.typeCode!}>{t.typeName ?? t.typeCode}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField label="توضیح" fullWidth multiline minRows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          </Grid>
          <Grid size={12}>
            <TextField label="کلمات کلیدی و جمله‌های نمونه (هر خط یکی)" fullWidth multiline minRows={2} value={d.keywords}
              onChange={(e) => setD({ ...d, keywords: e.target.value })} placeholder={'هزینه دارو\nدارو به تفکیک مرکز'} />
          </Grid>
        </Grid>

        <Typography variant="body2" sx={{ fontWeight: 700, mt: 2.5, mb: 1 }}>تنظیمات گزارش</Typography>
        <Stack spacing={1.5}>
          {spec.params.map((p) => (
            <Paper key={p.key} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{p.title}</Typography>
                <FormControlLabel
                  control={<Checkbox size="small" checked={d.ask.includes(p.key)}
                    onChange={(e) => setD({ ...d, ask: e.target.checked ? [...d.ask, p.key] : d.ask.filter((k) => k !== p.key) })} />}
                  label={<Typography variant="caption">هر بار از کاربر بپرس</Typography>}
                />
              </Stack>
              <ParamInput spec={p} value={d.values[p.key] ?? ''} financialYear={financialYear}
                onChange={(v) => setD({ ...d, values: { ...d.values, [p.key]: v } })} />
              {d.ask.includes(p.key) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>این مقدار فقط پیشنهاد اولیهٔ سؤال است.</Typography>
              )}
            </Paper>
          ))}
        </Stack>

        {errors.length > 0 && <Alert severity="error" sx={{ mt: 2 }}>{errors.map((e) => <Box key={e}>• {e}</Box>)}</Alert>}
        {requestError != null && <Box sx={{ mt: 2 }}><ErrorBanner error={requestError} /></Box>}
      </DialogContent>
      <DialogActions>
        <Button startIcon={<OpenInNewOutlinedIcon />}
          onClick={() => window.open(buildReportUrl(d.reportKind, d.values, financialYear, d.title || undefined), '_blank')}>
          امتحان (باز کردن گزارش)
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>بستن</Button>
        <Button variant="contained" disabled={busy || readOnly} onClick={save}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</Button>
      </DialogActions>
    </Dialog>
  );
}
