import type { ReactNode } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

export interface DataTableColumn<TRow> {
  key: string;
  header: string;
  render: (row: TRow) => ReactNode;
}

interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getRowKey: (row: TRow) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  /** Optional call-to-action rendered under `emptyMessage` — e.g. an "افزودن اولین ..." button. */
  emptyAction?: ReactNode;
}

/**
 * MUI `Table` wrapper with built-in loading/empty rows.
 *
 * Still not TanStack Table — reserved (per role brief) for the heavier
 * Trial Balance / Ledger reports with sorting/filtering/pagination, built
 * in a later phase. This one stays a simple flat-list renderer.
 */
export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  isLoading,
  emptyMessage = 'داده‌ای برای نمایش وجود ندارد.',
  emptyAction,
}: DataTableProps<TRow>) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.key} scope="col">
                {col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <CircularProgress size={20} />
                  <span>در حال بارگذاری...</span>
                </Box>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <InboxOutlinedIcon sx={{ fontSize: 36, opacity: 0.4 }} />
                  <span>{emptyMessage}</span>
                  {emptyAction && <Box sx={{ mt: 1 }}>{emptyAction}</Box>}
                </Box>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={getRowKey(row)} hover>
                {columns.map((col) => (
                  <TableCell key={col.key}>{col.render(row)}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
