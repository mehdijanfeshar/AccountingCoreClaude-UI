import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { toPersianDigits } from '../../lib/format/numbers';
import { FS_ROW_TYPE } from '../../types/fsTemplate';
import type { FsRunRowDto, FsRunStatementDto } from '../../types/fsRun';

export const AMOUNT_UNITS = [
  { value: 1, label: 'ریال' },
  { value: 1_000, label: 'هزار ریال' },
  { value: 1_000_000, label: 'میلیون ریال' },
  { value: 1_000_000_000, label: 'میلیارد ریال' },
] as const;

interface Props {
  statement: FsRunStatementDto;
  orgName: string;
  periodLine: string;
  priorLabel: string | null;
  currentLabel: string;
  unitDivisor: number;
  unitLabel: string;
  showChange: boolean;
  isTrial: boolean;
  /** «note» = برگهٔ یادداشت: عنوان «۵. موجودی نقد» به‌جای عنوان سه‌سطری، شمارهٔ زیر‌یادداشت پیش از «عنوان»‌ها. */
  variant?: "statement" | "note";
  /** کلیک روی شمارهٔ یادداشت در ستون «یادداشت» صورت. */
  onNoteClick?: (noteNo: string) => void;
  /** کلیک روی مبلغ ردیف «حساب» قابل ریزشدن ⇒ Drill-down (بخش ۴۵-د). */
  onDrill?: (row: FsRunRowDto) => void;
}

const VALUE_TYPES = new Set<number>([FS_ROW_TYPE.Account, FS_ROW_TYPE.Formula, FS_ROW_TYPE.External]);

/** مبلغ داخلی (بدهکار مثبت) ⇒ مبلغ نمایشی: ماهیت بستانکار قرینه می‌شود. */
export function displayAmount(row: FsRunRowDto, amount: number | null): number | null {
  if (amount === null) return null;
  return row.normalBalance === 2 ? -amount : amount;
}

/** ارقام فارسی، جداکنندهٔ هزارگان، منفی داخل پرانتز، «—» برای صفر (سند منبع §۴-۱). */
export function formatAmount(value: number | null, divisor: number): string {
  if (value === null) return '';
  const scaled = Math.round(value / divisor);
  if (scaled === 0) return '—';
  const text = Math.abs(scaled).toLocaleString('fa-IR');
  return scaled < 0 ? `(${text})` : text;
}

function borderCss(kind: number): string | undefined {
  if (kind === 1) return '1px solid';
  if (kind === 2) return '3px double';
  return undefined;
}

/**
 * برگهٔ صورت مالی با قالب رسمی (سند منبع §۲-۳ و §۴-۱): عنوان سه‌سطری وسط‌چین، «(مبالغ به …)»،
 * ستون یادداشت، ستون داخلی (اقلام) و بیرونی (جمع) برای هر دوره، خط بالا/زیر جمع‌ها، پاورقی ثابت.
 * گرد کردن فقط در نمایش است (اختلاف گرد کردن جمع‌ها در این بخش منتقل نمی‌شود — کنترل V-10 در ۴۵-د).
 */
