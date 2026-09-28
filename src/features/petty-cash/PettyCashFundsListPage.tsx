import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import SavingsOutlinedIcon from '@mui/icons-material/SavingsOutlined';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ListToolbar } from '../../components/ListToolbar';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { ApiError } from '../../lib/api/apiError';
import { toPersianDigits, formatThousands } from '../../lib/format/numbers';
import { pettyCashFundsApi } from './api';
import { getSettlementPeriodLabel } from './pettyCashDocState';
import { PettyCashFundFormDialog } from './PettyCashFundFormDialog';
import { PettyCashReviewersDialog } from './PettyCashReviewersDialog';
import type { PettyCashFundDto } from '../../types/pettyCash';

/**
 * تعریف تنخواه — ص ۱۳. تصمیم صاحب پروژه ۲۰۲۶-۰۹-۲۸: تنخواه‌های این ماژول جدول مستقل خودشان
 * (`TB_PC_FUND`) را دارند؛ این صفحه خودِ ساخت/ویرایش/حذف تنخواه است، نه فقط تنظیماتی روی «تنخواه»
 * اطلاعات پایه (که دیگر اینجا هیچ ارجاعی به آن نیست).
 */
export function PettyCashFundsListPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('');
  const [formFund, setFormFund] = useState<PettyCashFundDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [reviewersFund, setReviewersFund] = useState<PettyCashFundDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PettyCashFundDto | null>(null);

  const query = useQuery({
    queryKey: ['petty-cash-funds'],
    queryFn: () => pettyCashFundsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (fundId: string) => pettyCashFundsApi.remove(fundId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['petty-cash-funds'] });
      notify('تنخواه حذف شد.');
      setPendingDelete(null);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError && error.status === 409
          ? error.detail ?? 'این تنخواه صورت‌هزینهٔ حذف‌نشده دارد و قابل حذف نیست.'
          : error instanceof Error
            ? error.message
            : 'حذف تنخواه با خطا مواجه شد.';
      notify({ message, severity: 'error' });
    },
  });

  const rows = useMemo(() => {
    const items = query.data ?? [];
    if (!filter.trim()) return items;
    const needle = filter.trim().toLowerCase();
    return items.filter(
      (row) => (row.code ?? '').toLowerCase().includes(needle) || (row.name ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

  function openCreateForm() {
    setFormFund(null);
    setFormOpen(true);
  }

  function openEditForm(fund: PettyCashFundDto) {
    setFormFund(fund);
    setFormOpen(true);
  }

  const columns: DataTableColumn<PettyCashFundDto>[] = [
    { key: 'code', header: 'کد', render: (row) => <MonoCode value={row.code} /> },
    { key: 'name', header: 'عنوان', render: (row) => row.name ?? '—' },
    { key: 'custodian', header: 'تنخواه‌دار', render: (row) => row.custodianName || row.custodianUserId || '—' },
    { key: 'ceiling', header: 'سقف تنخواه', render: (row) => (row.ceiling != null ? formatThousands(row.ceiling) : '—') },
    {
      key: 'perDocLimit',
      header: 'سقف هر سند',
      render: (row) => (row.perDocLimit != null ? formatThousands(row.perDocLimit) : '—'),
    },
    {
      key: 'alertThreshold',
      header: 'آستانهٔ هشدار',
      render: (row) => (row.alertThresholdPercent != null ? `${toPersianDigits(row.alertThresholdPercent)}٪` : '—'),
    },
    {
      key: 'settlementPeriod',
      header: 'دورهٔ تسویه',
      render: (row) => getSettlementPeriodLabel(row.settlementPeriod),
    },
    {
      key: 'isActive',
      header: 'وضعیت',
      render: (row) => (
        <Chip size="small" color={row.isActive ? 'success' : 'default'} label={row.isActive ? 'فعال' : 'غیرفعال'} />
      ),
    },
    {
      key: 'cashBalance',
      header: 'موجودی نقد',
      render: (row) => (row.cashBalance != null ? formatThousands(row.cashBalance) : '—'),
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="ویرایش">
            <IconButton size="small" aria-label="ویرایش" onClick={() => openEditForm(row)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="بررسی‌کنندگان">
            <IconButton size="small" aria-label="بررسی‌کنندگان" onClick={() => setReviewersFund(row)}>
              <PeopleAltOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="حذف">
            <IconButton size="small" color="error" aria-label="حذف" onClick={() => setPendingDelete(row)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        eyebrow="تنخواه و خزانه‌داری"
        icon={<SavingsOutlinedIcon />}
        accentColor="secondary"
        title="تعریف تنخواه"
        description="ساخت و ویرایش تنخواه‌ها — سقف، سقف هر سند، آستانهٔ هشدار، تنخواه‌دار و دورهٔ تسویه."
        actions={
          <Button variant="contained" color="secondary" startIcon={<AddOutlinedIcon />} onClick={openCreateForm}>
            تنخواه جدید
          </Button>
        }
      />

      <ListToolbar
        search={filter}
        onSearchChange={setFilter}
        searchLabel="جستجو در همین صفحه"
        summary={query.data ? `${toPersianDigits(query.data.length)} تنخواه` : ''}
      />

      {query.isError && <ErrorBanner error={query.error} />}

      {!query.isError && (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          isLoading={query.isLoading}
          emptyMessage={
            filter.trim() ? 'نتیجه‌ای برای این جستجو یافت نشد.' : 'هنوز تنخواهی تعریف نشده است.'
          }
          emptyAction={
            filter.trim() ? (
              <Button size="small" variant="text" onClick={() => setFilter('')}>
                پاک کردن جستجو
              </Button>
            ) : (
              <Button size="small" variant="outlined" color="secondary" startIcon={<AddOutlinedIcon />} onClick={openCreateForm}>
                افزودن اولین تنخواه
              </Button>
            )
          }
        />
      )}

      {rows.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          موجودی نقد از فرمول «سقف − Σ مبلغ اسناد در وضعیت جدید/در انتظار بررسی/برگشتی/تأییدشده»
          محاسبه می‌شود (سند مرجع بخش ۲) و تا ساخت شارژ/ترمیم (بخش ۳) موقت است.
        </Typography>
      )}

      <PettyCashFundFormDialog fund={formFund} open={formOpen} onClose={() => setFormOpen(false)} />

      <PettyCashReviewersDialog
        fund={reviewersFund}
        open={reviewersFund !== null}
        onClose={() => setReviewersFund(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف تنخواه"
        description={
          pendingDelete ? `تنخواه «${pendingDelete.name}» حذف می‌شود. ادامه می‌دهید؟` : undefined
        }
        pending={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
      />
    </section>
  );
}
