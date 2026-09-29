import { useQuery } from '@tanstack/react-query';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { formatThousands } from '../../lib/format/numbers';
import { formatLegacyJalaliDate } from '../../lib/format/dates';
import { getDocLifeLabel, getDocLifeTone } from '../vouchers/api';
import type { PaymentRequestVoucherAccountingDto } from '../../types/treasury';

/**
 * سند GL (خودکار) به شکل جدول — استخراج‌شده از `PaymentRequestAccountingPanel` (بخش ۴-ب) تا
 * دریافت وجه/انتقال وجه (بخش ۴-ج) همان جدول را دوباره بسازند نه کپی کنند؛ هر سه از یک DTO سرور
 * (`PaymentRequestVoucherAccountingDto`) استفاده می‌کنند (دستور صاحب پروژه).
 */
export function VoucherMiniTable({ title, voucher }: { title: string; voucher: PaymentRequestVoucherAccountingDto }) {
  const balanced = voucher.totalDebit === voucher.totalCredit;
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {voucher.voucherNumber && <MonoCode value={voucher.voucherNumber} />}
        {voucher.state != null && (
          <Chip size="small" color={getDocLifeTone(voucher.state)} label={getDocLifeLabel(voucher.state)} />
        )}
        {voucher.date && (
          <Typography variant="caption" color="text.secondary">
            تاریخ سند: {formatLegacyJalaliDate(voucher.date)}
          </Typography>
        )}
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>حساب</TableCell>
              <TableCell>تفصیلی</TableCell>
              <TableCell align="left">بدهکار</TableCell>
              <TableCell align="left">بستانکار</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {voucher.lines.map((line, index) => (
              // eslint-disable-next-line react/no-array-index-key -- lines have no stable id on the wire
              <TableRow key={index}>
                <TableCell>
                  {line.accountCode ? <MonoCode value={line.accountCode} /> : '—'} {line.accountName ?? ''}
                </TableCell>
                <TableCell>{line.tafsiliLabels || '—'}</TableCell>
                <TableCell align="left">{line.debit ? formatThousands(line.debit) : '—'}</TableCell>
                <TableCell align="left">{line.credit ? formatThousands(line.credit) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
        <Typography variant="body2">جمع بدهکار: {formatThousands(voucher.totalDebit)}</Typography>
        <Typography variant="body2">جمع بستانکار: {formatThousands(voucher.totalCredit)}</Typography>
        <Chip size="small" color={balanced ? 'success' : 'error'} label={balanced ? 'متوازن ✓' : 'نامتوازن'} />
      </Stack>
    </Stack>
  );
}

interface SingleVoucherAccountingPanelProps {
  /** عنوان سند وقتی صادر شده باشد — مثلاً «سند دریافت» یا «سند انتقال». */
  voucherTitle: string;
  /** پیام وقتی سند هنوز صادر نشده. */
  emptyMessage: string;
  queryKey: readonly unknown[];
  queryFn: () => Promise<{ voucher: PaymentRequestVoucherAccountingDto | null; payRecivCode?: string | null }>;
}

/**
 * «اسناد حسابداری» تک‌سندی — دریافت وجه/انتقال وجه (بخش ۴-ج)، هم‌الگوی
 * `PaymentRequestAccountingPanel` (بخش ۴-ب) که دوسندی است (شناسایی بدهی + پرداخت). فقط-خواندنی؛
 * تا وقتی سند صادر نشده `voucher` همیشه `null` است (نه خطا) — پیام خالی نمایش داده می‌شود.
 */
export function SingleVoucherAccountingPanel({ voucherTitle, emptyMessage, queryKey, queryFn }: SingleVoucherAccountingPanelProps) {
  const accountingQuery = useQuery({ queryKey, queryFn });

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mt: 3 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
        <ReceiptLongOutlinedIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          اسناد حسابداری
        </Typography>
      </Stack>

      {accountingQuery.isLoading && <Skeleton variant="rounded" height={120} />}
      {accountingQuery.isError && <ErrorBanner error={accountingQuery.error} />}

      {accountingQuery.data && (
        <Stack spacing={3}>
          {accountingQuery.data.payRecivCode && (
            <Typography variant="body2">
              کد دریافت/پرداخت (Legacy): <MonoCode value={accountingQuery.data.payRecivCode} />
            </Typography>
          )}

          {accountingQuery.data.voucher ? (
            <VoucherMiniTable title={voucherTitle} voucher={accountingQuery.data.voucher} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              {emptyMessage}
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
}
