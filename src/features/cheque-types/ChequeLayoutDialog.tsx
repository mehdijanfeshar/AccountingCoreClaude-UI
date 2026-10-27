import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { apiClient } from '../../lib/api/client';
import { toLatinDigits, toPersianDigits } from '../../lib/format/numbers';
import {
  BASE_H,
  BASE_W,
  CHEQUE_FIELDS,
  parseFontSize,
  resolveField,
  type ChequeFieldBox,
  type ChequeFieldKey,
  type ChequeFieldLayout,
} from '../cheque-book/chequeLayout';

/**
 * «جای فیلدها» — مختصات هر فیلد روی برگ چک (`TB_CHECK_TYPE.CHEQUE_<KEY>_LEFT/TOP/WIDTH/FONT`)، به میلی‌متر از
 * گوشهٔ بالا-چپ برگ؛ قلم = اندازه به pt. خانهٔ خالی = جای پیش‌فرض قالب (مقیاس‌شده با اندازهٔ برگ)، که در
 * placeholder دیده می‌شود. پیش‌نمایش روی تصویر چک همان چیدمانی است که صفحهٔ چاپ چک می‌سازد.
 *
 * ⚠️ ویرایش در بک‌اند جایگزینی کامل است: نسخهٔ فعلی خوانده و فقط ۲۴ ستون مختصات عوض می‌شود.
 */

type Part = 'Left' | 'Top' | 'Width' | 'Font';
const PARTS: { part: Part; label: string; max: number }[] = [
  { part: 'Left', label: 'از چپ', max: 9999 },
  { part: 'Top', label: 'از بالا', max: 9999 },
  { part: 'Width', label: 'پهنا', max: 9999 },
  { part: 'Font', label: 'قلم (pt)', max: 72 },
];
const SERVER_ONLY = ['id', 'vahedCode', 'createdDate', 'updatedDate', 'addUserId', 'changeUserId', 'isDeleted'];
const PX_PER_MM = 3.2;

type Values = Record<string, string>;
type DragMode = 'move' | 'resize';
interface DragState {
  key: ChequeFieldKey;
  mode: DragMode;
  startX: number;
  startY: number;
  /** جای فیلد در شروع کشیدن (mm). */
  left: number;
  top: number;
  width: number;
}
const field = (dto: string, part: Part) => `${dto}${part}`;

function readValues(dto: Record<string, unknown>): Values {
  const v: Values = {};
  for (const f of CHEQUE_FIELDS) {
    for (const { part } of PARTS) {
      const raw = dto[field(f.dto, part)];
      v[field(f.dto, part)] = part === 'Font' ? String(parseFontSize(raw as string | null) ?? '') : raw == null ? '' : String(raw);
    }
  }
  return v;
}

function errorOf(value: string, max: number): string | undefined {
  const v = toLatinDigits(value).trim();
  if (v === '') return undefined;
  if (!/^\d+$/.test(v)) return 'عدد صحیح';
  if (Number(v) > max) return `حداکثر ${toPersianDigits(max)}`;
  return undefined;
}

function toLayouts(values: Values): ChequeFieldLayout[] {
  const num = (s: string) => (toLatinDigits(s).trim() === '' ? null : Number(toLatinDigits(s).trim()));
  return CHEQUE_FIELDS.map((f) => ({
    key: f.key,
    left: num(values[field(f.dto, 'Left')]),
    top: num(values[field(f.dto, 'Top')]),
    width: num(values[field(f.dto, 'Width')]),
    font: toLatinDigits(values[field(f.dto, 'Font')]).trim() || null,
  }));
}

