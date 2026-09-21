import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { formatThousands, toPersianDigits } from '../../../lib/format/numbers';
import type { TrialBalanceRow, TrialBalanceVariant } from '../../../types/trialBalance';
import { buildColumnGroups, type TrialBalanceTotals } from './columns';

/**
 * The trial balance is not a list, and rendering it with the shared `DataTable` was the reason it
 * read as a wall of digits: eight money columns with identical styling, no indication of which
 * belong together.
 *
 * <para>This table is built around the one thing an accountant needs to see instantly — which pair
 * of numbers is which. Columns are grouped under a spanning header (اول دوره / گردش دوره / جمع کل /
 * مانده), each group is separated by a real vertical rule, and بدهکار/بستانکار alternate a faint
 * tint so the eye can track a pair across the row.</para>
 */

/** Group boundaries get a rule; the pair inside a group does not. */
const GROUP_EDGE = '2px solid';

interface Props {
  rows: TrialBalanceRow[];
  variant: TrialBalanceVariant;
  totals: TrialBalanceTotals;
  isLoading: boolean;
  emptyMessage: string;
}

function Amount({ value, bold }: { value: number | undefined; bold?: boolean }) {
  // A zero in every unused cell is noise in a table this dense — an em dash reads as "nothing
  // here" at a glance, where "۰" has to be read as a number first.
  if (!value) {
    return (
      <Box component="span" sx={{ color: 'text.disabled' }}>
        —
      </Box>
    );
  }

  return (
    <Box
      component="span"
      sx={{
        fontVariantNumeric: 'tabular-nums',
        fontWeight: bold ? 700 : 400,
        letterSpacing: '0.01em',
      }}
    >
      {formatThousands(value)}
    </Box>
  );
}

