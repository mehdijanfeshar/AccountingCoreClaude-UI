import type { PettyCashRoleValue } from '../../types/pettyCash';

/**
 * نقش‌های بررسی‌کنندهٔ تنخواه — `PettyCashRole` سمت سرور
 * (`Accounting.Domain.ValueObjects.PettyCashRole`، تکمیل بخش ۲، ۲۰۲۶-۰۹-۲۸، صفحهٔ ۱۳ پاورپوینت؛
 * ۴/۵ افزوده‌شده در بخش ۳-الف، همان تاریخ). هم‌الگوی `pettyCashDocState.ts`: تنها محل عدد↔برچسب
 * فارسی این enum. تنخواه‌دار نقش جداگانه نیست (`TB_PC_FUND.CUSTODIAN_USERID`)، اینجا نمایش داده
 * نمی‌شود.
 */
export const PETTY_CASH_ROLE = {
  inspector: 1,
  financeManager: 2,
  chiefExecutive: 3,
  seniorAccountant: 4,
  treasurer: 5,
} as const;

export const PETTY_CASH_ROLE_OPTIONS: readonly { value: PettyCashRoleValue; label: string }[] = [
  { value: 1, label: 'بازرس مالی' },
  { value: 2, label: 'مدیر مالی' },
  { value: 3, label: 'مدیرعامل' },
  { value: 4, label: 'حسابدار ارشد' },
  { value: 5, label: 'خزانه‌دار' },
] as const;

export function getPettyCashRoleLabel(value: number | null | undefined): string {
  return PETTY_CASH_ROLE_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}
