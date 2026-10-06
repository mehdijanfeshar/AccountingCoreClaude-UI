import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { JalaliDateField } from '../../../components/JalaliDateField';
import { useSession } from '../../../lib/session/SessionContext';
import {
  PERIOD_PRESETS,
  REPORT_KINDS,
  buildReportUrl,
  kindSpec,
  optionLabel,
  periodLabel,
  type ReportKindSpec,
  type ReportParamSpec,
} from './reportCatalog';
import { extractReportValues, rankReports, type ReportCandidate } from './reportExtract';
import { parseSettings, savedReportsApi, type SavedReportDto } from './reportsApi';

/** گزارش انتخاب‌شده: یکی از گزارش‌های پایه یا یک گزارش ذخیره‌شدهٔ ستاد. */
interface Target {
  spec: ReportKindSpec;
  saved: SavedReportDto | null;
  /** کلیدهایی که پرسیده می‌شوند (بقیه ثابت یا پیش‌فرض). */
  ask: string[];
  values: Record<string, string>;
  fromSentence: Set<string>;
}

interface Candidate extends ReportCandidate {
  spec: ReportKindSpec;
  saved: SavedReportDto | null;
}

function startTarget(spec: ReportKindSpec, saved: SavedReportDto | null, sentence: string): Target {
  const settings = saved ? parseSettings(saved.settingsJson) : null;
  const values: Record<string, string> = {};
  for (const p of spec.params) values[p.key] = settings?.fixed[p.key] ?? p.defaultValue;
  const ask = settings ? spec.params.filter((p) => settings.ask.includes(p.key)).map((p) => p.key) : spec.params.filter((p) => p.askByDefault).map((p) => p.key);
  const extracted = sentence ? extractReportValues(spec, sentence) : {};
  const fromSentence = new Set<string>();
  // از جمله فقط پارامترهای پرسیدنی پر می‌شوند؛ مقدار ثابت گزارش ذخیره‌شده عوض نمی‌شود.
  for (const [k, v] of Object.entries(extracted)) {
    if (ask.includes(k)) {
      values[k] = v;
      fromSentence.add(k);
    }
  }
  return { spec, saved, ask, values, fromSentence };
}

/**
 * گزارش با حسابیار — «چه گزارشی می‌خواهید؟». حسابیار فقط گزارش و پارامترها را انتخاب می‌کند و همان صفحهٔ
 * گزارش موجود را با آن‌ها باز می‌کند؛ عددها، دسترسی واحد، جمع‌ها و خروجی Excel همان گزارش است.
 */
