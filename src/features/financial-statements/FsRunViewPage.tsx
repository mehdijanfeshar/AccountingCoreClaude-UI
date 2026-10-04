import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import GridOnOutlinedIcon from "@mui/icons-material/GridOnOutlined";
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toLatinDigits, toPersianDigits } from "../../lib/format/numbers";
import { DOC_LIFE_OPTIONS } from '../vouchers/api';
import { FS_FRAMEWORK_OPTIONS, labelOf } from '../../types/fsTemplate';
import { FS_RUN_STATE, PERSIAN_MONTHS, describePeriod, type FsManualValueInput, type FsRunRowDto } from "../../types/fsRun";
import { fsDrillApi, fsNarrativesApi, fsRunWorkflowApi, fsRunsApi } from "./api";
import { NarrativeContent } from "./narratives/NarrativeContent";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import Typography from "@mui/material/Typography";
import { FsCommentsDrawer, type FsCommentTarget } from "./FsCommentsDrawer";
import { FsDrillDrawer } from "./FsDrillDrawer";
import { FsRunWorkflowBar } from "./FsRunWorkflowBar";
import { FsRunChecksPanel } from "./FsRunChecksPanel";
import { FsManualValuesDialog } from "./FsManualValuesDialog";
import { FsRunDiffDialog } from "./FsRunDiffDialog";
import { AMOUNT_UNITS, FsStatementSheet, VALUE_TYPES, visibleRows } from './FsStatementSheet';
import { FsRowSearchDialog } from './FsRowSearchDialog';
import { FS_ROW_TYPE } from '../../types/fsTemplate';