export function ChequeLayoutDialog({
  chequeType,
  onClose,
}: {
  chequeType: (Record<string, unknown> & { id: string; chequeTypeTitle: string | null }) | null;
  onClose: () => void;
}) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>({});
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    if (chequeType) setValues(readValues(chequeType));
  }, [chequeType]);

  const save = useMutation({
    mutationFn: async () => {
      const current = await apiClient.get<Record<string, unknown>>(`/cheque-types/${chequeType!.id}`).then((r) => r.data);
      const rest = Object.fromEntries(Object.entries(current).filter(([k]) => !SERVER_ONLY.includes(k)));
      const edited: Record<string, unknown> = {};
      for (const l of toLayouts(values)) {
        const dto = CHEQUE_FIELDS.find((f) => f.key === l.key)!.dto;
        edited[field(dto, 'Left')] = l.left;
        edited[field(dto, 'Top')] = l.top;
        edited[field(dto, 'Width')] = l.width;
        edited[field(dto, 'Font')] = l.font;
      }
      await apiClient.post(`/cheque-types/${chequeType!.id}/update`, { ...rest, ...edited });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['cheque-types'] });
      notify('جای فیلدهای چک ذخیره شد.');
      onClose();
    },
  });

  if (!chequeType) return null;

  const w = Number(chequeType.chequeWidth) || BASE_W;
  const h = Number(chequeType.chequeHeight) || BASE_H;
  const layouts = toLayouts(values);
  const hasErrors = CHEQUE_FIELDS.some((f) =>
    PARTS.some(({ part, max }) => errorOf(values[field(f.dto, part)] ?? '', max)),
  );
  const image = chequeType.chequeImage as string | null | undefined;

  // کشیدن فیلد روی پیش‌نمایش: جابه‌جایی (چپ/بالا) یا تغییر پهنا از لبهٔ راست — به میلی‌متر صحیح، داخل برگ.
  function startDrag(e: ReactPointerEvent, key: ChequeFieldKey, mode: DragMode, b: ChequeFieldBox) {
    e.preventDefault();
    e.stopPropagation();
    // capture روی جعبهٔ فیلد (نه دستگیرهٔ پهنا) تا move/up همان‌جا برسد.
    (mode === 'resize' ? (e.currentTarget.parentElement as HTMLElement) : (e.currentTarget as HTMLElement)).setPointerCapture(e.pointerId);
    setDrag({ key, mode, startX: e.clientX, startY: e.clientY, left: b.left, top: b.top, width: b.width });
  }

  function moveDrag(e: ReactPointerEvent) {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / PX_PER_MM;
    const dy = (e.clientY - drag.startY) / PX_PER_MM;
    const dto = CHEQUE_FIELDS.find((f) => f.key === drag.key)!.dto;
    const clamp = (v: number, lo: number, hi: number) => String(Math.round(Math.min(Math.max(v, lo), Math.max(lo, hi))));
    if (drag.mode === 'move') {
      setValues((prev) => ({
        ...prev,
        [field(dto, 'Left')]: clamp(drag.left + dx, 0, w - drag.width),
        [field(dto, 'Top')]: clamp(drag.top + dy, 0, h - 3),
        // پهنای پیش‌فرض (خالی) هم ثابت می‌شود تا با جابه‌جایی تغییر نکند.
        [field(dto, 'Width')]: prev[field(dto, 'Width')] || String(Math.round(drag.width)),
      }));
    } else {
      setValues((prev) => ({
        ...prev,
        [field(dto, 'Left')]: prev[field(dto, 'Left')] || String(Math.round(drag.left)),
        [field(dto, 'Top')]: prev[field(dto, 'Top')] || String(Math.round(drag.top)),
        [field(dto, 'Width')]: clamp(drag.width + dx, 5, w - drag.left),
      }));
    }
  }

  function endDrag() {
    setDrag(null);
  }

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>جای فیلدها روی چک — {chequeType.chequeTypeTitle ?? ''}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {save.isError && <ErrorBanner error={save.error} />}
          <Typography variant="body2" color="text.secondary">
            اعداد به میلی‌متر از گوشهٔ بالا-چپ برگ چک‌اند. خانهٔ خالی یعنی جای پیش‌فرض (عدد کم‌رنگ). اندازهٔ برگ:{' '}
            {toPersianDigits(w)}×{toPersianDigits(h)} میلی‌متر.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>فیلد</TableCell>
                {PARTS.map((p) => (
                  <TableCell key={p.part}>{p.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {CHEQUE_FIELDS.map((f) => {
                const def = resolveField(f.key, null, w, h);
                const placeholder: Record<Part, number> = {
                  Left: Math.round(def.left),
                  Top: Math.round(def.top),
                  Width: Math.round(def.width),
                  Font: def.fontSize,
                };
                return (
                  <TableRow key={f.key}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{f.label}</TableCell>
                    {PARTS.map(({ part, max }) => {
                      const name = field(f.dto, part);
                      const err = errorOf(values[name] ?? '', max);
                      return (
                        <TableCell key={part}>
                          <TextField
                            size="small"
                            value={values[name] ?? ''}
                            placeholder={toPersianDigits(placeholder[part])}
                            error={!!err}
                            helperText={err}
                            onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                            slotProps={{ htmlInput: { dir: 'ltr', inputMode: 'numeric', style: { width: 64 } } }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Typography variant="subtitle2">پیش‌نمایش</Typography>
          <Typography variant="body2" color="text.secondary">
            هر فیلد را با ماوس بکشید تا روی جای درستش در تصویر چک بنشیند؛ با کشیدن نوار لبهٔ راستش پهنا عوض می‌شود.
            اعداد جدول هم‌زمان به‌روز می‌شوند.
          </Typography>
          <Box sx={{ overflowX: 'auto' }}>
            <Box
              sx={{
                position: 'relative',
                width: w * PX_PER_MM,
                height: h * PX_PER_MM,
                border: 1,
                borderColor: 'divider',
                bgcolor: '#fff',
                backgroundImage: image ? `url(data:image/*;base64,${image})` : undefined,
                backgroundSize: '100% 100%',
              }}
            >
              {CHEQUE_FIELDS.map((f) => {
                const b = resolveField(f.key as ChequeFieldKey, layouts, w, h);
                const active = drag?.key === f.key;
                return (
                  <Box
                    key={f.key}
                    title="برای جابه‌جایی بکشید؛ لبهٔ راست برای تغییر پهنا"
                    onPointerDown={(e) => startDrag(e, f.key, 'move', b)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    // left/top/width در `style` نه `sx`: stylis-plugin-rtl هر `left` درون sx را `right` می‌کند.
                    style={{ left: b.left * PX_PER_MM, top: b.top * PX_PER_MM, width: b.width * PX_PER_MM }}
                    sx={{
                      position: 'absolute',
                      border: active ? '2px solid' : '1px dashed',
                      borderColor: 'primary.main',
                      bgcolor: active ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.08)',
                      color: 'primary.dark',
                      fontSize: `${b.fontSize * 0.9}pt`,
                      lineHeight: 1.3,
                      px: 0.5,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      cursor: 'move',
                      userSelect: 'none',
                      touchAction: 'none',
                      zIndex: active ? 2 : 1,
                    }}
                  >
                    {f.label}
                    <Box
                      onPointerDown={(e) => startDrag(e, f.key, 'resize', b)}
                      style={{ right: 0 }}
                      sx={{ position: 'absolute', top: 0, bottom: 0, width: 6, cursor: 'ew-resize', bgcolor: 'primary.main', opacity: 0.5 }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setValues(Object.fromEntries(Object.keys(values).map((k) => [k, ''])))}>
          برگشت به پیش‌فرض
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose}>انصراف</Button>
        <Button variant="contained" disabled={hasErrors || save.isPending} onClick={() => save.mutate()}>
          ذخیره
        </Button>
      </DialogActions>
    </Dialog>
  );
}
