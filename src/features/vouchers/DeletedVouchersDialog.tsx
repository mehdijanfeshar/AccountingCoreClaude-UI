import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatLegacyJalaliDate, formatPersianDateTime } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { deletedVouchersApi, type DeletedVoucher } from './api';

interface DeletedVouchersDialogProps {
  open: boolean;
  year: string;
  onClose: () => void;
}

/**
 * سندهای حذف‌شده و بازگردانی (فاز ۵۲). سند در وضعیت «یادداشت» برمی‌گردد؛ اگر شماره‌اش در این فاصله
 * به سند دیگری داده شده باشد، شمارهٔ تازه می‌گیرد.
 */
export function DeletedVouchersDialog({ open, year, onClose }: DeletedVouchersDialogProps) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['voucher-heads', 'deleted', year],
    queryFn: () => deletedVouchersApi.list(year),
    enabled: open && /^\d{4}$/.test(year ?? ''),
  });

  const restore = useMutation({
    mutationFn: (id: string) => deletedVouchersApi.restore(id),
    onSuccess: async (r) => {
      setMessage(
        r.renumbered
          ? `سند با شمارهٔ تازهٔ ${toPersianDigits(r.docNum)} برگشت (شمارهٔ قبلی گرفته شده بود) — ${toPersianDigits(r.restoredLines)} ردیف، وضعیت یادداشت.`
          : `سند ${toPersianDigits(r.docNum)} با ${toPersianDigits(r.restoredLines)} ردیف در وضعیت یادداشت برگشت.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
    },
  });

  const columns: DataTableColumn<DeletedVoucher>[] = [
    { key: 'num', header: 'شماره', render: (r) => toPersianDigits(r.docNum ?? '—') },
    { key: 'date', header: 'تاریخ', render: (r) => formatLegacyJalaliDate(r.dateDoc) },
    { key: 'desc', header: 'شرح', render: (r) => r.headDesc || '—' },
    { key: 'lines', header: 'ردیف', align: 'center', render: (r) => toPersianDigits(r.lineCount) },
    { key: 'debtor', header: 'بدهکار', align: 'end', render: (r) => formatThousands(r.debtor) },
    { key: 'creditor', header: 'بستانکار', align: 'end', render: (r) => formatThousands(r.creditor) },
    { key: 'deleted', header: 'زمان حذف', render: (r) => formatPersianDateTime(r.deletedAt) },
    {
      key: 'action',
      header: 'عملیات',
      render: (r) => (
        <Button size="small" disabled={restore.isPending} onClick={() => restore.mutate(r.id)}>
          بازگردانی
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>سندهای حذف‌شدهٔ سال {toPersianDigits(year ?? '')}</DialogTitle>
      <DialogContent>
        {message && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}
        {listQuery.isError && <ErrorBanner error={listQuery.error} />}
        {restore.isError && <ErrorBanner error={restore.error} />}
        <DataTable
          columns={columns}
          rows={listQuery.data ?? []}
          getRowKey={(r) => r.id}
          isLoading={listQuery.isLoading}
          emptyMessage="سند حذف‌شده‌ای نیست."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
