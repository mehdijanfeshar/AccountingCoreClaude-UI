import { useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { toLatinDigits } from '../../lib/format/numbers';
import { FS_ROW_TYPE } from '../../types/fsTemplate';
import type { FsRunRowDto, FsRunStatementDto } from '../../types/fsRun';

export interface FsRowSearchHit {
  statement: FsRunStatementDto;
  row: FsRunRowDto;
}

interface Props {
  statements: FsRunStatementDto[];
  onPick: (hit: FsRowSearchHit) => void;
  onClose: () => void;
}

/** ح-۲ — Ctrl+K: جستجوی ردیف در همهٔ صورت‌ها و یادداشت‌های اجرا (عنوان یا کد) و پرش به آن. */
export function FsRowSearchDialog({ statements, onPick, onClose }: Props) {
  const options = useMemo(
    () =>
      statements.flatMap((s) =>
        s.rows.filter((r) => r.rowType !== FS_ROW_TYPE.Blank && (r.titleFa || r.code)).map((row) => ({ statement: s, row })),
      ),
    [statements],
  );

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ p: 2 }}>
        <Autocomplete
          openOnFocus
          autoHighlight
          options={options}
          groupBy={(o) => (o.statement.noteNo ? `یادداشت ${o.statement.noteNo}. ${o.statement.titleFa}` : o.statement.titleFa)}
          getOptionLabel={(o) => `${o.row.titleFa ?? ''} (${o.row.code})`}
          filterOptions={(opts, { inputValue }) => {
            const q = toLatinDigits(inputValue.trim()).toLowerCase();
            if (!q) return opts.slice(0, 200);
            return opts.filter((o) => (o.row.titleFa ?? '').includes(inputValue.trim()) || o.row.code.toLowerCase().includes(q)).slice(0, 200);
          }}
          onChange={(_, v) => v && onPick(v)}
          renderOption={(props, o) => (
            <li {...props} key={`${o.statement.id}-${o.row.id}`}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {o.row.titleFa || '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {o.row.code}
              </Typography>
            </li>
          )}
          renderInput={(params) => <TextField {...params} autoFocus placeholder="جستجوی ردیف در صورت‌ها و یادداشت‌ها…" />}
        />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          ↑↓ حرکت بین ردیف‌های صورت · Enter باز کردن ریز مبلغ · Esc بستن پنل · Ctrl+K همین جستجو
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
