import Chip from '@mui/material/Chip';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { formatPersianDateTime } from '../../lib/format/dates';
import { toPersianDigits } from '../../lib/format/numbers';
import { MONTH_NAMES, MONTH_REOPEN_STATUS_LABEL, type MonthReopenDto } from './api';

const STATUS_COLOR: Record<MonthReopenDto['status'], 'info' | 'success' | 'error'> = {
  Open: 'info',
  Used: 'success',
  Voided: 'error',
};

/** سابقهٔ رمزهای برگشت صورتحساب — مشترک بین صفحهٔ ستاد و صفحهٔ واحد. */
export function MonthReopenLogTable({ rows, isLoading, showUnit }: { rows: MonthReopenDto[]; isLoading: boolean; showUnit: boolean }) {
  const columns: DataTableColumn<MonthReopenDto>[] = [
    ...(showUnit ? [{ key: 'unit', header: 'واحد', render: (r: MonthReopenDto) => toPersianDigits(r.vahedCode) }] : []),
    { key: 'month', header: 'ماه', render: (r) => `${MONTH_NAMES[r.month - 1]} ${toPersianDigits(r.year)}` },
    { key: 'seq', header: 'دفعه', align: 'center', render: (r) => toPersianDigits(r.seq) },
    { key: 'issued', header: 'صدور', render: (r) => `${formatPersianDateTime(r.issuedDate)} — ${r.issuedBy}` },
    { key: 'reason', header: 'علت', render: (r) => r.reason ?? '—' },
    {
      key: 'status',
      header: 'وضعیت',
      render: (r) => <Chip size="small" color={STATUS_COLOR[r.status]} label={MONTH_REOPEN_STATUS_LABEL[r.status]} />,
    },
    {
      key: 'used',
      header: 'برگشت',
      render: (r) =>
        r.usedDate
          ? `${formatPersianDateTime(r.usedDate)} — ${r.usedBy ?? ''} (${toPersianDigits(r.revertedCount ?? 0)} سند)`
          : r.failedAttempts > 0
            ? `${toPersianDigits(r.failedAttempts)} ورود نادرست`
            : '—',
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      isLoading={isLoading}
      emptyMessage="در این سال رمز برگشتی صادر نشده است."
    />
  );
}