export function ReportAssistantPage() {
  const navigate = useNavigate();
  const { financialYear } = useSession();
  const saved = useQuery({ queryKey: ['saved-reports'], queryFn: savedReportsApi.list, retry: false });
  const [search, setSearch] = useState('');
  const [asked, setAsked] = useState('');
  const [target, setTarget] = useState<Target | null>(null);

  const candidates = useMemo<Candidate[]>(() => [
    ...(saved.data ?? []).flatMap((r) => {
      const spec = kindSpec(r.reportKind);
      return spec ? [{
        id: r.id, title: r.title, keywords: (r.keywords ?? '').split('\n'), description: r.description ?? '', specific: true, spec, saved: r,
      }] : [];
    }),
    ...REPORT_KINDS.map((spec) => ({ id: spec.kind, title: spec.title, keywords: spec.keywords, description: spec.description, specific: false, spec, saved: null })),
  ], [saved.data]);

  const ranked = asked ? rankReports(candidates, asked) : [];

  function send(e: FormEvent) {
    e.preventDefault();
    const sentence = search.trim();
    if (!sentence) return;
    setAsked(sentence);
    const r = rankReports(candidates, sentence);
    if (r.length === 1 || (r.length > 1 && r[0].score > r[1].score)) setTarget(startTarget(r[0].item.spec, r[0].item.saved, sentence));
    else setTarget(null);
  }

  function choose(c: Candidate) {
    setTarget(startTarget(c.spec, c.saved, asked));
  }

  function show() {
    if (!target) return;
    navigate(buildReportUrl(target.spec.kind, target.values, financialYear, target.saved?.title));
  }

  const savedList = candidates.filter((c) => c.saved);
  const baseList = candidates.filter((c) => !c.saved);
  const visible = asked && !target ? ranked.map((r) => r.item) : null;

  return (
    <Box>
      <PageHeader
        eyebrow="حسابیار"
        icon={<AssessmentOutlinedIcon fontSize="small" />}
        accentColor="secondary"
        title="گزارش با حسابیار"
        description="بگویید چه گزارشی می‌خواهید؛ حسابیار گزارش و بازه را انتخاب می‌کند و همان گزارش همیشگی را با جمع‌ها و خروجی Excel باز می‌کند."
        actions={<Button variant="outlined" startIcon={<BookmarkBorderOutlinedIcon />} onClick={() => navigate('/assistant/reports/manage')}>گزارش‌های ذخیره‌شده</Button>}
      />

      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2.5 }, borderRadius: 3, mb: 2.5 }}>
        <Box component="form" onSubmit={send} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="مثلاً: تراز ۶ ستونی سطح کل ماه قبل — یا — هزینه‌ها به تفکیک تفصیلی ۱ در مهر"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchOutlinedIcon fontSize="small" /></InputAdornment> } }}
          />
          <Button type="submit" variant="contained" disabled={!search.trim()} endIcon={<SendRoundedIcon sx={{ transform: 'scaleX(-1)' }} />}>بفرست</Button>
        </Box>
        {asked && !target && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {ranked.length === 0 ? `برای «${asked}» گزارشی پیدا نشد؛ یکی از گزارش‌های زیر را انتخاب کنید.` : 'این گزارش‌ها به درخواست شما نزدیک‌اند؛ یکی را انتخاب کنید:'}
          </Typography>
        )}
      </Paper>

      {saved.error != null && <Alert severity="info" sx={{ mb: 2 }}>گزارش‌های ذخیره‌شده خوانده نشد (اگر اسکریپت ۰۷۲ هنوز اجرا نشده، دلیلش همین است). گزارش‌های پایه در دسترس‌اند.</Alert>}

      {target ? (
        <ReportQuestions
          target={target}
          financialYear={financialYear}
          onChange={(key, value) => setTarget((t) => t && { ...t, values: { ...t.values, [key]: value }, fromSentence: new Set([...t.fromSentence].filter((k) => k !== key)) })}
          onShow={show}
          onCancel={() => setTarget(null)}
        />
      ) : (
        <>
          {(visible ?? savedList).length > 0 && (
            <CandidateGrid title={visible ? 'پیشنهادها' : 'گزارش‌های آماده (ستاد)'} items={visible ?? savedList} onChoose={choose} />
          )}
          {!visible && <CandidateGrid title="گزارش‌های پایه" items={baseList} onChoose={choose} />}
          {visible && visible.length === 0 && <CandidateGrid title="همهٔ گزارش‌ها" items={candidates} onChoose={choose} />}
        </>
      )}
    </Box>
  );
}

