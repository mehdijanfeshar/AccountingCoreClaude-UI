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

/**
 * `TB_PC_FUND.SETTLEMENT_PERIOD` — ۱=ماهانه، ۲=فصلی، `null`=هنوز تعیین نشده. `SETTLEMENT_PERIOD_OPTIONS`
 * برچسب‌های نمایشی را نگه می‌دارد.
 */
export type PettyCashSettlementPeriodValue = 1 | 2;

/**
 * `TB_PC_REVIEWER.ROLE` — تکمیل بخش ۲ (۲۰۲۶-۰۹-۲۸، `Accounting.Domain.ValueObjects.PettyCashRole`).
 * ۱=بازرس مالی، ۲=مدیر مالی، ۳=مدیرعامل. تنخواه‌دار نقش جداگانه نیست (`TB_PC_FUND.CUSTODIAN_USERID`).
 */
export type PettyCashRoleValue = 1 | 2 | 3;

/**
 * `GET /api/petty-cash/funds` / `GET /api/petty-cash/funds/{fundId}` — یک ردیف به‌ازای هر
 * `TB_PC_FUND` (جدول مستقل خودِ این ماژول، ۲۰۲۶-۰۹-۲۸؛ هیچ ربطی به `TB_REVOLVING_FUND`ندارد)،
 * دقیقاً هم‌شکل با `PettyCashFundDto.cs` سمت سرور — فیلدهای تنظیمات دیگر تودرتو نیستند.
 */
export interface PettyCashFundDto {
  id: string;
  code: string;
  name: string;
  /** تنخواه‌دار مسئول. */
  custodianUserId: string;
  custodianName: string | null;
  /** سقف تنخواه. */
  ceiling: number;
  /** سقف هر سند. */
  perDocLimit: number;
  /**
   * سقف اختیار تأیید نهایی نقش مدیر مالی — تکمیل بخش ۲ (۲۰۲۶-۰۹-۲۸). بیشتر از این فقط مدیرعامل
   * می‌تواند تأیید نهایی کند.
   */
  financeManagerApprovalLimit: number;
  alertThresholdPercent: number | null;
  accountCodeId: string | null;
  /** نمایشی: `TB_ACCOUNTCODE.ACCCODENAME` معین متصل. */
  accountCodeTitle: string | null;
  settlementPeriod: PettyCashSettlementPeriodValue | null;
  /** `false` یعنی ساخت/ارسال صورت‌هزینهٔ جدید برای این تنخواه مسدود است. */
  isActive: boolean;
  isDeleted: boolean;
  /** §۲: `Ceiling − (ApprovedAmount + InFlightAmount)`. */
  cashBalance: number;
  /** جمع مبلغ اسناد تأییدشدهٔ منتظر ترمیم. */
  approvedAmount: number;
  approvedCount: number;
  /** جمع مبلغ اسناد در جریان (جدید + در انتظار بررسی + برگشتی). */
  inFlightAmount: number;
  inFlightCount: number;
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
  /** تأیید دومرحله‌ای (تکمیل بخش ۲، ۲۰۲۶-۰۹-۲۸) — کاربری که «تأیید کنترل» را انجام داد. */
  verifiedByUserId: string | null;
  /** ISO timestamp. */
  verifiedDate: string | null;
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
  /**
   * «قفل فیلدبه‌فیلد» (تکمیل بخش ۲، صفحهٔ ۸ پاورپوینت): نام‌های camelCase فیلدهای بدنهٔ update که
   * اکنون قابل تغییرند (به‌علاوهٔ `"attachments"`), یا `null` = بدون محدودیت (قاعدهٔ عادی
   * پیش‌نویس/برگشتی). فقط ممکن است هنگامی که `state === Returned` غیر `null` باشد.
   */
  editableFields: string[] | null;
}

export interface PettyCashStateCount {
  state: PettyCashDocStateValue;
  count: number;
}

/**
 * بخش ۲ — `GET/POST /api/petty-cash/funds/{fundId}/reviewers` — یک ردیف به‌ازای هر `TB_PC_REVIEWER`
 * فعال. کلید یکتای upsert روی `(fundId, reviewerUserId)` است، نه `id` — سرور با همان جفت
 * تشخیص می‌دهد رکورد جدید بسازد یا نام رکورد موجود را به‌روزرسانی/فعال کند.
 */
export interface PettyCashFundReviewerDto {
  id: string;
  fundId: string;
  reviewerUserId: string;
  reviewerName: string | null;
  role: PettyCashRoleValue;
}

/**
 * بخش ۲-ب — یک ردیف پیوست، `GET /api/petty-cash/expense-docs/{id}/attachments`. متادیتا فقط —
 * هرگز بایت فایل (`PettyCashAttachmentDto.cs` سمت سرور). دقیقاً هم‌شکل با DTO واقعی سرور، نه از
 * سند مرجع حدس زده شده.
 */
export interface PettyCashAttachmentDto {
  id: string;
  expenseDocId: string;
  attachName: string;
  /** حجم به بایت. */
  attachSize: number;
  contentType: string | null;
  attachRadif: number;
  addUserId: string;
  createdDate: string;
}

/**
 * «گردش عملیات» — `PettyCashDocAction` سمت سرور (`Accounting.Domain.ValueObjects.PettyCashDocAction`).
 * ۱..۴ از بخش ۱ (ایجاد/ویرایش/ارسال/حذف)، ۵..۸ بخش ۲ (شروع بررسی/تأیید/برگشت/رد، ۶ فقط دادهٔ
 * تاریخی)، ۹..۱۰ تکمیل بخش ۲ (کنترل بازرس/تأیید نهایی).
 */
export type PettyCashDocActionValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * `GET /api/petty-cash/expense-docs/{id}/events` — یک ردیف تاریخچه، دقیقاً هم‌شکل با
 * `PettyCashDocEventDto.cs` سمت سرور.
 */
export interface PettyCashDocEventDto {
  id: string;
  action: PettyCashDocActionValue;
  fromState: PettyCashDocStateValue | null;
  toState: PettyCashDocStateValue | null;
  note: string | null;
  /** کدهای دلیل برگشت با `,` جدا (مثلاً `"1,3"`)، یا `null` وقتی اکشن برگشت نبوده. */
  returnReasons: string | null;
  userId: string;
  /** ISO timestamp. */
  createdDate: string;
  clientIp: string | null;
}
