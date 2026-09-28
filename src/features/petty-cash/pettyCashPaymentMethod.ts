import type { PettyCashPaymentMethodValue } from '../../types/pettyCash';

/**
 * روش پرداخت ترمیم/شارژ — `PettyCashPaymentMethod` سمت سرور (بخش ۳-الف، ۲۰۲۶-۰۹-۲۸، صفحهٔ ۹
 * پاورپوینت). هم‌الگوی `pettyCashDocState.ts`/`pettyCashRole.ts`: تنها محل عدد↔برچسب این enum.
 *
 * ⚠️ در این بخش فقط اطلاعاتی است — اجرای واقعی پرداخت (بخش ۴+، خزانه) هنوز ساخته نشده؛
 * `record-payment` فقط وضعیت ترمیم را «پرداخت‌شده» می‌کند.
 */
export const PETTY_CASH_PAYMENT_METHOD_OPTIONS: readonly {
  value: PettyCashPaymentMethodValue;
  label: string;
}[] = [
  { value: 1, label: 'پایا به حساب تنخواه‌دار' },
  { value: 2, label: 'چک' },
  { value: 3, label: 'نقد' },
  { value: 4, label: 'سایر' },
] as const;

export function getPaymentMethodLabel(value: number | null | undefined): string {
  return PETTY_CASH_PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}
