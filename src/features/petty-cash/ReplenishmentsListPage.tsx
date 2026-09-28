import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { formatPersianDateTime } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { pettyCashFundsApi, pettyCashReplenishmentsApi } from './api';
import { getPaymentMethodLabel } from './pettyCashPaymentMethod';
import { PETTY_CASH_REPLENISHMENT_STATE_OPTIONS, getReplenishmentStateColor, getReplenishmentStateLabel } from './pettyCashReplenishmentState';
import type { PettyCashReplenishmentListItemDto } from '../../types/pettyCash';

const PAGE_SIZE = 20;

/**
 * شارژ و ترمیم — بخش ۳-الف (`docs/tankhah-khazaneh-module.md` §۹، صفحهٔ ۹ پاورپوینت). فهرست
 * درخواست‌های ترمیم؛ ساخت/مشاهده/اقدام هرکدام در `ReplenishmentFormPage` است.
 */
export function ReplenishmentsListPage() {
  const navigate = useNavigate();
  const [pageNumber, setPageNumber] = useState(1);
  const [fundFilter, setFundFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  const fundsQuery = useQuery({ queryKey: ['petty-cash-funds'], queryFn: () => pettyCashFundsApi.list() });
  const funds = fundsQuery.data ?? [];

  const query = useQuery({
    queryKey: ['petty-cash-replenishments', pageNumber, fundFilter, stateFilter],
    queryFn: () =>
      pettyCashReplenishmentsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        fundId: fundFilter || undefined,
        state: stateFilter ? (Number(stateFilter) as 1 | 2 | 3 | 4 | 5) : undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const rows = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;

  const columns: DataTableColumn<PettyCashReplenishmentListItemDto>[] = [
    { key: 'code', header: 'کد', render: (row) => <MonoCode value={row.code} /> },
    { key: 'fundName', header: 'تنخواه', render: (row) => row.fundName ?? '—' },
    { key: 'amount', header: 'مبلغ (ریال)', align: 'end', render: (row) => formatThousands(row.totalAmount) },
    { key: 'docCount', header: 'تعداد سند', align: 'end', render: (row) => toPersianDigits(row.docCount) },
    { key: 'paymentMethod', header: 'روش پرداخت', render: (row) => getPaymentMethodLabel(row.paymentMethod) },
    {
      key: 'state',
      header: 'وضعیت',
      render: (row) => (
        <Chip size="small" color={getReplenishmentStateColor(row.state)} label={getReplenishmentStateLabel(row.state)} />
      ),
    },
    { key: 'createdDate', header: 'تاریخ', render: (row) => formatPersianDateTime(row.createdDate) },
    {
      key: 'action',
      header: '',
      render: (row) => (
        <Button size="small" variant="outlined" component={RouterLink} to={`/treasury/petty-cash/replenishments/${row.id}`}>
          مشاهده
        </Button>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<CurrencyExchangeOutlinedIcon />}
        accentColor="secondary"
        title="شارژ و ترمیم"
        description="درخواست ترمیم تنخواه از اسناد تأییدشدهٔ منتظر ترمیم، با مسیر تأیید مدیر مالی ← خزانه‌دار."
        actions={
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddOutlinedIcon />}
            component={RouterLink}
            to="/treasury/petty-cash/replenishments/new"
          >
            درخواست ترمیم جدید
          </Button>
        }
      />

      <ListToolbar summary={`${toPersianDigits(totalCount)} ترمیم`}>
        <TextField
          select
          size="small"
          label="تنخواه"
          value={fundFilter}
          onChange={(e) => {
            setFundFilter(e.target.value);
            setPageNumber(1);
          }}
          sx={{ width: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SavingsOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        >
          <MenuItem value="">همهٔ تنخواه‌ها</MenuItem>
          {funds.map((fund) => (
            <MenuItem key={fund.id} value={fund.id}>
              {fund.name ?? fund.code}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="وضعیت"
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPageNumber(1);
          }}
          sx={{ width: 220 }}
        >
          <MenuItem value="">همهٔ وضعیت‌ها</MenuItem>
          {PETTY_CASH_REPLENISHMENT_STATE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </ListToolbar>

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage="هنوز درخواست ترمیمی ثبت نشده است."
            emptyAction={
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<AddOutlinedIcon />}
                onClick={() => navigate('/treasury/petty-cash/replenishments/new')}
              >
                ثبت اولین درخواست ترمیم
              </Button>
            }
          />
          <Pagination pageNumber={pageNumber} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPageNumber} />
        </>
      )}
    </section>
  );
}
