import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import GlobalStyles from '@mui/material/GlobalStyles';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toPersianDigits } from '../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, labelOf } from '../../types/fsTemplate';
import { FS_RUN_ACTION, FS_RUN_STATE, FS_RUN_STATE_META, PERSIAN_MONTHS, describePeriod } from '../../types/fsRun';
import { fsNarrativesApi, fsRunsApi } from './api';
import { AMOUNT_UNITS, FsStatementSheet } from './FsStatementSheet';
import { NarrativeContent } from './narratives/NarrativeContent';

const pageBreak = { breakBefore: 'page' as const, pageBreakBefore: 'always' as const };

/**
 * ح-۷ — بستهٔ رسمی صورت‌های مالی برای چاپ و «ذخیره به‌صورت PDF» مرورگر (سند منبع §۱۲-۳ «چاپ و خروجی» و §۱۶؛
 * تصمیم صاحب پروژه به‌جای QuestPDF): صفحهٔ عنوان، فهرست، صورت‌ها هر کدام در صفحهٔ جدا، یادداشت‌ها (متنی و عددی)،
 * جایگاه امضا، واترمارک «پیش‌نویس» برای اجرای منتشرنشده و شناسهٔ اجرا و اثر انگشت در پاورقی هر صفحه.
 */
export function FsRunPrintPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [divisor, setDivisor] = useState(1_000_000);
  const [cover, setCover] = useState(true);
  const [toc, setToc] = useState(true);
  const [withNotes, setWithNotes] = useState(true);
  const [signatures, setSignatures] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const runQuery = useQuery({ queryKey: ['fs-run', id], queryFn: () => fsRunsApi.get(id), enabled: !!id });
  const narrativesQuery = useQuery({ queryKey: ['fs-run-narratives', id], queryFn: () => fsNarrativesApi.forRun(id), enabled: !!id });
  const detail = runQuery.data;
  const run = detail?.run;
  const narratives = useMemo(() => narrativesQuery.data ?? [], [narrativesQuery.data]);

  const statements = useMemo(() => detail?.statements.filter((s) => !s.isNote) ?? [], [detail]);
  const notes = useMemo(() => detail?.statements.filter((s) => s.isNote) ?? [], [detail]);
  const noteCodes = useMemo(() => new Set(notes.map((n) => n.templateCode.toUpperCase())), [notes]);
  const standalone = narratives.filter((n) => !n.linkedTemplateCode || !noteCodes.has(n.linkedTemplateCode.toUpperCase()));
  const printed = statements.filter((s) => !excluded.has(s.id));
  const hasNotes = withNotes && (notes.length > 0 || narratives.length > 0);

  if (runQuery.isError) return <ErrorBanner error={runQuery.error} />;
  if (!detail || !run) return <Skeleton variant="rounded" height={480} />;

  const unitLabel = AMOUNT_UNITS.find((u) => u.value === divisor)?.label ?? 'ریال';
  const monthName = PERSIAN_MONTHS[run.toMonth - 1];
  const periodLabel = (y: string) => `${run.toMonth !== 12 ? `${monthName} ` : ''}${toPersianDigits(y)}`;
  const priorLabel = run.hasPrior ? periodLabel(String(Number(run.year) - 1)) + (run.priorRestated ? ' (تجدید ارائه‌شده)' : '') : null;
  const isDraft = run.state !== FS_RUN_STATE.Published;
  const org = run.vahedName ?? run.vahedCode;
  const hash = detail.contentHash?.slice(0, 16) ?? '';

  // جایگاه امضا: تهیه‌کننده، مراحل گردش (یا تأییدکنندهٔ ساده) و منتشرکننده — با نام کاربری کسی که اقدام کرد.
  const lastBy = (action: number) => [...detail.actions].reverse().find((a) => a.action === action)?.userId ?? null;
  const signers: { role: string; user: string | null }[] = [
    { role: 'تهیه‌کننده', user: run.addUserId },
    ...((detail.approvalSteps ?? []).length > 0
      ? (detail.approvalSteps ?? []).map((s) => ({ role: s.titleFa, user: s.approvedBy }))
      : [{ role: 'تأییدکننده', user: lastBy(FS_RUN_ACTION.Approve) }]),
    { role: 'منتشرکننده', user: lastBy(FS_RUN_ACTION.Publish) },
  ];

  const sheetProps = {
    orgName: org,
    periodLine: describePeriod(run.year, run.toMonth, toPersianDigits),
    currentLabel: periodLabel(run.year),
    priorLabel,
    unitDivisor: divisor,
    unitLabel,
    showChange: false,
    isTrial: run.usesDraft,
  };

  return (
    <Box>
      <GlobalStyles
        styles={{
          '@page': { size: 'A4', margin: '16mm 14mm 20mm' },
          '@media print': { body: { background: '#fff' }, '.fs-print-sheet .MuiPaper-root': { border: 0, boxShadow: 'none' } },
        }}
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, displayPrint: 'none' }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate(`/fs/runs/${id}`)}>
            بازگشت به صورت
          </Button>
          <TextField select size="small" label="واحد مبلغ" value={divisor} onChange={(e) => setDivisor(Number(e.target.value))} sx={{ minWidth: 150 }}>
            {AMOUNT_UNITS.map((u) => (
              <MenuItem key={u.value} value={u.value}>
                {u.label}
              </MenuItem>
            ))}
          </TextField>
          <FormControlLabel control={<Checkbox checked={cover} onChange={(e) => setCover(e.target.checked)} />} label="صفحهٔ عنوان" />
          <FormControlLabel control={<Checkbox checked={toc} onChange={(e) => setToc(e.target.checked)} />} label="فهرست" />
          <FormControlLabel control={<Checkbox checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} />} label="یادداشت‌ها" />
          <FormControlLabel control={<Checkbox checked={signatures} onChange={(e) => setSignatures(e.target.checked)} />} label="جایگاه امضا" />
          <Button variant="contained" startIcon={<PictureAsPdfOutlinedIcon />} sx={{ mr: 'auto' }} onClick={() => window.print()}>
            چاپ / ذخیرهٔ PDF
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            صورت‌ها:
          </Typography>
          {statements.map((s) => (
            <FormControlLabel
              key={s.id}
              control={
                <Checkbox
                  size="small"
                  checked={!excluded.has(s.id)}
                  onChange={(e) =>
                    setExcluded((x) => {
                      const next = new Set(x);
                      if (e.target.checked) next.delete(s.id);
                      else next.add(s.id);
                      return next;
                    })
                  }
                />
              }
              label={s.titleFa}
            />
          ))}
        </Stack>
        <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
          در پنجرهٔ چاپ، مقصد «ذخیره به‌صورت PDF» را انتخاب کنید. برای حذف سربرگ و تاریخ مرورگر، گزینهٔ «Headers and footers» را خاموش کنید.
        </Alert>
      </Paper>

      {isDraft && (
        <Typography
          aria-hidden
          sx={{
            display: 'none',
            '@media print': { display: 'block' },
            position: 'fixed',
            top: '42%',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 110,
            fontWeight: 800,
            color: '#000',
            opacity: 0.06,
            transform: 'rotate(-25deg)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          پیش‌نویس
        </Typography>
      )}

      <Box
        sx={{
          display: 'none',
          '@media print': { display: 'flex' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          justifyContent: 'space-between',
          fontSize: 9,
          color: '#555',
          borderTop: '0.5px solid #999',
          pt: 0.5,
          bgcolor: '#fff',
        }}
      >
        <span>
          {org} — {labelOf(FS_FRAMEWORK_OPTIONS, run.framework)} — اجرای شمارهٔ {toPersianDigits(run.runNo)} ({FS_RUN_STATE_META[run.state]?.label})
        </span>
        <span dir="ltr">{hash ? `SHA-256 ${hash}` : ''}</span>
      </Box>

      <Box className="fs-print-sheet" sx={{ position: 'relative', zIndex: 1 }}>
        {cover && (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', py: 8, '@media print': { minHeight: '240mm' } }}>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
              {org}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              صورت‌های مالی
            </Typography>
            <Typography variant="subtitle1">{labelOf(FS_FRAMEWORK_OPTIONS, run.framework)}</Typography>
            <Typography variant="subtitle1" sx={{ mb: 4 }}>
              {describePeriod(run.year, run.toMonth, toPersianDigits)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {run.includeSubUnits ? `صورت‌های ترکیبی (${toPersianDigits(run.unitCount)} واحد)` : 'صورت‌های جداگانه'} · مبالغ به {unitLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              اجرای شمارهٔ {toPersianDigits(run.runNo)} · {FS_RUN_STATE_META[run.state]?.label}
              {isDraft ? ' · این نسخه منتشرنشده است' : ''}
            </Typography>
          </Box>
        )}

        {toc && (
          <Box sx={{ ...(cover ? pageBreak : {}), py: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, textAlign: 'center' }}>
              فهرست
            </Typography>
            <Box component="ol" sx={{ pr: 4, lineHeight: 2.2 }}>
              {printed.map((s) => (
                <li key={s.id}>{s.titleFa}</li>
              ))}
              {hasNotes && <li>یادداشت‌های توضیحی</li>}
            </Box>
          </Box>
        )}

        {printed.map((s, i) => (
          <Box key={s.id} sx={cover || toc || i > 0 ? pageBreak : undefined}>
            <FsStatementSheet statement={s} {...sheetProps} />
          </Box>
        ))}

        {hasNotes && (
          <Box sx={pageBreak}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, textAlign: 'center' }}>
              یادداشت‌های توضیحی صورت‌های مالی
            </Typography>
            {standalone.map((x, i) => (
              <Box key={x.id} sx={{ mb: 3, breakInside: 'avoid-page' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  {toPersianDigits(i + 1)}. {x.titleFa}
                </Typography>
                <NarrativeContent contentJson={x.contentJson} statements={detail.statements} linkedTemplateCode={x.linkedTemplateCode} divisor={divisor} />
              </Box>
            ))}
            {notes.map((n) => (
              <Box key={n.id} sx={{ mb: 3 }}>
                <FsStatementSheet statement={n} {...sheetProps} periodLine="" variant="note" />
                {narratives
                  .filter((x) => x.linkedTemplateCode?.toUpperCase() === n.templateCode.toUpperCase())
                  .map((x) => (
                    <Box key={x.id} sx={{ px: { xs: 2, sm: 4 }, mt: 1 }}>
                      <NarrativeContent contentJson={x.contentJson} statements={detail.statements} linkedTemplateCode={x.linkedTemplateCode} divisor={divisor} />
                    </Box>
                  ))}
              </Box>
            ))}
          </Box>
        )}

        {signatures && (
          <Box sx={{ mt: 6, breakInside: 'avoid-page' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              امضاها
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: `repeat(${Math.min(signers.length, 4)}, 1fr)` }, gap: 2 }}>
              {signers.map((s, i) => (
                <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, minHeight: 110, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {s.role}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.user ?? '—'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
