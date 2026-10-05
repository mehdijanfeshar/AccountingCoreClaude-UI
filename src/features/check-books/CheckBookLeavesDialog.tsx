import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { useNotify } from '../../lib/notifications/NotificationProvider';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { formatThousands, toPersianDigits } from '../../lib/format/numbers';
import { APPROVAL_META } from '../cheque-book/api';
import { checkBookLeavesApi, type ChequeLeafDto } from './api';
import type { CheckBookDto } from '../../types/checkBook';
import { SORI_CHECK_TYPE } from './schema';

type LeafFilter = 'all' | 'free' | 'used' | 'canceled';

const isUsed = (l: ChequeLeafDto) =>
  !!l.voucherHeadId || !!l.chequeDate || !!l.payTo || !!l.paperDescription || l.isPrinted;

/**
 * «اوراق چک» یک دسته‌چک — برگ‌های `TB_CHECK` از اولین تا آخرین شماره. برگی که در سند به کار رفته «در وجه»،
 * «بابت»، تاریخ و سندش را نشان می‌دهد. دسته‌چک‌های قدیمی که پیش از این قابلیت بی‌برگ ثبت شده‌اند با
 * «ساخت اوراق» برگ‌دار می‌شوند.
 */
export function CheckBookLeavesDialog({ book, onClose }: { book: CheckBookDto | null; onClose: () => void }) {
  const notify = useNotify();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<LeafFilter>('all');

  const query = useQuery({
    queryKey: ['check-book-leaves', book?.id],
    queryFn: () => checkBookLeavesApi.list(book!.id),
    enabled: book !== null,
  });

  const generate = useMutation({
    mutationFn: () => checkBookLeavesApi.generate(book!.id),
    onSuccess: async (added) => {
      await queryClient.invalidateQueries({ queryKey: ['check-book-leaves', book?.id] });
      notify(added > 0 ? `${toPersianDigits(added)} برگ چک ساخته شد.` : 'همهٔ برگ‌ها از قبل وجود داشتند.');
    },
    onError: (error) =>
      notify({ message: error instanceof Error ? error.message : 'ساخت اوراق با خطا مواجه شد.', severity: 'error' }),
  });

  const leaves = query.data ?? [];
  const isSori = book?.checkBookType === SORI_CHECK_TYPE;
  const counts = useMemo(
    () => ({
      used: leaves.filter((l) => !l.isCanceled && isUsed(l)).length,
      canceled: leaves.filter((l) => l.isCanceled).length,
    }),
    [leaves],
  );
  const rows = useMemo(() => {
    switch (filter) {
      case 'free':
        return leaves.filter((l) => !l.isCanceled && !isUsed(l));
      case 'used':
        return leaves.filter((l) => !l.isCanceled && isUsed(l));
      case 'canceled':
        return leaves.filter((l) => l.isCanceled);
      default:
        return leaves;
    }
  }, [leaves, filter]);

  const columns: DataTableColumn<ChequeLeafDto>[] = [
    { key: 'chequeNo', header: 'شماره چک', render: (r) => <MonoCode value={r.chequeNo} /> },
    { key: 'chequeDate', header: 'تاریخ چک', render: (r) => (r.chequeDate ? formatLegacyJalaliDate(r.chequeDate) : '—') },
    { key: 'payTo', header: 'در وجه', render: (r) => r.payTo ?? '—' },
    { key: 'paperDescription', header: 'بابت', render: (r) => r.paperDescription ?? '—' },
    { key: 'amount', header: 'مبلغ', render: (r) => (r.amount != null ? toPersianDigits(formatThousands(r.amount)) : '—') },
    {
      key: 'voucher',
      header: 'سند',
      render: (r) =>
        r.voucherHeadId ? (
          <Button size="small" onClick={() => navigate(`/operation/vouchers/${r.voucherHeadId}/view`)}>
            {toPersianDigits(r.voucherNumber ?? '')}
            {r.voucherDate ? ` — ${formatLegacyJalaliDate(r.voucherDate)}` : ''}
          </Button>
        ) : (
          '—'
        ),
    },
    {
      key: 'state',
      header: 'وضعیت',
      render: (r) => (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }}>
          {r.isCanceled ? (
            <Chip size="small" color="error" label="باطل" />
          ) : isUsed(r) ? (
            <Chip size="small" color="primary" variant="outlined" label="استفاده‌شده" />
          ) : (
            <Chip size="small" color="success" variant="outlined" label="سفید" />
          )}
          {r.isPrinted && <Chip size="small" label="چاپ‌شده" />}
          {r.approvalState && (
            <Chip size="small" color={APPROVAL_META[r.approvalState].color} label={APPROVAL_META[r.approvalState].label} />
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Dialog open={book !== null} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        اوراق چک {book?.checkBookTitle ? `«${book.checkBookTitle}» ` : ''}
        {book && (
          <>
            — <MonoCode value={book.fromCheckNumber} /> تا <MonoCode value={book.toCheckNumber} />
          </>
        )}
      </DialogTitle>
      <DialogContent>
        {query.isError && <ErrorBanner error={query.error} />}
        {isSori && (
          <Alert severity="info" sx={{ mb: 2 }}>
            دسته‌چک صوری (اعلامیه) برگ از پیش ندارد؛ هر شماره هنگام استفاده در سند صادر و اینجا اضافه می‌شود.
          </Alert>
        )}
        {query.isSuccess && leaves.length === 0 && !isSori && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" disabled={generate.isPending} onClick={() => generate.mutate()}>
                ساخت اوراق
              </Button>
            }
          >
            این دسته‌چک پیش از قابلیت «اوراق چک» ثبت شده و برگی ندارد. با «ساخت اوراق» برگ‌ها از اولین تا آخرین شماره ساخته می‌شوند.
          </Alert>
        )}
        {leaves.length > 0 && (
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="نمایش"
              value={filter}
              onChange={(e) => setFilter(e.target.value as LeafFilter)}
              sx={{ width: 180 }}
            >
              <MenuItem value="all">همهٔ برگ‌ها</MenuItem>
              <MenuItem value="free">سفید (استفاده‌نشده)</MenuItem>
              <MenuItem value="used">استفاده‌شده</MenuItem>
              <MenuItem value="canceled">باطل</MenuItem>
            </TextField>
            <span>
              {toPersianDigits(leaves.length)} برگ — {toPersianDigits(counts.used)} استفاده‌شده،{' '}
              {toPersianDigits(counts.canceled)} باطل،{' '}
              {toPersianDigits(leaves.length - counts.used - counts.canceled)} سفید
            </span>
          </Stack>
        )}
        {!query.isError && (
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.checkId}
            isLoading={query.isLoading}
            emptyMessage={leaves.length === 0 ? 'برگی ثبت نشده است.' : 'برگی با این فیلتر نیست.'}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
