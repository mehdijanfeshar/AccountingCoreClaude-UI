import { useMemo, useState, type SyntheticEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { bankStatementsApi } from './api';
import { bankAccountsApi } from '../bank-accounts/api';
import {
  BANK_STATEMENT_STATE_OPTIONS,
  getBankStatementSourceLabel,
  getBankStatementStateColor,
  getBankStatementStateLabel,
} from './bankStatementState';
import type { BankStatementListItemDto, BankStatementStateValue } from '../../types/treasury';
import { NewBankStatementDialog } from './NewBankStatementDialog';

const PAGE_SIZE = 20;
/** تعداد حساب‌های بانکی معمولاً کم است — یک صفحهٔ بزرگ برای نگاشت شناسه→برچسب، هم‌الگوی `TransferListPanel`. */
const BANK_ACCOUNT_LOOKUP_PAGE_SIZE = 200;

type StatusTab = '' | BankStatementStateValue;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: '', label: 'همه' },
  ...BANK_STATEMENT_STATE_OPTIONS.map((o) => ({ value: o.value as StatusTab, label: o.label })),
];

function bankAccountLabel(account: { accountNumber: string | null; accountHolder: string | null } | undefined): string {
  if (!account) return '—';
  return `${account.accountNumber ?? ''} — ${account.accountHolder ?? ''}`;
}

/** فهرست صورت‌حساب‌های بانکی — خزانه‌داری بخش ۴-د (`docs/tankhah-khazaneh-module.md` §۱۰). */
export function BankStatementListPage() {
  const [pageNumber, setPageNumber] = useState(1);
  const [statusTab, setStatusTab] = useState<StatusTab>('');
  const [createOpen, setCreateOpen] = useState(false);

  function handleTabChange(_event: SyntheticEvent, value: StatusTab) {
    setStatusTab(value);
    setPageNumber(1);
  }

  const listQuery = useQuery({
    queryKey: ['treasury-bank-statements', pageNumber, PAGE_SIZE, statusTab],
    queryFn: () => bankStatementsApi.list({ pageNumber, pageSize: PAGE_SIZE, state: statusTab || undefined }),
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

  const columns: DataTableColumn<BankStatementListItemDto>[] = [
    {
      key: 'code',
      header: 'شماره',
      render: (row) => (
        <Box component={RouterLink} to={`/treasury/khazaneh/bank-reconciliation/${row.id}`} sx={{ textDecoration: 'none', color: 'inherit' }}>
          <MonoCode value={row.code} />
        </Box>
      ),
    },
    { key: 'bankAccount', header: 'حساب بانکی', render: (row) => bankAccountLabel(bankAccountsById.get(row.bankAccountId)) },
    {
      key: 'period',
      header: 'بازه',
      render: (row) => `${formatLegacyJalaliDate(row.fromDate)} تا ${formatLegacyJalaliDate(row.toDate)}`,
    },
    { key: 'closingBalance', header: 'مانده پایانی (ریال)', align: 'end', render: (row) => formatThousands(row.closingBalance) },
    { key: 'source', header: 'منبع', render: (row) => getBankStatementSourceLabel(row.source) },
    {
      key: 'state',
      header: 'وضعیت',
      render: (row) => <Chip size="small" color={getBankStatementStateColor(row.state)} label={getBankStatementStateLabel(row.state)} />,
    },
    {
      key: 'rowActions',
      header: 'اقدام',
      render: (row) => (
        <Tooltip title="مشاهده">
          <IconButton
            size="small"
            aria-label="مشاهده"
            component={RouterLink}
            to={`/treasury/khazaneh/bank-reconciliation/${row.id}`}
          >
            <VisibilityOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<RuleOutlinedIcon />}
        accentColor="secondary"
        title="مغایرت بانکی"
        description="صورت‌حساب‌های بانکی و تطبیق ردیف‌های آن با دفتر."
      />

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
        <Button variant="contained" color="secondary" size="small" startIcon={<AddOutlinedIcon />} onClick={() => setCreateOpen(true)} sx={{ m: 1 }}>
          صورت‌حساب جدید
        </Button>
      </Paper>

      {listQuery.isError && <ErrorBanner error={listQuery.error} />}

      {!listQuery.isError && (
        <>
          <ListToolbar summary={`${toPersianDigits(totalCount)} صورت‌حساب`} />

          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={listQuery.isLoading}
            emptyMessage="در این تب هنوز صورت‌حسابی نیست."
            emptyAction={
              <Button size="small" variant="outlined" color="secondary" startIcon={<AddOutlinedIcon />} onClick={() => setCreateOpen(true)}>
                ثبت اولین صورت‌حساب
              </Button>
            }
          />

          <Pagination pageNumber={pageNumber} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPageNumber} />
        </>
      )}

      <NewBankStatementDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </section>
  );
}
