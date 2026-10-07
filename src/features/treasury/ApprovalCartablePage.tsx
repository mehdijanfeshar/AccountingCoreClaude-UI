import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import KeyboardReturnOutlinedIcon from '@mui/icons-material/KeyboardReturnOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import DoneAllOutlinedIcon from '@mui/icons-material/DoneAllOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { approvalCartableApi, type BulkApproveFailure, paymentRequestsApi } from './api';
import { getBulkApproveFailureReasonLabel } from './treasuryPaymentRequestState';
import { CartableReviewDialogs, type CartableActionTarget } from './CartableReviewDialogs';
import { TransferReviewDialogs, type TransferReviewTarget } from './TransferReviewDialogs';
import type { ApprovalCartableItemDto } from '../../types/treasury';

const PAGE_SIZE = 20;

/**
 * کارتابل تأیید خزانه‌داری — بخش ۴-الف (`docs/tankhah-khazaneh-module.md` §۱۰). یک فهرست ادغام‌شدهٔ
 * سمت سرور: درخواست‌های پرداخت Pending* + ترمیم‌های تنخواهِ `PendingTreasurer`. `pendingForMe`
 * مشخص می‌کند اقدام واقعاً برای کاربر جاری باز است — ردیف‌های دیگر فقط نمایشی‌اند.
 *
 * ⚠️ «تأیید گروهی» فقط برای درخواست‌های پرداخت است (`POST payment-requests/bulk-approve`) — هیچ
 * endpoint گروهی‌ای برای ترمیم تنخواه وجود ندارد؛ ردیف‌های ترمیم قابل‌انتخاب نیستند.
 */
