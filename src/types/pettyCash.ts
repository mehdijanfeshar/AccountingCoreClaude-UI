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
 * `TB_PC_REVIEWER.ROLE` — تکمیل بخش ۲ (۲۰۲۶-۰۹-۲۸) + بخش ۳-الف (۲۰۲۶-۰۹-۲۸، افزودن ۴/۵)،
 * `Accounting.Domain.ValueObjects.PettyCashRole`. ۱=بازرس مالی، ۲=مدیر مالی، ۳=مدیرعامل،
 * ۴=حسابدار ارشد (فعلاً بدون consumer)، ۵=خزانه‌دار. تنخواه‌دار نقش جداگانه نیست
 * (`TB_PC_FUND.CUSTODIAN_USERID`).
 */
export type PettyCashRoleValue = 1 | 2 | 3 | 4 | 5;

/**
 * `TB_PC_REPLENISHMENT.PAYMENT_METHOD` — `PettyCashPaymentMethod` سمت سرور، بخش ۳-الف
 * (۲۰۲۶-۰۹-۲۸). ۱=پایا به حساب تنخواه‌دار، ۲=چک، ۳=نقد، ۴=سایر.
 */
export type PettyCashPaymentMethodValue = 1 | 2 | 3 | 4;

/**
 * `TB_PC_REPLENISHMENT.STATE` — `PettyCashReplenishmentState` سمت سرور، بخش ۳-الف (۲۰۲۶-۰۹-۲۸).
 * `Draft → PendingFinanceManager → PendingTreasurer → Paid`، یا `Rejected` از هر Pending.
 */
export type PettyCashReplenishmentStateValue = 1 | 2 | 3 | 4 | 5;

/**
 * `TB_PC_FUND.REFUND_RECORDER` — `PettyCashRefundRecorder` سمت سرور، بخش ۳-الف (۲۰۲۶-۰۹-۲۸).
 * ۱=تنخواه‌دار، ۲=خزانه‌دار (پیش‌فرض)، ۳=حسابدار ارشد، ۴=مدیر مالی.
 */
export type PettyCashRefundRecorderValue = 1 | 2 | 3 | 4;

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
  /** بخش ۳-الف (۲۰۲۶-۰۹-۲۸) — چه کسی مجاز به ثبت/حذف استرداد وجه این تنخواه است. */
  refundRecorder: PettyCashRefundRecorderValue;
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

/* ------------------------------------------------------------------------------------------- *
 * بخش ۳-الف (۲۰۲۶-۰۹-۲۸) — ترمیم/شارژ، استرداد وجه، داشبورد، گزارش گردش
 * (`docs/tankhah-khazaneh-module.md` §۹). دقیقاً هم‌شکل با DTOهای واقعی سرور
 * (`PettyCashController.cs` + `Accounting.Application/PettyCash/Queries/*.cs`).
 * ------------------------------------------------------------------------------------------- */

/** یک حساب هزینه در پیش‌نمایش/جزئیات ترمیم — `PettyCashReplenishmentLineDto.cs`. */
export interface PettyCashReplenishmentLineDto {
  accountCodeId: string | null;
  accountCode: string | null;
  accountTitle: string | null;
  amount: number;
  docCount: number;
}

/** `GET /api/petty-cash/funds/{fundId}/replenishment-preview` — `PettyCashReplenishmentPreviewDto.cs`. */
export interface PettyCashReplenishmentPreviewDto {
  fundId: string;
  ceiling: number;
  /** موجودی نقد فعلی، پیش از این ترمیم. */
  cashBalance: number;
  approvedAmount: number;
  approvedCount: number;
  inFlightAmount: number;
  inFlightCount: number;
  lines: PettyCashReplenishmentLineDto[];
  /** جمع خطوط — همان مبلغ ترمیمی که الان ساخته می‌شود. */
  totalAmount: number;
  /** موجودی نقد پس از این ترمیم (وقتی هم ساخته و هم پرداخت‌شده باشد). */
  balanceAfter: number;
  docIds: string[];
}

/** `GET /api/petty-cash/replenishments` — یک ردیف، `PettyCashReplenishmentListItemDto.cs`. */
export interface PettyCashReplenishmentListItemDto {
  id: string;
  /** نمایش: «RCH-» + شمارهٔ ۵رقمی. */
  code: string;
  fundId: string;
  fundName: string;
  paymentMethod: PettyCashPaymentMethodValue;
  state: PettyCashReplenishmentStateValue;
  totalAmount: number;
  docCount: number;
  /** ISO timestamp. */
  createdDate: string;
  /** ISO timestamp — فقط بعد از `record-payment`. */
  paidDate: string | null;
  addUserId: string;
}

