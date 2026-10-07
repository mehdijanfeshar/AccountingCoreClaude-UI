import { useState, type SyntheticEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { paymentRequestsApi } from './api';
import {
  PAYMENT_REQUEST_STATE_OPTIONS,
  getPaymentRequestStateColor,
  getPaymentRequestStateLabel,
  getTreasuryPaymentTypeLabel,
  isPaymentRequestDeletable,
  isPaymentRequestEditable,
} from './treasuryPaymentRequestState';
import type { PaymentRequestListItemDto, PaymentRequestStateValue } from '../../types/treasury';

const PAGE_SIZE = 20;

type StatusTab = '' | PaymentRequestStateValue;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: '', label: 'همه' },
  ...PAYMENT_REQUEST_STATE_OPTIONS.map((o) => ({ value: o.value as StatusTab, label: o.label })),
];

/**
 * فهرست درخواست‌های پرداخت — خزانه‌داری بخش ۴-الف (`docs/tankhah-khazaneh-module.md` §۱۰).
 * ساخت/ویرایش/حذف/ارسال. اقدامات تأیید/برگشت/رد در `ApprovalCartablePage` جداست.
 */
export function PaymentRequestListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [statusTab, setStatusTab] = useState<StatusTab>('');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PaymentRequestListItemDto | null>(null);

  function handleTabChange(_event: SyntheticEvent, value: StatusTab) {
    setStatusTab(value);
    setPageNumber(1);
  }

  const listQuery = useQuery({
    queryKey: ['treasury-payment-requests', pageNumber, pageSize, statusTab, search],
    queryFn: () =>
      paymentRequestsApi.list({
        pageNumber,
        pageSize,
        state: statusTab || undefined,
        search: search || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const stateCounts = listQuery.data?.stateCounts ?? [];
  const rows = listQuery.data?.page.items ?? [];
  const totalCount = listQuery.data?.page.totalCount ?? 0;

  async function invalidateList() {
    await queryClient.invalidateQueries({ queryKey: ['treasury-payment-requests'] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentRequestsApi.remove(id),
    onSuccess: async () => {
      await invalidateList();
      notify('درخواست پرداخت حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => paymentRequestsApi.submit(id),
    onSuccess: async () => {
      await invalidateList();
      notify('درخواست پرداخت برای تأیید ارسال شد.');
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'ارسال با خطا مواجه شد.', severity: 'error' });
    },
  });

  const columns: DataTableColumn<PaymentRequestListItemDto>[] = [
    { key: 'code', header: 'شماره', render: (row) => <MonoCode value={row.code} /> },
    { key: 'beneficiaryName', header: 'ذی‌نفع', render: (row) => row.beneficiaryName },
    { key: 'paymentType', header: 'نوع', render: (row) => getTreasuryPaymentTypeLabel(row.paymentType) },
    { key: 'netPayableAmount', header: 'مبلغ خالص (ریال)', align: 'end', render: (row) => formatThousands(row.netPayableAmount) },
    { key: 'dueDate', header: 'سررسید', render: (row) => formatLegacyJalaliDate(row.dueDate) },
    {
      key: 'state',
      header: 'وضعیت',
      render: (row) => (
        <Chip size="small" color={getPaymentRequestStateColor(row.requestState)} label={getPaymentRequestStateLabel(row.requestState)} />
      ),
    },
    {
      key: 'rowActions',
      header: 'اقدام',
      render: (row) => {
        const editable = isPaymentRequestEditable(row.requestState);
        const deletable = isPaymentRequestDeletable(row.requestState);
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={editable ? 'ویرایش' : 'نمایش'}>
              <IconButton
                size="small"
                aria-label={editable ? 'ویرایش' : 'نمایش'}
                component={RouterLink}
                to={`/treasury/khazaneh/payment-requests/${row.id}/edit`}
              >
                {editable ? <EditOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            {editable && (
              <Tooltip title="ارسال برای تأیید">
                <IconButton
                  size="small"
                  color="primary"
                  aria-label="ارسال برای تأیید"
                  onClick={() => submitMutation.mutate(row.id)}
                  disabled={submitMutation.isPending}
                >
                  <SendOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {deletable && (
              <Tooltip title="حذف">
                <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(row)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
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
        icon={<RequestQuoteOutlinedIcon />}
        accentColor="secondary"
        title="درخواست پرداخت"
        description="ثبت، ویرایش و ارسال درخواست پرداخت به زنجیرهٔ تأیید خزانه."
        actions={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddOutlinedIcon />}
            component={RouterLink}
            to="/treasury/khazaneh/payment-requests/new"
          >
            درخواست پرداخت جدید
          </Button>
        }
      />

      <Paper variant="outlined" sx={{ mb: 3, px: 1, borderRadius: 2 }}>
        <Tabs value={statusTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.value === '' ? stateCounts.reduce((total, c) => total + c.count, 0) : stateCounts.find((c) => c.state === tab.value)?.count;
            return (
              <Tab
                key={tab.value || 'all'}
                value={tab.value}
                label={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <span>{tab.label}</span>
                    {count !== undefined && (
                      <Box
                        component="span"
                        sx={{
                          minWidth: 22,
                          px: 0.75,
                          borderRadius: 1,
                          fontSize: '0.7rem',
                          lineHeight: '18px',
                          textAlign: 'center',
                          fontVariantNumeric: 'tabular-nums',
                          bgcolor: count > 0 ? 'action.selected' : 'action.hover',
                          color: count > 0 ? 'text.secondary' : 'text.disabled',
                        }}
                      >
                        {toPersianDigits(count)}
                      </Box>
                    )}
                  </Stack>
                }
              />
            );
          })}
        </Tabs>
      </Paper>

      {listQuery.isError && <ErrorBanner error={listQuery.error} />}

      {!listQuery.isError && (
        <>
          <ListToolbar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPageNumber(1);
            }}
            searchLabel="جستجو"
            summary={`${toPersianDigits(totalCount)} درخواست`}
          />

          <DataTable
            pageable={false}
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={listQuery.isLoading}
            emptyMessage={search ? 'درخواستی با این جستجو یافت نشد.' : 'در این تب هنوز درخواستی نیست.'}
            emptyAction={
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/treasury/khazaneh/payment-requests/new"
              >
                ثبت اولین درخواست
              </Button>
            }
          />

          <Pagination pageNumber={pageNumber} pageSize={pageSize} totalCount={totalCount} onPageChange={setPageNumber}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPageNumber(1);
        }}
      />
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف درخواست پرداخت"
        description={pendingDelete ? `درخواست «${pendingDelete.code}» حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
