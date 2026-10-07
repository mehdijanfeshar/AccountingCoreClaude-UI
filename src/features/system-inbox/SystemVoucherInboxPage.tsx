import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { useSession } from '../../lib/session/SessionContext';
import { formatLegacyJalaliDate, formatPersianDateTime } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { systemInboxApi, type SystemVoucherInboxItem, type SystemVoucherInboxLine } from './api';

/**
 * دریافت اسناد از سایر سیستم‌ها (فاز ۵۲). سیستم‌هایی مثل حقوق سند را در جدول‌های موقت
 * (TB_TMP_VOUCHERHEAD/DETAIL) می‌گذارند؛ این‌جا واحد پیش‌نمایش می‌بیند و «دریافت» سند یادداشت می‌سازد.
 * معین‌های «فقط سیستمی» فقط از همین مسیر قابل ثبت‌اند.
 */
export function SystemVoucherInboxPage() {
  const queryClient = useQueryClient();
  const { financialYear } = useSession();
  const [includeReceived, setIncludeReceived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['system-voucher-inbox', financialYear, includeReceived],
    queryFn: () => systemInboxApi.list(financialYear, includeReceived),
    enabled: !!financialYear,
  });

  const detailQuery = useQuery({
    queryKey: ['system-voucher-inbox', 'detail', openId],
    queryFn: () => systemInboxApi.get(openId as string),
    enabled: !!openId,
  });

  const receive = useMutation({
    mutationFn: (id: string) => systemInboxApi.receive(id),
    onSuccess: async (r) => {
      setMessage(`سند شمارهٔ ${toPersianDigits(r.docNum)} در وضعیت یادداشت ساخته شد.`);
      setOpenId(null);
      await queryClient.invalidateQueries({ queryKey: ['system-voucher-inbox'] });
      await queryClient.invalidateQueries({ queryKey: ['voucher-heads'] });
    },
  });

  function open(id: string) {
    receive.reset();
    setOpenId(id);
  }

  const columns: DataTableColumn<SystemVoucherInboxItem>[] = [
    { key: 'sys', header: 'سیستم ارسال‌کننده', render: (r) => r.sysType || '—' },
    { key: 'date', header: 'تاریخ سند', render: (r) => formatLegacyJalaliDate(r.dateDoc) },
    { key: 'desc', header: 'شرح', render: (r) => r.headDesc || '—' },
    { key: 'lines', header: 'ردیف', align: 'center', render: (r) => toPersianDigits(r.lineCount) },
    { key: 'debtor', header: 'بدهکار', align: 'end', render: (r) => formatThousands(r.debtor) },
    { key: 'creditor', header: 'بستانکار', align: 'end', render: (r) => formatThousands(r.creditor) },
    { key: 'created', header: 'زمان ارسال', render: (r) => formatPersianDateTime(r.createdDate) },
    {
      key: 'state',
      header: 'وضعیت',
      render: (r) =>
        r.voucherHeadId ? (
          <Chip size="small" color="success" label={`دریافت شد — سند ${toPersianDigits(r.voucherDocNum ?? '')}`} />
        ) : (
          <Chip size="small" color="warning" label="منتظر دریافت" />
        ),
    },
    {
      key: 'action',
      header: 'عملیات',
      render: (r) => (
        <Button size="small" onClick={() => open(r.id)}>
          {r.voucherHeadId ? 'مشاهده' : 'بررسی و دریافت'}
        </Button>
      ),
    },
  ];

  const lineColumns: DataTableColumn<SystemVoucherInboxLine>[] = [
    { key: 'radif', header: 'ردیف', render: (l) => (l.radif != null ? toPersianDigits(l.radif) : '—') },
    { key: 'moin', header: 'معین', render: (l) => `${l.moinCode ?? ''}${l.moinName ? ` - ${l.moinName}` : ''}` },
    {
      key: 'taf',
      header: 'تفصیلی‌ها',
      render: (l) =>
        l.tafsilis.length === 0
          ? '—'
          : l.tafsilis
              .map((t) => `سطح ${toPersianDigits(t.level)}: ${t.code}${t.name ? ` ${t.name}` : ''}`)
              .join('، '),
    },
    { key: 'desc', header: 'شرح', render: (l) => l.description || '—' },
    { key: 'debtor', header: 'بدهکار', align: 'end', render: (l) => (l.debtor ? formatThousands(l.debtor) : '—') },
    { key: 'creditor', header: 'بستانکار', align: 'end', render: (l) => (l.creditor ? formatThousands(l.creditor) : '—') },
    {
      key: 'err',
      header: 'کنترل',
      render: (l) =>
        l.error ? (
          <Typography variant="caption" color="error">
            {l.error}
          </Typography>
        ) : (
          <Chip size="small" color="success" label="درست" />
        ),
    },
  ];

  const detail = detailQuery.data;

  return (
    <section>
      <PageHeader
        eyebrow="عملیات"
        icon={<MoveToInboxOutlinedIcon />}
        accentColor="secondary"
        title="دریافت اسناد از سایر سیستم‌ها"
        description="اسنادی که سیستم‌هایی مثل حقوق برای واحد شما فرستاده‌اند. پس از بررسی، «دریافت» یک سند یادداشت می‌سازد."
      />

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}
      {listQuery.isError && <ErrorBanner error={listQuery.error} />}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <FormControlLabel
          control={<Checkbox checked={includeReceived} onChange={(e) => setIncludeReceived(e.target.checked)} />}
          label="نمایش دریافت‌شده‌ها"
        />
        <DataTable
          columns={columns}
          rows={listQuery.data ?? []}
          getRowKey={(r) => r.id}
          isLoading={listQuery.isLoading}
          emptyMessage="سندی برای دریافت نیست."
        />
      </Paper>

      <Dialog open={!!openId} onClose={() => setOpenId(null)} maxWidth="lg" fullWidth>
        <DialogTitle>سند ارسالی {detail?.head.sysType ? `از ${detail.head.sysType}` : ''}</DialogTitle>
        <DialogContent>
          {detailQuery.isError && <ErrorBanner error={detailQuery.error} />}
          {detail && (
            <Stack spacing={2}>
              <Typography variant="body2">
                تاریخ: {formatLegacyJalaliDate(detail.head.dateDoc)} — شرح: {detail.head.headDesc || '—'} — جمع بدهکار{' '}
                {formatThousands(detail.head.debtor)} / بستانکار {formatThousands(detail.head.creditor)}
              </Typography>
              {!detail.canReceive && !detail.head.voucherHeadId && (
                <Alert severity="warning">
                  ردیف‌هایی که خطا دارند باید در سیستم فرستنده یا در کدینگ اصلاح شوند؛ تا آن موقع سند قابل دریافت نیست.
                </Alert>
              )}
              {receive.isError && <ErrorBanner error={receive.error} />}
              <DataTable
                columns={lineColumns}
                rows={detail.lines}
                getRowKey={(l) => `${l.radif}-${l.moinCode}-${l.debtor}-${l.creditor}-${l.description}`}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenId(null)}>بستن</Button>
          {detail && !detail.head.voucherHeadId && (
            <Button
              variant="contained"
              disabled={!detail.canReceive || receive.isPending}
              onClick={() => receive.mutate(detail.head.id)}
            >
              دریافت و ساخت سند
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </section>
  );
}