export function ApprovalCartablePage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproveFailures, setBulkApproveFailures] = useState<BulkApproveFailure[] | null>(null);

  const [approveTarget, setApproveTarget] = useState<CartableActionTarget | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CartableActionTarget | null>(null);
  const [returnTarget, setReturnTarget] = useState<CartableActionTarget | null>(null);

  // بخش ۴-ج (۲۰۲۶-۰۹-۲۹) — انتقال وجه: شکل تأیید/برگشت/رد سرورش با پرداخت/ترمیم فرق دارد (تأیید
  // شمارهٔ مرجع بانکی می‌خواهد نه یادداشت اختیاری) — دیالوگ‌های جدای `TransferReviewDialogs`، نه
  // `CartableReviewDialogs`.
  const [transferApproveTarget, setTransferApproveTarget] = useState<TransferReviewTarget | null>(null);
  const [transferReturnTarget, setTransferReturnTarget] = useState<TransferReviewTarget | null>(null);
  const [transferRejectTarget, setTransferRejectTarget] = useState<TransferReviewTarget | null>(null);

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const cartableQuery = useQuery({
    queryKey: ['treasury-approval-cartable', pageNumber, pageSize],
    queryFn: () => approvalCartableApi.list({ pageNumber, pageSize: pageSize }),
    placeholderData: (previous) => previous,
  });

  const rows = cartableQuery.data?.items ?? [];
  const totalCount = cartableQuery.data?.totalCount ?? 0;

  const bulkApproveMutation = useMutation({
    mutationFn: (ids: string[]) => paymentRequestsApi.bulkApprove(ids),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['treasury-approval-cartable'] });
      await queryClient.invalidateQueries({ queryKey: ['treasury-payment-requests'] });
      notify(`${toPersianDigits(result.ids.length)} درخواست تأیید شد.`);
      clearSelection();
      setBulkApproveFailures(null);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        const failures = (error.problem?.failedIds as BulkApproveFailure[] | undefined) ?? [];
        setBulkApproveFailures(failures);
        return;
      }
      notify({ message: error instanceof Error ? error.message : 'تأیید گروهی با خطا مواجه شد.', severity: 'error' });
    },
  });

  const columns: DataTableColumn<ApprovalCartableItemDto>[] = [
    {
      key: 'select',
      header: '',
      width: 40,
      render: (row) => {
        if (row.nature !== 'payment' || !row.pendingForMe) return null;
        return (
          <Checkbox
            size="small"
            aria-label="انتخاب برای تأیید گروهی"
            checked={selectedIds.has(row.id)}
            onChange={(event) => toggleSelected(row.id, event.target.checked)}
          />
        );
      },
    },
    { key: 'code', header: 'شماره', render: (row) => <MonoCode value={row.code} /> },
    {
      key: 'nature',
      header: 'نوع',
      render: (row) => (
        <Chip
          size="small"
          variant="outlined"
          color={row.nature === 'payment' ? 'secondary' : row.nature === 'transfer' ? 'warning' : 'info'}
          label={row.nature === 'payment' ? 'درخواست پرداخت' : row.nature === 'transfer' ? 'انتقال وجه' : 'ترمیم تنخواه'}
        />
      ),
    },
    { key: 'beneficiaryOrFund', header: 'ذی‌نفع/تنخواه', render: (row) => row.beneficiaryOrFund },
    { key: 'description', header: 'شرح', render: (row) => row.description ?? '—' },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.amount) },
    { key: 'state', header: 'وضعیت', render: (row) => <Chip size="small" label={row.stateLabel} /> },
    { key: 'dueDate', header: 'سررسید', render: (row) => (row.dueDate ? formatLegacyJalaliDate(row.dueDate) : '—') },
    {
      key: 'age',
      header: 'عمر',
      render: (row) => (
        <Typography
          variant="body2"
          component="span"
          sx={{ color: row.ageDays > 5 ? 'error.main' : 'text.primary', fontWeight: row.ageDays > 5 ? 700 : 400 }}
        >
          {toPersianDigits(row.ageDays)} روز
        </Typography>
      ),
    },
    {
      key: 'rowActions',
      header: 'اقدام',
      render: (row) => {
        if (row.nature === 'transfer') {
          const transferTarget: TransferReviewTarget = { id: row.id, code: row.code };
          return (
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="نمایش">
                <IconButton
                  size="small"
                  aria-label="نمایش"
                  component={RouterLink}
                  to={`/treasury/khazaneh/transfers/${row.id}/edit`}
                >
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {row.pendingForMe && (
                <>
                  <Tooltip title="تأیید">
                    <IconButton size="small" color="success" aria-label="تأیید" onClick={() => setTransferApproveTarget(transferTarget)}>
                      <CheckCircleOutlineOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="برگشت">
                    <IconButton size="small" color="warning" aria-label="برگشت" onClick={() => setTransferReturnTarget(transferTarget)}>
                      <KeyboardReturnOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="رد">
                    <IconButton size="small" color="error" aria-label="رد" onClick={() => setTransferRejectTarget(transferTarget)}>
                      <CancelOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Stack>
          );
        }

        const target: CartableActionTarget = { nature: row.nature, id: row.id, code: row.code };
        return (
          <Stack direction="row" spacing={0.5}>
            {row.nature === 'payment' && (
              <Tooltip title="نمایش">
                <IconButton
                  size="small"
                  aria-label="نمایش"
                  component={RouterLink}
                  to={`/treasury/khazaneh/payment-requests/${row.id}/edit`}
                >
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {row.pendingForMe && (
              <>
                <Tooltip title={row.nature === 'payment' ? 'تأیید' : 'ثبت پرداخت'}>
                  <IconButton size="small" color="success" aria-label="تأیید" onClick={() => setApproveTarget(target)}>
                    <CheckCircleOutlineOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {row.nature === 'payment' && (
                  <Tooltip title="برگشت">
                    <IconButton size="small" color="warning" aria-label="برگشت" onClick={() => setReturnTarget(target)}>
                      <KeyboardReturnOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="رد">
                  <IconButton size="small" color="error" aria-label="رد" onClick={() => setRejectTarget(target)}>
                    <CancelOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<FactCheckOutlinedIcon />}
        accentColor="secondary"
        title="کارتابل تأیید خزانه"
        description="درخواست‌های پرداخت در انتظار تأیید و ترمیم‌های تنخواه در انتظار خزانه‌دار، در یک فهرست."
      />

      {cartableQuery.isError && <ErrorBanner error={cartableQuery.error} />}

      {!cartableQuery.isError && (
        <>
          {selectedIds.size > 0 && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
              <Chip size="small" color="primary" label={`${toPersianDigits(selectedIds.size)} درخواست انتخاب شده`} />
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<DoneAllOutlinedIcon />}
                onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
                disabled={bulkApproveMutation.isPending}
              >
                {bulkApproveMutation.isPending ? 'در حال تأیید…' : 'تأیید گروهی'}
              </Button>
              <Button size="small" variant="text" color="inherit" onClick={clearSelection}>
                لغو انتخاب
              </Button>
            </Stack>
          )}

          <DataTable
            pageable={false}
            columns={columns}
            rows={rows}
            getRowKey={(row) => `${row.nature}-${row.id}`}
            isLoading={cartableQuery.isLoading}
            emptyMessage="کارتابل خالی است."
          />

          <Pagination pageNumber={pageNumber} pageSize={pageSize} totalCount={totalCount} onPageChange={setPageNumber}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageNumber(1);
        }}
      />
        </>
      )}

      <CartableReviewDialogs
        approveTarget={approveTarget}
        onCloseApprove={() => setApproveTarget(null)}
        rejectTarget={rejectTarget}
        onCloseReject={() => setRejectTarget(null)}
        returnTarget={returnTarget}
        onCloseReturn={() => setReturnTarget(null)}
      />

      <TransferReviewDialogs
        approveTarget={transferApproveTarget}
        onCloseApprove={() => setTransferApproveTarget(null)}
        returnTarget={transferReturnTarget}
        onCloseReturn={() => setTransferReturnTarget(null)}
        rejectTarget={transferRejectTarget}
        onCloseReject={() => setTransferRejectTarget(null)}
      />

      <Dialog open={bulkApproveFailures !== null} onClose={() => setBulkApproveFailures(null)} maxWidth="sm" fullWidth>
        <DialogTitle>تأیید گروهی ناموفق بود</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            هیچ‌کدام از درخواست‌های انتخاب‌شده تأیید نشدند. دلیل هر مورد:
          </Typography>
          <Stack spacing={1}>
            {bulkApproveFailures?.map((failure) => (
              <Stack key={failure.id} direction="row" spacing={1} sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2">{rows.find((r) => r.id === failure.id)?.code ?? failure.id}</Typography>
                <Typography variant="body2" color="error.main">
                  {getBulkApproveFailureReasonLabel(failure.reason)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkApproveFailures(null)} color="inherit">
            بستن
          </Button>
          <Button
            variant="contained"
            disabled={bulkApproveMutation.isPending}
            onClick={() => {
              const failedIdSet = new Set((bulkApproveFailures ?? []).map((f) => f.id));
              const remaining = Array.from(selectedIds).filter((id) => !failedIdSet.has(id));
              setSelectedIds(new Set(remaining));
              setBulkApproveFailures(null);
              if (remaining.length > 0) bulkApproveMutation.mutate(remaining);
            }}
          >
            حذف موارد ناموفق و تلاش مجدد
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
