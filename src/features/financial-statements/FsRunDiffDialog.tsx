import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { toPersianDigits } from '../../lib/format/numbers';
import { FS_RUN_STATE_META, describePeriod, type FsRunDiffRowDto, type FsRunSummaryDto } from '../../types/fsRun';
import { fsRunWorkflowApi, fsRunsApi } from './api';
import { formatAmount } from './FsStatementSheet';

interface Props {
  run: FsRunSummaryDto;
  onClose: () => void;
}

const signed = (row: FsRunDiffRowDto, v: number | null) => (v === null ? null : row.normalBalance === 2 ? -v : v);

/** مقایسهٔ ردیف‌به‌ردیف این اجرا با اجرای دیگری از همین واحد (بخش ۴۵-ه، سند منبع §۱۱ «Diff»). ریال. */
export function FsRunDiffDialog({ run, onClose }: Props) {
  const [otherId, setOtherId] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(true);

  const runsQuery = useQuery({ queryKey: ['fs-runs-for-diff', run.year], queryFn: () => fsRunsApi.list() });
  const diffQuery = useQuery({
    queryKey: ['fs-run-diff', run.id, otherId],
    queryFn: () => fsRunWorkflowApi.diff(run.id, otherId),
    enabled: !!otherId,
  });

  const rows = (diffQuery.data ?? []).filter((r) => !onlyChanged || (r.amountA ?? 0) !== (r.amountB ?? 0));

  const columns: DataTableColumn<FsRunDiffRowDto>[] = [
    { key: 'stmt', header: 'صورت', render: (r) => r.statementTitle },
    { key: 'code', header: 'ردیف', width: 70, render: (r) => <MonoCode value={r.rowCode} /> },
    { key: 'title', header: 'شرح', render: (r) => r.titleFa ?? '—' },
    { key: 'a', header: `اجرای ${toPersianDigits(run.runNo)}`, align: 'end', render: (r) => formatAmount(signed(r, r.amountA), 1) },
    { key: 'b', header: 'اجرای دیگر', align: 'end', render: (r) => formatAmount(signed(r, r.amountB), 1) },
    {
      key: 'd',
      header: 'اختلاف',
      align: 'end',
      render: (r) => formatAmount((signed(r, r.amountA) ?? 0) - (signed(r, r.amountB) ?? 0), 1),
    },
  ];

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>مقایسهٔ دو اجرا</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} sx={{ my: 1, alignItems: 'center' }}>
          <TextField select size="small" label="اجرای دیگر" value={otherId} onChange={(e) => setOtherId(e.target.value)} sx={{ minWidth: 380 }}>
            {(runsQuery.data ?? [])
              .filter((r) => r.id !== run.id && r.framework === run.framework)
              .map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {toPersianDigits(r.runNo)} — {describePeriod(r.year, r.toMonth, toPersianDigits)} — {FS_RUN_STATE_META[r.state]?.label}
                </MenuItem>
              ))}
          </TextField>
          <FormControlLabel control={<Switch checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} />} label="فقط ردیف‌های متفاوت" />
        </Stack>
        {diffQuery.isError && <ErrorBanner error={diffQuery.error} />}
        {otherId && (
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => `${r.templateCode}-${r.rowCode}`}
            isLoading={diffQuery.isLoading}
            emptyMessage="هیچ ردیفی متفاوت نیست."
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
