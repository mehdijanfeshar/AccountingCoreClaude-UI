import type { TrialBalanceRow, TrialBalanceVariant } from '../../../types/trialBalance';

/**
 * One definition of the report's columns, read by the table, the Excel export and the print view.
 *
 * Keeping it in one place is not tidiness for its own sake: three renderers that each decide their
 * own column order is how an export quietly stops matching the screen it came from, and nobody
 * notices until someone reconciles a printed page against the app.
 */

export interface TrialBalanceTotals {
  debtor: number;
  creditor: number;
  debtorBalance: number;
  creditorBalance: number;
  firstDebtor: number;
  firstCreditor: number;
  totDebtor: number;
  totCreditor: number;
}

export interface TrialBalanceColumn {
  key: string;
  /** Used inside a group header, where the group already says "اول دوره". */
  shortHeader: string;
  /** Used where there is no group header to lean on — Excel, and the narrow print layout. */
  fullHeader: string;
  get: (row: TrialBalanceRow) => number | undefined;
  total: (totals: TrialBalanceTotals) => number;
}

export interface TrialBalanceColumnGroup {
  key: string;
  label: string;
  /** Theme palette path; groups are tinted so the header reads as four blocks, not eight cells. */
  tone: string;
  columns: TrialBalanceColumn[];
}

const OPENING: TrialBalanceColumnGroup = {
  key: 'opening',
  label: 'اول دوره',
  tone: 'text.secondary',
  columns: [
    {
      key: 'firstDebtor',
      shortHeader: 'بدهکار',
      fullHeader: 'بدهکار اول دوره',
      get: (row) => row.firstDebtor,
      total: (t) => t.firstDebtor,
    },
    {
      key: 'firstCreditor',
      shortHeader: 'بستانکار',
      fullHeader: 'بستانکار اول دوره',
      get: (row) => row.firstCreditor,
      total: (t) => t.firstCreditor,
    },
  ],
};

const PERIOD: TrialBalanceColumnGroup = {
  key: 'period',
  label: 'گردش دوره',
  tone: 'primary.main',
  columns: [
    {
      key: 'debtor',
      shortHeader: 'بدهکار',
      fullHeader: 'گردش بدهکار',
      get: (row) => row.debtor,
      total: (t) => t.debtor,
    },
    {
      key: 'creditor',
      shortHeader: 'بستانکار',
      fullHeader: 'گردش بستانکار',
      get: (row) => row.creditor,
      total: (t) => t.creditor,
    },
  ],
};

const CUMULATIVE: TrialBalanceColumnGroup = {
  key: 'cumulative',
  label: 'جمع کل',
  tone: 'text.secondary',
  columns: [
    {
      key: 'totDebtor',
      shortHeader: 'بدهکار',
      fullHeader: 'جمع بدهکار',
      get: (row) => row.totDebtor,
      total: (t) => t.totDebtor,
    },
    {
      key: 'totCreditor',
      shortHeader: 'بستانکار',
      fullHeader: 'جمع بستانکار',
      get: (row) => row.totCreditor,
      total: (t) => t.totCreditor,
    },
  ],
};

const BALANCE: TrialBalanceColumnGroup = {
  key: 'balance',
  label: 'مانده',
  tone: 'secondary.dark',
  columns: [
    {
      key: 'debtorBalance',
      shortHeader: 'بدهکار',
      fullHeader: 'مانده بدهکار',
      get: (row) => row.debtorBalance,
      total: (t) => t.debtorBalance,
    },
    {
      key: 'creditorBalance',
      shortHeader: 'بستانکار',
      fullHeader: 'مانده بستانکار',
      get: (row) => row.creditorBalance,
      total: (t) => t.creditorBalance,
    },
  ],
};

/**
 * Group order follows the accounting reading order — where the account started, what moved, where
 * it ended — so the 6- and 8-column variants widen the middle rather than reshuffling the report.
 * The balance stays last in every variant, because it is the number people look for first.
 */
export function buildColumnGroups(variant: TrialBalanceVariant): TrialBalanceColumnGroup[] {
  const groups: TrialBalanceColumnGroup[] = [];

  if (variant >= 6) groups.push(OPENING);
  groups.push(PERIOD);
  if (variant >= 8) groups.push(CUMULATIVE);
  groups.push(BALANCE);

  return groups;
}

export function emptyTotals(): TrialBalanceTotals {
  return {
    debtor: 0,
    creditor: 0,
    debtorBalance: 0,
    creditorBalance: 0,
    firstDebtor: 0,
    firstCreditor: 0,
    totDebtor: 0,
    totCreditor: 0,
  };
}

export function sumTotals(rows: TrialBalanceRow[]): TrialBalanceTotals {
  return rows.reduce<TrialBalanceTotals>(
    (acc, row) => ({
      debtor: acc.debtor + row.debtor,
      creditor: acc.creditor + row.creditor,
      debtorBalance: acc.debtorBalance + row.debtorBalance,
      creditorBalance: acc.creditorBalance + row.creditorBalance,
      firstDebtor: acc.firstDebtor + (row.firstDebtor ?? 0),
      firstCreditor: acc.firstCreditor + (row.firstCreditor ?? 0),
      totDebtor: acc.totDebtor + (row.totDebtor ?? 0),
      totCreditor: acc.totCreditor + (row.totCreditor ?? 0),
    }),
    emptyTotals(),
  );
}
