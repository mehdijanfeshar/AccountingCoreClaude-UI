import { useQuery } from '@tanstack/react-query';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
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
import { paymentRequestsApi } from './api';
import { getDocLifeLabel, getDocLifeTone } from '../vouchers/api';
import type { PaymentRequestVoucherAccountingDto } from '../../types/treasury';

function VoucherMiniTable({ title, voucher }: { title: string; voucher: PaymentRequestVoucherAccountingDto }) {
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
        <Chip
          size="small"
          color={balanced ? 'success' : 'error'}
          label={balanced ? 'متوازن ✓' : 'نامتوازن'}
        />
      </Stack>
    </Stack>
  );
}

/**
 * «اسناد حسابداری» — خزانه‌داری بخش ۴-ب. `GET payment-requests/{id}/accounting` فقط-خواندنی است؛
 * تا وقتی درخواست از تأیید نهایی عبور نکرده هر دو سند `null`‌اند (نه خطا) — پیام خالی نمایش
 * داده می‌شود، نه یک state خطا.
 */
export function PaymentRequestAccountingPanel({ paymentRequestId }: { paymentRequestId: string }) {
  const accountingQuery = useQuery({
    queryKey: ['treasury-payment-requests', paymentRequestId, 'accounting'],
    queryFn: () => paymentRequestsApi.getAccounting(paymentRequestId),
  });

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

          {accountingQuery.data.liabilityVoucher ? (
            <VoucherMiniTable title="سند شناسایی بدهی" voucher={accountingQuery.data.liabilityVoucher} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              سند «شناسایی بدهی» هنوز صادر نشده است — این سند هنگام تأیید نهایی درخواست صادر می‌شود.
            </Typography>
          )}

          {accountingQuery.data.paymentVoucher && (
            <>
              <Divider />
              <VoucherMiniTable title="سند پرداخت" voucher={accountingQuery.data.paymentVoucher} />
            </>
          )}
          {!accountingQuery.data.paymentVoucher && accountingQuery.data.liabilityVoucher && (
            <Typography variant="body2" color="text.secondary">
              سند «پرداخت» هنوز صادر نشده است — این سند هنگام اجرای پرداخت صادر می‌شود.
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
}
