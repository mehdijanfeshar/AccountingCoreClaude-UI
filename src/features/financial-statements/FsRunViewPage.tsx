import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from "@mui/material/Box";
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toLatinDigits, toPersianDigits } from "../../lib/format/numbers";
import { DOC_LIFE_OPTIONS } from '../vouchers/api';
import { FS_FRAMEWORK_OPTIONS, labelOf } from '../../types/fsTemplate';
import { PERSIAN_MONTHS, describePeriod } from '../../types/fsRun';
import { fsRunsApi } from './api';
import { AMOUNT_UNITS, FsStatementSheet } from './FsStatementSheet';

/** نمایش یک اجرای تهیهٔ صورت‌ها (بخش ۴۵-ب) — از Snapshot؛ هر صورت یک زبانه. */
export function FsRunViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [unitDivisor, setUnitDivisor] = useState<number>(1_000_000);
  const [showChange, setShowChange] = useState(false);

  const runQuery = useQuery({ queryKey: ['fs-run', id], queryFn: () => fsRunsApi.get(id), enabled: !!id });
  const detail = runQuery.data;
  const run = detail?.run;
  // بخش ۴۵-ج — یادداشت‌ها زبانهٔ جدای «یادداشت‌ها» دارند (زبانهٔ آخر).
  const statements = useMemo(() => detail?.statements.filter((s) => !s.isNote) ?? [], [detail]);
  const notes = useMemo(() => detail?.statements.filter((s) => s.isNote) ?? [], [detail]);
  const notesTab = statements.length;
  const statement = tab < statements.length ? statements[tab] : undefined;
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);

  useEffect(() => {
    if (tab === notesTab && pendingScroll) {
      document.getElementById(`fs-note-${pendingScroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingScroll(null);
    }
  }, [tab, notesTab, pendingScroll]);

  const goToNote = (noteNo: string) => {
    setPendingScroll(toLatinDigits(noteNo));
    setTab(notesTab);
  };

  const priorYear = run ? String(Number(run.year) - 1) : '';
  const monthName = run ? PERSIAN_MONTHS[run.toMonth - 1] : '';

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<AssessmentOutlinedIcon />}
        title={run ? `${labelOf(FS_FRAMEWORK_OPTIONS, run.framework)} — اجرای ${toPersianDigits(run.runNo)}` : 'صورت‌های مالی'}
        description={run ? describePeriod(run.year, run.toMonth, toPersianDigits) : undefined}
        actions={
          <Stack direction="row" spacing={1}>
            <Button variant="text" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/fs/runs')}>
              اجراها
            </Button>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={!detail}>
              چاپ
            </Button>
          </Stack>
        }
      />

      {runQuery.isError && <ErrorBanner error={runQuery.error} />}
      {runQuery.isLoading && <Skeleton variant="rounded" height={480} />}

      {run && detail && (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, displayPrint: 'none' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Chip size="small" color="warning" label="پیش‌نویس" />
              {run.usesDraft && <Chip size="small" color="warning" variant="outlined" label="آزمایشی — قالب پیش‌نویس" />}
              <Chip size="small" variant="outlined" label={`${run.vahedName ?? run.vahedCode}${run.includeSubUnits ? ` · ترکیبی (${toPersianDigits(run.unitCount)} واحد)` : ' · جداگانه'}`} />
              <Chip size="small" variant="outlined" label={`اسناد از «${labelOf(DOC_LIFE_OPTIONS, run.minDocLife)}» به بالا`} />
              {detail.contentHash && (
                <Chip size="small" variant="outlined" label={`اثر انگشت ${detail.contentHash.slice(0, 8)}`} sx={{ fontFamily: 'monospace' }} />
              )}
              <Stack direction="row" spacing={1} sx={{ mr: 'auto', alignItems: 'center' }}>
                {run.hasPrior && (
                  <FormControlLabel control={<Switch size="small" checked={showChange} onChange={(e) => setShowChange(e.target.checked)} />} label="تغییرات" />
                )}
                <TextField select size="small" label="واحد مبلغ" value={unitDivisor} onChange={(e) => setUnitDivisor(Number(e.target.value))} sx={{ minWidth: 150 }}>
                  {AMOUNT_UNITS.map((u) => (
                    <MenuItem key={u.value} value={u.value}>
                      {u.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>
          </Paper>

          {run.usesDraft && (
            <Alert severity="warning" sx={{ mb: 2, displayPrint: 'none' }}>
              این اجرا با قالب پیش‌نویس محاسبه شده و فقط برای امتحان قالب است.
            </Alert>
          )}

          {(statements.length > 1 || notes.length > 0) && (
            <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="scrollable" sx={{ mb: 2, displayPrint: 'none' }}>
              {statements.map((s, i) => (
                <Tab key={s.id} value={i} label={s.titleFa} />
              ))}
              {notes.length > 0 && <Tab value={notesTab} label={`یادداشت‌ها (${toPersianDigits(notes.length)})`} />}
            </Tabs>
          )}

          {tab === notesTab && notes.length > 0 ? (
            <Stack spacing={3}>
              {notes.map((n) => {
                const parent = statements.find((s) => s.templateCode === n.parentTemplateCode);
                const diffs = [n.checkDiffCur, run.hasPrior ? n.checkDiffPrv : null].filter((d): d is number => d !== null);
                const mismatch = diffs.some((d) => d !== 0);
                return (
                  <Box key={n.id} id={`fs-note-${n.noteNo ?? ''}`} sx={{ scrollMarginTop: 80 }}>
                    <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1, displayPrint: 'none' }}>
                      {n.parentTemplateCode ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`ردیف ${n.parentRowCode} از «${parent?.titleFa ?? n.parentTemplateCode}»`}
                          onClick={parent ? () => setTab(statements.indexOf(parent)) : undefined}
                        />
                      ) : (
                        <Chip size="small" variant="outlined" color="warning" label="بدون ارتباط با صورت" />
                      )}
                      {n.parentTemplateCode && diffs.length > 0 && (
                        <Chip
                          size="small"
                          color={mismatch ? 'error' : 'success'}
                          label={
                            mismatch
                              ? `جمع یادداشت با ردیف صورت برابر نیست (اختلاف ${Math.abs(n.checkDiffCur ?? n.checkDiffPrv ?? 0).toLocaleString('fa-IR')} ریال)`
                              : 'جمع یادداشت = ردیف صورت'
                          }
                        />
                      )}
                    </Stack>
                    <FsStatementSheet
                      statement={n}
                      orgName={run.vahedName ?? run.vahedCode}
                      periodLine=""
                      currentLabel={`${run.toMonth === 12 ? '' : `${monthName} `}${toPersianDigits(run.year)}`}
                      priorLabel={run.hasPrior ? `${run.toMonth === 12 ? '' : `${monthName} `}${toPersianDigits(priorYear)}` : null}
                      unitDivisor={unitDivisor}
                      unitLabel={AMOUNT_UNITS.find((u) => u.value === unitDivisor)?.label ?? 'ریال'}
                      showChange={showChange}
                      isTrial={run.usesDraft}
                      variant="note"
                    />
                  </Box>
                );
              })}
            </Stack>
          ) : statement ? (
            <FsStatementSheet
              statement={statement}
              orgName={run.vahedName ?? run.vahedCode}
              periodLine={describePeriod(run.year, run.toMonth, toPersianDigits)}
              currentLabel={`${run.toMonth === 12 ? '' : `${monthName} `}${toPersianDigits(run.year)}`}
              priorLabel={run.hasPrior ? `${run.toMonth === 12 ? '' : `${monthName} `}${toPersianDigits(priorYear)}` : null}
              unitDivisor={unitDivisor}
              unitLabel={AMOUNT_UNITS.find((u) => u.value === unitDivisor)?.label ?? 'ریال'}
              showChange={showChange}
              isTrial={run.usesDraft}
              onNoteClick={notes.length > 0 ? goToNote : undefined}
            />
          ) : (
            <Alert severity="info">این اجرا هیچ صورتی ندارد.</Alert>
          )}
        </>
      )}
    </section>
  );
}
