import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { toPersianDigits } from '../../../lib/format/numbers';
import { FS_PAIR_STATUS, type FsElimPairDto, type FsElimPairLineDto } from '../../../types/fsConsolidation';
import { fsConsolidationApi } from '../api';
import { formatAmount } from '../FsStatementSheet';

const fa = (v: number | string) => toPersianDigits(String(v));
const unitLabel = (code: string | null, name: string | null) => (code ? `${name ?? ''} (${fa(code)})` : '—');
const date8 = (d: string | null) => (d && d.length === 8 ? fa(`${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}`) : (d ?? ''));

type Scope = 'all' | 'root' | 'between';

/** ردیف‌های سند پشت یک جفت — دو سو کنار هم، با منبع تشخیص طرف مقابل. */
function PairLinesDialog({ runId, pair, unitDivisor, onClose }: { runId: string; pair: FsElimPairDto; unitDivisor: number; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['fs-elim-pair-lines', runId, pair.ruleCode, pair.unitA, pair.unitB],
    queryFn: () => fsConsolidationApi.elimPairLines(runId, pair.ruleCode, pair.unitA, pair.unitB),
  });
  const columns: DataTableColumn<FsElimPairLineDto & { key: string }>[] = [
    { key: 'u', header: 'واحد', render: (l) => fa(l.vahedCode) },
    { key: 'n', header: 'سند', render: (l) => fa(l.docNum ?? '') },
    { key: 'd', header: 'تاریخ', render: (l) => date8(l.dateDoc) },
    { key: 'a', header: 'معین', render: (l) => fa(l.accCode) },
    { key: 's', header: 'شناسه', render: (l) => fa(l.attributeValue ?? '') },
    {
      key: 'src',
      header: 'طرف مقابل از',
      render: (l) => (l.source === 'A' ? 'شناسه' : l.source === 'E' ? 'اعلامیه' : '—'),
    },
    { key: 'desc', header: 'شرح', render: (l) => l.lineDesc ?? '' },
    { key: 'bd', header: 'بدهکار', align: 'end', render: (l) => formatAmount(l.debtor, unitDivisor) },
    { key: 'bs', header: 'بستانکار', align: 'end', render: (l) => formatAmount(l.creditor, unitDivisor) },
    {
      key: 'open',
      header: '',
      render: (l) => (
        <IconButton size="small" component="a" href={`/operation/vouchers/${l.voucherHeadId}/view`} target="_blank" rel="noopener" aria-label="مشاهدهٔ سند">
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];
  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {pair.ruleTitle}: {unitLabel(pair.unitA, pair.nameA)} ↔ {pair.unitB ? unitLabel(pair.unitB, pair.nameB) : 'طرف مقابل نامعلوم'}
      </DialogTitle>
      <DialogContent>
        {pair.status === 5 && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            این ردیف‌ها نه شناسه‌ای دارند که با کد واحد شروع شود و نه به اعلامیه‌ای وصل‌اند؛ برای تطبیق، شناسهٔ ردیف را اصلاح کنید.
          </Alert>
        )}
        {query.isLoading && <LinearProgress />}
        {query.isError && <ErrorBanner error={query.error} />}
        {query.data && (
          <>
            <DataTable
              columns={columns}
              rows={query.data.map((l, i) => ({ ...l, key: `${l.voucherHeadId}-${i}` }))}
              getRowKey={(l) => l.key}
              emptyMessage="ردیفی نیست."
            />
            {query.data.length >= 1000 && (
              <Typography variant="caption" color="text.secondary">
                فقط ۱۰۰۰ ردیف اول هر سو نمایش داده شد.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * تطبیق حساب‌های فی‌مابین به تفکیک جفت واحد (سند منبع: «تلفیق و حذف فی‌مابین»): کاشی خلاصه، زبانه‌های دامنه، فیلتر
 * قاعده/وضعیت و «بررسی» هر جفت. طرف مقابل = ۴ رقم اول شناسهٔ ردیف یا اعلامیهٔ سند.
 */
export function FsElimPairsPanel({ runId, unitDivisor }: { runId: string; unitDivisor: number }) {
  const query = useQuery({ queryKey: ['fs-elim-pairs', runId], queryFn: () => fsConsolidationApi.elimPairs(runId) });
  const [scope, setScope] = useState<Scope>('all');
  const [status, setStatus] = useState<number | null>(null);
  const [rule, setRule] = useState('');
  const [open, setOpen] = useState<FsElimPairDto | null>(null);

  const pairs = useMemo(() => query.data?.pairs ?? [], [query.data]);
  const rules = useMemo(() => [...new Map(pairs.map((p) => [p.ruleCode, p.ruleTitle])).entries()], [pairs]);
  const inScope = pairs.filter((p) => (scope === 'all' ? true : scope === 'root' ? p.withRoot : !p.withRoot)).filter((p) => !rule || p.ruleCode === rule);
  const shown = inScope.filter((p) => status === null || p.status === status);
  const count = (s: number) => inScope.filter((p) => p.status === s).length;

  if (query.isLoading) return <LinearProgress />;
  if (query.isError) return <ErrorBanner error={query.error} />;
  if (!query.data?.available) {
    return query.data?.message ? (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {query.data.message}
        </Typography>
      </Paper>
    ) : null;
  }

  const tiles: [number, string][] = [
    [1, 'تطبیق‌شده'],
    [2, 'اختلاف در آستانهٔ مجاز'],
    [3, 'اختلاف'],
    [4, 'بدون طرف مقابل'],
    [5, 'طرف مقابل نامعلوم'],
  ];

  const columns: DataTableColumn<FsElimPairDto>[] = [
    ...(rules.length > 1 ? [{ key: 'r', header: 'قاعده', render: (p: FsElimPairDto) => p.ruleTitle }] : []),
    { key: 'a', header: 'واحد الف', render: (p) => unitLabel(p.unitA, p.nameA) },
    { key: 'b', header: 'واحد ب', render: (p) => (p.unitB ? unitLabel(p.unitB, p.nameB) : <em>نامعلوم</em>) },
    { key: 'ma', header: 'ماندهٔ الف', align: 'end', render: (p) => formatAmount(p.amountA, unitDivisor) },
    { key: 'mb', header: 'ماندهٔ ب', align: 'end', render: (p) => (p.unitB ? formatAmount(p.amountB, unitDivisor) : '') },
    {
      key: 'd',
      header: 'اختلاف',
      align: 'end',
      render: (p) => (
        <Box component="span" sx={{ color: p.status === 3 ? 'error.main' : undefined, fontWeight: p.status === 3 ? 700 : 400 }}>
          {formatAmount(p.difference, unitDivisor)}
        </Box>
      ),
    },
    { key: 's', header: 'وضعیت', render: (p) => <Chip size="small" color={FS_PAIR_STATUS[p.status]?.color} label={FS_PAIR_STATUS[p.status]?.label} /> },
    {
      key: 'x',
      header: '',
      render: (p) => (
        <Button size="small" variant={p.status === 1 ? 'text' : 'outlined'} onClick={() => setOpen(p)}>
          {p.status === 1 ? 'ریز' : 'بررسی'}
        </Button>
      ),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        تطبیق حساب‌های فی‌مابین به تفکیک واحد
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        طرف مقابل هر ردیف از ۴ رقم اول شناسهٔ ردیف (حساب شناسه‌دار) یا از اعلامیهٔ سند تشخیص داده می‌شود.
        {query.data.tolerance != null && ` آستانهٔ مجاز: ${formatAmount(query.data.tolerance, 1)} ریال.`}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
        {tiles.map(([s, label]) => (
          <Chip
            key={s}
            clickable
            color={FS_PAIR_STATUS[s].color}
            variant={status === s ? 'filled' : 'outlined'}
            label={`${label}: ${fa(count(s))} ${s === 5 ? 'مورد' : 'جفت'}`}
            onClick={() => setStatus(status === s ? null : s)}
          />
        ))}
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
        <Tabs value={scope} onChange={(_e, v: Scope) => setScope(v)} sx={{ flex: 1, minHeight: 36 }}>
          <Tab value="all" label="همه" sx={{ minHeight: 36 }} />
          <Tab value="root" label="واحد اصلی ↔ زیرواحدها" sx={{ minHeight: 36 }} />
          <Tab value="between" label="بین زیرواحدها" sx={{ minHeight: 36 }} />
        </Tabs>
        {rules.length > 1 && (
          <TextField select size="small" label="قاعده" value={rule} onChange={(e) => setRule(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="">همهٔ قاعده‌ها</MenuItem>
            {rules.map(([code, title]) => (
              <MenuItem key={code} value={code}>
                {title}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <DataTable
          columns={columns}
          rows={shown}
          getRowKey={(p) => `${p.ruleCode}|${p.unitA}|${p.unitB ?? ''}`}
          emptyMessage="جفتی با این فیلتر نیست."
        />
      </Box>
      {open && <PairLinesDialog runId={runId} pair={open} unitDivisor={unitDivisor} onClose={() => setOpen(null)} />}
    </Paper>
  );
}
