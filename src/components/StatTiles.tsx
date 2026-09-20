import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { toPersianDigits } from '../lib/format/numbers';
import { NumberTicker } from './NumberTicker';

export type StatTileTone = 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error';

export interface StatTile {
  key: string;
  label: string;
  /** Pass a number for digit conversion + thousands grouping, or a string for a pre-formatted value. */
  value: number | string | null | undefined;
  icon?: ReactNode;
  tone?: StatTileTone;
  /** Small caption under the value — a unit, a qualifier, or what the number excludes. */
  hint?: string;
  /** Renders the tile as a button. Use when the number is also a filter the user can apply. */
  onClick?: () => void;
  /** Draws the tile as currently applied — pairs with `onClick`. */
  active?: boolean;
}

/**
 * A row of summary tiles for the top of a list page.
 *
 * <b>Why these exist.</b> A bare table answers "what rows are there" but never "how much is
 * here, and is any of it unusual" — which is the first question anyone opens an accounting
 * screen with. The tiles put that answer above the fold without making the user read the table.
 *
 * <b>Tiles are not decoration; every tile must be a number someone acts on.</b> A tile that
 * merely repeats the row count the toolbar already shows is noise. Where a tile represents a
 * subset the user can also filter by, pass `onClick` — then the number and the way to see the
 * rows behind it are the same control, instead of the user reading a number and then hunting for
 * the filter that reproduces it.
 *
 * Loading renders skeletons at the tile's real size rather than collapsing the row, for the same
 * no-layout-shift reason `DataTable` uses skeleton rows.
 */
export function StatTiles({ tiles, isLoading }: { tiles: StatTile[]; isLoading?: boolean }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        mb: 3,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: `repeat(${Math.min(tiles.length, 4)}, minmax(0, 1fr))`,
        },
      }}
    >
      {tiles.map((tile) => {
        const tone = tile.tone ?? 'primary';
        const interactive = Boolean(tile.onClick);

        return (
          <Paper
            key={tile.key}
            variant="outlined"
            {...(interactive
              ? {
                  component: 'button' as const,
                  type: 'button' as const,
                  onClick: tile.onClick,
                  'aria-pressed': tile.active ?? false,
                }
              : {})}
            sx={{
              p: 2,
              borderRadius: 2,
              textAlign: 'start',
              font: 'inherit',
              color: 'inherit',
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
              cursor: interactive ? 'pointer' : 'default',
              borderColor: (theme) => (tile.active ? theme.palette[tone].main : theme.palette.divider),
              backgroundColor: (theme) =>
                tile.active ? alpha(theme.palette[tone].main, 0.06) : theme.palette.background.paper,
              transition: 'border-color 160ms, background-color 160ms, transform 160ms',
              ...(interactive && {
                '&:hover': {
                  borderColor: (theme) => alpha(theme.palette[tone].main, 0.6),
                  backgroundColor: (theme) => alpha(theme.palette[tone].main, 0.04),
                },
                // A visible focus ring is required, not optional — skill rule `focus-states`.
                '&:focus-visible': {
                  outline: (theme) => `2px solid ${theme.palette[tone].main}`,
                  outlineOffset: 2,
                },
                // Honour the OS "reduce motion" setting — skill rule `reduced-motion`.
                '@media (prefers-reduced-motion: no-preference)': {
                  '&:active': { transform: 'translateY(1px)' },
                },
              }),
            }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              {tile.icon && (
                <Box
                  aria-hidden
                  sx={{
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    color: `${tone}.main`,
                    backgroundColor: (theme) => alpha(theme.palette[tone].main, 0.1),
                  }}
                >
                  {tile.icon}
                </Box>
              )}

              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {tile.label}
                </Typography>

                {isLoading ? (
                  <Skeleton variant="text" width={64} sx={{ fontSize: '1.4rem' }} />
                ) : (
                  <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 700 }}>
                    {/* A numeric tile counts up; a string one (or a missing value) does not —
                        animating a label would be motion with nothing to say. */}
                    {typeof tile.value === 'number' ? (
                      <NumberTicker value={tile.value} />
                    ) : (
                      formatTileValue(tile.value)
                    )}
                  </Typography>
                )}

                {tile.hint && (
                  <Typography variant="caption" color="text.disabled" noWrap>
                    {tile.hint}
                  </Typography>
                )}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}

/** `—` rather than `۰` for an absent value: zero is a fact, missing is not. */
function formatTileValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  return toPersianDigits(value.toLocaleString('en-US'));
}