export function FsStatementSheet({
  statement,
  orgName,
  periodLine,
  priorLabel,
  currentLabel,
  unitDivisor,
  unitLabel,
  showChange,
  isTrial,
  variant = "statement",
  onNoteClick,
  onDrill,
}: Props) {
  const isNoteSheet = variant === "note";
  const rows = useMemo(
    () =>
      statement.rows.filter((r) => {
        if (!r.format.hideIfZero || !VALUE_TYPES.has(r.rowType)) return true;
        return Math.round((r.amountCur ?? 0) / unitDivisor) !== 0 || Math.round((r.amountPrv ?? 0) / unitDivisor) !== 0;
      }),
    [statement.rows, unitDivisor],
  );

  const hasInner = rows.some((r) => r.format.innerColumn && VALUE_TYPES.has(r.rowType));
  const hasPrior = priorLabel !== null;
  const hasNotes = rows.some((r) => r.noteRef && !(isNoteSheet && r.rowType === FS_ROW_TYPE.Header));

  const periods: { key: 'cur' | 'prv'; label: string }[] = [{ key: 'cur', label: currentLabel }];
  if (hasPrior) periods.push({ key: 'prv', label: priorLabel });

  const numCell = {
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
    px: 1.5,
    py: 0.6,
    minWidth: 110,
  };

  return (
    <Paper
      variant="outlined"
      sx={{ p: { xs: 2, sm: 4 }, borderRadius: 2, maxWidth: 1000, mx: 'auto', position: 'relative', overflow: 'hidden' }}
    >
      {isTrial && (
        <Typography
          aria-hidden
          sx={{
            position: 'absolute',
            top: '40%',
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 96,
            fontWeight: 800,
            color: 'warning.main',
            opacity: 0.07,
            transform: 'rotate(-20deg)',
            pointerEvents: 'none',
          }}
        >
          آزمایشی
        </Typography>
      )}

      {isNoteSheet ? (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {statement.noteNo ? `${toPersianDigits(statement.noteNo)}. ` : ''}
            {statement.titleFa}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            (مبالغ به {unitLabel})
          </Typography>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {orgName}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {statement.titleFa}
          </Typography>
          <Typography variant="body2">{periodLine}</Typography>
          <Typography variant="caption" color="text.secondary">
            (مبالغ به {unitLabel})
          </Typography>
        </Box>
      )}

      <Box sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              <Box component="th" sx={{ textAlign: 'right', px: 1, py: 1 }} />
              {hasNotes && (
                <Box component="th" sx={{ px: 1, py: 1, fontWeight: 600, width: 70 }}>
                  یادداشت
                </Box>
              )}
              {periods.map((p) => (
                <Box
                  key={p.key}
                  component="th"
                  colSpan={hasInner ? 2 : 1}
                  sx={{ px: 1.5, py: 1, fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'center' }}
                >
                  {p.label}
                </Box>
              ))}
              {showChange && hasPrior && (
                <>
                  <Box component="th" sx={{ px: 1.5, py: 1, fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
                    تغییر
                  </Box>
                  <Box component="th" sx={{ px: 1.5, py: 1, fontWeight: 600, borderBottom: '1px solid', borderColor: 'divider' }}>
                    درصد
                  </Box>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isValue = VALUE_TYPES.has(r.rowType);
              const isHeader = r.rowType === FS_ROW_TYPE.Header;
              const bold = r.format.bold || isHeader;
              const cur = displayAmount(r, r.amountCur);
              const prv = displayAmount(r, r.amountPrv);
              const valueCellSx = {
                ...numCell,
                fontWeight: bold ? 700 : 400,
                borderTop: borderCss(r.format.topBorder),
                borderBottom: borderCss(r.format.bottomBorder),
                borderColor: 'text.primary',
                color: undefined as string | undefined,
              };

              if (r.rowType === FS_ROW_TYPE.Blank) {
                return (
                  <tr key={r.id}>
                    <Box component="td" colSpan={99} sx={{ height: 16 }} />
                  </tr>
                );
              }

              const drillable = !!onDrill && r.rowType === FS_ROW_TYPE.Account && r.isDrillable;
              const renderPeriod = (value: number | null) => {
                const raw = isValue ? formatAmount(value, unitDivisor) : '';
                const text =
                  drillable && raw ? (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => onDrill!(r)}
                      title="ریز این مبلغ"
                      sx={{
                        border: 0,
                        bgcolor: 'transparent',
                        color: 'inherit',
                        font: 'inherit',
                        cursor: 'pointer',
                        p: 0,
                        '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                      }}
                    >
                      {raw}
                    </Box>
                  ) : (
                    raw
                  );
                if (!hasInner) {
                  return <Box component="td" sx={valueCellSx}>{text}</Box>;
                }
                const inner = r.format.innerColumn;
                return (
                  <>
                    <Box component="td" sx={inner ? valueCellSx : numCell}>
                      {inner ? text : ''}
                    </Box>
                    <Box component="td" sx={inner ? numCell : valueCellSx}>
                      {inner ? '' : text}
                    </Box>
                  </>
                );
              };

              const change = isValue && cur !== null && prv !== null ? cur - prv : null;
              const pct = change !== null && prv ? (change / Math.abs(prv)) * 100 : null;

              return (
                <tr key={r.id}>
                  <Box
                    component="td"
                    sx={{
                      px: 1,
                      py: 0.6,
                      pr: 1 + (r.format.indent ?? 0) * 2,
                      fontWeight: bold ? 700 : 400,
                      fontStyle: r.format.italic ? 'italic' : undefined,
                      pt: isHeader ? 1.5 : 0.6,
                    }}
                  >
                    {isNoteSheet && isHeader && r.noteRef ? `${toPersianDigits(r.noteRef)}. ` : ''}
                    {r.titleFa}
                  </Box>
                  {hasNotes && (
                    <Box component="td" sx={{ textAlign: 'center', px: 1 }}>
                      {r.noteRef && !(isNoteSheet && isHeader) ? (
                        onNoteClick ? (
                          <Box
                            component="button"
                            type="button"
                            onClick={() => onNoteClick(r.noteRef!.split('،')[0].trim())}
                            sx={{
                              border: 0,
                              bgcolor: 'transparent',
                              color: 'primary.main',
                              cursor: 'pointer',
                              font: 'inherit',
                              textDecoration: 'underline dotted',
                              p: 0,
                            }}
                          >
                            {toPersianDigits(r.noteRef)}
                          </Box>
                        ) : (
                          toPersianDigits(r.noteRef)
                        )
                      ) : (
                        ''
                      )}
                    </Box>
                  )}
                  {renderPeriod(cur)}
                  {hasPrior && renderPeriod(prv)}
                  {showChange && hasPrior && (
                    <>
                      <Box component="td" sx={{ ...numCell, color: 'text.secondary' }}>
                        {change !== null ? formatAmount(change, unitDivisor) : ''}
                      </Box>
                      <Box component="td" sx={{ ...numCell, minWidth: 70, color: 'text.secondary' }}>
                        {pct !== null ? `${toPersianDigits(pct.toFixed(1))}٪` : ''}
                      </Box>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Box>
      </Box>

      {!isNoteSheet && (
        <Typography variant="caption" component="p" sx={{ mt: 4, textAlign: 'center' }}>
          یادداشت‌های توضیحی، بخش جدایی‌ناپذیر صورت‌های مالی است.
        </Typography>
      )}
    </Paper>
  );
}