/** `GET /api/petty-cash/replenishments/{id}` — `PettyCashReplenishmentDto.cs`. */
export interface PettyCashReplenishmentDto {
  id: string;
  code: string;
  fundId: string;
  fundName: string;
  sourceBankAccountId: string | null;
  sourceBankAccountNumber: string | null;
  paymentMethod: PettyCashPaymentMethodValue;
  state: PettyCashReplenishmentStateValue;
  totalAmount: number;
  note: string | null;
  paidDate: string | null;
  paidByUserId: string | null;
  approvedByUserId: string | null;
  addUserId: string;
  /** ISO timestamp. */
  createdDate: string;
  lines: PettyCashReplenishmentLineDto[];
  docIds: string[];
}

/** `GET /api/petty-cash/funds/{fundId}/refunds` — یک ردیف، `PettyCashRefundDto.cs`. */
export interface PettyCashRefundDto {
  id: string;
  fundId: string;
  /** نمایش: «REF-» + شمارهٔ ۵رقمی. */
  code: string;
  amount: number;
  reason: string | null;
  /** Legacy `YYYYMMDD`. */
  refundDate: string;
  recordedByUserId: string;
  /** ISO timestamp. */
  createdDate: string;
}

/** `GET /api/petty-cash/funds/{fundId}/dashboard` — `PettyCashFundDashboardDto.cs` (صفحهٔ ۴). */
export interface PettyCashFundDashboardDto {
  fund: PettyCashFundSummaryDto;
  cashBalance: number;
  cashPercentOfCeiling: number;
  belowAlertThreshold: boolean;
  awaitingReplenishment: PettyCashDashboardBucketDto;
  inFlight: PettyCashDashboardInFlightDto;
  returned: PettyCashDashboardReturnedDto;
  balanceCheck: PettyCashDashboardBalanceCheckDto;
  todayActions: PettyCashDashboardActionItemDto[];
  alerts: PettyCashDashboardAlertDto[];
}

export interface PettyCashFundSummaryDto {
  id: string;
  code: string;
  name: string;
  ceiling: number;
  alertThresholdPercent: number | null;
}

export interface PettyCashDashboardBucketDto {
  amount: number;
  count: number;
}

export interface PettyCashDashboardInFlightDto {
  amount: number;
  count: number;
  olderThan5DaysCount: number;
}

export interface PettyCashDashboardReturnedDto {
  count: number;
  oldestAgeDays: number | null;
}

/**
 * معادلهٔ تراز: `CEILING = Cash + AwaitingReplenishment + InFlight − RefundTotal` (نسخهٔ ساده‌شده)؛
 * `balanced` از فرم کامل‌تر (شامل `replenishedNotSettled`) محاسبه می‌شود — `PettyCashDashboardBalanceCheckDto.cs`.
 */
export interface PettyCashDashboardBalanceCheckDto {
  ceiling: number;
  cash: number;
  awaitingReplenishment: number;
  inFlight: number;
  /** نمایشی فقط — ترمیم‌های پرداخت‌شدهٔ هنوز تسویه‌نشده. */
  replenishedNotSettled: number;
  balanced: boolean;
}

export interface PettyCashDashboardActionItemDto {
  id: string;
  docNumber: string;
  custodianName: string | null;
  description: string | null;
  amount: number;
  state: PettyCashDocStateValue;
  ageDays: number;
}

export interface PettyCashDashboardAlertDto {
  severity: string;
  message: string;
}

/**
 * `GET /api/petty-cash/funds/{fundId}/ledger?from=&to=&type=` — `PettyCashFundLedgerDto.cs`
 * (صفحهٔ ۱۱). ⚠️ تاریخچهٔ حرکت واقعی وجه است، نه معادل لحظه‌ایِ فرمول موجودی نقد — جزئیات در
 * `docs/tankhah-khazaneh-module.md` §۹.
 */
export interface PettyCashFundLedgerDto {
  openingBalance: number;
  rows: PettyCashLedgerRowDto[];
  totalReceipt: number;
  receiptCount: number;
  totalPayment: number;
  paymentCount: number;
  closingBalance: number;
}

export type PettyCashLedgerRowType = 'replenishment' | 'expense' | 'refund';

