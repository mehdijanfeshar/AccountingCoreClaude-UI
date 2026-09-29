import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PauseCircleOutlineOutlinedIcon from '@mui/icons-material/PauseCircleOutlineOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { Pagination } from '../../components/Pagination';
import { ErrorBanner } from '../../components/ErrorBanner';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { paymentRequestsApi } from './api';
import { PaymentExecutionDialogs } from './PaymentExecutionDialogs';
import {
  getPaymentRequestStateColor,
  getPaymentRequestStateLabel,
  isPaymentRequestExecutable,
  isPaymentRequestResumable,
  isPaymentRequestSuspendable,
} from './treasuryPaymentRequestState';
import type { PaymentRequestListItemDto } from '../../types/treasury';

const PAGE_SIZE = 20;

/**
 * اجرای پرداخت — خزانه‌داری بخش ۴-ب (`docs/tankhah-khazaneh-module.md` §۱۰). فهرست
 * `GET payment-requests?forExecution=true` — فقط درخواست‌های «آمادهٔ اجرا» و «معلق»، بی‌اثر از
 * فیلتر `state`. اقدامات: اجرا (قطعی)، تعلیق (دلیل اجباری) و رفع تعلیق — همگی در
 * `PaymentExecutionDialogs`.
 */
export function PaymentExecutionListPage() {
  const [pageNumber, setPageNumber] = useState(1);
  const [search, setSearch] = useState('');

  const [executeTarget, setExecuteTarget] = useState<PaymentRequestListItemDto | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<PaymentRequestListItemDto | null>(null);
  const [resumeTarget, setResumeTarget] = useState<PaymentRequestListItemDto | null>(null);

  const listQuery = useQuery({
    queryKey: ['treasury-payment-requests', 'for-execution', pageNumber, PAGE_SIZE, search],
    queryFn: () =>
      paymentRequestsApi.list({
        pageNumber,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        forExecution: true,
      }),
    placeholderData: (previous) => previous,
  });

  const rows = listQuery.data?.page.items ?? [];
  const totalCount = listQuery.data?.page.totalCount ?? 0;

  const columns: DataTableColumn<PaymentRequestListItemDto>[] = [
    { key: 'code', header: 'شماره', render: (row) => <MonoCode value={row.code} /> },
    { key: 'beneficiaryName', header: 'ذی‌نفع', render: (row) => row.beneficiaryName },
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
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
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
          {isPaymentRequestExecutable(row.requestState) && (
            <Tooltip title="اجرا">
              <IconButton size="small" color="success" aria-label="اجرا" onClick={() => setExecuteTarget(row)}>
                <PaymentsOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isPaymentRequestSuspendable(row.requestState) && (
            <Tooltip title="تعلیق">
              <IconButton size="small" color="warning" aria-label="تعلیق" onClick={() => setSuspendTarget(row)}>
                <PauseCircleOutlineOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isPaymentRequestResumable(row.requestState) && (
            <Tooltip title="رفع تعلیق">
              <IconButton size="small" color="primary" aria-label="رفع تعلیق" onClick={() => setResumeTarget(row)}>
                <PlayCircleOutlineOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<PaymentsOutlinedIcon />}
        accentColor="secondary"
        title="اجرای پرداخت"
        description="اجرای واقعی پرداخت‌های آمادهٔ خزانه در بانک — ثبت شمارهٔ مرجع و تاریخ، یا تعلیق/رفع تعلیق موقت."
      />

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
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            isLoading={listQuery.isLoading}
            emptyMessage={search ? 'درخواستی با این جستجو یافت نشد.' : 'در حال حاضر درخواستی آمادهٔ اجرا نیست.'}
          />

          <Pagination pageNumber={pageNumber} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPageNumber} />
        </>
      )}

      <PaymentExecutionDialogs
        executeTarget={executeTarget}
        onCloseExecute={() => setExecuteTarget(null)}
        suspendTarget={suspendTarget}
        onCloseSuspend={() => setSuspendTarget(null)}
        resumeTarget={resumeTarget}
        onCloseResume={() => setResumeTarget(null)}
      />
    </section>
  );
}