export function TrialBalanceTable({ rows, variant, totals, isLoading, emptyMessage }: Props) {
  const groups = buildColumnGroups(variant);
  const leafColumns = groups.flatMap((g) => g.columns);
  const totalColumnCount = leafColumns.length + 2; // + code + description

  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        maxHeight: { xs: 'none', md: '62vh' },
        // The table is wider than the viewport once 8 money columns are on: let it scroll
        // horizontally rather than crushing the columns into each other.
        overflowX: 'auto',
      }}
    >
      <Table
        stickyHeader
        size="small"
        sx={{
          // Sized from what the columns actually need — code + description + one width per money
          // column. An earlier, more generous figure pushed the 8-column variant past 1600px and
          // clipped the last group off the right-hand edge on a normal screen.
          minWidth: 340 + leafColumns.length * 104,
          '& td, & th': { borderColor: 'divider' },
        }}
      >
        <TableHead>
          {/* Row 1 — group spans. This is the whole point of the redesign. */}
          <TableRow>
            <TableCell
              rowSpan={2}
              sx={{
                fontWeight: 700,
                bgcolor: 'grey.100',
                borderInlineEnd: `${GROUP_EDGE}`,
                borderInlineEndColor: 'divider',
                minWidth: 120,
              }}
            >
              کد حساب
            </TableCell>
            <TableCell
              rowSpan={2}
              sx={{
                fontWeight: 700,
                bgcolor: 'grey.100',
                borderInlineEnd: `${GROUP_EDGE}`,
                borderInlineEndColor: 'divider',
                minWidth: 220,
              }}
            >
              شرح حساب
            </TableCell>

            {groups.map((group, index) => (
              <TableCell
                key={group.key}
                colSpan={group.columns.length}
                align="center"
                sx={{
                  fontWeight: 700,
                  color: group.tone,
                  bgcolor: 'grey.100',
                  borderInlineEnd:
                    index < groups.length - 1 ? `${GROUP_EDGE}` : undefined,
                  borderInlineEndColor: 'divider',
                  borderBottom: 1,
                  borderBottomColor: 'divider',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.label}
              </TableCell>
            ))}
          </TableRow>

          {/* Row 2 — بدهکار / بستانکار under each group. */}
          <TableRow>
            {groups.map((group, groupIndex) =>
              group.columns.map((column, columnIndex) => (
                <TableCell
                  key={column.key}
                  align="left"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    bgcolor: 'grey.50',
                    whiteSpace: 'nowrap',
                    borderInlineEnd:
                      columnIndex === group.columns.length - 1 && groupIndex < groups.length - 1
                        ? `${GROUP_EDGE}`
                        : undefined,
                    borderInlineEndColor: 'divider',
                  }}
                >
                  {column.shortHeader}
                </TableCell>
              )),
            )}
          </TableRow>
        </TableHead>

        <TableBody>
          {isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {Array.from({ length: totalColumnCount }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton variant="text" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={totalColumnCount} align="center" sx={{ py: 6 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            rows.map((row) => (
              <TableRow
                key={row.code}
                hover
                sx={{
                  // Zebra striping earns its keep at this width: it is what stops the eye from
                  // sliding onto the wrong row halfway across eight numeric columns.
                  '&:nth-of-type(odd)': { bgcolor: 'grey.50' },
                }}
              >
                <TableCell
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                    borderInlineEnd: `${GROUP_EDGE}`,
                    borderInlineEndColor: 'divider',
                  }}
                >
                  {toPersianDigits(row.code)}
                </TableCell>
                <TableCell
                  sx={{
                    borderInlineEnd: `${GROUP_EDGE}`,
                    borderInlineEndColor: 'divider',
                  }}
                >
                  {row.description ?? (
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                      بدون شرح
                    </Typography>
                  )}
                </TableCell>

                {groups.map((group, groupIndex) =>
                  group.columns.map((column, columnIndex) => (
                    <TableCell
                      key={column.key}
                      align="left"
                      sx={{
                        whiteSpace: 'nowrap',
                        // The faint tint on the بستانکار half of each pair is what makes a pair
                        // readable as a pair rather than as two unrelated numbers.
                        bgcolor: columnIndex % 2 === 1 ? 'action.hover' : undefined,
                        borderInlineEnd:
                          columnIndex === group.columns.length - 1 && groupIndex < groups.length - 1
                            ? `${GROUP_EDGE}`
                            : undefined,
                        borderInlineEndColor: 'divider',
                      }}
                    >
                      <Amount value={column.get(row)} />
                    </TableCell>
                  )),
                )}
              </TableRow>
            ))}
        </TableBody>

        {!isLoading && rows.length > 0 && (
          <TableBody>
            {/* The totals row belongs inside the table, not in a separate panel below it: an
                accountant reads down a column to its total, and a gap breaks that. The double
                top rule is the conventional accounting marker for a summed line. */}
            <TableRow
              sx={{
                position: 'sticky',
                bottom: 0,
                bgcolor: 'grey.100',
                '& td': {
                  borderTop: '3px double',
                  borderTopColor: 'text.secondary',
                  fontWeight: 700,
                },
              }}
            >
              <TableCell
                colSpan={2}
                sx={{ borderInlineEnd: `${GROUP_EDGE}`, borderInlineEndColor: 'divider' }}
              >
                جمع کل ({toPersianDigits(rows.length)} حساب)
              </TableCell>

              {groups.map((group, groupIndex) =>
                group.columns.map((column, columnIndex) => (
                  <TableCell
                    key={column.key}
                    align="left"
                    sx={{
                      whiteSpace: 'nowrap',
                      borderInlineEnd:
                        columnIndex === group.columns.length - 1 && groupIndex < groups.length - 1
                          ? `${GROUP_EDGE}`
                          : undefined,
                      borderInlineEndColor: 'divider',
                    }}
                  >
                    <Amount value={column.total(totals)} bold />
                  </TableCell>
                )),
              )}
            </TableRow>
          </TableBody>
        )}
      </Table>
    </TableContainer>
  );
}
