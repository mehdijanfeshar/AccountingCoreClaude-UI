import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands } from '../../lib/format/numbers';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { bankStatementsApi } from './api';
import type { BankStatementBookLineDto, BankStatementLineDto } from '../../types/treasury';

interface BankStatementManualMatchDialogProps {
  open: boolean;
  onClose: () => void;
  statementId: string;
  line: BankStatementLineDto | null;
}

/**
 * «تطبیق دستی» — کاندیدهای دفتری تطبیق‌نیافتهٔ یک ردیف صورت‌حساب (`GET .../book-candidates`)،
 * خزانه‌داری بخش ۴-د. واریز ↔ بدهکار دفتر، برداشت ↔ بستانکار دفتر (منطق سمت سرور؛ اینجا فقط
 * نمایش هر دو ستون است).
 */
export function BankStatementManualMatchDialog({ open, onClose, statementId, line }: BankStatementManualMatchDialogProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();

  const candidatesQuery = useQuery({
    queryKey: ['treasury-bank-statement-book-candidates', statementId, line?.id],
    queryFn: () => bankStatementsApi.getBookCandidates(statementId, line!.id),
    enabled: open && line !== null,
  });

  const matchMutation = useMutation({
    mutationFn: (voucherDetailId: string) => bankStatementsApi.matchLine(statementId, line!.id, voucherDetailId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['treasury-bank-statements', statementId] });
      notify('ردیف با سند انتخاب‌شده تطبیق یافت.');
      onClose();
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'تطبیق با خطا مواجه شد.', severity: 'error' });
    },
  });

  const columns: DataTableColumn<BankStatementBookLineDto>[] = [
    { key: 'voucherNumber', header: 'شمارهٔ سند', render: (row) => <MonoCode value={row.voucherNumber} /> },
    { key: 'voucherDate', header: 'تاریخ سند', render: (row) => formatLegacyJalaliDate(row.voucherDate) },
    { key: 'debit', header: 'بدهکار', align: 'end', render: (row) => (row.debit ? formatThousands(row.debit) : '—') },
    { key: 'credit', header: 'بستانکار', align: 'end', render: (row) => (row.credit ? formatThousands(row.credit) : '—') },
    { key: 'description', header: 'شرح', render: (row) => row.description ?? '—' },
    { key: 'sourceBankReference', header: 'مرجع بانک سند', render: (row) => row.sourceBankReference ?? '—' },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Button size="small" variant="outlined" disabled={matchMutation.isPending} onClick={() => matchMutation.mutate(row.voucherDetailId)}>
          انتخاب
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>تطبیق دستی — {line?.description || line?.bankReference || 'ردیف'}</DialogTitle>
      <DialogContent>
        {line && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            تاریخ ردیف: {formatLegacyJalaliDate(line.lineDate)} — {line.withdrawal > 0 ? `برداشت ${formatThousands(line.withdrawal)}` : `واریز ${formatThousands(line.deposit)}`} ریال
          </Typography>
        )}

        {candidatesQuery.isError && <ErrorBanner error={candidatesQuery.error} />}
        {matchMutation.isError && <ErrorBanner error={matchMutation.error} />}

        {!candidatesQuery.isError && (
          <DataTable
            columns={columns}
            rows={candidatesQuery.data ?? []}
            getRowKey={(row) => row.voucherDetailId}
            isLoading={candidatesQuery.isLoading}
            emptyMessage="کاندیدی برای تطبیق دستی یافت نشد."
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
