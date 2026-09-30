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
