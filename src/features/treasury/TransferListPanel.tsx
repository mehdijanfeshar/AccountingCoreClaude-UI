import { useMemo, useState, type SyntheticEvent } from 'react';
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
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { transfersApi } from './api';
import { bankAccountsApi } from '../bank-accounts/api';
import { TRANSFER_STATE_OPTIONS, getTransferStateColor, getTransferStateLabel, isTransferEditable } from './receiptTransferState';
import type { TransferListItemDto, TransferStateValue } from '../../types/treasury';

const PAGE_SIZE = 20;
/** تعداد حساب‌های بانکی معمولاً کم است — یک صفحهٔ بزرگ برای ساخت نگاشت شناسه→برچسب، هم‌الگوی `TreasurySettingsPage.tafsilGroupsQuery`. */
const BANK_ACCOUNT_LOOKUP_PAGE_SIZE = 200;

type StatusTab = '' | TransferStateValue;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: '', label: 'همه' },
  ...TRANSFER_STATE_OPTIONS.map((o) => ({ value: o.value as StatusTab, label: o.label })),
];

function bankAccountLabel(account: { accountNumber: string | null; accountHolder: string | null } | undefined): string {
  if (!account) return '—';
  return `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`;
}

/** فهرست انتقال‌های وجه — خزانه‌داری بخش ۴-ج، تب «انتقال وجه» صفحهٔ `ReceiptsTransfersPage`. */
export function TransferListPanel() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [statusTab, setStatusTab] = useState<StatusTab>('');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<TransferListItemDto | null>(null);

  function handleTabChange(_event: SyntheticEvent, value: StatusTab) {
    setStatusTab(value);
    setPageNumber(1);
  }

  const listQuery = useQuery({
    queryKey: ['treasury-transfers', pageNumber, pageSize, statusTab, search],
    queryFn: () =>
      transfersApi.list({
        pageNumber,
        pageSize,
        state: statusTab || undefined,
        search: search || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const bankAccountsLookupQuery = useQuery({
    queryKey: ['bank-accounts-lookup'],
    queryFn: () => bankAccountsApi.list({ pageNumber: 1, pageSize: BANK_ACCOUNT_LOOKUP_PAGE_SIZE }),
  });
  const bankAccountsById = useMemo(() => {
    const map = new Map<string, { accountNumber: string | null; accountHolder: string | null }>();
    for (const account of bankAccountsLookupQuery.data?.items ?? []) map.set(account.id, account);
    return map;
  }, [bankAccountsLookupQuery.data]);

  const stateCounts = listQuery.data?.stateCounts ?? [];
  const rows = listQuery.data?.page.items ?? [];
  const totalCount = listQuery.data?.page.totalCount ?? 0;

  async function invalidateList() {
    await queryClient.invalidateQueries({ queryKey: ['treasury-transfers'] });
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transfersApi.remove(id),
    onSuccess: async () => {
      await invalidateList();
      notify('انتقال وجه حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'حذف با خطا مواجه شد.', severity: 'error' });
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => transfersApi.submit(id),
    onSuccess: async () => {
      await invalidateList();
      notify('انتقال وجه برای تأیید خزانه‌دار ارسال شد.');
    },
    onError: (error) => {
      notify({ message: error instanceof Error ? error.message : 'ارسال با خطا مواجه شد.', severity: 'error' });
    },
  });

  const columns: DataTableColumn<TransferListItemDto>[] = [
    { key: 'code', header: 'شماره', render: (row) => <MonoCode value={row.code} /> },
    { key: 'source', header: 'حساب مبدأ', render: (row) => bankAccountLabel(bankAccountsById.get(row.sourceBankAccountId)) },
    { key: 'dest', header: 'حساب مقصد', render: (row) => bankAccountLabel(bankAccountsById.get(row.destBankAccountId)) },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.amount) },
    { key: 'transferDate', header: 'تاریخ انتقال', render: (row) => formatLegacyJalaliDate(row.transferDate) },
    {
      key: 'state',
      header: 'وضعیت',
      render: (row) => <Chip size="small" color={getTransferStateColor(row.state)} label={getTransferStateLabel(row.state)} />,
    },
    {
      key: 'rowActions',
      header: 'اقدام',
      render: (row) => {
        const editable = isTransferEditable(row.state);
        return (
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={editable ? 'ویرایش' : 'نمایش'}>
              <IconButton
                size="small"
                aria-label={editable ? 'ویرایش' : 'نمایش'}
                component={RouterLink}
                to={`/treasury/khazaneh/transfers/${row.id}/edit`}
              >
                {editable ? <EditOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            {editable && (
              <Tooltip title="ارسال برای تأیید خزانه‌دار">
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
          to="/treasury/khazaneh/transfers/new"
          sx={{ m: 1 }}
        >
          انتقال جدید
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
            summary={`${toPersianDigits(totalCount)} انتقال`}
          />

          <DataTable
            pageable={false}
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={listQuery.isLoading}
            emptyMessage={search ? 'انتقالی با این جستجو یافت نشد.' : 'در این تب هنوز انتقالی نیست.'}
            emptyAction={
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<AddOutlinedIcon />}
                component={RouterLink}
                to="/treasury/khazaneh/transfers/new"
              >
                ثبت اولین انتقال
              </Button>
            }
          />

          <Pagination
            pageNumber={pageNumber}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPageNumber}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageNumber(1);
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف انتقال وجه"
        description={pendingDelete ? `انتقال «${pendingDelete.code}» حذف می‌شود. ادامه می‌دهید؟` : undefined}
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </>
  );
}
