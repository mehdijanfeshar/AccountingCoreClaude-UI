import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toPersianDigits } from '../../lib/format/numbers';
import {
  legacyImportApi,
  type LegacyDecisionInput,
  type LegacyImportReportDto,
  type LegacyIssueDto,
  type LegacyLookupDto,
  type LegacySectionDto,
} from './api';

const fa = (v: number | string) => toPersianDigits(String(v));

/** انتخاب کد موجود سیستم جدید (معین یا تفصیلی) با جستجو روی سرور. */
function CodePicker({
  kind,
  value,
  disabled,
  onPick,
}: {
  kind: 'moein' | 'tafsili';
  value: string | null;
  disabled: boolean;
  onPick: (code: string | null) => void;
}) {
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);
  const list = useQuery({ queryKey: ['legacy-import', 'lookup', kind, q], queryFn: () => legacyImportApi.lookup(kind, q) });
  const current: LegacyLookupDto | null = value ? (list.data?.find((x) => x.code === value) ?? { code: value, title: '' }) : null;
  return (
    <Autocomplete
      size="small"
      sx={{ minWidth: 280 }}
      options={list.data ?? []}
      value={current}
      loading={list.isLoading}
      disabled={disabled}
      filterOptions={(o) => o}
      getOptionLabel={(o) => (o.title ? `${o.code} — ${o.title}` : o.code)}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      onInputChange={(_e, v, reason) => reason === 'input' && setTyped(v)}
      onChange={(_e, v) => onPick(v?.code ?? null)}
      noOptionsText="موردی پیدا نشد"
      renderInput={(params) => <TextField {...params} label={kind === 'moein' ? 'معین جایگزین' : 'تفصیلی جایگزین'} />}
    />
  );
}

function statusChip(i: LegacyIssueDto) {
  if (i.status === 'resolved') return <Chip size="small" color="success" label="رفع شد" />;
  if (i.status === 'invalid') return <Chip size="small" color="error" label="تصمیم نامعتبر" />;
  if (i.options.length === 0) return <Chip size="small" color="error" label="باید بیرون از این صفحه اصلاح شود" />;
  return <Chip size="small" color="warning" label="منتظر تصمیم شما" />;
}