function CandidateGrid({ title, items, onChoose }: { title: string; items: Candidate[]; onChoose: (c: Candidate) => void }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      <Grid container spacing={1.5}>
        {items.map((c) => (
          <Grid key={c.id} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Card variant="outlined" sx={{ height: '100%', borderRadius: 2.5 }}>
              <CardActionArea onClick={() => onChoose(c)} sx={{ p: 1.75, height: '100%', alignItems: 'flex-start', display: 'flex', flexDirection: 'column' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{c.title}</Typography>
                  {c.saved && <Chip size="small" variant="outlined" label={c.spec.title} />}
                </Stack>
                <Typography variant="body2" color="text.secondary">{c.description || c.spec.description}</Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function ReportQuestions({ target, financialYear, onChange, onShow, onCancel }: {
  target: Target;
  financialYear: string;
  onChange: (key: string, value: string) => void;
  onShow: () => void;
  onCancel: () => void;
}) {
  const asked = target.spec.params.filter((p) => target.ask.includes(p.key));
  const fixed = target.spec.params.filter((p) => !target.ask.includes(p.key));
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.75, md: 2.5 }, borderRadius: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <AssessmentOutlinedIcon color="secondary" />
        <Typography variant="h2" component="h2" sx={{ flex: 1 }}>{target.saved?.title ?? target.spec.title}</Typography>
        {target.saved && <Chip size="small" variant="outlined" label={target.spec.title} />}
      </Stack>
      {target.saved?.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{target.saved.description}</Typography>}

      <Stack spacing={2.25}>
        {asked.map((p) => (
          <Box key={p.key}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
              {p.ask}
              {target.fromSentence.has(p.key) && <Typography component="span" variant="caption" color="secondary.main"> — از جملهٔ شما</Typography>}
            </Typography>
            <ParamInput spec={p} value={target.values[p.key] ?? ''} financialYear={financialYear} onChange={(v) => onChange(p.key, v)} />
          </Box>
        ))}
      </Stack>

      {fixed.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          {target.saved ? 'تنظیمات ثابت این گزارش' : 'پیش‌فرض‌ها (در خود گزارش قابل تغییر)'}:{' '}
          {fixed.map((p) => `${p.title}: ${p.type === 'period' ? periodLabel(target.values[p.key] ?? '', financialYear) : optionLabel(p, target.values[p.key] ?? '')}`).join(' · ')}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2.5 }}>
        <Button variant="contained" startIcon={<AssessmentOutlinedIcon />} onClick={onShow}>نمایش گزارش</Button>
        <Button color="inherit" onClick={onCancel}>انصراف</Button>
      </Stack>
    </Paper>
  );
}

/** ورودی یک پارامتر گزارش — مشترک با صفحهٔ «گزارش‌های ذخیره‌شده». */
export function ParamInput({ spec, value, financialYear, onChange }: {
  spec: ReportParamSpec;
  value: string;
  financialYear: string;
  onChange: (value: string) => void;
}) {
  const [custom, setCustom] = useState(() => /^\d{8}-\d{8}$/.test(value));
  if (spec.type === 'period') {
    const [from, to] = /^\d{8}-\d{8}$/.test(value) ? value.split('-') : ['', ''];
    return (
      <Box>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {PERIOD_PRESETS.map((p) => (
            <Chip key={p.value} label={p.label} color={!custom && value === p.value ? 'secondary' : 'default'}
              variant={!custom && value === p.value ? 'filled' : 'outlined'} onClick={() => { setCustom(false); onChange(p.value); }} />
          ))}
          <Chip label="بازهٔ دلخواه" color={custom ? 'secondary' : 'default'} variant={custom ? 'filled' : 'outlined'} onClick={() => setCustom(true)} />
        </Stack>
        {custom ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1.25 }}>
            <JalaliDateField label="از تاریخ" size="small" value={from} onChange={(v) => onChange(`${v}-${to || v}`)} />
            <JalaliDateField label="تا تاریخ" size="small" value={to} onChange={(v) => onChange(`${from || v}-${v}`)} />
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>{periodLabel(value, financialYear)}</Typography>
        )}
      </Box>
    );
  }
  if (spec.type === 'choice') {
    const options = spec.options ?? [];
    if (options.length <= 5) {
      return (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {options.map((o) => (
            <Chip key={o.value} label={o.label} color={value === o.value ? 'secondary' : 'default'}
              variant={value === o.value ? 'filled' : 'outlined'} onClick={() => onChange(o.value)} />
          ))}
        </Stack>
      );
    }
    return (
      <TextField select size="small" sx={{ minWidth: 220 }} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
      </TextField>
    );
  }
  return <TextField size="small" sx={{ minWidth: 260 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder="خالی = همه" />;
}

