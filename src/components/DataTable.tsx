import type { ReactNode } from 'react';

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
}

/**
 * Minimal, dependency-free table. Deliberately not TanStack Table yet —
 * this scaffold's only list pages are simple flat lists; TanStack Table is
 * reserved (per role brief) for the heavier Trial Balance / Ledger reports
 * with sorting/filtering, built in a later phase.
 */
export function DataTable<TRow>({
  columns,
  rows,
  getRowKey,
  isLoading,
  emptyMessage = 'داده‌ای برای نمایش وجود ندارد.',
}: DataTableProps<TRow>) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} scope="col">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr>
            <td colSpan={columns.length}>در حال بارگذاری...</td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>{emptyMessage}</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render(row)}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
