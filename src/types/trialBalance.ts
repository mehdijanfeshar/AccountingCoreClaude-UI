/**
 * Mirrors `Accounting.Application.Reports.TrialBalance` — read from the backend contract, not
 * guessed. Two things about this endpoint differ from every other list in the app and are worth
 * knowing before you touch it:
 *
 * 1. It returns a **bare array**, not a `PagedResult`. The backend aggregates one row per account
 *    code at the requested level, so the result is naturally small and unpaged.
 * 2. It takes **no `vahedCode`**. The server imposes the caller's own unit from the token
 *    (`VahedScopeBehavior`, phase 19). Sending one from the client is forbidden across this app.
 *    `year`, by contrast, really is a query parameter.
 */

/** `TrialBalanceLevel` — which row of the coding hierarchy the report aggregates by. */
export const TRIAL_BALANCE_LEVEL = {
  Group: 1,
  Kol: 2,
  Moin: 3,
} as const;

export type TrialBalanceLevel = (typeof TRIAL_BALANCE_LEVEL)[keyof typeof TRIAL_BALANCE_LEVEL];

export const TRIAL_BALANCE_LEVEL_LABELS: Record<TrialBalanceLevel, string> = {
  [TRIAL_BALANCE_LEVEL.Group]: 'گروه',
  [TRIAL_BALANCE_LEVEL.Kol]: 'کل',
  [TRIAL_BALANCE_LEVEL.Moin]: 'معین',
};

/**
 * `DOCLIFE` is an **ordinal** state, and the backend filter is an inclusive lower bound — "at
 * least this degree of finality" — not an equality match. That is why these read as
 * "و بالاتر" rather than as plain states.
 *
 * Value 0 exists in the column's Oracle DEFAULT but carries no agreed meaning, so it is
 * deliberately not offered here (see phase 28 / open risk #2 in the backend docs).
 */
export const DOC_LIFE_FILTER_OPTIONS = [
  { value: 1, label: 'یادداشت و بالاتر' },
  { value: 2, label: 'موقت و بالاتر' },
  { value: 3, label: 'بررسی‌شده و بالاتر' },
  { value: 4, label: 'تأیید دائم' },
] as const;

/**
 * One row of the 4-column trial balance (تراز ۴ ستونی).
 *
 * `debtor`/`creditor` are the period's raw turnover; `debtorBalance`/`creditorBalance` are the
 * same figures netted into a single side, so exactly one of the two is non-zero on a given row.
 */
export interface TrialBalance4Row {
  code: string;
  description: string | null;
  debtor: number;
  creditor: number;
  debtorBalance: number;
  creditorBalance: number;
}

/**
 * 6-column (تراز ۶ ستونی) — the 4-column report plus the opening figures carried into the period.
 *
 * ⚠️ `firstDebtor`/`firstCreditor` carry a recorded ambiguity (open risk #17 in the backend docs):
 * the reference project's formula produces raw pre-period turnover, while the Persian label
 * "مانده اول دوره" suggests a netted one-sided balance. The backend implements the formula
 * faithfully and the question is still open with the project owner, so the UI labels these as
 * "اول دوره" and carries a visible caveat rather than asserting a meaning the code does not.
 */
export interface TrialBalance6Row extends TrialBalance4Row {
  firstDebtor: number;
  firstCreditor: number;
}

/**
 * 8-column (تراز ۸ ستونی) — adds cumulative totals (opening + period) to the 6-column report.
 */
export interface TrialBalance8Row extends TrialBalance6Row {
  totDebtor: number;
  totCreditor: number;
}

/** The widest shape; the 4- and 6-column rows are structural subsets of it. */
export type TrialBalanceRow = TrialBalance4Row & Partial<Omit<TrialBalance8Row, keyof TrialBalance4Row>>;

/** How many columns the report shows. Doubles as the endpoint selector. */
export type TrialBalanceVariant = 4 | 6 | 8;

export interface TrialBalanceParams {
  /** Required. Exact-match on `TB_VOUCHERSHEAD.YEAR` (4 characters). */
  year: string;
  /** Optional Jalali `YYYYMMDD` start of the period. */
  fromDate?: string;
  /** Optional Jalali `YYYYMMDD` end of the period. */
  toDate?: string;
  level: TrialBalanceLevel;
  /** Optional inclusive lower bound on the raw `DOCLIFE` number. */
  docLife?: number;
}

