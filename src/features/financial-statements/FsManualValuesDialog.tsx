import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { normalizeNumericInput, toPersianDigits } from '../../lib/format/numbers';
import { FS_ROW_TYPE } from '../../types/fsTemplate';
import type { FsManualValueInput, FsRunDetailDto } from '../../types/fsRun';

interface Props {
  detail: FsRunDetailDto;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (values: FsManualValueInput[]) => void;
}

interface Draft {
  templateCode: string;
  rowCode: string;
  label: string;
  cur: string;
  prv: string;
  reason: string;
}

const toText = (v: number | null) => (v === null ? '' : String(Math.round(v)));

/**
 * ورود مقادیر ردیف‌های «مقدار دستی» (بخش ۴۵-ه) — به ریال و علامت نمایشی (همان که روی صورت دیده می‌شود)،
 * هر ردیف با دلیل. Snapshot تغییرناپذیر است، پس ذخیره یک اجرای تازه با همین تنظیمات می‌سازد و این اجرا
 * «جایگزین‌شده» می‌شود.
 */
export function FsManualValuesDialog({ detail, pending, error, onClose, onSubmit }: Props) {
  const existing = useMemo(
    () => new Map(detail.manualValues.map((m) => [`${m.templateCode}/${m.rowCode}`, m])),
    [detail.manualValues],
  );

  const [rows, setRows] = useState<Draft[]>(() =>
    detail.statements.flatMap((s) =>
      s.rows
        .filter((r) => r.rowType === FS_ROW_TYPE.External)
        .map((r) => {
          const m = existing.get(`${s.templateCode}/${r.code}`);
          return {
            templateCode: s.templateCode,
            rowCode: r.code,
            label: `${s.isNote && s.noteNo ? `یادداشت ${toPersianDigits(s.noteNo)} — ` : ''}${s.titleFa} / ${r.titleFa ?? r.code}`,
            cur: m ? toText(m.amountCur) : '',
            prv: m ? toText(m.amountPrv) : '',
            reason: m?.reason ?? '',
          };
        }),
    ),
  );

  const filled = rows.filter((r) => r.cur !== '' || r.prv !== '');
  const missingReason = filled.some((r) => !r.reason.trim());

  const update = (i: number, patch: Partial<Draft>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>ورود مقادیر دستی</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          مبالغ به <b>ریال</b> و با همان علامتی که روی صورت نمایش داده می‌شود (منفی = داخل پرانتز). ذخیره، صورت‌ها را با
          همین تنظیمات دوباره تهیه می‌کند و این اجرا «جایگزین‌شده» می‌شود.
        </Alert>
        {!!error && <ErrorBanner error={error} />}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ردیف</TableCell>
              <TableCell width={170}>جاری</TableCell>
              {detail.run.hasPrior && <TableCell width={170}>سال قبل</TableCell>}
              <TableCell>دلیل / سند پشتیبان</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={`${r.templateCode}-${r.rowCode}`}>
                <TableCell>
                  <Typography variant="body2">{r.label}</Typography>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={r.cur}
                    onChange={(e) => update(i, { cur: normalizeNumericInput(e.target.value) })}
                    slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
                  />
                </TableCell>
                {detail.run.hasPrior && (
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      value={r.prv}
                      onChange={(e) => update(i, { prv: normalizeNumericInput(e.target.value) })}
                      slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric' } }}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    value={r.reason}
                    error={(r.cur !== '' || r.prv !== '') && !r.reason.trim()}
                    onChange={(e) => update(i, { reason: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          انصراف
        </Button>
        <Button
          variant="contained"
          disabled={pending || missingReason}
          onClick={() =>
            onSubmit(
              filled.map((r) => ({
                templateCode: r.templateCode,
                rowCode: r.rowCode,
                amountCur: r.cur === '' ? null : Number(r.cur),
                amountPrv: r.prv === '' ? null : Number(r.prv),
                reason: r.reason.trim(),
              })),
            )
          }
        >
          {pending ? 'در حال تهیهٔ دوباره…' : 'ذخیره و تهیهٔ دوباره'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
