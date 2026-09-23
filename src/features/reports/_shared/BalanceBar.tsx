import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { motion, useReducedMotion } from 'motion/react';
import { formatThousands, toPersianDigits } from '../../../lib/format/numbers';
import {
  BALANCE_OFF_COLOR,
  BALANCE_OK_COLOR,
  CHART_TRACK,
  CREDITOR_COLOR,
  DEBTOR_COLOR,
} from './chartTokens';

export interface BalanceBarProps {
  debtor: number;
  creditor: number;
  /** Hidden entirely when there is nothing to compare. */
  hasRows: boolean;
}

/**
 * Two bars on one shared scale — بدهکار against بستانکار — plus the verdict on whether they match.
 *
 * <b>Why this form.</b> The question the reader opens a trial balance with is "does it balance?",
 * and a pair of numbers in a stat tile answers it only after the reader subtracts them. Two bars
 * on a common axis answer it pre-attentively: equal length means balanced, and any gap is the
 * error, at the size it actually is. This is the data-viz method's "compare magnitude" job for two
 * named things, so the two categorical slots carry identity and length carries the amount.
 *
 * <b>Identity is never colour-alone.</b> With two series, each bar is direct-labelled with its own
 * name and value, so the colours are reinforcement rather than the only channel — which is also
 * what keeps this readable under colour-vision deficiency and in print.
 *
 * <b>The verdict is status, not series.</b> Balanced/unbalanced uses the reserved status colours,
 * separate from the two series hues so a status can never be read as "a third series", and it
 * always ships with an icon and a word beside it.
 */
export function BalanceBar({ debtor, creditor, hasRows }: BalanceBarProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!hasRows) return null;

  const max = Math.max(debtor, creditor, 1);
  const difference = debtor - creditor;
  const isBalanced = difference === 0;

  const rows = [
    { key: 'debtor', label: 'بدهکار', value: debtor, color: DEBTOR_COLOR },
    { key: 'creditor', label: 'بستانکار', value: creditor, color: CREDITOR_COLOR },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, flexWrap: 'wrap' }}
      >
        <Typography variant="subtitle2">توازن گردش</Typography>

        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            gap: 0.75,
            color: isBalanced ? BALANCE_OK_COLOR : BALANCE_OFF_COLOR,
          }}
        >
          {isBalanced ? (
            <CheckCircleOutlineOutlinedIcon fontSize="small" />
          ) : (
            <ReportProblemOutlinedIcon fontSize="small" />
          )}
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {isBalanced
              ? 'متوازن'
              : `اختلاف ${toPersianDigits(formatThousands(Math.abs(difference)))}`}
          </Typography>
        </Stack>
      </Stack>

      <Stack spacing={1.25}>
        {rows.map((row) => {
          const percent = (row.value / max) * 100;
          return (
            <Box key={row.key}>
              <Stack
                direction="row"
                sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.25 }}
              >
                {/* Direct label: identity does not depend on the colour of the bar below it. */}
                <Typography variant="caption" color="text.secondary">
                  {row.label}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                >
                  {toPersianDigits(formatThousands(row.value))}
                </Typography>
              </Stack>

              <Tooltip title={`${row.label}: ${toPersianDigits(formatThousands(row.value))}`} arrow>
                <Box
                  sx={{
                    height: 10,
                    borderRadius: 999,
                    bgcolor: CHART_TRACK,
                    overflow: 'hidden',
                    cursor: 'default',
                  }}
                >
                  <motion.div
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: 'easeOut' }}
                    style={{
                      height: '100%',
                      borderRadius: 999,
                      background: row.color,
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
