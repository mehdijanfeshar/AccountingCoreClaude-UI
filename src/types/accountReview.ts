/** Mirrors Accounting.Api's `AccountReviewRowDto` exactly — `GET /api/reports/account-review`. */
export interface AccountReviewRow {
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
 * Mirrors `AccountReviewLevel`. The numbers are the wire contract — they match the reference
 * system's `typeShow` (1..10), so the same selection produces comparable output in both.
 */
export const ACCOUNT_REVIEW_LEVEL = {
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

export type AccountReviewLevelValue = (typeof ACCOUNT_REVIEW_LEVEL)[keyof typeof ACCOUNT_REVIEW_LEVEL];

/**
 * The level picker's options, split into the two families they actually belong to. Keeping the
 * split explicit is what lets the picker group them instead of showing ten flat entries where
 * «معین» and «تفصیلی ۴» look like the same kind of thing.
 */
export const ACCOUNT_REVIEW_CODING_LEVELS: { value: AccountReviewLevelValue; label: string }[] = [
  { value: ACCOUNT_REVIEW_LEVEL.group, label: 'گروه' },
  { value: ACCOUNT_REVIEW_LEVEL.kol, label: 'کل' },
  { value: ACCOUNT_REVIEW_LEVEL.moin, label: 'معین' },
];

export const ACCOUNT_REVIEW_TAFSILI_LEVELS: { value: AccountReviewLevelValue; label: string }[] = [
  { value: ACCOUNT_REVIEW_LEVEL.tafsili1, label: 'تفصیلی ۱' },
  { value: ACCOUNT_REVIEW_LEVEL.tafsili2, label: 'تفصیلی ۲' },
  { value: ACCOUNT_REVIEW_LEVEL.tafsili3, label: 'تفصیلی ۳' },
  { value: ACCOUNT_REVIEW_LEVEL.tafsili4, label: 'تفصیلی ۴' },
  { value: ACCOUNT_REVIEW_LEVEL.tafsili5, label: 'تفصیلی ۵' },
  { value: ACCOUNT_REVIEW_LEVEL.tafsili6, label: 'تفصیلی ۶' },
  { value: ACCOUNT_REVIEW_LEVEL.tafsili7, label: 'تفصیلی ۷' },
];

export const ACCOUNT_REVIEW_ALL_LEVELS = [...ACCOUNT_REVIEW_CODING_LEVELS, ...ACCOUNT_REVIEW_TAFSILI_LEVELS];

export function accountReviewLevelLabel(value: AccountReviewLevelValue): string {
  return ACCOUNT_REVIEW_ALL_LEVELS.find((o) => o.value === value)?.label ?? '—';
}

/** One step of the drill-down path — mirrors `AccountReviewScopeItem`. */
export interface AccountReviewScopeStep {
  level: AccountReviewLevelValue;
  code: string;
}

/** Mirrors `AccountReviewScopeDto` — a resolved step, with its name, for the breadcrumb. */
export interface AccountReviewScopeCrumb {
  level: AccountReviewLevelValue;
  levelLabel: string;
  code: string;
  /** Empty when the code matches no lines — the step is still echoed back rather than dropped. */
  name: string;
}

/** Mirrors `AccountReviewResultDto`. */
export interface AccountReviewResult {
  rows: AccountReviewRow[];
  level: AccountReviewLevelValue;
  levelLabel: string;
  /** The path that led here, shallowest first. */
  scope: AccountReviewScopeCrumb[];
  /** Levels that actually carry data inside the current scope — the answer to «کدام سطوح؟». */
  availableLevels: AccountReviewLevelValue[];
}

export interface AccountReviewParams {
  year: string;
  level: AccountReviewLevelValue;
  scope?: AccountReviewScopeStep[];
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
export function nextAccountReviewLevel(level: AccountReviewLevelValue): AccountReviewLevelValue | null {
  return level < ACCOUNT_REVIEW_LEVEL.tafsili7 ? ((level + 1) as AccountReviewLevelValue) : null;
}
