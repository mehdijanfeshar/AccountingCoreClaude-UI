/**
 * ماژول «صورت‌های مالی»، بخش ۴۵-الف — قالب/نسخه/ردیف (`docs/fs-module.md` در ریپوی بک‌اند).
 * enumها عدد خام‌اند (بک‌اند JsonStringEnumConverter ندارد).
 */

export const FS_FRAMEWORK = { Pension: 1, Commercial: 2, Public: 3, Management: 4 } as const;
export type FsFrameworkValue = (typeof FS_FRAMEWORK)[keyof typeof FS_FRAMEWORK];

export const FS_FRAMEWORK_OPTIONS: { value: FsFrameworkValue; label: string }[] = [
  { value: 1, label: 'طرح بیمه‌ای (استاندارد ۲۷)' },
  { value: 2, label: 'واحد تجاری (استاندارد ۱)' },
  { value: 3, label: 'بخش عمومی' },
  { value: 4, label: 'مدیریتی' },
];

export const FS_STATEMENT_TYPE_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'خالص دارایی‌ها' },
  { value: 2, label: 'تغییرات در خالص دارایی‌ها' },
  { value: 3, label: 'گردش ارزش ویژه' },
  { value: 4, label: 'وضعیت مالی' },
  { value: 5, label: 'سود و زیان' },
  { value: 6, label: 'سود و زیان جامع' },
  { value: 7, label: 'تغییرات در حقوق مالکانه' },
  { value: 8, label: 'جریان‌های نقدی' },
  { value: 9, label: 'عملکرد مالی' },
  { value: 10, label: 'مدیریتی/آزاد' },
  { value: 11, label: "یادداشت" },
];

export const FS_STATEMENT_TYPE_NOTE = 11;

export const FS_VERSION_STATE = { Draft: 1, Active: 2, Retired: 3 } as const;
export type FsVersionStateValue = (typeof FS_VERSION_STATE)[keyof typeof FS_VERSION_STATE];

export const FS_VERSION_STATE_META: Record<number, { label: string; color: 'default' | 'success' | 'warning' }> = {
  1: { label: 'پیش‌نویس', color: 'warning' },
  2: { label: 'فعال', color: 'success' },
  3: { label: 'بازنشسته', color: 'default' },
};

export const FS_ROW_TYPE = { Header: 1, Account: 2, Formula: 3, External: 4, Text: 5, Blank: 6 } as const;
export type FsRowTypeValue = (typeof FS_ROW_TYPE)[keyof typeof FS_ROW_TYPE];

export const FS_ROW_TYPE_OPTIONS: { value: FsRowTypeValue; label: string; hint: string }[] = [
  { value: 1, label: 'عنوان', hint: 'عنوان بخش، بدون مقدار' },
  { value: 2, label: 'حساب', hint: 'جمع مانده/گردش حساب‌های انتخاب‌شده' },
  { value: 3, label: 'فرمول', hint: 'محاسبه از ردیف‌های دیگر' },
  { value: 4, label: 'مقدار دستی', hint: 'مقدار دستی یا از سیستم دیگر' },
  { value: 5, label: 'متن', hint: 'متن توضیحی بدون مقدار' },
  { value: 6, label: 'خالی', hint: 'فاصله' },
];

export const FS_NORMAL_BALANCE_OPTIONS = [
  { value: 1, label: 'بدهکار' },
  { value: 2, label: 'بستانکار' },
] as const;

export const FS_VALUE_TYPE_OPTIONS = [
  { value: 1, label: 'مانده پایان دوره' },
  { value: 2, label: 'مانده ابتدای دوره' },
  { value: 3, label: 'گردش خالص دوره' },
  { value: 4, label: 'گردش بدهکار' },
  { value: 5, label: 'گردش بستانکار' },
] as const;

export const FS_BORDER_OPTIONS = [
  { value: 0, label: 'بدون خط' },
  { value: 1, label: 'یک خط' },
  { value: 2, label: 'دو خط' },
] as const;

export function labelOf(options: readonly { value: number; label: string }[], value: number | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? '—';
}

export interface FsRowFormat {
  indent: number;
  bold: boolean;
  italic: boolean;
  topBorder: number;
  bottomBorder: number;
  hideIfZero: boolean;
  pageBreakBefore: boolean;
  innerColumn: boolean;
}

export interface FsTemplateVersionSummaryDto {
  id: string;
  versionNo: number;
  state: FsVersionStateValue;
  effectiveFromYear: number | null;
  description: string | null;
  activatedBy: string | null;
  activatedDate: string | null;
  rowCount: number;
  createdDate: string;
}

