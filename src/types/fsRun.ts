import type { FsFrameworkValue, FsRowFormat, FsRowTypeValue, FsVersionStateValue } from './fsTemplate';

/** صورت‌های مالی، بخش ۴۵-ب — اجرا و Snapshot. مبالغ با علامت حسابداری (بدهکار مثبت). */

export interface FsRunSummaryDto {
  id: string;
  runNo: number;
  vahedCode: string;
  vahedName: string | null;
  includeSubUnits: boolean;
  unitCount: number;
  framework: FsFrameworkValue;
  year: string;
  toMonth: number;
  minDocLife: number;
  hasPrior: boolean;
  usesDraft: boolean;
  state: number;
  description: string | null;
  statementCount: number;
  durationMs: number | null;
  addUserId: string;
  createdDate: string;
}

export interface FsRunRowDto {
  id: string;
  code: string;
  parentCode: string | null;
  orderNo: number;
  rowType: FsRowTypeValue;
  titleFa: string | null;
  titleEn: string | null;
  noteRef: string | null;
  /** 1 بدهکار، 2 بستانکار — بستانکار در نمایش قرینه می‌شود. */
  normalBalance: number | null;
  selector: string | null;
  valueType: number | null;
  formula: string | null;
  format: FsRowFormat;
  isDrillable: boolean;
  amountCur: number | null;
  amountPrv: number | null;
}

export interface FsRunStatementDto {
  id: string;
  templateId: string;
  versionId: string;
  templateCode: string;
  titleFa: string;
  statementType: number;
  orderNo: number;
  versionNo: number;
  versionState: FsVersionStateValue;
  isNote: boolean;
  /** شمارهٔ داده‌شده در این اجرا (ارقام لاتین). */
  noteNo: string | null;
  parentTemplateCode: string | null;
  parentRowCode: string | null;
  totalRowCode: string | null;
  /** کنترل V-08: جمع یادداشت − ردیف صورت (علامت حسابداری)؛ 0 = برابر؛ null = بی‌والد. */
  checkDiffCur: number | null;
  checkDiffPrv: number | null;
  rows: FsRunRowDto[];
}

export interface FsRunDetailDto {
  run: FsRunSummaryDto;
  fromDate: string;
  toDate: string;
  contentHash: string | null;
  noteStartNo: number;
  statements: FsRunStatementDto[];
  sourceRunId: string | null;
  checks: FsRunCheckDto[];
  actions: FsRunActionDto[];
  manualValues: FsRunManualDto[];
}

export interface GenerateFsRunPayload {
  framework: FsFrameworkValue;
  year: string;
  toMonth: number;
  includeSubUnits: boolean;
  minDocLife: number;
  includePrior: boolean;
  useDraftVersions: boolean;
  description: string | null;
  noteStartNo: number;
  /** بخش ۴۵-ه — اجرای پیش‌نویسی که این اجرا جایگزینش می‌شود. */
  sourceRunId?: string | null;
  manualValues?: FsManualValueInput[];
}

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/** «سال مالی منتهی به پایان اسفند ۱۴۰۴» یا «دورهٔ ۶ ماهه منتهی به پایان شهریور ۱۴۰۴». */
export function describePeriod(year: string, toMonth: number, toPersian: (v: string | number) => string): string {
  const month = PERSIAN_MONTHS[toMonth - 1] ?? '';
  return toMonth === 12
    ? `سال مالی منتهی به پایان ${month} ${toPersian(year)}`
    : `دورهٔ ${toPersian(toMonth)} ماهه منتهی به پایان ${month} ${toPersian(year)}`;
}

/* ---- بخش ۴۵-د — Drill-down ---- */

export interface FsDrillAccountDto {
  accCode: string;
  accName: string | null;
  amountCur: number | null;
  amountPrv: number | null;
}

export interface FsDrillUnitDto {
  vahedCode: string;
  vahedName: string | null;
  amountCur: number | null;
  amountPrv: number | null;
}

export interface FsDrillVoucherLineDto {
  voucherHeadId: string;
  docNum: string | null;
  dateDoc: string | null;
  vahedCode: string | null;
  headDesc: string | null;
  lineDesc: string | null;
  debtor: number;
  creditor: number;
  isOpening: boolean;
}

export interface FsDrillVoucherPageDto {
  items: FsDrillVoucherLineDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  sumDebtor: number;
  sumCreditor: number;
}

/* ---- بخش ۴۵-ه — کنترل‌ها، گردش تأیید، مقادیر دستی ---- */

export const FS_RUN_STATE = { Draft: 1, InReview: 2, Approved: 3, Published: 4, Superseded: 5 } as const;

export const FS_RUN_STATE_META: Record<number, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'primary' }> = {
  1: { label: 'پیش‌نویس', color: 'warning' },
  2: { label: 'در بازبینی', color: 'info' },
  3: { label: 'تأییدشده', color: 'primary' },
  4: { label: 'منتشرشده', color: 'success' },
  5: { label: 'جایگزین‌شده', color: 'default' },
};

export const FS_RUN_ACTION = { Submit: 1, Approve: 2, Return: 3, Publish: 4, Supersede: 5 } as const;

export const FS_RUN_ACTION_LABEL: Record<number, string> = {
  1: 'ارسال برای بازبینی',
  2: 'تأیید',
  3: 'برگشت',
  4: 'انتشار',
  5: 'جایگزینی',
};

/** 1 اطلاع، 2 هشدار، 3 مسدودکننده. */
export const FS_CHECK_SEVERITY_LABEL: Record<number, string> = { 1: 'اطلاع', 2: 'هشدار', 3: 'مسدودکننده' };

export interface FsRunCheckDto {
  code: string;
  titleFa: string;
  severity: 1 | 2 | 3;
  passed: boolean;
  message: string | null;
  difference: number | null;
  rowRef: string | null;
}

export interface FsRunActionDto {
  action: number;
  fromState: number;
  toState: number;
  userId: string;
  comments: string | null;
  createdDate: string;
}

export interface FsRunManualDto {
  templateCode: string;
  rowCode: string;
  amountCur: number | null;
  amountPrv: number | null;
  reason: string;
  addUserId: string;
  createdDate: string;
}

export interface FsManualValueInput {
  templateCode: string;
  rowCode: string;
  amountCur: number | null;
  amountPrv: number | null;
  reason: string;
}

export interface FsRunDiffRowDto {
  templateCode: string;
  statementTitle: string;
  isNote: boolean;
  rowCode: string;
  titleFa: string | null;
  normalBalance: number | null;
  amountA: number | null;
  amountB: number | null;
}

export interface FsRunStalenessDto {
  isStale: boolean;
  unknown: boolean;
}

export interface FsCheckRuleDto {
  id: string;
  ownerVahedCode: string | null;
  canEdit: boolean;
  framework: number;
  code: string;
  titleFa: string;
  leftExpr: string;
  rightExpr: string;
  tolerance: number;
  severity: 1 | 2 | 3;
  isActive: boolean;
}
