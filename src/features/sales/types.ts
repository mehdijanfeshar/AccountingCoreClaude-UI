/**
 * ماژول فروش، فاز ۱ — `api/sales` (بک‌اند: `Accounting.Application/Sales`، طرح `docs/sales-module.md`).
 * تاریخ‌ها شمسی `YYYYMMDD`؛ مبلغ‌ها ریال صحیح؛ enumها عدد.
 */

/** 1 پیش‌فاکتور · 2 سفارش · 3 حواله · 4 فاکتور · 5 برگشت */
export type SalesDocType = 1 | 2 | 3 | 4 | 5;
/** 1 پیش‌نویس · 2 در انتظار تأیید · 3 تأییدشده · 4 قطعی · 9 باطل */
export type SalesDocStatus = 1 | 2 | 3 | 4 | 9;
/** 1 کارشناس فروش · 2 مدیر فروش · 3 حسابدار */
export type SalesRole = 1 | 2 | 3;
/** 1 کالا · 2 خدمت */
export type SalesItemKind = 1 | 2;
/** 1 حقیقی · 2 حقوقی */
export type PersonKind = 1 | 2;
/** 1 هشدار · 2 توقف · 3 ارجاع */
export type CreditPolicy = 1 | 2 | 3;
/** 1 داخلی · 2 صادراتی · 3 خدمات */
export type SalesType = 1 | 2 | 3;

export const DOC_TYPE_LABEL: Record<SalesDocType, string> = { 1: 'پیش‌فاکتور', 2: 'سفارش فروش', 3: 'حواله تحویل', 4: 'فاکتور فروش', 5: 'برگشت از فروش' };
export const STATUS_LABEL: Record<SalesDocStatus, string> = { 1: 'پیش‌نویس', 2: 'در انتظار تأیید', 3: 'تأییدشده', 4: 'قطعی‌شده', 9: 'باطل' };
export const STATUS_COLOR: Record<SalesDocStatus, 'default' | 'warning' | 'info' | 'success' | 'error'> = { 1: 'default', 2: 'warning', 3: 'info', 4: 'success', 9: 'error' };
export const ROLE_LABEL: Record<SalesRole, string> = { 1: 'کارشناس فروش', 2: 'مدیر فروش', 3: 'حسابدار فروش' };
export const POSTABLE: SalesDocType[] = [3, 4, 5];

export const ACCOUNT_ROLES: { key: string; title: string; hint: string }[] = [
  { key: 'ar', title: 'حساب‌های دریافتنی', hint: 'تفصیلی مشتری روی این حساب می‌نشیند — الزامی' },
  { key: 'sales', title: 'فروش کالا', hint: 'درآمد کالای تحویل‌شده' },
  { key: 'service', title: 'درآمد خدمات', hint: '' },
  { key: 'disc', title: 'تخفیفات فروش', hint: 'کاهندهٔ درآمد، جدا از فروش' },
  { key: 'ret', title: 'برگشت از فروش', hint: '' },
  { key: 'vat', title: 'مالیات بر ارزش افزوده', hint: '' },
  { key: 'contract', title: 'بدهی قراردادی', hint: 'فقط با «فاکتور پیش از تحویل»' },
  { key: 'cogs', title: 'بهای تمام‌شده', hint: 'حواله و فاکتور مستقیم' },
  { key: 'inv', title: 'موجودی کالا', hint: '' },
];

export interface SalesWriteResult {
  success: boolean;
  id: string | null;
  errors: string[];
}

export interface SalesSettings {
  discountApprovalPercent: number;
  creditPolicy: CreditPolicy;
  segregationOfDuties: boolean;
  billBeforeDelivery: boolean;
  allowNegativeStock: boolean;
  systemTypeId: string | null;
  sellerId: string | null;
  memoryId: string | null;
}

export interface SalesAccountMap {
  roleKey: string;
  accountId: string;
  accountCode: string | null;
  accountTitle: string | null;
  tafsiliId: string | null;
  tafsiliTitle: string | null;
}

export interface SalesSetup {
  settings: SalesSettings;
  accounts: SalesAccountMap[];
  myRoles: SalesRole[];
  isAdmin: boolean;
  canManage: boolean;
  configured: boolean;
}

export interface SalesVatRate {
  id: string;
  fromDate: string;
  rate: number;
  note: string | null;
}

