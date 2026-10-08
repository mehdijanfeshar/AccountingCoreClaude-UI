import { useState, type ReactNode } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { alpha, type Theme } from '@mui/material/styles';
import { ALL_ROWS, Pagination, PAGE_SIZE_OPTIONS } from './Pagination';

/**
 * Spacing and grouping for one column, given the column before it.
 *
 * An end-aligned (numeric) column's figures sit flush against its end edge, and the next text
 * column starts flush against that same line from the other side; with default padding
 * «۵۸,۰۰۰,۰۰۰» and «حسابداری» ran into each other. The gap goes on the text column's start, not
 * on the number column's end: padding the numbers pushed a debit/credit pair apart instead.
 */
function columnGutter<TRow>(col: DataTableColumn<TRow>, prev: DataTableColumn<TRow> | undefined) {
  return {
    ...(prev?.align === 'end' && col.align !== 'end' ? { paddingInlineStart: 4 } : {}),
    // An image layer, not backgroundColor: the sticky header needs its opaque paper fill and rows
    // their hover colour underneath, and the tint has to sit on top of both.
    ...(col.tinted
      ? { backgroundImage: (theme: Theme) => `linear-gradient(${alpha(theme.palette.primary.main, 0.04)}, ${alpha(theme.palette.primary.main, 0.04)})` }
      : {}),
  };
}

export interface DataTableColumn<TRow> {
  key: string;
  header: string;
  render: (row: TRow) => ReactNode;
  /** Numeric columns read better trailing-aligned; defaults to the row's natural direction. */
  align?: 'start' | 'center' | 'end';
  /** Keeps a column from collapsing when a neighbour holds long free text. */
  width?: number | string;
  /** Faint background on header and cells, to read adjacent columns as one group (e.g. a debit/credit pair). */
  tinted?: boolean;
}

interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getRowKey: (row: TRow) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  /** Optional call-to-action rendered under `emptyMessage` — e.g. an "افزودن اولین ..." button. */
  emptyAction?: ReactNode;
  /** Secondary line under the empty message, for explaining *why* it is empty. */
  emptyHint?: string;
  /** Below this width the table scrolls sideways instead of squeezing percentage-width columns. */
  minWidth?: number;
  /** Rows drawn while loading. Match the page size so the table does not resize on arrival. */
  skeletonRows?: number;
  /** Highlights a row — used for a selected/active record. */
  isRowHighlighted?: (row: TRow) => boolean;
  /**
   * Client-side paging with a rows-per-page selector under the grid (default on). Turn it off where the
   * page already pages on the server and passes one page of `rows` with its own `<Pagination>` —
   * otherwise that page would be split a second time. The bar is hidden while every row fits on the
   * smallest page size, so a three-row lookup table does not grow a «صفحه ۱ از ۱» footer.
   */
  pageable?: boolean;
}

/**
 * MUI `Table` wrapper with built-in loading/empty states.
 *
 * <b>Loading is skeleton rows, not a spinner.</b> A spinner in one merged cell collapses the
 * table to a single row and then snaps back to full height when the data lands — the layout
 * shift the `ui-ux-pro-max` skill flags as `content-jumping` (rules 10 and 78). Skeleton rows
 * reserve the real height, so the page does not move under the user's cursor.
 *
 * The header is sticky and the container scrolls horizontally on its own (skill rule 71): an
 * accounting table has more columns than a laptop is wide, and the alternative — the whole page
 * scrolling sideways — takes the sidebar and the toolbar with it.
 *
 * Still not TanStack Table — that stays reserved for the heavier Trial Balance / Ledger reports
 * which need real sorting and column virtualization. This is a flat-list renderer.
 */
export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  isLoading,
  emptyMessage = 'داده‌ای برای نمایش وجود ندارد.',
  emptyAction,
  emptyHint,
  skeletonRows = 6,
  isRowHighlighted,
  pageable = true,
  minWidth,
}: DataTableProps<TRow>) {
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const showPager = pageable && !isLoading && rows.length > PAGE_SIZE_OPTIONS[0];
  // Clamped rather than reset by an effect: when rows shrink (filter, delete) the last valid page is shown.
  const all = pageSize === ALL_ROWS;
  const lastPage = all ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(pageNumber, lastPage);
  const visibleRows =
    showPager && !all ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;

  function cellAlign(col: DataTableColumn<TRow>) {
    return col.align === 'end' ? 'right' : col.align === 'center' ? 'center' : 'left';
  }

  return (
    <>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ maxHeight: { xs: 'none', md: '68vh' }, overflowX: 'auto' }}
      >
        <Table stickyHeader size="small" sx={minWidth ? { minWidth } : undefined}>
          <TableHead>
            <TableRow>
              {columns.map((col, index) => (
                <TableCell
                  key={col.key}
                  scope="col"
                  align={cellAlign(col)}
                  sx={{
                    width: col.width,
                    ...columnGutter(col, columns[index - 1]),
                    whiteSpace: 'nowrap',
                    fontWeight: 700,
                    // A sticky header sits above scrolling rows, so it needs its own opaque
                    // background — `stickyHeader` alone leaves it see-through.
                    backgroundColor: 'background.paper',
                    borderBottom: (theme) => `2px solid ${theme.palette.divider}`,
                  }}
                >
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton
                        variant="text"
                        // Varying widths read as data arriving rather than as a progress bar.
                        width={`${55 + ((rowIndex * 7 + col.key.length * 11) % 40)}%`}
                        sx={{ fontSize: '0.875rem' }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 7, borderBottom: 'none' }}>
                  <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
                        color: 'primary.main',
                      }}
                    >
                      <InboxOutlinedIcon sx={{ fontSize: 30, opacity: 0.8 }} />
                    </Box>
                    <Typography variant="subtitle2" color="text.primary">
                      {emptyMessage}
                    </Typography>
                    {emptyHint && (
                      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 380 }}>
                        {emptyHint}
                      </Typography>
                    )}
                    {emptyAction && <Box sx={{ pt: 0.5 }}>{emptyAction}</Box>}
                  </Stack>
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => {
                const highlighted = isRowHighlighted?.(row) ?? false;
  
                return (
                  <TableRow
                    key={getRowKey(row)}
                    hover
                    sx={{
                      // Zebra striping on an accounting table is not decoration: it is how the eye
                      // keeps its place when tracking a wide row of numbers back to its label.
                      '&:nth-of-type(odd)': {
                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.018),
                      },
                      ...(highlighted && {
                        backgroundColor: (theme) => alpha(theme.palette.secondary.main, 0.1),
                      }),
                      '& td': { borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.6)}` },
                      '&:last-of-type td': { borderBottom: 'none' },
                    }}
                  >
                    {columns.map((col, index) => (
                      <TableCell key={col.key} align={cellAlign(col)} sx={{ width: col.width, ...columnGutter(col, columns[index - 1]) }}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {showPager && (
        <Pagination
          pageNumber={currentPage}
          pageSize={pageSize}
          totalCount={rows.length}
          onPageChange={setPageNumber}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageNumber(1);
          }}
          allowAll
        />
      )}
    </>
  );
}
