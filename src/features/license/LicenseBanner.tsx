import { useQuery } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import { Link as RouterLink } from 'react-router-dom';
import { toPersianDigits } from '../../lib/format/numbers';
import { LICENSE_STATUS_KEY, licenseApi } from './api';

/** هشدار نزدیکی انقضا، مهلت ارفاقی، یا حالت فقط‌خواندنی — بالای محتوای همهٔ صفحه‌ها. */
export function LicenseBanner() {
  const { data } = useQuery({
    queryKey: LICENSE_STATUS_KEY,
    queryFn: licenseApi.status,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: false,
  });

  if (!data || !data.enforced) return null;

  const link = <RouterLink to="/base/license">مدیریت لایسنس</RouterLink>;

  if (data.state === 'ReadOnly') {
    return (
      <Alert severity="error" sx={{ mb: 2, displayPrint: 'none' }}>
        لایسنس سامانه منقضی شده است؛ سامانه فقط‌خواندنی است (ثبت و ویرایش بسته است). برای تمدید با پشتیبانی تماس بگیرید. {link}
      </Alert>
    );
  }
  if (data.state === 'Grace') {
    return (
      <Alert severity="warning" sx={{ mb: 2, displayPrint: 'none' }}>
        لایسنس منقضی شده است؛ {toPersianDigits(String(data.graceDaysLeft ?? 0))} روز مهلت باقی است و بعد از آن سامانه فقط‌خواندنی می‌شود. {link}
      </Alert>
    );
  }
  if (data.daysLeft != null && data.daysLeft <= 30) {
    return (
      <Alert severity="info" sx={{ mb: 2, displayPrint: 'none' }}>
        لایسنس سامانه {toPersianDigits(String(data.daysLeft))} روز دیگر منقضی می‌شود. {link}
      </Alert>
    );
  }
  return null;
}
