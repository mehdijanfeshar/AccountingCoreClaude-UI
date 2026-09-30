/**
 * خزانه‌داری، بخش ۴-الف — درخواست پرداخت + کارتابل تأیید (`docs/tankhah-khazaneh-module.md` §۱۰).
 * Mirrors the backend DTOs exactly (camelCase over the wire) — read straight from
 * `Accounting.Application.Treasury.Queries` and `TreasuryController.cs`, never guessed.
 */

/** `TreasuryPaymentType` — ۱=تأمین‌کننده/پیمانکار، ۲=کارمند، ۳=سایر. */
export type TreasuryPaymentTypeValue = 1 | 2 | 3;

/** `TreasuryPaymentMethod` — ۱=ساتنا، ۲=پایا، ۳=چک، ۴=نقد. */
export type TreasuryPaymentMethodValue = 1 | 2 | 3 | 4;

/**
 * `PaymentRequestState` — زنجیرهٔ خطی Draft(۱) → PendingUnitManager(۲) → PendingFinanceManager(۳)
 * → (فقط اگر مبلغ از آستانهٔ مدیرعامل بیشتر باشد) PendingCeo(۴) → ReadyForExecution(۵)؛ از هر
 * Pending، هم Returned(۶) و هم Rejected(۷) قابل دسترس‌اند. بخش ۴-ب (۲۰۲۶-۰۹-۲۹) دو وضعیت پایانی/
 * موقت اضافه کرد: Executed(۸) — اجرا شد، پایانی؛ Suspended(۹) — موقتاً معلق، فقط از/به
 * ReadyForExecution.
 */
export type PaymentRequestStateValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** `PaymentRequestEventAction`. بخش ۴-ب اضافه کرد: ۸=صدور سند شناسایی بدهی، ۹=اجرا، ۱۰=تعلیق، ۱۱=رفع تعلیق. */
export type PaymentRequestEventActionValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** `TreasuryRole` — ۱=مدیر واحد، ۲=مدیر مالی، ۳=مدیرعامل، ۴=حسابدار ارشد، ۵=خزانه‌دار. */
export type TreasuryRoleValue = 1 | 2 | 3 | 4 | 5;

/** `ReceiptState` — ۱=پیش‌نویس، ۲=ثبت‌شده، ۳=لغوشده. بخش ۴-ج. */
export type ReceiptStateValue = 1 | 2 | 3;

/** `TransferState` — ۱=پیش‌نویس، ۲=در انتظار تأیید خزانه‌دار، ۳=انجام‌شده، ۴=برگشتی، ۵=ردشده. بخش ۴-ج. */
export type TransferStateValue = 1 | 2 | 3 | 4 | 5;

/** `TransferEventAction` — ۱=ایجاد..۷=رد. بخش ۴-ج. */
export type TransferEventActionValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * `GET/POST api/treasury/settings` — `TreasurySettingDto`. `beneficiaryTafsilGroupId` — اصلاح
 * ۴-الف (۲۰۲۶-۰۹-۲۹) — `null` یعنی واحد هنوز گروه تفصیلی ذی‌نفع تعریف نکرده؛ در این حالت ثبت
 * درخواست پرداخت با تفصیلی ذی‌نفع رد می‌شود. سه فیلد `...AccountId`/`...AccountCode`/
 * `...AccountName` — بخش ۴-ب (۲۰۲۶-۰۹-۲۹): `null` یعنی هنوز تعریف نشده — صدور سند شناسایی بدهی با
 * ۴۰۹ رد می‌شود. `receivablesAccountId`/`customerTafsilGroupId`/`dailyTransferLimit` — بخش ۴-ج
 * (۲۰۲۶-۰۹-۲۹): به‌ترتیب برای ثبت دریافت وجه (بدون آن‌ها با ۴۰۹ رد می‌شود) و تأیید انتقال وجه.
 */