export interface SalesUserRole {
  id: string;
  userId: string;
  role: SalesRole;
}

export interface SalesItem {
  id: string;
  code: string;
  name: string;
  kind: SalesItemKind;
  groupName: string | null;
  unitName: string;
  price: number;
  standardCost: number;
  taxCode: string | null;
  isExempt: boolean;
  stock: number;
  isActive: boolean;
}

export interface SalesCustomer {
  id: string;
  tafsiliId: string;
  tafsiliCode: string | null;
  name: string | null;
  personKind: PersonKind;
  nationalId: string | null;
  economicCode: string | null;
  postalCode: string | null;
  creditLimit: number;
  payTerms: number;
  isBlocked: boolean;
  completeForMoadian: boolean;
}

export interface SalesDocLineInput {
  itemId: string;
  qty: number;
  price: number;
  discountPercent: number;
}

export interface SalesDocInput {
  docType: SalesDocType;
  docDate: string;
  customerId: string;
  sourceId: string | null;
  payTerms: number;
  validUntil: string | null;
  deliveryDate: string | null;
  salesType: SalesType;
  refNo: string | null;
  note: string | null;
  printNote: string | null;
  headerDiscount: number;
  lines: SalesDocLineInput[];
}

export interface SalesCheck {
  /** err · warn · ok · info */
  level: string;
  message: string;
}

export interface SalesDocLine {
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  kind: SalesItemKind | null;
  unitName: string | null;
  taxCode: string | null;
  stock: number;
  qty: number;
  price: number;
  discountPercent: number;
  gross: number;
  lineDiscount: number;
  headerDiscountShare: number;
  taxable: number;
  vatRate: number;
  vat: number;
  total: number;
}

export interface SalesDocPreview {
  gross: number;
  discount: number;
  taxable: number;
  vat: number;
  total: number;
  vatRate: number;
  lines: SalesDocLine[];
  checks: SalesCheck[];
  approvalReasons: string[];
  customerBalance: number | null;
  customerOpenOrders: number | null;
  creditLimit: number | null;
}

export interface SalesDocResult {
  success: boolean;
  id: string | null;
  docNo: string | null;
  status: SalesDocStatus | null;
  checks: SalesCheck[];
  errors: string[];
  voucherId: string | null;
  voucherNo: string | null;
}

export interface SalesDocListRow {
  id: string;
  docType: SalesDocType;
  docNo: string | null;
  docDate: string;
  customerId: string;
  customerName: string | null;
  status: SalesDocStatus;
  total: number;
  sourceId: string | null;
  voucherId: string | null;
  createdBy: string;
}

export interface SalesDocPage {
  items: SalesDocListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SalesJournalLine {
  roleKey: string;
  accountId: string;
  accountCode: string | null;
  accountTitle: string | null;
  debit: number;
  credit: number;
  description: string;
  details: { level: number; levelId: string; detailId: string; detailTitle: string }[];
}

export interface SalesDoc {
  id: string;
  docType: SalesDocType;
  docNo: string | null;
  docDate: string;
  status: SalesDocStatus;
  customer: SalesCustomer | null;
  sourceId: string | null;
  payTerms: number;
  dueDate: string | null;
  validUntil: string | null;
  deliveryDate: string | null;
  salesType: SalesType;
  refNo: string | null;
  note: string | null;
  printNote: string | null;
  headerDiscount: number;
  gross: number;
  discount: number;
  taxable: number;
  vat: number;
  total: number;
  approvalReasons: string[];
  voucherId: string | null;
  createdBy: string;
  approvedBy: string | null;
  postedBy: string | null;
  createdAtUtc: string;
  lines: SalesDocLine[];
  chain: { id: string; docType: SalesDocType; docNo: string | null; status: SalesDocStatus; depth: number }[];
  conversions: { target: SalesDocType; available: boolean; reason: string | null }[];
  journal: SalesJournalLine[];
  journalErrors: string[];
  checks: SalesCheck[];
  history: { action: string; by: string; at: string }[];
  can: { edit: boolean; submit: boolean; approve: boolean; reject: boolean; post: boolean; void: boolean; convert: boolean };
}

export function docLabel(type: SalesDocType, no: string | null): string {
  return `${DOC_TYPE_LABEL[type]} ${no ?? '(بدون شماره)'}`;
}
