import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import { PageHeader } from '../../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { useSession } from '../../../lib/session/SessionContext';
import { toLatinDigits, toPersianDigits } from '../../../lib/format/numbers';
import { FS_FRAMEWORK_OPTIONS, FS_ROW_TYPE, type FsFrameworkValue } from '../../../types/fsTemplate';
import { FS_RUN_STATE, FS_RUN_STATE_META, type FsRunRowDto } from '../../../types/fsRun';
import { formatRatio, type FsRatioValueDto } from '../../../types/fsRatio';
import { fsRatiosApi, fsRunsApi } from '../api';
import { AMOUNT_UNITS, displayAmount, formatAmount } from '../FsStatementSheet';

const pct = (v: number | null) =>
  v === null || !Number.isFinite(v) ? '—' : `${v.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}٪`;

/**
 * ح-۸ — «تحلیل و مقایسهٔ دوره‌ای» (سند منبع §۱۲-۳): نسبت‌های کلیدی یک اجرا با سال قبل، روند چندسالهٔ نسبت‌ها
 * (آخرین اجرای منتشرشدهٔ هر سال)، و مقایسه و ترکیب اقلام اصلی هر صورت (جمع‌ها با سهم از ردیف پایه).
 */
export function FsAnalysisPage() {
  const navigate = useNavigate();
  const { financialYear, unitCode } = useSession();
  const [framework, setFramework] = useState<FsFrameworkValue>(1);
  const [year, setYear] = useState(financialYear || '');
  const [runId, setRunId] = useState('');
  const [statementId, setStatementId] = useState('');
  const [divisor, setDivisor] = useState(1_000_000);

  const yearValid = /^1[34]\d{2}$/.test(year);
  const runsQuery = useQuery({ queryKey: ['fs-runs', unitCode, year], queryFn: () => fsRunsApi.list(year), enabled: yearValid });
  const runs = useMemo(
    () =>
      (runsQuery.data ?? [])
        .filter((r) => r.framework === framework && r.state !== FS_RUN_STATE.Superseded)
        .sort((a, b) => (b.state === FS_RUN_STATE.Published ? 1 : 0) - (a.state === FS_RUN_STATE.Published ? 1 : 0) || b.runNo - a.runNo),
    [runsQuery.data, framework],
  );
  const effectiveRunId = runs.some((r) => r.id === runId) ? runId : (runs[0]?.id ?? '');

  const runQuery = useQuery({ queryKey: ['fs-run', effectiveRunId], queryFn: () => fsRunsApi.get(effectiveRunId), enabled: !!effectiveRunId });
  const ratiosQuery = useQuery({ queryKey: ['fs-run-ratios', effectiveRunId], queryFn: () => fsRatiosApi.forRun(effectiveRunId), enabled: !!effectiveRunId });
  const trendQuery = useQuery({
    queryKey: ['fs-ratio-trend', unitCode, framework, year],
    queryFn: () => fsRatiosApi.trend(framework, year, 5),
    enabled: yearValid,
  });

  const detail = runQuery.data;
  const statements = useMemo(() => detail?.statements.filter((s) => !s.isNote) ?? [], [detail]);
  const statement = statements.find((s) => s.id === statementId) ?? statements[0];

  // اقلام اصلی: ردیف‌های «فرمول» یا پررنگ؛ پایهٔ ترکیب = بزرگ‌ترین مبلغ مطلق جاری بین آن‌ها.
  const items = useMemo(
    () => (statement?.rows ?? []).filter((r) => (r.rowType === FS_ROW_TYPE.Formula || (r.format.bold && r.rowType !== FS_ROW_TYPE.Header)) && r.amountCur !== null),
    [statement],
  );
  const base = items.reduce((m, r) => Math.max(m, Math.abs(displayAmount(r, r.amountCur) ?? 0)), 0);

  const itemColumns: DataTableColumn<FsRunRowDto>[] = [
    { key: 't', header: 'قلم', render: (r) => <Typography variant="body2" sx={{ fontWeight: r.format.bold ? 700 : 400 }}>{r.titleFa ?? r.code}</Typography> },
    { key: 'c', header: 'جاری', align: 'end', render: (r) => formatAmount(displayAmount(r, r.amountCur), divisor) },
    { key: 'p', header: 'سال قبل', align: 'end', render: (r) => formatAmount(displayAmount(r, r.amountPrv), divisor) },
    {
      key: 'd',
      header: 'تغییر',
      align: 'end',
      render: (r) => {
        const c = displayAmount(r, r.amountCur);
        const p = displayAmount(r, r.amountPrv);
        return c === null || p === null ? '—' : formatAmount(c - p, divisor);
      },
    },
    {
      key: 'dp',
      header: 'درصد تغییر',
      align: 'end',
      render: (r) => {
        const c = displayAmount(r, r.amountCur);
        const p = displayAmount(r, r.amountPrv);
        return c === null || !p ? '—' : pct(((c - p) / Math.abs(p)) * 100);
      },
    },
    {
      key: 's',
      header: 'سهم از پایه',
      align: 'end',
      render: (r) => (base ? pct(((displayAmount(r, r.amountCur) ?? 0) / base) * 100) : '—'),
    },
  ];

  const ratioColumns: DataTableColumn<FsRatioValueDto>[] = [
    { key: 't', header: 'نسبت', render: (v) => v.titleFa },
    { key: 'c', header: 'جاری', align: 'end', render: (v) => (v.error ? <Typography variant="caption" color="error">{v.error}</Typography> : formatRatio(v.current, v.format)) },
    { key: 'p', header: 'سال قبل', align: 'end', render: (v) => formatRatio(v.prior, v.format) },
    {
      key: 'd',
      header: 'تغییر',
      align: 'end',
      render: (v) => (v.current === null || v.prior === null ? '—' : formatRatio(v.current - v.prior, v.format)),
    },
  ];

  const trend = trendQuery.data ?? [];
  const trendCodes = useMemo(() => {
    const seen = new Map<string, { title: string; format: number }>();
    for (const y of trend) for (const v of y.values) if (!seen.has(v.code)) seen.set(v.code, { title: v.titleFa, format: v.format });
    return [...seen.entries()];
  }, [trend]);

  return (
    <section>
      <PageHeader
        eyebrow="صورت‌های مالی"
        icon={<InsightsOutlinedIcon />}
        title="تحلیل و نسبت‌ها"
        description="نسبت‌های کلیدی و مقایسهٔ اقلام اصلی با سال قبل، و روند پنج‌سالهٔ نسبت‌ها از آخرین اجرای منتشرشدهٔ هر سال."
        actions={
          <Button variant="outlined" onClick={() => navigate('/fs/ratios')}>
            تعریف نسبت‌ها
          </Button>
        }
      />

      <Tabs value={framework} onChange={(_, v: FsFrameworkValue) => setFramework(v)} sx={{ mb: 2 }}>
        {FS_FRAMEWORK_OPTIONS.map((o) => (
          <Tab key={o.value} value={o.value} label={o.label} />
        ))}
      </Tabs>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <TextField
            size="small"
            label="سال مالی"
            value={toPersianDigits(year)}
            onChange={(e) => setYear(toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4))}
            sx={{ width: 110 }}
          />
          <TextField select size="small" label="اجرا" value={effectiveRunId} onChange={(e) => setRunId(e.target.value)} sx={{ minWidth: 220 }} disabled={runs.length === 0}>
            {runs.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                اجرای {toPersianDigits(r.runNo)} · {FS_RUN_STATE_META[r.state]?.label ?? ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="واحد مبلغ" value={divisor} onChange={(e) => setDivisor(Number(e.target.value))} sx={{ minWidth: 150 }}>
            {AMOUNT_UNITS.map((u) => (
              <MenuItem key={u.value} value={u.value}>
                {u.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Paper>

      {yearValid && runs.length === 0 && !runsQuery.isLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          برای این مجموعه در سال {toPersianDigits(year)} اجرایی نیست؛ اول صورت‌ها را تهیه کنید.
        </Alert>
      )}
      {(runQuery.error ?? ratiosQuery.error ?? trendQuery.error) && <ErrorBanner error={runQuery.error ?? ratiosQuery.error ?? trendQuery.error} />}

      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            نسبت‌های کلیدی
          </Typography>
          <DataTable
            columns={ratioColumns}
            rows={ratiosQuery.data ?? []}
            getRowKey={(v) => v.code}
            isLoading={ratiosQuery.isLoading && !!effectiveRunId}
            emptyMessage="نسبتی تعریف نشده — از «تعریف نسبت‌ها»، «نسبت‌های پیش‌فرض» را بزنید."
          />
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            روند نسبت‌ها
          </Typography>
          {trend.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              برای سال‌های اخیر اجرایی نیست.
            </Typography>
          ) : (
            <DataTable
              columns={[
                { key: 't', header: 'نسبت', render: ([, m]) => m.title },
                ...trend.map((y) => ({
                  key: y.year,
                  header: `${toPersianDigits(y.year)}${y.state === FS_RUN_STATE.Published ? '' : ' *'}`,
                  align: 'end' as const,
                  render: ([code, m]: [string, { title: string; format: number }]) =>
                    formatRatio(y.values.find((v) => v.code === code)?.current ?? null, m.format),
                })),
              ]}
              rows={trendCodes}
              getRowKey={([code]) => code}
            />
          )}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            * سالی که اجرای منتشرشده ندارد؛ از آخرین اجرای آن سال محاسبه شده است.
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              مقایسه و ترکیب اقلام اصلی
            </Typography>
            <TextField select size="small" label="صورت" value={statement?.id ?? ''} onChange={(e) => setStatementId(e.target.value)} sx={{ minWidth: 240 }}>
              {statements.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.titleFa}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <DataTable columns={itemColumns} rows={items} getRowKey={(r) => r.id} isLoading={runQuery.isLoading && !!effectiveRunId} emptyMessage="قلمی نیست." />
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            «سهم از پایه» = نسبت به بزرگ‌ترین جمع همین صورت (مثلاً جمع دارایی‌ها یا جمع منابع).
          </Typography>
        </Paper>
      </Stack>
    </section>
  );
}
