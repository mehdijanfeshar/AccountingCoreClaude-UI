import { Link as RouterLink } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { MonoCode } from '../../../components/MonoCode';
import { SortLabel, type SortState } from '../../../components/gridTools';
import type { TrialBalanceRow, TrialBalanceVariant } from '../../../types/trialBalance';
import {
  CREDIT_SIDE,
  DEBIT_SIDE,
  GRID_TOTAL_ROW,
  amountCellSx,
  frozenCell,
  frozenHeadCell,
  gridAmount,
  groupHeadSx,
  groupSeparator,
  reportGridTableSx,
  sectionSeparator,
  sideHeadSx,
  totalsCellSx,
  totalsSurfaceSx,
  useColumnHighlight,
  useHeaderRowHeight,
} from '../_shared/reportGrid';
import { buildColumnGroups, type TrialBalanceTotals } from './columns';

/**
 * The trial balance is not a list, and rendering it with the shared `DataTable` was the reason it
 * read as a wall of digits: eight money columns with identical styling, no indication of which
 * belong together.
 *
 * <para>طراحی گرید همان گزارش ماتریسی است (`_shared/reportGrid`): گروه‌ها زیر سرستون دوطبقه
 * (اول دوره / گردش دوره / جمع کل / مانده)، خط رنگی بدهکار/بستانکار، کد و شرح ثابت هنگام اسکرول افقی،
 * صلیب هاور و سطر جمع چسبان. گروه «مانده» مثل «جمع سطر» ماتریس پررنگ است.</para>
 */

const CODE_WIDTH = 128;
const NAME_WIDTH = 240;

interface Props {
  rows: TrialBalanceRow[];
  variant: TrialBalanceVariant;
  totals: TrialBalanceTotals;
  isLoading: boolean;
  emptyMessage: string;
  /** پیوند «این حساب به تفکیک استان / واحد / سند» (مرور حساب‌ها). */
  breakdownHref?: (row: TrialBalanceRow) => string;
  /** مرتب‌سازی با سرستون — وضعیت در صفحه است چون پیش از صفحه‌بندی اعمال می‌شود. */
  sort?: SortState | null;
  onSort?: (key: string) => void;
  /** ستون‌های قابل نمایش: «description» و کلید گروه‌ها (opening/period/cumulative/balance). */
  isColumnVisible?: (key: string) => boolean;
}