export interface PettyCashLedgerRowDto {
  /** شمسی YYYYMMDD. */
  date: string;
  type: PettyCashLedgerRowType;
  /** کد نمایشی («RCH-»/«TH-»/«REF-» + شماره). */
  reference: string;
  description: string | null;
  receipt: number | null;
  payment: number | null;
  balance: number;
  sourceId: string;
}

/* ------------------------------------------------------------------------------------------- *
 * بخش ۳-ب (۲۰۲۶-۰۹-۲۸) — تسویهٔ دوره و صدور سند حسابداری، تفصیلی(های) حساب معین تنخواه
 * (`docs/tankhah-khazaneh-module.md` §۹). دقیقاً هم‌شکل با `PettyCashSettlementDto.cs` سمت سرور.
 * ------------------------------------------------------------------------------------------- */

/** `TB_PC_SETTLEMENT_PERIOD.STATE` — `PettyCashSettlementState` سمت سرور. ۱=پیش‌نویس، ۲=نهایی. */
export type PettyCashSettlementStateValue = 1 | 2;

/**
 * یک تفصیلی، حل‌شده برای نمایش/سند — یا مالِ خودِ یک مادهٔ هزینه (`TB_EXPENCE_LINK_TAFSILI`) یا
 * مالِ خودِ یک تنخواه (`TB_PC_FUND_LINK_TAFSILI`)؛ `PettyCashSettlementTafsiliDto.cs`.
 */
export interface PettyCashSettlementTafsiliDto {
  tafsiliId: string;
  levelId: string;
  tafsiliCode: string | null;
  tafsiliTitle: string | null;
  levelName: string | null;
}

/** یک ردیف سند پیش‌نمایش/نهایی تسویه — `PettyCashSettlementVoucherLineDto.cs`. */
export interface PettyCashSettlementVoucherLineDto {
  accountCodeId: string | null;
  accountCode: string | null;
  accountTitle: string | null;
  tafsilis: PettyCashSettlementTafsiliDto[];
  debtor: number;
  creditor: number;
}

/** پیش‌نمایش سند حسابداری تسویه — `PettyCashSettlementVoucherPreviewDto.cs`. */
export interface PettyCashSettlementVoucherPreviewDto {
  /** Legacy `YYYYMMDD` — تاریخ سند (= پایان دوره). */
  date: string;
  description: string;
  lines: PettyCashSettlementVoucherLineDto[];
  totalDebtor: number;
  totalCredit: number;
  balanced: boolean;
}

/**
 * کنترل غیرقطعی پیش از بستن دوره — همان قواعدی که `finalize` هم اجرا می‌کند، برای نمایش «چرا هنوز
 * نمی‌توان بست» پیش از تلاش کاربر؛ `PettyCashSettlementCheckDto.cs`. `key` پایدار و غیرلوکالایزشده
 * است (مثلاً `"hasApprovedDocs"`)، `message` برای نمایش مستقیم.
 */
export interface PettyCashSettlementCheckDto {
  key: string;
  ok: boolean;
  message: string;
}

/** `GET /api/petty-cash/funds/{fundId}/settlement` — `PettyCashSettlementPreviewDto.cs`. */
export interface PettyCashSettlementPreviewDto {
  /** `null` تا وقتی هیچ شمارشی برای دورهٔ جاری ثبت نشده — پیش‌نمایش محض، هنوز رکورد پایگاه‌داده نیست. */
  periodId: string | null;
  /** Legacy `YYYYMMDD`. */
  periodStart: string;
  /** Legacy `YYYYMMDD`. */
  periodEnd: string;
  state: PettyCashSettlementStateValue;
  openingBalance: number;
  replenishmentsAndRefunds: number;
  approvedExpenses: number;
  inFlightAmount: number;
  inFlightCount: number;
  closingCashBalance: number;
  countedBalance: number | null;
  voucherPreview: PettyCashSettlementVoucherPreviewDto;
  checks: PettyCashSettlementCheckDto[];
  expenseDocIds: string[];
}

/** `GET /api/petty-cash/funds/{fundId}/settlements` — یک دورهٔ نهایی‌شده، `PettyCashSettlementHistoryItemDto.cs`. */
export interface PettyCashSettlementHistoryItemDto {
  periodId: string;
  /** Legacy `YYYYMMDD`. */
  periodStart: string;
  /** Legacy `YYYYMMDD`. */
  periodEnd: string;
  openingBalance: number;
  countedBalance: number;
  voucherHeadId: string | null;
  voucherDocNum: string | null;
  finalizedByUserId: string | null;
  /** ISO timestamp. */
  finalizedDate: string | null;
}