export interface TreasurySettingDto {
  id: string;
  ceoApprovalThreshold: number;
  bulkApproveLimit: number;
  beneficiaryTafsilGroupId: string | null;
  beneficiaryTafsilGroupCode: string | null;
  beneficiaryTafsilGroupName: string | null;
  /** «حساب بستانکاران تجاری». */
  payablesAccountId: string | null;
  payablesAccountCode: string | null;
  payablesAccountName: string | null;
  /** «حساب اعتبار مالیات بر ارزش‌افزودهٔ خرید». */
  vatCreditAccountId: string | null;
  vatCreditAccountCode: string | null;
  vatCreditAccountName: string | null;
  /** «حساب سپردهٔ بیمهٔ پرداختنی». */
  insurancePayableAccountId: string | null;
  insurancePayableAccountCode: string | null;
  insurancePayableAccountName: string | null;
  /** بخش ۴-ج — «حساب‌های دریافتنی». */
  receivablesAccountId: string | null;
  receivablesAccountCode: string | null;
  receivablesAccountName: string | null;
  /** بخش ۴-ج — گروه تفصیلی مشتریان (پرداخت‌کنندگان دریافت وجه). */
  customerTafsilGroupId: string | null;
  customerTafsilGroupCode: string | null;
  customerTafsilGroupName: string | null;
  /** بخش ۴-ج — سقف مجموع انتقال‌های اجراشده از یک حساب مبدأ در یک روز. */
  dailyTransferLimit: number | null;
  /** بخش ۴-د — «کارمزد بانکی». `null` یعنی هنوز تعریف نشده — حل ردیف با نوع «سند کارمزد بانکی» با ۴۰۹ رد می‌شود. */
  bankFeeAccountId: string | null;
  bankFeeAccountCode: string | null;
  bankFeeAccountName: string | null;
}

/** `GET api/treasury/roles` — `TreasuryRoleDto`. */
export interface TreasuryRoleDto {
  id: string;
  userId: string;
  userName: string | null;
  role: TreasuryRoleValue;
}

/** یک ردیف `GET api/treasury/payment-requests` — `PaymentRequestListItemDto`. */
export interface PaymentRequestListItemDto {
  id: string;
  code: string;
  beneficiaryName: string;
  paymentType: TreasuryPaymentTypeValue;
  netPayableAmount: number;
  requestState: PaymentRequestStateValue;
  dueDate: string;
  submittedDate: string | null;
  createdDate: string;
  addUserId: string;
}

/** `PaymentRequestStateCountDto`. */
export interface PaymentRequestStateCountDto {
  state: PaymentRequestStateValue;
  count: number;
}

/** `GET api/treasury/payment-requests` envelope — `PaymentRequestListResult`. */
export interface PaymentRequestListResult {
  page: {
    items: PaymentRequestListItemDto[];
    pageNumber: number;
    pageSize: number;
    totalCount: number;
  };
  stateCounts: PaymentRequestStateCountDto[];
}

/** یک ردیف «گردش عملیات» — `PaymentRequestEventDto`. */
export interface PaymentRequestEventDto {
  id: string;
  action: PaymentRequestEventActionValue;
  fromState: PaymentRequestStateValue | null;
  toState: PaymentRequestStateValue | null;
  note: string | null;
  userId: string;
  createdDate: string;
  clientIp: string | null;
}

/**
 * یک ردیف `costCenterTafsilis` روی `PaymentRequestDto` — اصلاح ۴-الف (۲۰۲۶-۰۹-۲۹)، جایگزین ستون
 * تک‌سطحی حذف‌شدهٔ `costCenterTafsiliId`: یک ردیف به‌ازای هر سطح تفصیلی مرکز هزینهٔ حساب هزینه.
 */
export interface PaymentRequestCostCenterTafsiliDto {
  levelId: string;
  levelName: string | null;
  tafsiliId: string;
  tafsiliCode: string | null;
  tafsiliName: string | null;
}

