import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MonoCode } from '../../components/MonoCode';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands } from '../../lib/format/numbers';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { pettyCashRefundsApi } from './api';
import { PettyCashRefundDialog } from './PettyCashRefundDialog';
import type { PettyCashFundDto, PettyCashRefundDto } from '../../types/pettyCash';

interface PettyCashRefundsPanelProps {
  fund: PettyCashFundDto | null;
}

/**
 * استردادهای یک تنخواه — بخش ۳-الف (`docs/tankhah-khazaneh-module.md` §۹، صفحهٔ ۱۱ پاورپوینت).
 * دکمهٔ «ثبت استرداد» و فهرست/حذف در یک پنل مشترک، تا هم `PettyCashLedgerPage` و هم داشبورد
 * بتوانند بدون تکرار کد از آن استفاده کنند.
 */
export function PettyCashRefundsPanel({ fund }: PettyCashRefundsPanelProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PettyCashRefundDto | null>(null);

  const query = useQuery({
    queryKey: ['petty-cash-refunds', fund?.id],
    queryFn: () => pettyCashRefundsApi.list(fund!.id),
    enabled: fund !== null,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pettyCashRefundsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-refunds', fund?.id] });
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] });
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-ledger'] });
      notify('استرداد حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف استرداد با خطا مواجه شد.', severity: 'error' });
    },
  });

  const columns: DataTableColumn<PettyCashRefundDto>[] = [
    { key: 'code', header: 'کد', render: (row) => <MonoCode value={row.code} /> },
    { key: 'refundDate', header: 'تاریخ', render: (row) => formatLegacyJalaliDate(row.refundDate) },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.amount) },
    { key: 'reason', header: 'دلیل', render: (row) => row.reason ?? '—' },
    { key: 'recordedByUserId', header: 'ثبت‌کننده', render: (row) => row.recordedByUserId },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Tooltip title="حذف">
          <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(row)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          استردادهای این تنخواه
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddOutlinedIcon />}
          disabled={!fund}
          onClick={() => setDialogOpen(true)}
        >
          ثبت استرداد
        </Button>
      </Stack>

      {!fund ? (
        <Typography variant="body2" color="text.secondary">
          ابتدا یک تنخواه را انتخاب کنید.
        </Typography>
      ) : query.isError ? (
        <ErrorBanner error={query.error} />
      ) : (
        <DataTable
          columns={columns}
          rows={query.data ?? []}
          getRowKey={(row) => row.id}
          isLoading={query.isLoading}
          emptyMessage="هنوز استردادی ثبت نشده است."
        />
      )}

      <PettyCashRefundDialog fund={fund} open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف استرداد"
        description={pendingDelete ? `استرداد «${pendingDelete.code}» حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={deleteMutation.isPending}
        confirmLabel="حذف"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </Paper>
  );
}