export interface FsTemplateDto {
  id: string;
  /** خالی = قالب مشترک همهٔ واحدها. */
  ownerVahedCode: string | null;
  ownerVahedName: string | null;
  /** واحد جاری (هدر) می‌تواند تغییرش دهد — مشترک فقط ستاد. */
  canEdit: boolean;
  framework: FsFrameworkValue;
  code: string;
  titleFa: string;
  titleEn: string | null;
  statementType: number;
  orderNo: number;
  /** فقط یادداشت (نوع ۱۱): صورت و ردیفی که یادداشت به آن وصل است، و ردیف جمع برای کنترل. */
  noteParentTemplateCode: string | null;
  noteParentRowCode: string | null;
  noteTotalRowCode: string | null;
  versions: FsTemplateVersionSummaryDto[];
}

export interface FsTemplateRowDto {
  id: string;
  code: string;
  parentId: string | null;
  parentCode: string | null;
  orderNo: number;
  rowType: FsRowTypeValue;
  titleFa: string | null;
  titleEn: string | null;
  noteRef: string | null;
  normalBalance: number | null;
  selector: string | null;
  valueType: number | null;
  formula: string | null;
  format: FsRowFormat;
  isDrillable: boolean;
  allowManualAdjust: boolean;
}

export interface FsTemplateVersionDetailDto {
  id: string;
  templateId: string;
  ownerVahedCode: string | null;
  canEdit: boolean;
  templateCode: string;
  templateTitleFa: string;
  framework: FsFrameworkValue;
  statementType: number;
  noteParentTemplateCode: string | null;
  noteParentRowCode: string | null;
  noteTotalRowCode: string | null;
  versionNo: number;
  state: FsVersionStateValue;
  effectiveFromYear: number | null;
  description: string | null;
  activatedBy: string | null;
  activatedDate: string | null;
  contentHash: string | null;
  rows: FsTemplateRowDto[];
}

/** بدنهٔ افزودن/ویرایش/ورود ردیف — والد با کد ردیف. */
export interface FsTemplateRowInput {
  code: string;
  rowType: FsRowTypeValue;
  titleFa: string | null;
  titleEn: string | null;
  parentCode: string | null;
  noteRef: string | null;
  normalBalance: number | null;
  selector: string | null;
  valueType: number | null;
  formula: string | null;
  format: FsRowFormat | null;
  isDrillable: boolean;
  allowManualAdjust: boolean;
  orderNo: number | null;
}

export interface FsTemplateIssue {
  rowCode: string | null;
  field: string;
  /** 1 = هشدار، 2 = خطا */
  severity: 1 | 2;
  message: string;
}

export interface FsTemplateCheckResultDto {
  isValid: boolean;
  issues: FsTemplateIssue[];
}

/* ---- بخش ۴۵-و — نگاشت حساب‌ها ---- */

export interface FsMappingMatchDto {
  templateCode: string;
  templateTitle: string;
  isNote: boolean;
  rowCode: string;
  rowTitle: string | null;
  /** "D" = فقط مانده بدهکار، "C" = فقط بستانکار، null = همه. */
  side: 'D' | 'C' | null;
}

export interface FsAccountMappingDto {
  accCode: string;
  accName: string | null;
  kolCode: string | null;
  kolName: string | null;
  groupCode: string | null;
  groupName: string | null;
  /** فقط صورت‌های اصلی؛ صفر = بدون نگاشت. */
  statementMatchCount: number;
  doubleCounted: boolean;
  matches: FsMappingMatchDto[];
  /** فقط برای «بدون نگاشت»: پرتکرارترین ردیف بین معین‌های هم‌کل، وگرنه هم‌گروه. */
  suggestion: FsMappingSuggestionDto | null;
}

/** بخش ۴۵-و — پیش‌نمایش زندهٔ یک نسخهٔ قالب (بدون ذخیرهٔ اجرا). */
export interface FsTemplatePreviewDto {
  templateCode: string;
  titleFa: string;
  /** خطای محاسبه (ارجاع/دور)؛ در این صورت مبالغ خالی‌اند. */
  error: string | null;
  rows: import('./fsRun').FsRunRowDto[];
}

export interface FsMappingSuggestionDto {
  templateCode: string;
  templateTitle: string;
  rowCode: string;
  rowTitle: string | null;
  basis: 'kol' | 'group';
  siblingCount: number;
}

/** یک سطر نگاشت: معین به ردیف از قالب. */
export interface FsMappingAssignment {
  accCode: string;
  templateCode: string;
  rowCode: string;
}

export interface FsMappingApplyItemResult extends FsMappingAssignment {
  status: 'applied' | 'unchanged' | 'error';
  message: string | null;
}

export interface FsMappingApplyResultDto {
  appliedCount: number;
  errorCount: number;
  dryRun: boolean;
  items: FsMappingApplyItemResult[];
}