/** یک مشکل: شرح، نمونه‌ها، راهنما و گزینه‌های رفع. تصمیم بلافاصله ذخیره می‌شود و در «بررسی دوباره» اعمال. */
function IssueRow({
  issue,
  pending,
  changed,
  onDecide,
}: {
  issue: LegacyIssueDto;
  pending: boolean;
  changed: boolean;
  onDecide: (d: LegacyDecisionInput) => void;
}) {
  const [option, setOption] = useState<string>(issue.option ?? '');
  const opt = issue.options.find((o) => o.code === option);
  const decide = (code: string, value: string | null) => onDecide({ issueId: issue.id, option: code || null, value });

  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
        {statusChip(issue)}
        {changed && <Chip size="small" variant="outlined" color="info" label="در بررسی بعدی اعمال می‌شود" />}
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {issue.message}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {fa(issue.uses)} مورد استفاده{issue.samples.length > 0 && ` — مثلاً: ${issue.samples.join('، ')}`}
      </Typography>
      {issue.hint && issue.status !== 'resolved' && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
          {issue.hint}
        </Typography>
      )}
      {issue.problem && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.25 }}>
          {issue.problem}
        </Typography>
      )}
      {issue.options.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
          <TextField
            select
            size="small"
            label="تصمیم"
            value={option}
            disabled={pending}
            sx={{ minWidth: 260 }}
            onChange={(e) => {
              const code = e.target.value;
              setOption(code);
              const o = issue.options.find((x) => x.code === code);
              // گزینهٔ «جایگزینی» تا انتخاب کد ذخیره نمی‌شود
              if (!o?.picker) decide(code, null);
            }}
          >
            <MenuItem value="">
              <em>— بدون تصمیم —</em>
            </MenuItem>
            {issue.options.map((o) => (
              <MenuItem key={o.code} value={o.code}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          {opt?.picker && (
            <CodePicker
              kind={opt.picker}
              value={issue.option === opt.code ? issue.value : null}
              disabled={pending}
              onPick={(code) => code && decide(opt.code, code)}
            />
          )}
          {issue.decidedAt && (
            <Typography variant="caption" color="text.secondary">
              تصمیم: {new Date(issue.decidedAt).toLocaleString('fa-IR')}
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}

/** دکمه‌های «همین گزینه برای همهٔ موارد باز» در یک بخش — فقط گزینه‌های بدون انتخاب کد. */
function BulkActions({ issues, pending, onDecide }: { issues: LegacyIssueDto[]; pending: boolean; onDecide: (d: LegacyDecisionInput[]) => void }) {
  const open = issues.filter((i) => i.status !== 'resolved');
  const byOption = new Map<string, { label: string; ids: string[] }>();
  for (const i of open)
    for (const o of i.options.filter((x) => !x.picker)) {
      const e = byOption.get(o.code) ?? { label: o.label, ids: [] };
      e.ids.push(i.id);
      byOption.set(o.code, e);
    }
  const groups = [...byOption.entries()].filter(([, g]) => g.ids.length > 1);
  if (groups.length === 0) return null;
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
      {groups.map(([code, g]) => (
        <Button
          key={code}
          size="small"
          variant="outlined"
          disabled={pending}
          onClick={() => onDecide(g.ids.map((id) => ({ issueId: id, option: code, value: null })))}
        >
          «{g.label}» برای همهٔ {fa(g.ids.length)} مورد باز
        </Button>
      ))}
    </Stack>
  );
}

function sectionChip(s: LegacySectionDto) {
  if (s.open > 0) return <Chip size="small" color="error" label={`${fa(s.open)} مشکل باز`} />;
  if (s.resolved > 0) return <Chip size="small" color="success" label={`آماده — ${fa(s.resolved)} مورد با تصمیم شما`} />;
  return <Chip size="small" color="success" variant="outlined" label="آماده" />;
}

/**
 * نتیجهٔ بررسی انتقال یک سال به تفکیک بخش (جدول). هر مشکل گزینه‌های رفع خودش را دارد؛ تصمیم‌ها روی سرور ذخیره و در
 * «بررسی دوباره» اعمال می‌شوند. ثبت نهایی (بیرون از این جزء) فقط وقتی همهٔ بخش‌ها آماده‌اند ممکن است.
 */
export function YearSections({
  year,
  report,
  onDecided,
}: {
  year: number;
  report: LegacyImportReportDto;
  /** پس از ذخیرهٔ تصمیم؛ نتیجهٔ فعلی دیگر به‌روز نیست. */
  onDecided: () => void;
}) {
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const save = useMutation({
    mutationFn: (d: LegacyDecisionInput[]) => legacyImportApi.saveVoucherDecisions(year, d),
    onSuccess: (_r, d) => {
      setChanged((prev) => new Set([...prev, ...d.map((x) => x.issueId)]));
      onDecided();
    },
  });
  useEffect(() => setChanged(new Set()), [report]);

  const sections = report.sections ?? [];
  const issues = report.issues ?? [];
  return (
    <Box sx={{ mt: 2 }}>
      {save.isError && <ErrorBanner error={save.error} />}
      {sections.map((s) => {
        const own = issues.filter((i) => i.section === s.key);
        return (
          <Accordion key={s.key} defaultExpanded={s.open > 0} disableGutters variant="outlined">
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}>
                <Typography variant="subtitle2">{s.title}</Typography>
                {sectionChip(s)}
                {s.records > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {fa(s.records)} رکورد
                  </Typography>
                )}
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              {s.notes.map((n, i) => (
                <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {n}
                </Typography>
              ))}
              {own.length === 0 && s.notes.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  موردی برای این بخش نیست.
                </Typography>
              )}
              {own.length > 0 && (
                <>
                  <BulkActions issues={own} pending={save.isPending} onDecide={(d) => save.mutate(d)} />
                  {own.map((i) => (
                    <IssueRow
                      key={`${i.id}|${i.option ?? ''}|${i.value ?? ''}`}
                      issue={i}
                      pending={save.isPending}
                      changed={changed.has(i.id)}
                      onDecide={(d) => save.mutate([d])}
                    />
                  ))}
                </>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
      {changed.size > 0 && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {fa(changed.size)} تصمیم ذخیره شد؛ برای اعمال آن‌ها «بررسی دوباره» را بزنید.
        </Alert>
      )}
    </Box>
  );
}
