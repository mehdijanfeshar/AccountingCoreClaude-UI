import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import Button from '@mui/material/Button';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useSession } from '../../lib/session/SessionContext';
import { voucherHeadsApi } from './api';
import type { VoucherHeadDto } from '../../types/voucherHead';

const PAGE_SIZE = 20;

const columns: DataTableColumn<VoucherHeadDto>[] = [
  { key: 'docNum', header: 'شماره سند', render: (row) => row.docNum ?? '—' },
  { key: 'dateDoc', header: 'تاریخ سند', render: (row) => row.dateDoc ?? '—' },
  { key: 'headDesc', header: 'شرح سند', render: (row) => row.headDesc ?? '—' },
  { key: 'year', header: 'سال مالی', render: (row) => row.year ?? '—' },
];

/**
 * Second end-to-end read: GET /api/voucher-heads?pageNumber&pageSize&year.
 * `year` comes from the "تنظیمات اولیه" session context (top bar), not a
 * page-local field. Unit scope is NOT sent — server-derived.
 */
export function VoucherHeadsListPage() {
  const { financialYear, isConfigured } = useSession();
  const [pageNumber, setPageNumber] = useState(1);

  const query = useQuery({
    queryKey: ['voucher-heads', pageNumber, PAGE_SIZE, financialYear],
    queryFn: () =>
      voucherHeadsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        year: financialYear || undefined,
      }),
    placeholderData: (previous) => previous,
    enabled: isConfigured,
  });

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<DescriptionOutlinedIcon />}
        accentColor="secondary"
        title="اسناد حسابداری"
        description="فهرست سرسند اسناد بر اساس سال مالی انتخاب‌شده در نوار بالا"
        actions={
          <Button variant="contained" color="secondary" startIcon={<AddOutlinedIcon />} component={RouterLink} to="/operation/vouchers/new">
            صدور سند جدید
          </Button>
        }
      />

      {!isConfigured && (
        <p role="status">برای مشاهدهٔ اسناد، ابتدا سال مالی را از نوار بالا انتخاب کنید.</p>
      )}

      {query.isError && <ErrorBanner error={query.error} />}

      {isConfigured && !query.isError && (
        <>
          <DataTable
            columns={columns}
            rows={query.data?.items ?? []}
            getRowKey={(row) => row.id}
            isLoading={query.isLoading}
            emptyMessage="هیچ سندی برای این سال مالی یافت نشد."
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
