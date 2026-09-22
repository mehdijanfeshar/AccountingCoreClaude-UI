/** Mirrors Accounting.Api's `MatrixReportRowDto` exactly — `GET /api/reports/matrix`. */
export interface MatrixReportRow {
  code: string;
  name: string;
  /** Persian label of the level this row was grouped at — «گروه»/«کل»/«معین»/«تفصیلی ۳». */
  levelLabel: string;
  debtor: number;
  creditor: number;
  /** One-sided: exactly one of the two balances is non-zero for any row. */
  debtorBalance: number;
  creditorBalance: number;
  /**
   * Whether drilling into this row would show anything. Computed server-side per row, not assumed
   * from the level — a معین with no تفصیلی assignment is normal, and offering a drill-down that
   * lands on an empty table reads as a broken report.
   */
  hasChildren: boolean;
}

/**
 * Mirrors `MatrixReportLevel`. The numbers are the wire contract — they match the reference
 * system's `typeShow` (1..10), so the same selection produces comparable output in both.
 */
export const MATRIX_LEVEL = {
  group: 1,
  kol: 2,
  moin: 3,
  tafsili1: 4,
  tafsili2: 5,
  tafsili3: 6,
  tafsili4: 7,
  tafsili5: 8,
  tafsili6: 9,
  tafsili7: 10,
} as const;

export type MatrixLevelValue = (typeof MATRIX_LEVEL)[keyof typeof MATRIX_LEVEL];

/**
 * The level picker's options, split into the two families they actually belong to. Keeping the
 * split explicit is what lets the picker group them instead of showing ten flat entries where
 * «معین» and «تفصیلی ۴» look like the same kind of thing.
 */
export const MATRIX_CODING_LEVELS: { value: MatrixLevelValue; label: string }[] = [
  { value: MATRIX_LEVEL.group, label: 'گروه' },
  { value: MATRIX_LEVEL.kol, label: 'کل' },
  { value: MATRIX_LEVEL.moin, label: 'معین' },
];

export const MATRIX_TAFSILI_LEVELS: { value: MatrixLevelValue; label: string }[] = [
  { value: MATRIX_LEVEL.tafsili1, label: 'تفصیلی ۱' },
  { value: MATRIX_LEVEL.tafsili2, label: 'تفصیلی ۲' },
  { value: MATRIX_LEVEL.tafsili3, label: 'تفصیلی ۳' },
  { value: MATRIX_LEVEL.tafsili4, label: 'تفصیلی ۴' },
  { value: MATRIX_LEVEL.tafsili5, label: 'تفصیلی ۵' },
  { value: MATRIX_LEVEL.tafsili6, label: 'تفصیلی ۶' },
  { value: MATRIX_LEVEL.tafsili7, label: 'تفصیلی ۷' },
];

export const MATRIX_ALL_LEVELS = [...MATRIX_CODING_LEVELS, ...MATRIX_TAFSILI_LEVELS];

export function matrixLevelLabel(value: MatrixLevelValue): string {
  return MATRIX_ALL_LEVELS.find((o) => o.value === value)?.label ?? '—';
}

/** One step of the drill-down path — mirrors `MatrixReportScopeItem`. */
export interface MatrixScopeStep {
  level: MatrixLevelValue;
  code: string;
}

/** Mirrors `MatrixReportScopeDto` — a resolved step, with its name, for the breadcrumb. */
export interface MatrixScopeCrumb {
  level: MatrixLevelValue;
  levelLabel: string;
  code: string;
  /** Empty when the code matches no lines — the step is still echoed back rather than dropped. */
  name: string;
}

/** Mirrors `MatrixReportResultDto`. */
export interface MatrixReportResult {
  rows: MatrixReportRow[];
  level: MatrixLevelValue;
  levelLabel: string;
  /** The path that led here, shallowest first. */
  scope: MatrixScopeCrumb[];
  /** Levels that actually carry data inside the current scope — the answer to «کدام سطوح؟». */
  availableLevels: MatrixLevelValue[];
}

export interface MatrixReportParams {
  year: string;
  level: MatrixLevelValue;
  scope?: MatrixScopeStep[];
  fromDate?: string;
  toDate?: string;
  fromVoucherNo?: string;
  toVoucherNo?: string;
  docLife?: number;
  systemTypeId?: string;
}

/**
 * The level immediately below `level`, or null at the deepest one.
 *
 * Drilling always descends exactly one step, which is why this is a successor function rather than
 * a lookup: the hierarchy is گروه → کل → معین → تفصیلی ۱ … ۷ and the wire values are consecutive
 * by construction.
 */
export function nextMatrixLevel(level: MatrixLevelValue): MatrixLevelValue | null {
  return level < MATRIX_LEVEL.tafsili7 ? ((level + 1) as MatrixLevelValue) : null;
}