export function TrialBalanceTable({
  rows,
  variant,
  totals,
  isLoading,
  emptyMessage,
  breakdownHref,
  sort = null,
  onSort,
  isColumnVisible = () => true,
}: Props) {
  const groups = buildColumnGroups(variant).filter((g) => isColumnVisible(g.key));
  const showName = isColumnVisible('description');
  const sortable = (key: string, label: ReactNode) =>
    onSort ? (
      <SortLabel sortKey={key} sort={sort} onSort={onSort}>
        {label}
      </SortLabel>
    ) : (
      label
    );
  const leafColumns = groups.flatMap((g) => g.columns);
  const totalColumnCount = leafColumns.length + 1 + (showName ? 1 : 0); // + code (+ description)
  const columnHighlight = useColumnHighlight();
  const headerTop = useHeaderRowHeight();
  // گروه «مانده» مثل «جمع سطر» ماتریس پررنگ است (حتی وقتی گروهی پنهان شده).
  const isStrong = (key: string) => key === 'balance';

  return (
    <TableContainer
      ref={columnHighlight.ref}
      onMouseOver={columnHighlight.onMouseOver}
      onMouseLeave={columnHighlight.onMouseLeave}
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        maxHeight: { xs: 'none', md: '62vh' },
        overflow: 'auto',
      }}
    >
      <Table
        stickyHeader
        size="small"
        sx={{
          ...reportGridTableSx(),
          // Sized from what the columns actually need — code + description + one width per money
          // column. An earlier, more generous figure pushed the 8-column variant past 1600px and
          // clipped the last group off the right-hand edge on a normal screen.
          minWidth: CODE_WIDTH + (showName ? NAME_WIDTH : 0) + leafColumns.length * 104,
        }}
      >
        <TableHead>
          <TableRow ref={headerTop.ref}>
            <TableCell rowSpan={2} sx={frozenHeadCell(0, CODE_WIDTH, showName ? undefined : { borderInlineEnd: sectionSeparator })}>
              {sortable('code', 'کد حساب')}
            </TableCell>
            {showName && (
              <TableCell rowSpan={2} sx={frozenHeadCell(CODE_WIDTH, NAME_WIDTH, { borderInlineEnd: sectionSeparator })}>
                {sortable('description', 'شرح حساب')}
              </TableCell>
            )}

            {groups.map((group, index) => (
              <TableCell
                key={group.key}
                data-ci={index}
                colSpan={group.columns.length}
                align="center"
                sx={groupHeadSx(index, { strong: isStrong(group.key) })}
              >
                {group.label}
              </TableCell>
            ))}
          </TableRow>

          <TableRow>
            {groups.map((group, groupIndex) =>
              group.columns.map((column, columnIndex) => (
                <TableCell
                  key={column.key}
                  data-ci={groupIndex}
                  align="left"
                  sx={sideHeadSx((columnIndex === 0 ? DEBIT_SIDE : CREDIT_SIDE).color, {
                    top: headerTop.height,
                    first: columnIndex === 0,
                    strong: isStrong(group.key),
                  })}
                >
                  {sortable(column.key, column.shortHeader)}
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
              <TableRow key={row.code}>
                <TableCell sx={{ ...frozenCell(0), ...(showName ? {} : { borderInlineEnd: sectionSeparator }) }}>
                  <MonoCode value={row.code} />
                </TableCell>
                {showName && (
                <TableCell
                  title={row.description ?? undefined}
                  sx={{
                    ...frozenCell(CODE_WIDTH),
                    maxWidth: NAME_WIDTH,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    borderInlineEnd: sectionSeparator,
                  }}
                >
                  {breakdownHref && (
                    <Tooltip title="این حساب به تفکیک استان / واحد / سند">
                      <IconButton
                        className="tb-no-print"
                        size="small"
                        component={RouterLink}
                        to={breakdownHref(row)}
                        sx={{ ml: 0.5, p: 0.25 }}
                      >
                        <AccountTreeOutlinedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {row.description ?? (
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                      بدون شرح
                    </Typography>
                  )}
                </TableCell>
                )}

                {groups.map((group, groupIndex) =>
                  group.columns.map((column, columnIndex) => {
                    const value = column.get(row);
                    return (
                      <TableCell
                        key={column.key}
                        data-ci={groupIndex}
                        align="left"
                        sx={amountCellSx(value, {
                          band: groupIndex % 2 === 1,
                          first: columnIndex === 0,
                          strong: isStrong(group.key),
                        })}
                      >
                        {gridAmount(value)}
                      </TableCell>
                    );
                  }),
                )}
              </TableRow>
            ))}
        </TableBody>

        {!isLoading && rows.length > 0 && (
          <TableBody>
            {/* The totals row belongs inside the table, not in a separate panel below it: an
                accountant reads down a column to its total, and a gap breaks that. */}
            <TableRow className={GRID_TOTAL_ROW}>
              <TableCell
                colSpan={showName ? 2 : 1}
                sx={{ ...totalsCellSx, ...frozenCell(0, 6), ...totalsSurfaceSx, borderInlineEnd: sectionSeparator }}
              >
                جمع کل ({gridAmount(rows.length)} حساب)
              </TableCell>

              {groups.map((group) =>
                group.columns.map((column, columnIndex) => (
                  <TableCell
                    key={column.key}
                    align="left"
                    sx={{ ...totalsCellSx, borderInlineStart: columnIndex === 0 ? groupSeparator : 'none' }}
                  >
                    {gridAmount(column.total(totals))}
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
