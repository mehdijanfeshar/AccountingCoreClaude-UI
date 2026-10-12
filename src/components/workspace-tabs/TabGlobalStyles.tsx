import GlobalStyles, { type GlobalStylesProps } from '@mui/material/GlobalStyles';
import { useIsActiveTab } from './tabActivity';

/**
 * `GlobalStyles` که فقط وقتی تبِ صفحه فعال است اعمال می‌شود. استایل‌های چاپ گزارش‌ها (`body * { visibility:
 * hidden }` و `@page`) سراسری‌اند؛ اگر تب پشتی هم آن‌ها را نگه دارد، چاپ تب فعال خالی یا به‌هم‌ریخته درمی‌آید.
 */
export function TabGlobalStyles(props: GlobalStylesProps) {
  const isActiveTab = useIsActiveTab();
  return isActiveTab ? <GlobalStyles {...props} /> : null;
}
