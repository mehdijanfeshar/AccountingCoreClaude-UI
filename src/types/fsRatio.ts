/* ح-۸ — نسبت‌های مالی و روند (سند منبع §۱۲-۳ «تحلیل و مقایسهٔ دوره‌ای»). */

/** 1 درصد، 2 برابر، 3 مبلغ. */
export const FS_RATIO_FORMAT_OPTIONS = [
  { value: 1, label: 'درصد' },
  { value: 2, label: 'برابر' },
  { value: 3, label: 'مبلغ (ریال)' },
] as const;

export interface FsRatioDto {
  id: string;
  ownerVahedCode: string | null;
  canEdit: boolean;
  framework: number;
  code: string;
  titleFa: string;
  numeratorExpr: string;
  denominatorExpr: string | null;
  format: number;
  orderNo: number;
  isActive: boolean;
}

export interface FsRatioValueDto {
  code: string;
  titleFa: string;
  format: number;
  current: number | null;
  prior: number | null;
  error: string | null;
}

export interface FsRatioTrendYearDto {
  year: string;
  runId: string;
  runNo: number;
  state: number;
  values: FsRatioValueDto[];
}

/** نمایش مقدار نسبت با ارقام فارسی. */
export function formatRatio(value: number | null, format: number): string {
  if (value === null || Number.isNaN(value)) return '—';
  if (format === 1) return `${value.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}٪`;
  if (format === 2) return `${value.toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} برابر`;
  const r = Math.round(value);
  const text = Math.abs(r).toLocaleString('fa-IR');
  return r < 0 ? `(${text})` : text;
}

/* ح-۹ — داشبورد صورت‌ها. */

export interface FsTaskDto {
  /** approveRun | publishRun | check | reviewNarrative | reviseNarrative | reopenRequest */
  kind: string;
  title: string;
  detail: string | null;
  /** مسیر داخلی برنامه. */
  link: string;
  date: string | null;
}

export interface FsDashboardDto {
  run: import('./fsRun').FsRunSummaryDto | null;
  kpis: FsRatioValueDto[];
  tasks: FsTaskDto[];
}
