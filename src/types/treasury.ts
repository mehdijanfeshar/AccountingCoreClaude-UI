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

/**
 * `GET/POST api/treasury/settings` — `TreasurySettingDto`. `beneficiaryTafsilGroupId` — اصلاح
 * ۴-الف (۲۰۲۶-۰۹-۲۹) — `null` یعنی واحد هنوز گروه تفصیلی ذی‌نفع تعریف نکرده؛ در این حالت ثبت
 * درخواست پرداخت با تفصیلی ذی‌نفع رد می‌شود. سه فیلد `...AccountId`/`...AccountCode`/
 * `...AccountName` — بخش ۴-ب (۲۰۲۶-۰۹-۲۹): `null` یعنی هنوز تعریف نشده — صدور سند شناسایی بدهی با
 * ۴۰۹ رد می‌شود.
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
 * پرداخت Pending* و ترمیم‌های تنخواهِ PendingTreasurer در یک فهرست، همیشه در C# (نه یک join سمت
 * SQL) — `nature` مشخص می‌کند کدام مجموعهٔ اقدام/مسیر برای این ردیف درست است.
 */
export interface ApprovalCartableItemDto {
  nature: 'payment' | 'replenishment';
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
