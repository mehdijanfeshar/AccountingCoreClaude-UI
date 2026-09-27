/**
 * تنخواه و خزانه‌داری — بخش ۱ (تعریف تنخواه، ثبت صورت‌هزینه، کارتابل).
 *
 * Mirrors the backend DTOs described in
 * `docs/tankhah-khazaneh-module.md` §۵ exactly (camelCase over the wire). The backend for this
 * module is being built in parallel to this exact shape — there is no live Controller/OpenAPI to
 * read yet, so these are re-derived from the spec doc, not guessed from a running API. If the
 * real contract ends up different, fix here first (this file is the single source of truth for
 * the module's wire shapes), then the two `api.ts` call sites that use it.
 */

/** ۱:۱ با یک تنخواه — `TB_PC_FUND_SETTING`. `null` وقتی هنوز برای این تنخواه تنظیم نشده است. */
export interface PettyCashFundSettingsDto {
  custodianUserId: string | null;
  custodianName: string | null;
  perDocLimit: number | null;
  alertThresholdPercent: number | null;
  /** ۱=ماهانه، ۲=فصلی — `SETTLEMENT_PERIOD_OPTIONS`. */
  settlementPeriod: number | null;
}

/** `GET /api/petty-cash/funds` — یک ردیف به‌ازای هر `TB_REVOLVING_FUND`، با تنظیمات و خلاصهٔ موجودی. */
export interface PettyCashFundDto {
  id: string;
  code: string | null;
  name: string | null;
  /** سقف تنخواه — `TB_REVOLVING_FUND.DEFAULTAMOUNT`. */
  ceiling: number | null;
  accountCodeId: string | null;
  accountCodeTitle: string | null;
  settings: PettyCashFundSettingsDto | null;
  /** موجودی نقد فعلی — `ceiling − Σ(اسناد در وضعیت جدید/در انتظار بررسی/برگشتی/تأییدشده)`. */
  cashBalance: number | null;
  /** جمع مبلغ اسناد تأییدشدهٔ منتظر ترمیم. */
  approvedAmount: number | null;
  approvedCount: number | null;
  /** جمع مبلغ اسناد در جریان (جدید + در انتظار بررسی + برگشتی). */
  inFlightAmount: number | null;
  inFlightCount: number | null;
}

/**
 * `PettyCashDocState` — نگاشت به `STATUS` لگیسی فقط در `PettyCashStatusMap` سمت سرور انجام
 * می‌شود؛ این فایل فقط عدد↔برچسب فرانت را نگه می‌دارد. مقادیر عدد از سند مرجع §۲ کپی شده‌اند.
 */
export type PettyCashDocStateValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** صورت‌هزینه — شکل فهرست/خلاصه، `TB_PC_EXPENSE_DOC` + `TB_CHARGEANDCOST_HEAD` نوع ۲. */
export interface PettyCashExpenseDocDto {
  id: string;
  /** نمایش: `TH-` + `docNumber` (`PadLeft(5,'0')` سمت سرور). */
  docNumber: string | null;
  code: string | null;
  /** Legacy `YYYYMMDD`. */
  registerDate: string | null;
  fundId: string | null;
  fundName: string | null;
  expenseId: string | null;
  expenseName: string | null;
  vendorName: string | null;
  description: string | null;
  totalAmount: number | null;
  state: PettyCashDocStateValue | null;
  /** ISO timestamp — فقط بعد از ارسال برای بررسی مقدار دارد. */
  submittedDate: string | null;
  /** عمر سند به روز، از زمان ارسال؛ `null` تا وقتی ارسال نشده. */
  ageDays: number | null;
  addUserId: string | null;
}

/** `GET /api/petty-cash/expense-docs/{id}` — شکل فهرست به‌علاوهٔ فیلدهای مخصوص فرم/جزئیات. */
export interface PettyCashExpenseDocDetailDto extends PettyCashExpenseDocDto {
  vendorNationalId: string | null;
  invoiceNo: string | null;
  /** Legacy `YYYYMMDD`. */
  invoiceDate: string | null;
  /** ۱=فاکتور رسمی، ۲=رسید، ۳=سایر — `EVIDENCE_TYPE_OPTIONS`. */
  evidenceType: number | null;
  amountBeforeTax: number | null;
  vatAmount: number | null;
  /** Legacy `YYYYMMDD` — مهلت پاسخ به برگشتی؛ فقط برای اسناد برگشتی مقدار دارد (بخش ۲). */
  returnDeadline: string | null;
}

export interface PettyCashStateCount {
  state: PettyCashDocStateValue;
  count: number;
}
