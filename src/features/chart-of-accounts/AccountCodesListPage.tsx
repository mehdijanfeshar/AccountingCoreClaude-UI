import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { accountCodesApi } from './api';
import type { AccountCodeDto } from '../../types/accountCode';

const PAGE_SIZE = 20;

const columns: DataTableColumn<AccountCodeDto>[] = [
  { key: 'accCode', header: 'کد حساب', render: (row) => row.accCode ?? '—' },
  { key: 'accCodeName', header: 'عنوان حساب', render: (row) => row.accCodeName ?? '—' },
  { key: 'id', header: 'شناسه', render: (row) => row.id },
  {
    key: 'action',
    header: 'عملیات',
    render: (row) => (
      <Button size="small" component={RouterLink} to={`/base/account-codes/${row.id}/edit`}>
        ویرایش
      </Button>
    ),
  },
];

/**
 * First real end-to-end read: GET /api/account-codes?pageNumber&pageSize.
 * No `vahedCode` param — chart of accounts is not unit-scoped like vouchers.
 */
export function AccountCodesListPage() {
  const [pageNumber, setPageNumber] = useState(1);

  const query = useQuery({
    queryKey: ['account-codes', pageNumber, PAGE_SIZE],
    queryFn: () => accountCodesApi.list({ pageNumber, pageSize: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  return (
    <section>
      <PageHeader
        eyebrow="اطلاعات پایه"
        icon={<AccountTreeOutlinedIcon />}
        title="کدینگ حسابداری"
        description="فهرست حساب‌ها (سطح گروه/کل/معین/تفصیلی به‌صورت یکجا)"
        actions={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/base/account-codes/new">
            افزودن حساب
          </Button>
        }
      />

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items ?? []}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage="هیچ حسابی یافت نشد."
          />
          {query.data && (
            <Pagination
              pageNumber={query.data.pageNumber}
              pageSize={query.data.pageSize}
              totalCount={query.data.totalCount}
              onPageChange={setPageNumber}
            />
          )}
        </>
      )}
    </section>
  );
}
