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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { receiptsApi } from './api';
import { RECEIPT_STATE_OPTIONS, getReceiptStateColor, getReceiptStateLabel, isReceiptDraft } from './receiptTransferState';
import type { ReceiptListItemDto, ReceiptStateValue } from '../../types/treasury';

const PAGE_SIZE = 20;

type StatusTab = '' | ReceiptStateValue;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: '', label: 'همه' },
  ...RECEIPT_STATE_OPTIONS.map((o) => ({ value: o.value as StatusTab, label: o.label })),
];

/** فهرست دریافت‌های وجه — خزانه‌داری بخش ۴-ج، تب «دریافت وجه» صفحهٔ `ReceiptsTransfersPage`. */
export function ReceiptListPanel() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [statusTab, setStatusTab] = useState<StatusTab>('');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ReceiptListItemDto | null>(null);
  const [pendingCancel, setPendingCancel] = useState<ReceiptListItemDto | null>(null);

  function handleTabChange(_event: SyntheticEvent, value: StatusTab) {
    setStatusTab(value);
    setPageNumber(1);
  }

  const listQuery = useQuery({
    queryKey: ['treasury-receipts', pageNumber, PAGE_SIZE, statusTab, search],
    queryFn: () =>
      receiptsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        state: statusTab || undefined,
        search: search || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const stateCounts = listQuery.data?.stateCounts ?? [];
  const rows = listQuery.data?.page.items ?? [];
  const totalCount = listQuery.data?.page.totalCount ?? 0;

  async function invalidateList() {
    await queryClient.invalidateQueries({ queryKey: ['treasury-receipts'] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => receiptsApi.remove(id),
    onSuccess: async () => {
      await invalidateList();
      notify('دریافت وجه حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => receiptsApi.cancel(id),
    onSuccess: async () => {
      await invalidateList();
      notify('دریافت وجه لغو شد.');
      setPendingCancel(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'لغو با خطا مواجه شد.', severity: 'error' });
    },
  });

  const columns: DataTableColumn<ReceiptListItemDto>[] = [
    { key: 'code', header: 'شماره', render: (row) => <MonoCode value={row.code} /> },
    { key: 'payerName', header: 'پرداخت‌کننده', render: (row) => row.payerName },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.amount) },
    { key: 'receiptDate', header: 'تاریخ دریافت', render: (row) => formatLegacyJalaliDate(row.receiptDate) },
    {
      key: 'state',
      header: 'وضعیت',
      render: (row) => <Chip size="small" color={getReceiptStateColor(row.state)} label={getReceiptStateLabel(row.state)} />,
    },
    {
      key: 'rowActions',
      header: 'اقدام',
      render: (row) => {
        const editable = isReceiptDraft(row.state);
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={editable ? 'ویرایش' : 'نمایش'}>
              <IconButton
                size="small"
                aria-label={editable ? 'ویرایش' : 'نمایش'}
                component={RouterLink}
                to={`/treasury/khazaneh/receipts/${row.id}/edit`}
              >
                {editable ? <EditOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            {editable && (
              <Tooltip title="لغو">
                <IconButton size="small" color="warning" aria-label="لغو" onClick={() => setPendingCancel(row)}>
                  <CancelOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {editable && (
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
    <>
      <Paper variant="outlined" sx={{ mb: 3, px: 1, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
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
        <Button
          variant="contained"
          color="secondary"
          size="small"
          startIcon={<AddOutlinedIcon />}
          component={RouterLink}
          to="/treasury/khazaneh/receipts/new"
          sx={{ m: 1 }}
        >
          دریافت جدید
        </Button>
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
            summary={`${toPersianDigits(totalCount)} دریافت`}
          />

          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={listQuery.isLoading}
            emptyMessage={search ? 'دریافتی با این جستجو یافت نشد.' : 'در این تب هنوز دریافتی نیست.'}
            emptyAction={
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/treasury/khazaneh/receipts/new"
              >
                ثبت اولین دریافت
              </Button>
            }
          />

          <Pagination pageNumber={pageNumber} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPageNumber} />
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف دریافت وجه"
        description={pendingDelete ? `دریافت «${pendingDelete.code}» حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
      <ConfirmDialog
        open={pendingCancel !== null}
        title="لغو دریافت وجه"
        description={pendingCancel ? `دریافت «${pendingCancel.code}» لغو می‌شود. ادامه می‌دهید؟` : undefined}
        confirmLabel="لغو دریافت"
        confirmColor="primary"
        pending={cancelMutation.isPending}
        onCancel={() => setPendingCancel(null)}
        onConfirm={() => pendingCancel && cancelMutation.mutate(pendingCancel.id)}
      />
    </>
  );
}