/** نمایش یک اجرای تهیهٔ صورت‌ها (بخش ۴۵-ب) — از Snapshot؛ هر صورت یک زبانه. */
export function FsRunViewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(0);
  const [unitDivisor, setUnitDivisor] = useState<number>(1_000_000);
  const [showChange, setShowChange] = useState(false);

  const runQuery = useQuery({ queryKey: ['fs-run', id], queryFn: () => fsRunsApi.get(id), enabled: !!id });
  const detail = runQuery.data;
  const run = detail?.run;
  // بخش ۴۵-ج — یادداشت‌ها زبانهٔ جدای «یادداشت‌ها» دارند (زبانهٔ آخر).
  const statements = useMemo(() => detail?.statements.filter((s) => !s.isNote) ?? [], [detail]);
  const notes = useMemo(() => detail?.statements.filter((s) => s.isNote) ?? [], [detail]);
  // ح-۶ — یادداشت‌های توضیحی متنی (کپی انتشار یا متن جاری) کنار یادداشت‌های عددی.
  const narrativesQuery = useQuery({ queryKey: ['fs-run-narratives', id], queryFn: () => fsNarrativesApi.forRun(id), enabled: !!id });
  const narratives = useMemo(() => narrativesQuery.data ?? [], [narrativesQuery.data]);
  const noteCodes = useMemo(() => new Set(notes.map((n) => n.templateCode.toUpperCase())), [notes]);
  const standaloneNarratives = narratives.filter((n) => !n.linkedTemplateCode || !noteCodes.has(n.linkedTemplateCode.toUpperCase()));
  const hasNotesTab = notes.length > 0 || narratives.length > 0;
  const notesTab = statements.length;
  // بخش ۴۵-ه — زبانهٔ «کنترل‌ها» بعد از یادداشت‌ها.
  const checksTab = statements.length + (hasNotesTab ? 1 : 0);
  const statement = tab < statements.length ? statements[tab] : undefined;
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);

  useEffect(() => {
    if (tab === notesTab && pendingScroll) {
      document.getElementById(`fs-note-${pendingScroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingScroll(null);
    }
  }, [tab, notesTab, pendingScroll]);

  // بخش ۴۵-د — ردیفی که Drill-downش باز است، و دانلود Excel.
  const [drillRow, setDrillRow] = useState<FsRunRowDto | null>(null);

  // ح-۳ — نظرها روی ردیف/کنترل/اجرا.
  const commentsQuery = useQuery({ queryKey: ['fs-run-comments', id], queryFn: () => fsRunWorkflowApi.comments(id), enabled: !!id });
  const comments = useMemo(() => commentsQuery.data ?? [], [commentsQuery.data]);
  const commentCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of comments) if (c.rowId) m[c.rowId] = (m[c.rowId] ?? 0) + 1;
    return m;
  }, [comments]);
  const [commentTarget, setCommentTarget] = useState<FsCommentTarget | null>(null);
  const openRowComments = (r: FsRunRowDto) => setCommentTarget({ rowId: r.id, checkId: null, title: r.titleFa ?? r.code });

  const [excelBusy, setExcelBusy] = useState(false);
  const [wordBusy, setWordBusy] = useState(false);
  const [excelError, setExcelError] = useState<unknown>(null);

  const downloadExcel = async () => {
    if (!run) return;
    setExcelBusy(true);
    setExcelError(null);
    try {
      await fsDrillApi.downloadExcel(id, `FS-${run.runNo}.xlsx`);
    } catch (e) {
      setExcelError(e);
    } finally {
      setExcelBusy(false);
    }
  };

  // بخش ۴۵-ه — مقادیر دستی، تهیهٔ دوباره و مقایسه.
  const [manualOpen, setManualOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const regenerate = useMutation({
    mutationFn: (manualValues: FsManualValueInput[] | undefined) =>
      fsRunsApi.generate({
        framework: run!.framework,
        year: run!.year,
        toMonth: run!.toMonth,
        includeSubUnits: run!.includeSubUnits,
        minDocLife: run!.minDocLife,
        includePrior: run!.hasPrior,
        priorRestated: run!.priorRestated,
        useDraftVersions: run!.usesDraft,
        description: run!.description,
        noteStartNo: detail!.noteStartNo,
        sourceRunId: run!.state === FS_RUN_STATE.Draft ? run!.id : null,
        manualValues:
          manualValues ??
          detail!.manualValues.map((m) => ({
            templateCode: m.templateCode,
            rowCode: m.rowCode,
            amountCur: m.amountCur,
            amountPrv: m.amountPrv,
            reason: m.reason,
          })),
      }),
    onSuccess: async (newId) => {
      setManualOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["fs-runs"] });
      navigate(`/fs/runs/${newId}`);
    },
  });

  const goToNote = (noteNo: string) => {
    setPendingScroll(toLatinDigits(noteNo));
    setTab(notesTab);
  };

  // ح-۲ — تحلیل عمودی (درصد از ردیف پایه)، نمای فشرده، ناوبری صفحه‌کلید و جستجوی Ctrl+K.
  const [verticalOn, setVerticalOn] = useState(false);
  const [baseByStatement, setBaseByStatement] = useState<Record<string, string>>({});
  const [dense, setDense] = useState(false);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const valueRows = useMemo(
    () => (statement ? visibleRows(statement, unitDivisor).filter((r) => VALUE_TYPES.has(r.rowType)) : []),
    [statement, unitDivisor],
  );
  // پیش‌فرض پایه: بزرگ‌ترین مبلغ مطلق جاری بین ردیف‌های «فرمول» (معمولاً جمع دارایی‌ها یا درآمدها).
  const defaultBaseId = useMemo(() => {
    const formulas = valueRows.filter((r) => r.rowType === FS_ROW_TYPE.Formula && r.amountCur);
    const pool = formulas.length > 0 ? formulas : valueRows;
    return pool.reduce<FsRunRowDto | null>(
      (best, r) => (best === null || Math.abs(r.amountCur ?? 0) > Math.abs(best.amountCur ?? 0) ? r : best),
      null,
    )?.id ?? null;
  }, [valueRows]);
  const baseId = statement ? (baseByStatement[statement.id] ?? defaultBaseId) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      const t = e.target as HTMLElement | null;
      if (!t || t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="listbox"]')) return;
      if (drillRow || searchOpen || manualOpen || compareOpen || commentTarget || valueRows.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const i = valueRows.findIndex((r) => r.id === focusedRowId);
        const next = e.key === 'ArrowDown' ? Math.min(i + 1, valueRows.length - 1) : Math.max(i - 1, 0);
        setFocusedRowId(valueRows[i < 0 ? 0 : next].id);
      } else if (e.key === 'Enter' && focusedRowId) {
        const r = valueRows.find((x) => x.id === focusedRowId);
        if (r && r.rowType === FS_ROW_TYPE.Account && r.isDrillable) {
          e.preventDefault();
          setDrillRow(r);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [valueRows, focusedRowId, drillRow, searchOpen, manualOpen, compareOpen, commentTarget]);

  useEffect(() => {
    if (focusedRowId) document.getElementById(`fs-row-${focusedRowId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedRowId, tab]);

  const priorYear = run ? String(Number(run.year) - 1) : '';
  const monthName = run ? PERSIAN_MONTHS[run.toMonth - 1] : '';
  const periodLabel = (y: string) => `${run && run.toMonth !== 12 ? `${monthName} ` : ''}${toPersianDigits(y)}`;
  const priorLabel = run?.hasPrior ? periodLabel(priorYear) + (run.priorRestated ? ' (تجدید ارائه‌شده)' : '') : null;

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
            <Button variant="outlined" startIcon={<GridOnOutlinedIcon />} onClick={downloadExcel} disabled={!detail || excelBusy}>
              {excelBusy ? "در حال ساخت…" : "Excel"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DescriptionOutlinedIcon />}
              disabled={!detail || narratives.length + notes.length === 0 || wordBusy}
              onClick={async () => {
                if (!run) return;
                setWordBusy(true);
                setExcelError(null);
                try {
                  await fsNarrativesApi.downloadDocx(id, unitDivisor, `FS-${run.runNo}-notes.docx`);
                } catch (e) {
                  setExcelError(e);
                } finally {
                  setWordBusy(false);
                }
              }}
            >
              {wordBusy ? "در حال ساخت…" : "Word یادداشت‌ها"}
            </Button>
            <Button variant="contained" startIcon={<PictureAsPdfOutlinedIcon />} onClick={() => navigate(`/fs/runs/${id}/print`)} disabled={!detail}>
              بستهٔ رسمی / PDF
            </Button>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={!detail}>
              چاپ
            </Button>
          </Stack>
        }
      />

      {runQuery.isError && <ErrorBanner error={runQuery.error} />}
      {excelError ? <ErrorBanner error={excelError} /> : null}
      {runQuery.isLoading && <Skeleton variant="rounded" height={480} />}

      {run && detail && (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, displayPrint: 'none' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
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
                {statement && (
                  <FormControlLabel
                    control={<Switch size="small" checked={verticalOn} onChange={(e) => setVerticalOn(e.target.checked)} />}
                    label="تحلیل عمودی"
                  />
                )}
                {statement && verticalOn && (
                  <TextField
                    select
                    size="small"
                    label="ردیف پایه (۱۰۰٪)"
                    value={baseId ?? ''}
                    onChange={(e) => setBaseByStatement((m) => ({ ...m, [statement.id]: e.target.value }))}
                    sx={{ minWidth: 200, maxWidth: 260 }}
                  >
                    {valueRows.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.titleFa ?? r.code}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <FormControlLabel control={<Switch size="small" checked={dense} onChange={(e) => setDense(e.target.checked)} />} label="فشرده" />
                <Button size="small" startIcon={<SearchOutlinedIcon />} onClick={() => setSearchOpen(true)} title="Ctrl+K">
                  جستجو
                </Button>
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

          <FsRunWorkflowBar
            detail={detail}
            onChanged={() => {
              void runQuery.refetch();
              void queryClient.invalidateQueries({ queryKey: ["fs-runs"] });
            }}
            onManualValues={() => setManualOpen(true)}
            onRegenerate={() => regenerate.mutate(undefined)}
            regenerating={regenerate.isPending}
            onCompare={() => setCompareOpen(true)}
          />
          {regenerate.isError && !manualOpen && <ErrorBanner error={regenerate.error} />}

          {run.usesDraft && (
            <Alert severity="warning" sx={{ mb: 2, displayPrint: 'none' }}>
              این اجرا با قالب پیش‌نویس محاسبه شده و فقط برای امتحان قالب است.
            </Alert>
          )}

          {(statements.length > 0) && (
            <Tabs value={tab} onChange={(_, v: number) => setTab(v)} variant="scrollable" sx={{ mb: 2, displayPrint: 'none' }}>
              {statements.map((s, i) => (
                <Tab key={s.id} value={i} label={s.titleFa} />
              ))}
              {hasNotesTab && <Tab value={notesTab} label={`یادداشت‌ها (${toPersianDigits(notes.length + standaloneNarratives.length)})`} />}
              <Tab value={checksTab} label={`کنترل‌ها (${toPersianDigits(detail.checks.filter((c) => !c.passed).length)} مورد)`} />
            </Tabs>
          )}

          {tab === checksTab ? (
            <FsRunChecksPanel
              detail={detail}
              comments={comments}
              onComment={setCommentTarget}
              onChanged={() => {
                void runQuery.refetch();
                void commentsQuery.refetch();
              }}
            />
          ) : tab === notesTab && hasNotesTab ? (
            <Stack spacing={3}>
              {narratives.some((x) => !x.isSnapshot && x.state !== 3) && (
                <Alert severity="info" variant="outlined" sx={{ displayPrint: "none" }}>
                  متن بعضی یادداشت‌های توضیحی هنوز تأیید نشده است؛ متن تا انتشار صورت‌ها قابل تغییر است.
                </Alert>
              )}
              {standaloneNarratives.map((x, i) => (
                <Paper key={x.id} variant="outlined" sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2, maxWidth: 1000, mx: "auto", width: "100%" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                    {toPersianDigits(i + 1)}. {x.titleFa}
                  </Typography>
                  <NarrativeContent contentJson={x.contentJson} statements={detail.statements} linkedTemplateCode={x.linkedTemplateCode} divisor={unitDivisor} />
                </Paper>
              ))}
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
                      currentLabel={periodLabel(run.year)}
                      priorLabel={priorLabel}
                      unitDivisor={unitDivisor}
                      unitLabel={AMOUNT_UNITS.find((u) => u.value === unitDivisor)?.label ?? 'ریال'}
                      showChange={showChange}
                      isTrial={run.usesDraft}
                      dense={dense}
                      focusedRowId={focusedRowId}
                      variant="note"
                      onDrill={setDrillRow}
                      commentCounts={commentCounts}
                      onComment={openRowComments}
                    />
                    {narratives
                      .filter((x) => x.linkedTemplateCode?.toUpperCase() === n.templateCode.toUpperCase())
                      .map((x) => (
                        <Box key={x.id} sx={{ maxWidth: 1000, mx: "auto", mt: 1.5, px: { xs: 2, sm: 4 } }}>
                          <NarrativeContent contentJson={x.contentJson} statements={detail.statements} linkedTemplateCode={x.linkedTemplateCode} divisor={unitDivisor} />
                        </Box>
                      ))}
                  </Box>
                );
              })}
            </Stack>
          ) : statement ? (
            <FsStatementSheet
              statement={statement}
              orgName={run.vahedName ?? run.vahedCode}
              periodLine={describePeriod(run.year, run.toMonth, toPersianDigits)}
              currentLabel={periodLabel(run.year)}
              priorLabel={priorLabel}
              unitDivisor={unitDivisor}
              unitLabel={AMOUNT_UNITS.find((u) => u.value === unitDivisor)?.label ?? 'ریال'}
              showChange={showChange}
              isTrial={run.usesDraft}
              verticalBaseId={verticalOn ? baseId : null}
              dense={dense}
              focusedRowId={focusedRowId}
              onNoteClick={notes.length > 0 ? goToNote : undefined}
              onDrill={setDrillRow}
              commentCounts={commentCounts}
              onComment={openRowComments}
            />
          ) : (
            <Alert severity="info">این اجرا هیچ صورتی ندارد.</Alert>
          )}
        </>
      )}

      {manualOpen && detail && (
        <FsManualValuesDialog
          detail={detail}
          pending={regenerate.isPending}
          error={regenerate.error}
          onClose={() => setManualOpen(false)}
          onSubmit={(values) => regenerate.mutate(values)}
        />
      )}

      {compareOpen && run && <FsRunDiffDialog run={run} onClose={() => setCompareOpen(false)} />}

      {commentTarget && (
        <FsCommentsDrawer
          runId={id}
          target={commentTarget}
          comments={comments}
          onClose={() => setCommentTarget(null)}
          onChanged={() => void commentsQuery.refetch()}
        />
      )}

      {searchOpen && detail && (
        <FsRowSearchDialog
          statements={detail.statements}
          onClose={() => setSearchOpen(false)}
          onPick={({ statement: s, row }) => {
            setSearchOpen(false);
            setTab(s.isNote ? notesTab : statements.findIndex((x) => x.id === s.id));
            setFocusedRowId(row.id);
          }}
        />
      )}

      {drillRow && run && (
        <FsDrillDrawer
          runId={id}
          row={drillRow}
          hasPrior={run.hasPrior}
          unitDivisor={unitDivisor}
          unitLabel={AMOUNT_UNITS.find((u) => u.value === unitDivisor)?.label ?? 'ریال'}
          onClose={() => setDrillRow(null)}
        />
      )}
    </section>
  );
}