/** `GET api/treasury/payment-requests/{id}` — `PaymentRequestDto`. */
export interface PaymentRequestDto {
  id: string;
  code: string;
  beneficiaryName: string;
  beneficiaryNationalId: string | null;
  beneficiaryTafsiliId: string | null;
  beneficiaryTafsiliCode: string | null;
  beneficiaryTafsiliName: string | null;
  paymentType: TreasuryPaymentTypeValue;
  invoiceRef: string | null;
  invoiceApproved: boolean;
  expenseAccountId: string;
  costCenterTafsilis: PaymentRequestCostCenterTafsiliDto[];
  amountBeforeTax: number;
  vatPercent: number | null;
  vatAmount: number;
  insuranceDeductionPercent: number | null;
  insuranceDeductionAmount: number;
  netPayableAmount: number;
  dueDate: string;
  paymentAccountId: string;
  paymentMethod: TreasuryPaymentMethodValue | null;
  description: string | null;
  requestState: PaymentRequestStateValue;
  submittedDate: string | null;
  payRecivHeadId: string | null;
  addUserId: string;
  createdDate: string;
  /** بخش ۴-ب — سند «شناسایی بدهی» (شمارهٔ ۱)، در لحظهٔ تأیید نهایی (ورود به ReadyForExecution) صادر می‌شود. */
  liabilityVoucherId: string | null;
  liabilityVoucherNumber: string | null;
  /** بخش ۴-ب — سند «پرداخت» (شمارهٔ ۲)، در لحظهٔ اجرا صادر می‌شود. */
  paymentVoucherId: string | null;
  paymentVoucherNumber: string | null;
  bankReference: string | null;
  /** Legacy `YYYYMMDD`. */
  paidDate: string | null;
  destinationIban: string | null;
  executedBy: string | null;
  executedDate: string | null;
  suspendReason: string | null;
  events: PaymentRequestEventDto[];
}

/**
 * `GET api/treasury/payment-requests/{id}/accounting` — `PaymentRequestAccountingDto`، بخش ۴-ب.
 * فقط-خواندنی: تصویری از دو سند خودکار GL (اگر صادر شده باشند) و کد Legacy
 * `TB_PAYRECIVHEAD` (اگر پرداخت اجرا شده باشد).
 */
export interface PaymentRequestAccountingDto {
  liabilityVoucher: PaymentRequestVoucherAccountingDto | null;
  paymentVoucher: PaymentRequestVoucherAccountingDto | null;
  payRecivCode: string | null;
}

/** `totalDebit`/`totalCredit` — سرور محاسبه می‌کند، همیشه با هم برابرند. `state` — `DocLife`. */
export interface PaymentRequestVoucherAccountingDto {
  id: string;
  voucherNumber: string | null;
  date: string | null;
  state: number | null;
  lines: PaymentRequestVoucherLineAccountingDto[];
  totalDebit: number;
  totalCredit: number;
}

/** هر تفصیلی به شکل `"{code} - {name}"`، با «، » به هم پیوسته؛ رشتهٔ خالی یعنی ردیف تفصیلی ندارد. */
export interface PaymentRequestVoucherLineAccountingDto {
  accountCode: string | null;
  accountName: string | null;
  tafsiliLabels: string;
  debit: number;
  credit: number;
}

/**
 * یک ردیف `GET api/treasury/approval-cartable` — `ApprovalCartableItemDto`. ادغام درخواست‌های
 * پرداخت Pending*، ترمیم‌های تنخواهِ PendingTreasurer و — بخش ۴-ج (۲۰۲۶-۰۹-۲۹) — انتقال‌های وجه
 * PendingTreasurer در یک فهرست، همیشه در C# (نه یک join سمت SQL) — `nature` مشخص می‌کند کدام
 * مجموعهٔ اقدام/مسیر برای این ردیف درست است.
 */
export interface ApprovalCartableItemDto {
  nature: 'payment' | 'replenishment' | 'transfer';
  id: string;
  code: string;
  beneficiaryOrFund: string;
  description: string | null;
  amount: number;
  /** مقدار خامِ enum وضعیت — enum متفاوت بر اساس nature؛ فقط `stateLabel` را نشان بده. */
  state: number;
  stateLabel: string;
  ageDays: number;
  dueDate: string | null;
  pendingForMe: boolean;
}

/* ------------------------------------------------------------------------------------------- *
 * بخش ۴-ج — دریافت وجه (`ReceiptDto`/`ReceiptListItemDto`/`ReceiptListResult`/`ReceiptAccountingDto`)
 * ------------------------------------------------------------------------------------------- */

