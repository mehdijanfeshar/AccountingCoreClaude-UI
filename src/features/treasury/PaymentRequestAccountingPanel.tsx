import { useQuery } from '@tanstack/react-query';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MonoCode } from '../../components/MonoCode';
import { paymentRequestsApi } from './api';
import { VoucherMiniTable } from './VoucherAccountingPanel';

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
