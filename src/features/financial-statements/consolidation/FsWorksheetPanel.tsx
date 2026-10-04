import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { DataTable, type DataTableColumn } from '../../../components/DataTable';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { FS_ELIM_STATUS, type FsRunElimDto, type FsWorksheetRowDto } from '../../../types/fsConsolidation';
import { fsConsolidationApi } from '../api';
import { formatAmount } from '../FsStatementSheet';

interface Props {
  runId: string;
  unitDivisor: number;
}

/**
 * ط-۳/ط-۴ — کاربرگ ترکیب/تلفیق (سند منبع §۸ و §۱۲-۳): برای هر ردیف صورت، مبلغ هر گروه (زیرواحد سطح اول، شرکت
 * تابعه)، «حذفیات» و جمع صورت؛ به‌علاوهٔ نتیجهٔ قواعد حذف فی‌مابین (V-07).
 */
export function FsWorksheetPanel({ runId, unitDivisor }: Props) {
  const query = useQuery({ queryKey: ['fs-run-worksheet', runId], queryFn: () => fsConsolidationApi.worksheet(runId) });
  const data = query.data;
  const statements = useMemo(() => [...new Map((data?.rows ?? []).map((r) => [r.templateCode, r.statementTitle])).entries()], [data]);
  const [stmt, setStmt] = useState('');
  const current = stmt || statements[0]?.[0] || '';
  const rows = (data?.rows ?? []).filter((r) => r.templateCode === current);

  const sign = (r: FsWorksheetRowDto) => (r.normalBalance === 2 ? -1 : 1);
  const show = (r: FsWorksheetRowDto, v: number | null | undefined) => (v === null || v === undefined || r.rowType === 1 || r.rowType === 6 ? '' : formatAmount(v * sign(r), unitDivisor));

  const columns: DataTableColumn<FsWorksheetRowDto>[] = [
    {
      key: 'title',
      header: 'ردیف',
      render: (r) => (
        <Typography variant="body2" sx={{ fontWeight: r.bold ? 700 : 400, whiteSpace: 'nowrap' }}>
          {r.titleFa ?? r.rowCode}
        </Typography>
      ),
    },
    ...(data?.groups ?? []).map((g) => ({
      key: g.code,
      header: g.name ?? g.code,
      align: 'end' as const,
      render: (r: FsWorksheetRowDto) => (
        <Box component="span" sx={{ color: g.kind === 3 ? 'error.main' : undefined, fontVariantNumeric: 'tabular-nums' }}>
          {show(r, r.amounts[g.code])}
        </Box>
      ),
    })),
    {
      key: 'total',
      header: 'جمع (صورت)',
      align: 'end',
      render: (r) => <strong>{show(r, r.total)}</strong>,
    },
  ];

  const elimColumns: DataTableColumn<FsRunElimDto>[] = [
    { key: 'c', header: 'قاعده', render: (e) => `${e.ruleCode} — ${e.titleFa}` },
    { key: 'l', header: 'سوی اول', align: 'end', render: (e) => formatAmount(e.left, unitDivisor) },
    { key: 'r', header: 'سوی دوم', align: 'end', render: (e) => formatAmount(e.right, unitDivisor) },
    { key: 'd', header: 'اختلاف', align: 'end', render: (e) => formatAmount(e.difference, unitDivisor) },
    { key: 's', header: 'نتیجه', render: (e) => <Chip size="small" color={FS_ELIM_STATUS[e.status]?.color} label={FS_ELIM_STATUS[e.status]?.label} /> },
  ];

  if (query.isError) return <ErrorBanner error={query.error} />;

  return (
    <Stack spacing={3}>
      {data && data.groups.length === 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            این اجرا تک‌گروهی است (صورت جداگانه بدون شرکت تابعه)؛ کاربرگ ترکیب ندارد.
          </Typography>
        </Paper>
      )}
      {data && data.eliminations.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            حذف فی‌مابین (V-07)
          </Typography>
          <DataTable columns={elimColumns} rows={data.eliminations} getRowKey={(e) => e.ruleCode} />
        </Paper>
      )}
      {data && data.groups.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              کاربرگ ترکیب / تلفیق
            </Typography>
            <TextField select size="small" label="صورت" value={current} onChange={(e) => setStmt(e.target.value)} sx={{ minWidth: 240 }}>
              {statements.map(([code, title]) => (
                <MenuItem key={code} value={code}>
                  {title}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Box sx={{ overflowX: 'auto' }}>
            <DataTable columns={columns} rows={rows} getRowKey={(r) => r.rowId} isLoading={query.isLoading} emptyMessage="ردیفی نیست." />
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