/** یک ردیف `GET api/treasury/receipts` — `ReceiptListItemDto`. */
export interface ReceiptListItemDto {
  id: string;
  code: string;
  payerName: string;
  amount: number;
  state: ReceiptStateValue;
  /** Legacy `YYYYMMDD`. */
  receiptDate: string;
  createdDate: string;
  addUserId: string;
}

export interface ReceiptStateCountDto {
  state: ReceiptStateValue;
  count: number;
}

/** `GET api/treasury/receipts` envelope — `ReceiptListResult`. */
export interface ReceiptListResult {
  page: {
    items: ReceiptListItemDto[];
    pageNumber: number;
    pageSize: number;
    totalCount: number;
  };
  stateCounts: ReceiptStateCountDto[];
}

/**
 * `GET api/treasury/receipts/{id}` — `ReceiptDto`. دریافت وجه «گردش عملیات» ندارد (بر خلاف
 * درخواست پرداخت/انتقال وجه) — `state` به‌همراه `registeredBy`/`registeredDate` تنها گذار معنادار
 * آن را نشان می‌دهد.
 */
export interface ReceiptDto {
  id: string;
  code: string;
  payerTafsiliId: string;
  payerTafsiliCode: string | null;
  payerTafsiliName: string | null;
  payerName: string;
  amount: number;
  bankAccountId: string;
  receiptMethod: TreasuryPaymentMethodValue;
  /** Legacy `YYYYMMDD`. */
  receiptDate: string;
  bankReference: string;
  invoiceRef: string | null;
  description: string | null;
  state: ReceiptStateValue;
  voucherId: string | null;
  voucherNumber: string | null;
  payRecivHeadId: string | null;
  payRecivCode: string | null;
  registeredBy: string | null;
  registeredDate: string | null;
  addUserId: string;
  createdDate: string;
}

/**
 * `GET api/treasury/receipts/{id}/accounting` — `ReceiptAccountingDto`. همان شکل سند با
 * `PaymentRequestVoucherAccountingDto` (دستور صاحب پروژه، بخش ۴-ج).
 */
export interface ReceiptAccountingDto {
  voucher: PaymentRequestVoucherAccountingDto | null;
  payRecivCode: string | null;
}

/* ------------------------------------------------------------------------------------------- *
 * بخش ۴-ج — انتقال وجه (`TransferDto`/`TransferListItemDto`/`TransferListResult`/`TransferEventDto`/`TransferAccountingDto`)
 * ------------------------------------------------------------------------------------------- */

/** یک ردیف `GET api/treasury/transfers` — `TransferListItemDto`. */
export interface TransferListItemDto {
  id: string;
  code: string;
  sourceBankAccountId: string;
  destBankAccountId: string;
  amount: number;
  state: TransferStateValue;
  /** Legacy `YYYYMMDD`. */
  transferDate: string;
  createdDate: string;
  addUserId: string;
}

export interface TransferStateCountDto {
  state: TransferStateValue;
  count: number;
}

/** `GET api/treasury/transfers` envelope — `TransferListResult`. */
export interface TransferListResult {
  page: {
    items: TransferListItemDto[];
    pageNumber: number;
    pageSize: number;
    totalCount: number;
  };
  stateCounts: TransferStateCountDto[];
}

/** یک ردیف «گردش عملیات» انتقال وجه — `TransferEventDto`. */
export interface TransferEventDto {
  id: string;
  action: TransferEventActionValue;
  fromState: TransferStateValue | null;
  toState: TransferStateValue | null;
  note: string | null;
  userId: string;
  createdDate: string;
  clientIp: string | null;
}

/** `GET api/treasury/transfers/{id}` — `TransferDto` — با «گردش عملیات». */
export interface TransferDto {
  id: string;
  code: string;
  sourceBankAccountId: string;
  destBankAccountId: string;
  amount: number;
  /** Legacy `YYYYMMDD`. */
  transferDate: string;
  transferMethod: TreasuryPaymentMethodValue;
  reason: string;
  state: TransferStateValue;
  bankReference: string | null;
  voucherId: string | null;
  voucherNumber: string | null;
  approvedBy: string | null;
  approvedDate: string | null;
  returnReason: string | null;
  addUserId: string;
  createdDate: string;
  events: TransferEventDto[];
}

