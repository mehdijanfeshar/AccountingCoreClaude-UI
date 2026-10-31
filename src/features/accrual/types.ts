// حسابداری تعهدی، فاز ۶۶ — همان DTOهای api/accrual (بک‌اند: Accounting.Application.Accrual).

/** 1 برگشت برآورد · 2 سهم ماهانهٔ پیش‌پرداخت · 3 سهم ماهانهٔ درآمد انتقالی */
export type AccrualKind = 1 | 2 | 3;

/** 1 باز · 2 اجراشده · 3 لغو */
export type AccrualState = 1 | 2 | 3;

export interface AccrualSchedule {
  id: string;
  sourceVoucherId: string;
  sourceVoucherNo: string | null;
  executionId: string | null;
  kind: AccrualKind;
  lineNo: number;
  /** شمسی yyyyMMdd */
  dueDate: string;
  amount: number;
  description: string | null;
  state: AccrualState;
  resultVoucherId: string | null;
  resultVoucherNo: string | null;
  createdBy: string;
  createdAtUtc: string;
}

export interface AccrualVoucherSchedule {
  sourceVoucherId: string;
  sourceVoucherNo: string | null;
  totalAmount: number;
  lines: AccrualSchedule[];
}

export interface AccrualRunResult {
  voucherId: string;
  voucherNo: string | null;
  alreadyDone: boolean;
}

export interface AccrualCancelResult {
  cancelledCount: number;
  cancelledAmount: number;
}

export interface AccrualFilter {
  state?: AccrualState;
  kind?: AccrualKind;
  from?: string;
  to?: string;
}

/** برچسب نوع به زبان ساده (دستور کار ۶۶-ب). */
export const KIND_LABEL: Record<AccrualKind, string> = {
  1: 'برگرداندن برآورد',
  2: 'سهم ماهانهٔ پیش‌پرداخت',
  3: 'سهم ماهانهٔ درآمد انتقالی',
};

export const STATE_LABEL: Record<AccrualState, string> = { 1: 'باز', 2: 'اجراشده', 3: 'لغو' };
