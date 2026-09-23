import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { motion, useReducedMotion } from 'motion/react';
import { MonoCode } from '../../../components/MonoCode';
import { formatThousands, toPersianDigits } from '../../../lib/format/numbers';
import { CHART_TRACK, MAGNITUDE_COLOR } from './chartTokens';

export interface MagnitudeBarItem {
  key: string;
  code: string | null;
  name: string | null;
  value: number;
}

export interface MagnitudeBarListProps {
  title: string;
  /** What the number on each bar is — shown once, under the title, not repeated per row. */
  caption?: string;
  items: MagnitudeBarItem[];
  /** How many bars to draw. Anything past this is summarised as "سایر". */
  limit?: number;
}

/**
 * The biggest N accounts as horizontal bars, with the remainder folded into a single «سایر» row.
 *
 * <b>Why horizontal.</b> The category labels here are Persian account names of very uneven length;
 * rotated or truncated vertical-column labels are the classic way to make a chart of named things
 * unreadable. Horizontal bars give every label a full line and read top-to-bottom in reading
 * order.
 *
 * <b>Why one hue.</b> Bar length already encodes magnitude. Shading each bar differently would
 * encode the same variable twice and imply a second dimension that does not exist — so every bar
 * carries the single magnitude hue, and only length varies.
 *
 * <b>Why a tail row instead of more bars.</b> Past a handful of bars the chart stops answering
 * "which accounts dominate" and becomes a worse version of the table underneath it. Folding the
 * tail keeps the total honest — the bars plus «سایر» always account for everything — without
 * inventing more colours.
 */
export function MagnitudeBarList({ title, caption, items, limit = 7 }: MagnitudeBarListProps) {
  const prefersReducedMotion = useReducedMotion();

  const ranked = [...items].filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  if (ranked.length === 0) return null;

  const head = ranked.slice(0, limit);
  const tail = ranked.slice(limit);
  const tailTotal = tail.reduce((sum, item) => sum + item.value, 0);
  // The tail is scaled on the same axis as the bars, so it cannot look smaller than it is.
  const max = Math.max(head[0]?.value ?? 0, tailTotal, 1);

  const rows: (MagnitudeBarItem & { isTail?: boolean })[] =
    tail.length > 0
      ? [
          ...head,
          {
            key: '__tail__',
            code: null,
            name: `سایر (${toPersianDigits(tail.length)} حساب)`,
            value: tailTotal,
            isTail: true,
          },
        ]
      : head;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
      <Typography variant="subtitle2">{title}</Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          {caption}
        </Typography>
      )}

      <Stack spacing={1}>
        {rows.map((row, index) => {
          const percent = (row.value / max) * 100;
          const label = row.name ?? '—';
          return (
            <Box key={row.key}>
              <Stack
                direction="row"
                sx={{ alignItems: 'baseline', gap: 1, mb: 0.25, minWidth: 0 }}
              >
                {row.code && <MonoCode value={row.code} muted />}
                <Typography variant="caption" color="text.secondary" noWrap title={label} sx={{ minWidth: 0 }}>
                  {label}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
                >
                  {toPersianDigits(formatThousands(row.value))}
                </Typography>
              </Stack>

              <Tooltip title={`${label}: ${toPersianDigits(formatThousands(row.value))}`} arrow>
                <Box
                  sx={{
                    height: 8,
                    borderRadius: 999,
                    bgcolor: CHART_TRACK,
                    overflow: 'hidden',
                    cursor: 'default',
                  }}
                >
                  <motion.div
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.5,
                      // A short stagger makes the ranking legible as it draws; without it the bars
                      // all arrive at once and the order has to be re-read.
                      delay: prefersReducedMotion ? 0 : index * 0.04,
                      ease: 'easeOut',
                    }}
                    style={{
                      height: '100%',
                      borderRadius: 999,
                      // The tail is context, not a finding: it recedes rather than competing with
                      // the ranked bars above it.
                      background: MAGNITUDE_COLOR,
                      opacity: row.isTail ? 0.35 : 1,
                    }}
                  />
                </Box>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