/**
 * `GET api/treasury/transfers/{id}/accounting` — `TransferAccountingDto`. انتقال وجه معادل Legacy
 * `TB_PAYRECIVHEAD` ندارد (جابه‌جایی بانک‌به‌بانک است، نه پرداخت/دریافت نسبت به ذی‌نفع/مشتری) — فقط
 * یک سند GL خودکار.
 */
export interface TransferAccountingDto {
  voucher: PaymentRequestVoucherAccountingDto | null;
}

/** `GET api/treasury/bank-accounts/{id}/balance` — `BankAccountBalanceDto`. */
export interface BankAccountBalanceDto {
  bankAccountId: string;
  balance: number;
}

/* ------------------------------------------------------------------------------------------- *
 * بخش ۴-د — مغایرت‌گیری بانکی (`BankStatementDto`/...) + داشبورد خزانه (`TreasuryDashboardDto`)
 * ------------------------------------------------------------------------------------------- */

/** `BankStatementSource` — ۱=دستی، ۲=فایل «دیسکت» بانک (هنوز پیاده نشده، همیشه ۴۰۹ می‌دهد). */
export type BankStatementSourceValue = 1 | 2;

/** `BankStatementState` — ۱=باز (قابل ویرایش/تطبیق)، ۲=بسته (فقط‌خواندنی، قابل بازگشایی). */
export type BankStatementStateValue = 1 | 2;

/**
 * `BankStatementLineMatchState` — Unmatched(۱) → (تطبیق خودکار) AutoMatched(۲) یا (تطبیق دستی)
 * ManualMatched(۳)، یا مستقیماً (رفع) Resolved(۴). AutoMatched/ManualMatched → (لغو تطبیق) به
 * Unmatched برمی‌گردد. Resolved → (برگرداندن، فقط اگر سند رفع هنوز موقت باشد) به Unmatched برمی‌گردد.
 */
export type BankStatementLineMatchStateValue = 1 | 2 | 3 | 4;

/** `BankStatementLineResolutionType` — ۱=سند کارمزد بانکی (فقط برداشت)، ۲=اتصال به دریافت (فقط واریز)، ۳=نادیده‌گرفته‌شده. */
export type BankStatementLineResolutionTypeValue = 1 | 2 | 3;

/** یک ردیف `GET api/treasury/statements` — `BankStatementListItemDto`. */
export interface BankStatementListItemDto {
  id: string;
  code: string;
  bankAccountId: string;
  /** Legacy `YYYYMMDD`. */
  fromDate: string;
  /** Legacy `YYYYMMDD`. */
  toDate: string;
  closingBalance: number;
  source: BankStatementSourceValue;
  state: BankStatementStateValue;
  createdDate: string;
  addUserId: string;
}

export interface BankStatementStateCountDto {
  state: BankStatementStateValue;
  count: number;
}

/** `GET api/treasury/statements` envelope — `BankStatementListResult`. */
export interface BankStatementListResult {
  page: {
    items: BankStatementListItemDto[];
    pageNumber: number;
    pageSize: number;
    totalCount: number;
  };
  stateCounts: BankStatementStateCountDto[];
}

/** بخش خلاصهٔ `GET api/treasury/statements/{id}` — `BankStatementSummaryDto`. */
export interface BankStatementSummaryDto {
  closingBalance: number;
  bookBalance: number;
  /** = `closingBalance` − `bookBalance`. صفر یعنی مغایرتی نمانده (با احتساب ردیف‌های حل‌شده). */
  difference: number;
  unmatchedCount: number;
  autoMatchedCount: number;
  manualMatchedCount: number;
  resolvedCount: number;
}

