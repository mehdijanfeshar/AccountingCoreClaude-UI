import type { PettyCashRefundRecorderValue } from '../../types/pettyCash';

/**
 * چه نقشی مجاز به ثبت/حذف استرداد وجه یک تنخواه است — `PettyCashRefundRecorder` سمت سرور
 * (`TB_PC_FUND.REFUND_RECORDER`، بخش ۳-الف، ۲۰۲۶-۰۹-۲۸). پیش‌فرض «خزانه‌دار». هم‌الگوی
 * `pettyCashRole.ts` — تنها محل عدد↔برچسب این enum.
 */
export const PETTY_CASH_REFUND_RECORDER_OPTIONS: readonly {
  value: PettyCashRefundRecorderValue;
  label: string;
}[] = [
  { value: 1, label: 'تنخواه‌دار' },
  { value: 2, label: 'خزانه‌دار' },
  { value: 3, label: 'حسابدار ارشد' },
  { value: 4, label: 'مدیر مالی' },
] as const;

export const DEFAULT_REFUND_RECORDER: PettyCashRefundRecorderValue = 2;

export function getRefundRecorderLabel(value: number | null | undefined): string {
  return PETTY_CASH_REFUND_RECORDER_OPTIONS.find((o) => o.value === value)?.label ?? '—';
}