/** یک ردیف صورت‌حساب — `BankStatementLineDto`. */
export interface BankStatementLineDto {
  id: string;
  statementId: string;
  /** Legacy `YYYYMMDD`. */
  lineDate: string;
  bankReference: string | null;
  description: string | null;
  withdrawal: number;
  deposit: number;
  balance: number | null;
  matchState: BankStatementLineMatchStateValue;
  matchedVoucherDetailId: string | null;
  matchedVoucherNumber: string | null;
  resolutionType: BankStatementLineResolutionTypeValue | null;
  resolutionVoucherId: string | null;
  resolutionVoucherNumber: string | null;
  resolutionReceiptId: string | null;
  resolutionReceiptCode: string | null;
  resolutionNote: string | null;
  addUserId: string;
  createdDate: string;
}

/**
 * یک ردیف دفتری (سند) کاندید/باقی‌مانده برای مغایرت‌گیری — `BankStatementBookLineDto`. شکل
 * مشترک `GET statements/{id}/book-candidates` و بخش «فقط در دفتر» جزئیات صورت‌حساب.
 */
export interface BankStatementBookLineDto {
  voucherDetailId: string;
  voucherHeadId: string;
  voucherNumber: string | null;
  /** Legacy `YYYYMMDD`. */
  voucherDate: string;
  debit: number;
  credit: number;
  description: string | null;
  /** مرجع بانک سند خزانهٔ صادرکننده (درخواست پرداخت/دریافت/انتقال)، اگر قابل‌تشخیص باشد. */
  sourceBankReference: string | null;
}

/** `GET api/treasury/statements/{id}` — `BankStatementDto` — جزئیات کامل. */
export interface BankStatementDto {
  id: string;
  code: string;
  bankAccountId: string;
  /** Legacy `YYYYMMDD`. */
  fromDate: string;
  /** Legacy `YYYYMMDD`. */
  toDate: string;
  closingBalance: number;
  source: BankStatementSourceValue;
  state: BankStatementStateValue;
  description: string | null;
  addUserId: string;
  createdDate: string;
  lines: BankStatementLineDto[];
  summary: BankStatementSummaryDto;
  bookOnly: BankStatementBookLineDto[];
}

/** `POST statements/{id}/auto-match` response — `BankStatementAutoMatchResult`. */
export interface BankStatementAutoMatchResult {
  matchedCount: number;
  unmatchedCount: number;
}

/** یک ردیف `GET api/treasury/dashboard` → `bankAccounts` — `TreasuryDashboardBankAccountDto`. */
export interface TreasuryDashboardBankAccountDto {
  bankAccountId: string;
  label: string;
  balance: number;
}

/** تعهدات ۷ روز آینده — `TreasuryDashboardCommitmentsDto`. `coverageRatio` — `null` یعنی تقسیم بر صفر، نه «بدون داده». */
export interface TreasuryDashboardCommitmentsDto {
  count: number;
  amount: number;
  coverageRatio: number | null;
}

/** در انتظار تأیید (کل واحد، نه فقط کاربر جاری) — `TreasuryDashboardPendingApprovalDto`. */
export interface TreasuryDashboardPendingApprovalDto {
  count: number;
  amount: number;
}

/** گردش امروز — `TreasuryDashboardTodayDto`. */
export interface TreasuryDashboardTodayDto {
  receipts: number;
  payments: number;
  net: number;
}

/** یک ردیف «اقلام باز» داشبورد — `TreasuryDashboardOpenItemDto`. */
export interface TreasuryDashboardOpenItemDto {
  type: 'payment' | 'replenishment' | 'receipt' | 'transfer';
  id: string;
  code: string;
  counterparty: string | null;
  amount: number;
  /** فقط برای `payment` مقدار دارد (`dueDate`). Legacy `YYYYMMDD`. */
  dueDate: string | null;
  stateLabel: string;
}

/** `GET api/treasury/dashboard` — `TreasuryDashboardDto` — فقط‌خواندنی، مطابق صفحهٔ ۱۴ پاورپوینت. */
export interface TreasuryDashboardDto {
  totalBankBalance: number;
  bankAccounts: TreasuryDashboardBankAccountDto[];
  commitmentsNext7Days: TreasuryDashboardCommitmentsDto;
  pendingApproval: TreasuryDashboardPendingApprovalDto;
  today: TreasuryDashboardTodayDto;
  openItems: TreasuryDashboardOpenItemDto[];
  alerts: string[];
}
